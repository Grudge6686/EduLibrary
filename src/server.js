const express = require('express');
const path = require('path');
const config = require('./config');
const fileManager = require('./utils/fileManager');
const { router: notesRouter, handleUpload } = require('./routes/notes');
const systemRouter = require('./routes/system');

const app = express();

// Initialize content directories recursively on startup
fileManager.initContentDirectory();

// Cross-Origin Resource Sharing (CORS) for dev servers (e.g. VS Code Live Server on port 5500)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files (offline UI, styles, scripts, vendor dependencies)
app.use(express.static(config.PUBLIC_DIR));

// Direct upload route to match POST /api/upload exactly as specified
app.post('/api/upload', handleUpload);

// System routes: /api/health, /api/classes, /api/search, /api/backup
app.use('/api', systemRouter);

// Notes routes: /api/notes, /api/notes/:id, etc.
app.use('/api/notes', notesRouter);

// 404 handler for unknown API routes (Express 4 & 5 compatible)
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    }
  });
});

// SPA fallback for frontend navigation
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
  }
  next();
});

// Global error handler with standard JSON envelope
app.use((err, req, res, next) => {
  const status = err.status || (err.code === 'ACCESS_DENIED' ? 403 : 500);
  const code = err.code || 'INTERNAL_SERVER_ERROR';

  console.error(`[Error] ${code}: ${err.message}`, err.stack);

  res.status(status).json({
    success: false,
    error: {
      code,
      message: err.message || 'Internal server error occurred.'
    }
  });
});

// Start listening if run directly
if (require.main === module) {
  const server = app.listen(config.PORT, '0.0.0.0', () => {
    console.log(`====================================================`);
    console.log(`  EduLibrary CMS - Local Academic Markdown Platform`);
    console.log(`  Running at: http://localhost:${config.PORT}`);
    console.log(`  Target Root: ${config.ROOT_DIR}`);
    console.log(`  Content Dir: ${config.CONTENT_DIR}`);
    console.log(`  Node.js: ${process.version} | Mode: Production-ready`);
    console.log(`====================================================`);
  });

  server.on('error', (err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

module.exports = app;
