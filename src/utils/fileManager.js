const fs = require('fs');
const path = require('path');
const config = require('../config');
const { sanitizeFilename, extractTitleFromContent } = require('./sanitize');

/**
 * Initialize recursive folder topology for all classes and subjects
 */
function initContentDirectory() {
  if (!fs.existsSync(config.CONTENT_DIR)) {
    fs.mkdirSync(config.CONTENT_DIR, { recursive: true });
  }

  for (const cls of config.CLASSES) {
    for (const sub of config.SUBJECTS) {
      const dirPath = path.join(config.CONTENT_DIR, cls.id, sub.id);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    }
  }
}

/**
 * Resolve absolute path while strictly enforcing Zero Path Traversal
 * Throws an Error with code 'ACCESS_DENIED' or 'INVALID_PATH' if check fails.
 */
function resolveSafePath(relativePath) {
  if (!relativePath || typeof relativePath !== 'string') {
    const err = new Error('Invalid path provided');
    err.code = 'INVALID_PATH';
    err.status = 400;
    throw err;
  }

  // Prevent null bytes
  if (relativePath.includes('\0')) {
    const err = new Error('Path traversal attempt with null byte');
    err.code = 'ACCESS_DENIED';
    err.status = 403;
    throw err;
  }

  // Directly resolve relative path against CONTENT_DIR
  const absoluteTarget = path.resolve(config.CONTENT_DIR, relativePath);

  // Cross-platform case-insensitive traversal check
  const normalizedTarget = path.normalize(absoluteTarget).toLowerCase();
  const normalizedBase = path.normalize(config.CONTENT_DIR).toLowerCase();

  const isInside =
    normalizedTarget === normalizedBase ||
    normalizedTarget.startsWith(normalizedBase + path.sep);

  if (!isInside) {
    const err = new Error('Access denied: Path traversal detected');
    err.code = 'ACCESS_DENIED';
    err.status = 403;
    throw err;
  }

  // Calculate clean relative path using forward slashes
  const rel = path.relative(config.CONTENT_DIR, absoluteTarget).replace(/\\/g, '/');

  return {
    resolvedPath: absoluteTarget,
    relativePath: rel
  };
}

/**
 * Base64URL identifier encoder
 */
function encodeId(relativePath) {
  const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
  return Buffer.from(cleanRel, 'utf8').toString('base64url');
}

/**
 * Base64URL identifier decoder with path traversal guard
 */
function decodeId(id) {
  if (!id || typeof id !== 'string') {
    const err = new Error('Invalid note identifier');
    err.code = 'INVALID_ID';
    err.status = 400;
    throw err;
  }

  let decoded;
  try {
    decoded = Buffer.from(id, 'base64url').toString('utf8');
  } catch (e) {
    const err = new Error('Malformed base64url note identifier');
    err.code = 'MALFORMED_ID';
    err.status = 400;
    throw err;
  }

  return resolveSafePath(decoded);
}

/**
 * Find collision-free sequential filename if file exists
 * e.g., 'algebra.md' -> 'algebra (1).md' -> 'algebra (2).md'
 */
function getCollisionFreeFilename(directory, desiredFilename) {
  const ext = path.extname(desiredFilename);
  const base = path.basename(desiredFilename, ext);

  let candidate = desiredFilename;
  let counter = 1;

  while (fs.existsSync(path.join(directory, candidate))) {
    candidate = `${base} (${counter})${ext}`;
    counter++;
  }

  return candidate;
}

/**
 * Parse metadata for a specific markdown file
 */
function parseNoteMetadata(filePath, relativePath) {
  const stat = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const parts = relativePath.replace(/\\/g, '/').split('/');

  const classId = parts[0] || '';
  const subjectId = parts[1] || '';

  const classObj = config.CLASSES.find(c => c.id === classId);
  const subjectObj = config.SUBJECTS.find(s => s.id === subjectId);

  // Read first 2KB for title extraction
  let title = path.basename(filename, path.extname(filename));
  try {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(Math.min(stat.size, 2048));
    fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);
    const headContent = buffer.toString('utf8');
    title = extractTitleFromContent(headContent, filename);
  } catch {
    // fallback to filename
  }

  return {
    id: encodeId(relativePath),
    filename,
    title,
    class: classId,
    className: classObj ? classObj.name : classId,
    classBengaliName: classObj ? classObj.bengaliName : '',
    subject: subjectId,
    subjectName: subjectObj ? subjectObj.name : subjectId,
    subjectBengaliName: subjectObj ? subjectObj.bengaliName : '',
    relativePath: relativePath.replace(/\\/g, '/'),
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    birthtime: stat.birthtime.toISOString()
  };
}

/**
 * Recursively scan all markdown notes under content/
 */
function scanAllNotes(options = {}) {
  const { classFilter, subjectFilter, sort = 'mtime', order = 'desc' } = options;
  const notes = [];

  for (const cls of config.CLASSES) {
    if (classFilter && cls.id !== classFilter) continue;

    for (const sub of config.SUBJECTS) {
      if (subjectFilter && sub.id !== subjectFilter) continue;

      const subDir = path.join(config.CONTENT_DIR, cls.id, sub.id);
      if (!fs.existsSync(subDir)) continue;

      const entries = fs.readdirSync(subDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
          const filePath = path.join(subDir, entry.name);
          const relPath = `${cls.id}/${sub.id}/${entry.name}`;
          try {
            notes.push(parseNoteMetadata(filePath, relPath));
          } catch {
            // Ignore unreadable files
          }
        }
      }
    }
  }

  // Sorting
  notes.sort((a, b) => {
    let comparison = 0;
    if (sort === 'name') {
      comparison = a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' });
    } else if (sort === 'size') {
      comparison = a.size - b.size;
    } else {
      // default mtime
      comparison = new Date(a.mtime).getTime() - new Date(b.mtime).getTime();
    }
    return order === 'asc' ? comparison : -comparison;
  });

  return notes;
}

/**
 * Get note by ID with content
 */
function getNoteById(id) {
  const { resolvedPath, relativePath } = decodeId(id);

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error(`Note not found: ${relativePath}`);
    err.code = 'NOTE_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const metadata = parseNoteMetadata(resolvedPath, relativePath);
  const content = fs.readFileSync(resolvedPath, 'utf8');

  return {
    ...metadata,
    content
  };
}

/**
 * Create a new note file
 */
function createNote({ classSlug, subjectSlug, filename, content }) {
  if (!config.ALLOWED_CLASS_IDS.includes(classSlug)) {
    const err = new Error(`Invalid class: ${classSlug}. Must be one of: ${config.ALLOWED_CLASS_IDS.join(', ')}`);
    err.code = 'INVALID_CLASS';
    err.status = 400;
    throw err;
  }

  if (!config.ALLOWED_SUBJECT_IDS.includes(subjectSlug)) {
    const err = new Error(`Invalid subject: ${subjectSlug}. Must be one of: ${config.ALLOWED_SUBJECT_IDS.join(', ')}`);
    err.code = 'INVALID_SUBJECT';
    err.status = 400;
    throw err;
  }

  const targetDir = path.join(config.CONTENT_DIR, classSlug, subjectSlug);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const sanitized = sanitizeFilename(filename, 'untitled.md');
  const collisionFreeName = getCollisionFreeFilename(targetDir, sanitized);
  const filePath = path.join(targetDir, collisionFreeName);

  const cleanContent = typeof content === 'string' ? content : '';
  fs.writeFileSync(filePath, cleanContent, 'utf8');

  const relativePath = `${classSlug}/${subjectSlug}/${collisionFreeName}`;
  return parseNoteMetadata(filePath, relativePath);
}

/**
 * Update note content
 */
function updateNoteContent(id, content) {
  const { resolvedPath, relativePath } = decodeId(id);

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error(`Note not found: ${relativePath}`);
    err.code = 'NOTE_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const cleanContent = typeof content === 'string' ? content : '';
  fs.writeFileSync(resolvedPath, cleanContent, 'utf8');

  const metadata = parseNoteMetadata(resolvedPath, relativePath);
  return {
    ...metadata,
    content: cleanContent
  };
}

/**
 * Rename note
 */
function renameNote(id, newFilename) {
  const { resolvedPath, relativePath } = decodeId(id);

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error(`Note not found: ${relativePath}`);
    err.code = 'NOTE_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const dir = path.dirname(resolvedPath);
  const sanitized = sanitizeFilename(newFilename, path.basename(resolvedPath));
  const collisionFreeName = getCollisionFreeFilename(dir, sanitized);
  const targetPath = path.join(dir, collisionFreeName);

  if (resolvedPath !== targetPath) {
    fs.renameSync(resolvedPath, targetPath);
  }

  const relParts = relativePath.split('/');
  relParts[relParts.length - 1] = collisionFreeName;
  const newRelPath = relParts.join('/');

  return parseNoteMetadata(targetPath, newRelPath);
}

/**
 * Delete note
 */
function deleteNote(id) {
  const { resolvedPath, relativePath } = decodeId(id);

  if (!fs.existsSync(resolvedPath)) {
    const err = new Error(`Note not found: ${relativePath}`);
    err.code = 'NOTE_NOT_FOUND';
    err.status = 404;
    throw err;
  }

  fs.unlinkSync(resolvedPath);
  return { deleted: true, id, relativePath };
}

/**
 * Full-text search across all notes
 */
function searchNotes(searchTerm) {
  if (!searchTerm || typeof searchTerm !== 'string' || !searchTerm.trim()) {
    return [];
  }

  const term = searchTerm.trim().toLowerCase();
  const allNotes = scanAllNotes({ sort: 'mtime', order: 'desc' });
  const results = [];

  for (const note of allNotes) {
    const { resolvedPath } = decodeId(note.id);
    let content = '';
    try {
      content = fs.readFileSync(resolvedPath, 'utf8');
    } catch {
      continue;
    }

    const titleMatch = note.title.toLowerCase().includes(term);
    const filenameMatch = note.filename.toLowerCase().includes(term);
    const contentLower = content.toLowerCase();
    const contentIndex = contentLower.indexOf(term);

    if (titleMatch || filenameMatch || contentIndex !== -1) {
      // Generate preview snippet around the match
      let snippet = '';
      let matchLine = 1;

      if (contentIndex !== -1) {
        // Calculate line number
        const preMatch = content.slice(0, contentIndex);
        matchLine = (preMatch.match(/\n/g) || []).length + 1;

        const start = Math.max(0, contentIndex - 60);
        const end = Math.min(content.length, contentIndex + term.length + 80);
        let snippetText = content.slice(start, end).replace(/\r?\n/g, ' ');
        if (start > 0) snippetText = '...' + snippetText;
        if (end < content.length) snippetText = snippetText + '...';
        snippet = snippetText;
      } else {
        // If matched only in title/filename, show beginning of note
        snippet = content.slice(0, 140).replace(/\r?\n/g, ' ') + (content.length > 140 ? '...' : '');
      }

      results.push({
        ...note,
        snippet,
        matchLine,
        matchedIn: {
          title: titleMatch,
          filename: filenameMatch,
          content: contentIndex !== -1
        }
      });
    }
  }

  return results;
}

/**
 * Get structured class & subject hierarchy with note counts & stats
 */
function getClassStatistics() {
  const allNotes = scanAllNotes();
  let totalStorageBytes = 0;

  const hierarchy = config.CLASSES.map(cls => {
    let classNoteCount = 0;
    const subjects = config.SUBJECTS.map(sub => {
      const matching = allNotes.filter(n => n.class === cls.id && n.subject === sub.id);
      classNoteCount += matching.length;
      return {
        id: sub.id,
        name: sub.name,
        bengaliName: sub.bengaliName,
        noteCount: matching.length
      };
    });

    return {
      id: cls.id,
      name: cls.name,
      bengaliName: cls.bengaliName,
      numeric: cls.numeric,
      totalNotes: classNoteCount,
      subjects
    };
  });

  for (const n of allNotes) {
    totalStorageBytes += n.size;
  }

  return {
    classes: hierarchy,
    totalNotes: allNotes.length,
    totalStorageBytes,
    classCount: config.CLASSES.length,
    subjectCount: config.SUBJECTS.length
  };
}

module.exports = {
  initContentDirectory,
  resolveSafePath,
  encodeId,
  decodeId,
  getCollisionFreeFilename,
  scanAllNotes,
  getNoteById,
  createNote,
  updateNoteContent,
  renameNote,
  deleteNote,
  searchNotes,
  getClassStatistics
};
