// routes/documentoRoutes.js
const express = require('express');
const router = express.Router();
const documentoController = require('../controllers/documentoController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Crear carpeta uploads si no existe
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de Multer para almacenar PDFs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + '-' + file.originalname);
  }
});

function fileFilter(req, file, cb) {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten archivos PDF'), false);
  }
}

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB máximo
});

// ============================================================
// RUTAS - Sistema de Revisión de Documentos
// ============================================================

// POST /api/documentos/subir - Subir PDF (SOLICITANTE)
router.post('/subir', upload.single('pdf'), documentoController.subirDocumento);

// GET /api/documentos - Listar todos los documentos (REVISORES)
router.get('/', documentoController.listarDocumentos);

// POST /api/documentos/atendiendo/:id - Marcar como EN_REVISION (REVISOR)
router.post('/atendiendo/:id', documentoController.marcarAtendiendo);

// POST /api/documentos/revisar/:id - Aceptar o Rechazar (REVISOR)
router.post('/revisar/:id', documentoController.revisarDocumento);

// GET /api/documentos/descargar/:id - Descargar documento PDF
router.get('/descargar/:id', documentoController.descargarDocumento);

// GET /api/documentos/ver/:id - Ver documento PDF en el navegador
router.get('/ver/:id', documentoController.verDocumento);

// GET /api/documentos/estado-pool - Estado del pool (opcional)
router.get('/estado-pool', documentoController.estadoPool);

module.exports = router;