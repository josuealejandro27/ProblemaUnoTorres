// backend/routes/revisionPoolRoutes.js
const express = require('express');
const router = express.Router();
const revisionPoolManager = require('../singleton/revisionPoolManager');

// Middleware para log de requests
router.use((req, res, next) => {
  console.log(`🔐 Pool Request: ${req.method} ${req.originalUrl}`);
  next();
});

// POST /api/revision-pool/acquire - Adquirir pool
router.post('/acquire', (req, res) => {
  try {
    const { userId, userName, userType } = req.body;
    
    if (!userId || !userName) {
      return res.status(400).json({ 
        error: 'Se requiere userId y userName' 
      });
    }

    const result = revisionPoolManager.acquirePool(userId, userName, userType);
    res.json(result);
  } catch (error) {
    console.error('Error al adquirir pool:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/revision-pool/release - Liberar pool
router.post('/release', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'Se requiere userId' 
      });
    }

    const result = revisionPoolManager.releasePool(userId);
    res.json(result);
  } catch (error) {
    console.error('Error al liberar pool:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/revision-pool/status - Verificar estado del pool
router.get('/status', (req, res) => {
  try {
    const { userId } = req.query;
    const result = revisionPoolManager.checkPoolStatus(userId);
    res.json(result);
  } catch (error) {
    console.error('Error al verificar estado del pool:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/revision-pool/activity - Registrar actividad (extender sesión)
router.post('/activity', (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ 
        error: 'Se requiere userId' 
      });
    }

    const result = revisionPoolManager.registerActivity(userId);
    res.json(result);
  } catch (error) {
    console.error('Error al registrar actividad:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// POST /api/revision-pool/force-release - Forzar liberación (admin)
router.post('/force-release', (req, res) => {
  try {
    const { adminToken } = req.body;
    
    if (!adminToken) {
      return res.status(400).json({ 
        error: 'Se requiere adminToken' 
      });
    }

    const result = revisionPoolManager.forceReleasePool(adminToken);
    res.json(result);
  } catch (error) {
    console.error('Error al forzar liberación:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/revision-pool/stats - Estadísticas del pool
router.get('/stats', (req, res) => {
  try {
    const result = revisionPoolManager.getStats();
    res.json(result);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// GET /api/revision-pool/simple-status - Estado simple del pool
router.get('/simple-status', (req, res) => {
  try {
    const result = revisionPoolManager.getSimpleStatus();
    res.json(result);
  } catch (error) {
    console.error('Error al obtener estado simple:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});
module.exports = router;