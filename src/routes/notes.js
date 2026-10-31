const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { fixMulterEncoding, sanitizeFilename } = require('../utils/sanitize');
const fileManager = require('../utils/fileManager');

const router = express.Router();

// Multer in-memory storage for safe UTF-8 decoding and validation
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.MAX_FILE_SIZE_BYTES // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Multer originalname might be latin1 encoded, fix first
    const decodedName = fixMulterEncoding(file.originalname);
    const ext = path.extname(decodedName).toLowerCase();

    if (!config.ALLOWED_EXTENSIONS.includes(ext)) {
      const err = new Error('Invalid file type. Only Markdown files (.md, .markdown) are accepted.');
      err.code = 'INVALID_FILE_TYPE';
      err.status = 400;
      return cb(err);
    }
    cb(null, true);
  }
});

/**
 * GET /api/notes
 * Query notes by class, subject, sort (mtime, name, size), and order (asc, desc)
 */
router.get('/', (req, res, next) => {
  try {
    const { class: classFilter, subject: subjectFilter, sort = 'mtime', order = 'desc' } = req.query;

    if (classFilter && !config.ALLOWED_CLASS_IDS.includes(classFilter)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CLASS_FILTER',
          message: `Unknown class: ${classFilter}`
        }
      });
    }

    if (subjectFilter && !config.ALLOWED_SUBJECT_IDS.includes(subjectFilter)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SUBJECT_FILTER',
          message: `Unknown subject: ${subjectFilter}`
        }
      });
    }

    const notes = fileManager.scanAllNotes({
      classFilter,
      subjectFilter,
      sort,
      order
    });

    res.json({
      success: true,
      data: notes
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notes/:id
 * Retrieve single note metadata, stats, and raw markdown content
 */
router.get('/:id', (req, res, next) => {
  try {
    const note = fileManager.getNoteById(req.params.id);
    res.json({
      success: true,
      data: note
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notes
 * Create a new note directly from JSON body
 */
router.post('/', (req, res, next) => {
  try {
    const { class: classSlug, subject: subjectSlug, filename, content = '' } = req.body;

    if (!classSlug || !subjectSlug || !filename) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Fields "class", "subject", and "filename" are required.'
        }
      });
    }

    const note = fileManager.createNote({
      classSlug,
      subjectSlug,
      filename,
      content
    });

    res.status(201).json({
      success: true,
      data: note
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/upload (or mounted as /api/notes/upload)
 * Multipart form upload: file, class, subject
 */
const handleUpload = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_TOO_LARGE',
            message: 'File size exceeds maximum allowed limit of 10MB.'
          }
        });
      }
      return res.status(err.status || 400).json({
        success: false,
        error: {
          code: err.code || 'UPLOAD_ERROR',
          message: err.message
        }
      });
    }

    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_UPLOADED',
            message: 'No file provided in the "file" field.'
          }
        });
      }

      const classSlug = req.body.class;
      const subjectSlug = req.body.subject;

      if (!classSlug || !config.ALLOWED_CLASS_IDS.includes(classSlug)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CLASS',
            message: `Valid "class" field required (${config.ALLOWED_CLASS_IDS.join(', ')})`
          }
        });
      }

      if (!subjectSlug || !config.ALLOWED_SUBJECT_IDS.includes(subjectSlug)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_SUBJECT',
            message: `Valid "subject" field required (${config.ALLOWED_SUBJECT_IDS.join(', ')})`
          }
        });
      }

      // Fix Multer's default latin1 header encoding bug for UTF-8 and Bengali scripts
      const rawOriginal = fixMulterEncoding(req.file.originalname);
      const sanitized = sanitizeFilename(rawOriginal, 'uploaded-note.md');

      const targetDir = path.join(config.CONTENT_DIR, classSlug, subjectSlug);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const finalFilename = fileManager.getCollisionFreeFilename(targetDir, sanitized);
      const targetFilePath = path.join(targetDir, finalFilename);

      // Write buffered file content
      fs.writeFileSync(targetFilePath, req.file.buffer);

      const relPath = `${classSlug}/${subjectSlug}/${finalFilename}`;
      const note = fileManager.getNoteById(fileManager.encodeId(relPath));

      res.status(201).json({
        success: true,
        data: note
      });
    } catch (writeErr) {
      next(writeErr);
    }
  });
};

router.post('/upload', handleUpload);

/**
 * PUT /api/notes/:id
 * Update file content safely
 */
router.put('/:id', (req, res, next) => {
  try {
    const { content } = req.body;
    if (typeof content !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Field "content" must be a string.'
        }
      });
    }

    const updatedNote = fileManager.updateNoteContent(req.params.id, content);
    res.json({
      success: true,
      data: updatedNote
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notes/:id/rename
 * Rename note
 */
router.patch('/:id/rename', (req, res, next) => {
  try {
    const { newFilename } = req.body;
    if (!newFilename || typeof newFilename !== 'string' || !newFilename.trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILENAME',
          message: 'Valid "newFilename" string is required.'
        }
      });
    }

    const renamedNote = fileManager.renameNote(req.params.id, newFilename);
    res.json({
      success: true,
      data: renamedNote
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notes/:id
 * Permanently delete note
 */
router.delete('/:id', (req, res, next) => {
  try {
    const result = fileManager.deleteNote(req.params.id);
    res.json({
      success: true,
      data: {
        message: 'Note deleted successfully',
        id: result.id,
        relativePath: result.relativePath
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = {
  router,
  handleUpload
};
