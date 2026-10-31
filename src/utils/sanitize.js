const path = require('path');

const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
]);

/**
 * Fix Multer's default latin1 header encoding bug for UTF-8 filenames
 * Handles characters like Bengali Unicode (\u0980-\u09FF)
 */
function fixMulterEncoding(filename) {
  if (!filename || typeof filename !== 'string') return '';
  try {
    const converted = Buffer.from(filename, 'latin1').toString('utf8');
    // If the converted string contains valid UTF-8 representation without broken sequences
    return converted;
  } catch (err) {
    return filename;
  }
}

/**
 * Sanitize filename preserving Bengali script (\u0980-\u09FF), English alphanumerics,
 * dashes, underscores, spaces, and periods while stripping illegal Windows characters
 * (\ / : * ? " < > |) and control chars (\x00-\x1f).
 */
function sanitizeFilename(filename, defaultName = 'untitled.md') {
  if (!filename || typeof filename !== 'string') {
    return defaultName;
  }

  // 1. Normalize Unicode (NFC)
  let clean = filename.normalize('NFC').trim();

  // 2. Remove null bytes and control characters
  clean = clean.replace(/[\x00-\x1f\x7f]/g, '');

  // 3. Strip Windows illegal filesystem characters: \ / : * ? " < > |
  clean = clean.replace(/[\\/:*?"<>|]/g, '');

  // 4. Ensure it has .md extension
  let ext = path.extname(clean);
  let base = path.basename(clean, ext);

  // If extension is not .md or .markdown, keep whole clean as base and append .md
  if (ext.toLowerCase() !== '.md' && ext.toLowerCase() !== '.markdown') {
    base = clean;
    ext = '.md';
  } else {
    ext = '.md'; // normalize to .md
  }

  // 5. Trim trailing dots and spaces from the base name (Windows constraint)
  base = base.replace(/[.\s]+$/g, '').trim();

  // 6. Check for reserved Windows filenames (e.g. CON, PRN, AUX, etc.)
  if (WINDOWS_RESERVED_NAMES.has(base.toUpperCase())) {
    base = `${base}_note`;
  }

  // 7. If base is empty or purely whitespace, fallback to default
  if (!base || base.length === 0) {
    return defaultName;
  }

  // 8. Limit length to 120 characters for Windows filesystem safety
  if (base.length > 120) {
    base = base.slice(0, 120).trim();
  }

  return `${base}${ext}`;
}

/**
 * Extract clean display title from Markdown content or filename
 */
function extractTitleFromContent(content, fallbackFilename) {
  if (content && typeof content === 'string') {
    // Check for first markdown heading (# Title)
    const match = content.match(/^#\s+(.+)$/m);
    if (match && match[1]) {
      const heading = match[1].trim();
      if (heading) return heading;
    }
  }
  // Fallback to filename without extension
  return path.basename(fallbackFilename || 'Untitled', path.extname(fallbackFilename || ''));
}

module.exports = {
  fixMulterEncoding,
  sanitizeFilename,
  extractTitleFromContent
};
