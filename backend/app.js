// app.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const documentoRoutes = require('./routes/documentoRoutes');
const poolSingleton = require('./singleton/documentPoolSingleton');
const revisionPoolRoutes = require('./routes/revisionPoolRoutes');

const app = express();

// MIDDLEWARES


// CORS - Permitir peticiones desde Angular
app.use(cors({
  origin: 'http://localhost:4200', 
  credentials: true
}));

// Parsear JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Log de peticiones
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// RUTAS

app.use('/api/documentos', documentoRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ 
    message: 'API de Sistema de Revisión de Documentos',
    singleton: 'Pool único inicializado'
  });
});

// MANEJO DE ERRORES

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: err.message || 'Error interno del servidor' 
  });
});

app.use('/api/revision-pool', revisionPoolRoutes);

console.log('📦 Rutas de Revision Pool registradas');

const revisorRoutes = require('./routes/revisorRoutes');
app.use('/api/revisores', revisorRoutes);

// INICIAR SERVIDOR

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log('='.repeat(60));
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log('='.repeat(60));
  
  try {
    // Cargar el Singleton al inicio (PATRÓN SINGLETON)
    await poolSingleton.cargarDesdeDB();
    console.log('✅ DocumentPool Singleton inicializado');
    console.log('📋 Documentos en memoria:', poolSingleton.obtenerLista().length);
    console.log('='.repeat(60));
  } catch (err) {
    console.error('❌ Error cargando pool:', err);
  }
});

module.exports = app;