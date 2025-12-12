// models/documentoModel.js
const db = require('../config/db');

// Insertar nuevo documento
async function insertarDocumento({ nombreArchivo, rutaArchivo, solicitanteEmail }) {
  const [result] = await db.execute(
    `INSERT INTO documentos (nombre, ruta, solicitante_email, estado) 
     VALUES (?, ?, ?, 'PENDIENTE')`,
    [nombreArchivo, rutaArchivo, solicitanteEmail]
  );
  return result.insertId;
}

// Obtener todos los documentos
async function obtenerTodos() {
  const [rows] = await db.execute(
    `SELECT 
      id,
      nombre as nombreArchivo,
      ruta as rutaArchivo,
      estado,
      reviewer as atendidoPor,
      fecha_subido as fechaSubido,
      solicitante_email as solicitanteEmail
     FROM documentos 
     ORDER BY fecha_subido DESC`
  );
  return rows;
}

// Obtener documento por ID
async function obtenerPorId(id) {
  const [rows] = await db.execute(
    `SELECT 
      id,
      nombre as nombreArchivo,
      ruta as rutaArchivo,
      estado,
      reviewer as atendidoPor,
      fecha_subido as fechaSubido,
      solicitante_email as solicitanteEmail
     FROM documentos 
     WHERE id = ?`,
    [id]
  );
  return rows[0];
}

// Actualizar estado y revisor asignado
async function actualizarEstadoYAtendido(id, estado, atendidoPor) {
  await db.execute(
    `UPDATE documentos 
     SET estado = ?, reviewer = ? 
     WHERE id = ?`,
    [estado, atendidoPor, id]
  );
  
  // Registrar en historial
  await db.execute(
    `INSERT INTO documento_historial (documento_id, reviewer, accion) 
     VALUES (?, ?, ?)`,
    [id, atendidoPor, estado === 'Aceptado' ? 'ACEPTADO' : 'RECHAZADO']
  );
}

// Marcar como "EN_REVISION" y asignar revisor
async function marcarAtendiendo(id, atendidoPor) {
  await db.execute(
    `UPDATE documentos 
     SET estado = 'EN_REVISION', reviewer = ? 
     WHERE id = ?`,
    [atendidoPor, id]
  );
  
  // Registrar en historial
  await db.execute(
    `INSERT INTO documento_historial (documento_id, reviewer, accion) 
     VALUES (?, ?, 'TOMADO')`,
    [id, atendidoPor]
  );
}

module.exports = {
  insertarDocumento,
  obtenerTodos,
  obtenerPorId,
  actualizarEstadoYAtendido,
  marcarAtendiendo
};