const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONTENT_DIR = path.resolve(ROOT_DIR, 'content');
const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');

const CLASSES = [
  { id: 'class-5', name: 'Class 5', bengaliName: 'পঞ্চম শ্রেণি', numeric: 5 },
  { id: 'class-6', name: 'Class 6', bengaliName: 'ষষ্ঠ শ্রেণি', numeric: 6 },
  { id: 'class-7', name: 'Class 7', bengaliName: 'সপ্তম শ্রেণি', numeric: 7 },
  { id: 'class-8', name: 'Class 8', bengaliName: 'অষ্টম শ্রেণি', numeric: 8 },
  { id: 'class-9', name: 'Class 9', bengaliName: 'নবম শ্রেণি', numeric: 9 },
  { id: 'class-10', name: 'Class 10', bengaliName: 'দশম শ্রেণি', numeric: 10 }
];

const SUBJECTS = [
  { id: 'mathematics', name: 'Mathematics', bengaliName: 'গণিত' },
  { id: 'physical-science', name: 'Physical Science', bengaliName: 'ভৌত বিজ্ঞান' }
];

const ALLOWED_CLASS_IDS = CLASSES.map(c => c.id);
const ALLOWED_SUBJECT_IDS = SUBJECTS.map(s => s.id);

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || 'localhost',
  ROOT_DIR,
  CONTENT_DIR,
  PUBLIC_DIR,
  CLASSES,
  SUBJECTS,
  ALLOWED_CLASS_IDS,
  ALLOWED_SUBJECT_IDS,
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
  ALLOWED_EXTENSIONS: ['.md', '.markdown'],
  ALLOWED_MIME_TYPES: [
    'text/markdown',
    'text/x-markdown',
    'text/plain',
    'application/octet-stream'
  ]
};
