// backend/routes/revisorRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../config/db');

// GET /api/revisores - Obtener todos los revisores
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, nombre, email FROM revisores ORDER BY nombre'
    );
    res.json(rows);
  } catch (error) {
    console.error('Error al obtener revisores:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/revisores/:id - Obtener revisor por ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await db.execute(
      'SELECT id, nombre, email FROM revisores WHERE id = ?',
      [id]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Revisor no encontrado' });
    }
    
    res.json(rows[0]);
  } catch (error) {
    console.error('Error al obtener revisor:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;