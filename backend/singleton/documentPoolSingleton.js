// backend/services/documentPoolSingleton.js - VERSIÓN CORREGIDA
const documentoModel = require('../models/documentoModel');

class DocumentPool {
  constructor() {
    if (DocumentPool._instance) return DocumentPool._instance;
    
    this.lista = []; // cache en memoria
    this.lastLoaded = null;
    
    // Cargar inicialmente desde la base de datos
    this.cargarDesdeDB();
    
    DocumentPool._instance = this;
  }

  static getInstance() {
    if (!DocumentPool._instance) {
      DocumentPool._instance = new DocumentPool();
    }
    return DocumentPool._instance;
  }

  // Cargar desde la BD
  async cargarDesdeDB() {
    try {
      this.lista = await documentoModel.obtenerTodos();
      this.lastLoaded = new Date();
      console.log(`📊 DocumentPool recargado desde BD: ${this.lista.length} documentos`);
    } catch (error) {
      console.error('Error al cargar documentos desde BD:', error);
    }
    return this.lista;
  }

  obtenerLista() {
    return this.lista;
  }

  // Marca que un revisor está atendiendo el doc
  async marcarAtendiendo(id, nombreRevisor) {
    try {
      // Actualizar en la base de datos
      await documentoModel.marcarAtendiendo(id, nombreRevisor);
      
      // Actualizar en cache
      const doc = this.lista.find(d => d.id === Number(id));
      if (doc) {
        doc.atendidoPor = nombreRevisor;
        doc.reviewer = nombreRevisor;
        doc.estado = 'EN_REVISION';
      }
      
      // Recargar para asegurar consistencia
      await this.cargarDesdeDB();
      return true;
    } catch (error) {
      console.error('Error en marcarAtendiendo:', error);
      throw error;
    }
  }

  // Aceptar/rechazar (actualiza DB y cache)
  async revisarDocumento(id, estado, nombreRevisor, motivo = null) {
    try {
      // Asegurarse de que el estado esté en el formato correcto para la base de datos
      const estadoBD = estado === 'Aceptado' ? 'ACEPTADO' : 'RECHAZADO';
      
      // Actualizar en la base de datos
      await documentoModel.actualizarEstadoYAtendido(id, estadoBD, nombreRevisor, motivo);
      
      // Actualizar en cache
      const doc = this.lista.find(d => d.id === Number(id));
      if (doc) {
        doc.estado = estadoBD;
        doc.atendidoPor = nombreRevisor;
        doc.reviewer = nombreRevisor;
      }
      
      // Recargar para asegurar consistencia
      await this.cargarDesdeDB();
      return true;
    } catch (error) {
      console.error('Error en revisarDocumento:', error);
      throw error;
    }
  }

  // Cuando se sube un documento nuevo, recarga para que pool tenga lo último
  async recargarDespuesDeSubida() {
    return this.cargarDesdeDB();
  }

  // Método auxiliar para debugging
  getInfo() {
    return {
      total: this.lista.length,
      lastLoaded: this.lastLoaded,
      estados: {
        PENDIENTE: this.lista.filter(d => d.estado === 'PENDIENTE').length,
        EN_REVISION: this.lista.filter(d => d.estado === 'EN_REVISION').length,
        ACEPTADO: this.lista.filter(d => d.estado === 'ACEPTADO').length,
        RECHAZADO: this.lista.filter(d => d.estado === 'RECHAZADO').length
      }
    };
  }
}

module.exports = DocumentPool.getInstance();