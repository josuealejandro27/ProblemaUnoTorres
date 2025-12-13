// controllers/documentoController.js
const poolSingleton = require('../singleton/documentPoolSingleton');
const documentoModel = require('../models/documentoModel');
const { enviarCorreo } = require('../config/mailer');
const fs = require('fs');
const path = require('path');

const controller = {};

// Subir documento (SOLICITANTE)
controller.subirDocumento = async (req, res) => {
  try {
    console.log('📥 Subiendo documento...');
    console.log('File:', req.file);
    console.log('Body:', req.body);

    if (!req.file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo PDF' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'El email es obligatorio' });
    }

    // Insertar en BD
    const docId = await documentoModel.insertarDocumento({
      nombreArchivo: req.file.originalname,
      rutaArchivo: req.file.path,
      solicitanteEmail: email
    });

    console.log('✅ Documento insertado con ID:', docId);

    // Recargar el pool singleton - CON VALIDACIÓN
    try {
      if (poolSingleton && typeof poolSingleton.recargarDespuesDeSubida === 'function') {
        await poolSingleton.recargarDespuesDeSubida();
        console.log('✅ Pool recargado');
      } else {
        console.warn('⚠️ poolSingleton.recargarDespuesDeSubida no existe');
      }
    } catch (poolError) {
      console.error('⚠️ Error al recargar pool (no crítico):', poolError);
      // No lanzamos error, el documento ya se guardó
    }

    res.status(201).json({ 
      id: docId, 
      message: 'Documento subido exitosamente',
      filename: req.file.originalname 
    });

  } catch (error) {
    console.error('❌ Error al subir documento:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: 'Error al subir el documento',
      message: error.message 
    });
  }
};

// Listar todos los documentos (REVISORES)
controller.listarDocumentos = async (req, res) => {
  try {
    let lista = [];
    
    // Intentar obtener del singleton
    if (poolSingleton && typeof poolSingleton.obtenerLista === 'function') {
      lista = poolSingleton.obtenerLista();
    } else {
      // Fallback: consultar BD directamente
      lista = await documentoModel.obtenerTodos();
    }
    
    res.json(lista);
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

// Marcar documento como "EN_REVISION"
controller.marcarAtendiendo = async (req, res) => {
  try {
    const { id } = req.params;
    const { revisor } = req.body;

    if (!revisor) {
      return res.status(400).json({ error: 'El nombre del revisor es obligatorio' });
    }

    // Actualizar directamente en BD usando el modelo
    await documentoModel.marcarAtendiendo(id, revisor);

    // Actualizar singleton si existe
    if (poolSingleton && typeof poolSingleton.marcarAtendiendo === 'function') {
      try {
        await poolSingleton.marcarAtendiendo(id, revisor);
      } catch (poolError) {
        console.warn('⚠️ Error al actualizar pool:', poolError);
      }
    }

    res.json({ 
      message: `Documento tomado por ${revisor}`,
      id: Number(id),
      revisor 
    });
  } catch (error) {
    console.error('Error al marcar atendiendo:', error);
    res.status(500).json({ error: 'Error al marcar documento' });
  }
};

// Revisar documento: ACEPTADO o RECHAZADO
controller.revisarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, revisor, motivo } = req.body;

    if (!estado || !revisor) {
      return res.status(400).json({ error: 'Estado y revisor son obligatorios' });
    }

    if (estado !== 'Aceptado' && estado !== 'Rechazado') {
      return res.status(400).json({ error: 'Estado debe ser "Aceptado" o "Rechazado"' });
    }

    if (estado === 'Rechazado' && !motivo) {
      return res.status(400).json({ error: 'El motivo del rechazo es obligatorio' });
    }

    // Actualizar directamente en BD usando el modelo
    await documentoModel.actualizarEstadoYAtendido(id, estado, revisor);

    // Actualizar singleton si existe
    if (poolSingleton && typeof poolSingleton.revisarDocumento === 'function') {
      try {
        await poolSingleton.revisarDocumento(id, estado, revisor);
      } catch (poolError) {
        console.warn('⚠️ Error al actualizar pool:', poolError);
      }
    }

    // Obtener datos del documento para enviar correo
    const documento = await documentoModel.obtenerPorId(id);
    
    if (documento && documento.solicitanteEmail) {
      try {
        const subject = `Documento ${estado}: ${documento.nombreArchivo}`;
        let text = `Su documento "${documento.nombreArchivo}" ha sido ${estado} por ${revisor}.`;
        let html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
            <h2 style="color: ${estado === 'Aceptado' ? '#27ae60' : '#e74c3c'};">
              ${estado === 'Aceptado' ? '✅' : '❌'} Documento ${estado}
            </h2>
            <p style="font-size: 16px;">Su documento <strong>"${documento.nombreArchivo}"</strong> ha sido <strong>${estado}</strong>.</p>
        `;
        
        if (estado === 'Rechazado' && motivo) {
          text += `\n\nMotivo del rechazo: ${motivo}`;
          html += `
            <div style="background-color: #fef5f5; padding: 15px; border-left: 4px solid #e74c3c; margin: 20px 0;">
              <h3 style="color: #e74c3c; margin-top: 0;">Motivo del Rechazo:</h3>
              <p style="margin: 0;">${motivo}</p>
            </div>
          `;
        }
        
        html += `
            <p style="margin-top: 20px;"><em>Revisado por: ${revisor}</em></p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #7f8c8d;">Sistema de Revisión de Documentos.</p>
          </div>
        `;
        
        await enviarCorreo(documento.solicitanteEmail, subject, text, html);
      } catch (mailError) {
        console.error('Error al enviar correo:', mailError);
      }
    }

    res.json({ 
      message: `Documento ${estado}`,
      id: Number(id),
      estado,
      revisor 
    });
  } catch (error) {
    console.error('Error al revisar documento:', error);
    res.status(500).json({ error: 'Error al revisar documento' });
  }
};

// Descargar documento PDF
controller.descargarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const documento = await documentoModel.obtenerPorId(id);
    
    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    if (!fs.existsSync(documento.rutaArchivo)) {
      return res.status(404).json({ error: 'El archivo físico no existe' });
    }

    res.download(documento.rutaArchivo, documento.nombreArchivo);
  } catch (error) {
    console.error('Error al descargar documento:', error);
    res.status(500).json({ error: 'Error al descargar el documento' });
  }
};

// Ver documento PDF en el navegador
controller.verDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const documento = await documentoModel.obtenerPorId(id);
    
    if (!documento || !fs.existsSync(documento.rutaArchivo)) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${documento.nombreArchivo}"`);
    
    fs.createReadStream(documento.rutaArchivo).pipe(res);
  } catch (error) {
    console.error('Error al visualizar documento:', error);
    res.status(500).json({ error: 'Error al visualizar el documento' });
  }
};

// Estado del pool
controller.estadoPool = async (req, res) => {
  try {
    const info = poolSingleton.getInfo ? poolSingleton.getInfo() : {};
    const lista = poolSingleton.obtenerLista ? poolSingleton.obtenerLista() : await documentoModel.obtenerTodos();
    
    res.json({
      ...info,
      documentos: lista
    });
  } catch (error) {
    console.error('Error al obtener estado del pool:', error);
    res.status(500).json({ error: 'Error al obtener estado del pool' });
  }
};

module.exports = controller;