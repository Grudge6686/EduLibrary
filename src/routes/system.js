const express = require('express');
const archiverPkg = require('archiver');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const fileManager = require('../utils/fileManager');

const router = express.Router();

function createZipArchive(options) {
  if (archiverPkg.ZipArchive) {
    return new archiverPkg.ZipArchive(options);
  }
  return archiverPkg('zip', options);
}

/**
 * GET /api/health
 * Server status, uptime, node version, and system stats
 */
router.get('/health', (req, res) => {
  const stats = fileManager.getClassStatistics();
  res.json({
    success: true,
    data: {
      status: 'healthy',
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      timestamp: new Date().toISOString(),
      contentDirectory: config.CONTENT_DIR,
      totalNotes: stats.totalNotes,
      totalStorageBytes: stats.totalStorageBytes
    }
  });
});

/**
 * GET /api/classes
 * Returns list of classes (5–10), subjects, and note counts
 */
router.get('/classes', (req, res, next) => {
  try {
    const stats = fileManager.getClassStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/search
 * Full-text scan across filename and Markdown content
 */
router.get('/search', (req, res, next) => {
  try {
    const query = req.query.q || '';
    if (!query.trim()) {
      return res.json({
        success: true,
        data: []
      });
    }

    const matches = fileManager.searchNotes(query);
    res.json({
      success: true,
      data: matches
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/backup
 * Streams a complete .zip archive of the content/ tree directly into the response
 */
router.get('/backup', (req, res, next) => {
  try {
    // Ensure content directory exists
    fileManager.initContentDirectory();

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const zipFilename = `edulibrary-backup-${dateStamp}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFilename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    const archive = createZipArchive({
      zlib: { level: 9 }, // Maximum compression
      comment: 'EduLibrary Content Backup'
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Backup warning:', err);
      } else {
        throw err;
      }
    });

    archive.on('error', (err) => {
      console.error('Backup archive error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: {
            code: 'BACKUP_FAILED',
            message: 'Failed to create backup archive.'
          }
        });
      } else {
        res.end();
      }
    });

    // Pipe archive data directly to HTTP response stream
    archive.pipe(res);

    // Append all contents of content/ directory into root of zip
    archive.directory(config.CONTENT_DIR, 'content');

    // Finalize the archive stream
    archive.finalize();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
