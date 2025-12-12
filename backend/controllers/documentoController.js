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

    // Recargar el pool singleton con los nuevos datos
    await poolSingleton.recargarDespuesDeSubida();

    res.json({ 
      id: docId, 
      message: 'Documento subido exitosamente',
      nombreArchivo: req.file.originalname 
    });
  } catch (error) {
    console.error('Error al subir documento:', error);
    res.status(500).json({ error: 'Error al subir el documento' });
  }
};

// Listar todos los documentos (REVISORES)
controller.listarDocumentos = async (req, res) => {
  try {
    // Obtener lista del Singleton (ya sincronizada automáticamente)
    const lista = poolSingleton.obtenerLista();
    
    // Para debugging: mostrar información del pool
    console.log('📋 Listando documentos desde pool:', poolSingleton.getInfo());
    
    res.json(lista);
  } catch (error) {
    console.error('Error al listar documentos:', error);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
};

// Marcar documento como "EN_REVISION" (REVISOR toma el documento)
controller.marcarAtendiendo = async (req, res) => {
  try {
    const { id } = req.params;
    const { revisor } = req.body;

    if (!revisor) {
      return res.status(400).json({ error: 'El nombre del revisor es obligatorio' });
    }

    // Actualizar en el Singleton (que actualiza BD y cache)
    await poolSingleton.marcarAtendiendo(id, revisor);

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

// Revisar documento: ACEPTADO o RECHAZADO (REVISOR finaliza revisión)
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

    // Validar motivo si es rechazo
    if (estado === 'Rechazado' && !motivo) {
      return res.status(400).json({ error: 'El motivo del rechazo es obligatorio' });
    }

    // Actualizar en el Singleton (que actualiza BD y cache)
    await poolSingleton.revisarDocumento(id, estado, revisor);

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
            <p style="font-size: 12px; color: #7f8c8d;">Este es un mensaje automático del Sistema de Revisión de Documentos.</p>
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
    
    // Obtener documento de la base de datos
    const documento = await documentoModel.obtenerPorId(id);
    
    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const rutaArchivo = documento.rutaArchivo;
    const nombreArchivo = documento.nombreArchivo || 'documento.pdf';
    
    if (!rutaArchivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    // Verificar si el archivo existe
    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: 'El archivo físico no existe en el servidor' });
    }

    // Enviar el archivo
    res.download(rutaArchivo, nombreArchivo, (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error al descargar el archivo' });
        }
      }
    });
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
    
    if (!documento) {
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    const rutaArchivo = documento.rutaArchivo;
    
    if (!rutaArchivo) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    if (!fs.existsSync(rutaArchivo)) {
      return res.status(404).json({ error: 'El archivo físico no existe' });
    }

    // Enviar como PDF para visualización en el navegador
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${documento.nombreArchivo}"`);
    
    const fileStream = fs.createReadStream(rutaArchivo);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error al visualizar documento:', error);
    res.status(500).json({ error: 'Error al visualizar el documento' });
  }
};

// Estado del pool (opcional)
controller.estadoPool = async (req, res) => {
  try {
    const info = poolSingleton.getInfo ? poolSingleton.getInfo() : { message: "Pool no tiene método getInfo" };
    res.json({
      ...info,
      documentos: poolSingleton.obtenerLista ? poolSingleton.obtenerLista() : []
    });
  } catch (error) {
    console.error('Error al obtener estado del pool:', error);
    res.status(500).json({ error: 'Error al obtener estado del pool' });
  }
};

module.exports = controller;