# EduLibrary — Local Educational Markdown CMS

A high-performance, zero-dependency, local-first academic Markdown Content Management System (CMS) designed for curriculum notes management across Classes 5 to 10 in Mathematics and Physical Science, featuring first-class bilingual support for English and Bengali (`\u0980-\u09FF`) scripts.

---

## 1. System Overview & Key Features

* **Offline Guarantee (Zero External CDN):** All parsing (`marked.min.js`), sanitization (`purify.min.js`), fonts, and UI icons run 100% locally from `public/vendor/`.
* **Zero Path Traversal Guarantee:** Strict canonical path resolution asserting `resolvedPath.startsWith(CONTENT_DIR)` and rejecting null bytes or traversal attempts with HTTP 403 / 400.
* **Deterministic Safe Identifiers:** Base64URL-encoded relative paths (e.g., `class-8/mathematics/algebra.md` &rarr; `Y2xhc3MtOC9tYXRoZW1hdGljcy9hbGdlYnJhLm1k`).
* **Bengali & UTF-8 Integrity:** Fixes Multer's default latin1 encoding bug and strips Windows reserved filesystem characters while preserving Bengali Unicode ranges (`\u0980-\u09FF`).
* **Collision Avoidance:** Automatically renames conflicting uploads and notes sequentially (e.g., `formula (1).md`).
* **Academic Minimalism UI:** Clean dual-theme (Light & Dark) interface with an academic typography scale, live split-mode editor, character/word counters, copyable code blocks, responsive tables, callout notes, and a print stylesheet (`@media print`).
* **Live Streaming Backup:** Exports full `.zip` archives of the `content/` tree directly into the HTTP response stream.

---

## 2. Directory Topology

```text
D:\EduLibrary\
├── package.json
├── README.md
├── src/
│   ├── server.js              # Express app bootstrap & route registration
│   ├── config.js              # Ports, paths, allowed mime-types, class mappings
│   ├── routes/
│   │   ├── notes.js           # CRUD, rename, upload endpoints
│   │   └── system.js          # Health, backup ZIP export, stats
│   └── utils/
│       ├── fileManager.js     # Path resolution, traversal guards, disk scan
│       └── sanitize.js        # Safe filename & UTF-8 normalization
├── public/
│   ├── index.html             # Single-page responsive academic shell
│   ├── css/
│   │   └── style.css          # Design system, themes, academic typography
│   ├── js/
│   │   ├── app.js             # UI router, event bindings, state store
│   │   ├── api.js             # Fetch abstraction for /api endpoints
│   │   └── markdown.js        # Markdown rendering pipeline
│   └── vendor/
│       ├── marked.min.js      # Bundled offline parser
│       └── purify.min.js      # Bundled offline sanitizer
└── content/
    ├── class-5/
    │   ├── mathematics/
    │   └── physical-science/
    ├── class-6/
    │   ├── mathematics/
    │   └── physical-science/
    ├── class-7/
    │   ├── mathematics/
    │   └── physical-science/
    ├── class-8/
    │   ├── mathematics/
    │   └── physical-science/
    ├── class-9/
    │   ├── mathematics/
    │   └── physical-science/
    └── class-10/
        ├── mathematics/
        └── physical-science/
```

*Note: Missing class and subject directories inside `content/` are automatically initialized recursively when the server starts.*

---

## 3. Getting Started & Running on Windows 11

### Prerequisites
* Windows 11 with Node.js `v24.x` and npm `11.x`

### Installation
Dependencies are already installed. If running in a new clone:
```powershell
npm install
```

### Start Server in Production Mode
```powershell
npm start
```

### Start Server in Live-Reload Development Mode
```powershell
npm run dev
```

Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 4. REST API Specification

All responses adhere to standard JSON envelopes:
* **Success:** `{ "success": true, "data": ... }`
* **Error:** `{ "success": false, "error": { "code": "STRING_CODE", "message": "Details" } }`

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Returns server health, uptime, platform, note count, and memory/storage metrics. |
| `GET` | `/api/classes` | Returns classes (5–10), subjects (Mathematics, Physical Science), and note counts. |
| `GET` | `/api/notes` | Queries notes with optional `?class=class-8&subject=mathematics&sort=mtime&order=desc`. |
| `GET` | `/api/notes/:id` | Returns metadata, raw markdown content, and file stats by Base64URL ID. |
| `POST` | `/api/notes` | Creates note via JSON body: `{ "class": "...", "subject": "...", "filename": "...", "content": "..." }`. |
| `POST` | `/api/upload` | Multipart form (`file`, `class`, `subject`). Max 10MB. Validates `.md`. |
| `PUT` | `/api/notes/:id` | Body: `{ "content": "..." }`. Safely updates note content. |
| `PATCH` | `/api/notes/:id/rename`| Body: `{ "newFilename": "..." }`. Renames note with collision handling. |
| `DELETE` | `/api/notes/:id` | Permanently deletes note with path validation. |
| `GET` | `/api/search` | `?q=term`. Full-text scan across note titles, filenames, and markdown bodies. |
| `GET` | `/api/backup` | Streams a complete `.zip` archive of the `content/` tree directly to the client. |

---

## 5. Verification Commands (Windows PowerShell)

You can run automated end-to-end tests or manual `Invoke-RestMethod` queries:

### Automated Test Suite (16 Automated Assertions)
```powershell
npm test
```

### Manual Testing with PowerShell `Invoke-RestMethod`

#### 1. System Health Check
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/health" | ConvertTo-Json -Depth 4
```

#### 2. Query Classes Hierarchy & Note Counts
```powershell
Invoke-RestMethod -Uri "http://localhost:3000/api/classes" | ConvertTo-Json -Depth 4
```

#### 3. Search for Notes (English or Bengali)
```powershell
# Search in English
Invoke-RestMethod -Uri "http://localhost:3000/api/search?q=algebra" | ConvertTo-Json -Depth 4

# Search in Bengali
$encodedQuery = [System.Uri]::EscapeDataString("নিউটনের")
Invoke-RestMethod -Uri "http://localhost:3000/api/search?q=$encodedQuery" | ConvertTo-Json -Depth 4
```

#### 4. Create Note via JSON API
```powershell
$body = @{
    class = "class-8"
    subject = "mathematics"
    filename = "বীজগণিত_অনুশীলন.md"
    content = "# বীজগণিত অনুশীলন`n`n(a + b)² = a² + 2ab + b²"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3000/api/notes" -Method Post -ContentType "application/json; charset=utf-8" -Body $body | ConvertTo-Json
```

#### 5. Download Content Backup ZIP
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/backup" -OutFile "edulibrary-backup.zip"
Get-Item "edulibrary-backup.zip"
```
