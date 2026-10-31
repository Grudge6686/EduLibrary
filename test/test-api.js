const assert = require('assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const app = require('../src/server');
const config = require('../src/config');
const fileManager = require('../src/utils/fileManager');
const { sanitizeFilename, fixMulterEncoding } = require('../src/utils/sanitize');

async function runTests() {
  console.log('--- Starting EduLibrary Verification Test Suite ---');

  // Cleanup helper
  const cleanupTestFiles = () => {
    const targets = [
      path.join(config.CONTENT_DIR, 'class-7', 'mathematics'),
      path.join(config.CONTENT_DIR, 'class-8', 'mathematics')
    ];
    for (const dir of targets) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.startsWith('পরিমাপ_') || f.startsWith('ত্রিকোণমিতি') || f.includes(' (1).md') || f.includes('test_note')) {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          }
        }
      }
    }
  };

  cleanupTestFiles();

  // Start temporary server on dynamic port
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // 1. Health check
    console.log('1. Testing GET /api/health...');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthJson.success, true);
    assert.strictEqual(healthJson.data.status, 'healthy');
    console.log('   ✓ Health check passed');

    // 2. Classes and hierarchy
    console.log('2. Testing GET /api/classes...');
    const classesRes = await fetch(`${baseUrl}/api/classes`);
    assert.strictEqual(classesRes.status, 200);
    const classesJson = await classesRes.json();
    assert.strictEqual(classesJson.success, true);
    assert.strictEqual(classesJson.data.classCount, 6);
    assert.strictEqual(classesJson.data.classes.length, 6);
    console.log(`   ✓ Classes hierarchy passed (Found ${classesJson.data.totalNotes} notes across 6 classes)`);

    // 3. Notes listing
    console.log('3. Testing GET /api/notes...');
    const notesRes = await fetch(`${baseUrl}/api/notes?class=class-8&subject=mathematics`);
    assert.strictEqual(notesRes.status, 200);
    const notesJson = await notesRes.json();
    assert.strictEqual(notesJson.success, true);
    assert.ok(notesJson.data.length >= 2, 'Should have algebra.md and বীজগণিত.md');
    console.log(`   ✓ Notes listing returned ${notesJson.data.length} notes`);

    // 4. Retrieve single note with Bengali identifier
    console.log('4. Testing GET /api/notes/:id (Bengali note)...');
    const bengaliRelPath = 'class-8/mathematics/বীজগণিত.md';
    const bengaliId = Buffer.from(bengaliRelPath, 'utf8').toString('base64url');
    const noteRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(bengaliId)}`);
    assert.strictEqual(noteRes.status, 200);
    const noteJson = await noteRes.json();
    assert.strictEqual(noteJson.success, true);
    assert.strictEqual(noteJson.data.filename, 'বীজগণিত.md');
    assert.ok(noteJson.data.content.includes('বীজগণিতীয় সূত্রাবলী'), 'Content must contain Bengali text');
    console.log('   ✓ Bengali note retrieved with full UTF-8 fidelity');

    // 5. Zero Path Traversal Guard
    console.log('5. Testing Path Traversal guards...');
    // Attempt relative escape
    const evilPath = '..\\..\\..\\windows\\system32\\calc.exe';
    const evilId = Buffer.from(evilPath, 'utf8').toString('base64url');
    const evilRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(evilId)}`);
    assert.ok(evilRes.status === 403 || evilRes.status === 400 || evilRes.status === 404);
    const evilJson = await evilRes.json();
    assert.strictEqual(evilJson.success, false);
    console.log('   ✓ Path traversal attempt successfully blocked with error code:', evilJson.error.code);

    // 6. Create note via POST /api/notes
    console.log('6. Testing POST /api/notes (Note Creation)...');
    const createRes = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class: 'class-7',
        subject: 'mathematics',
        filename: 'পরিমাপ_ও_ক্ষেত্রফল.md',
        content: '# পরিমাপ ও ক্ষেত্রফল\n\nআয়তক্ষেত্রের ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ'
      })
    });
    assert.strictEqual(createRes.status, 201);
    const createdJson = await createRes.json();
    assert.strictEqual(createdJson.success, true);
    assert.strictEqual(createdJson.data.filename, 'পরিমাপ_ও_ক্ষেত্রফল.md');
    const createdId = createdJson.data.id;
    console.log('   ✓ Created note:', createdJson.data.filename);

    // 7. Update note via PUT /api/notes/:id
    console.log('7. Testing PUT /api/notes/:id (Update Content)...');
    const updateRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(createdId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '# পরিমাপ ও ক্ষেত্রফল (সংশোধিত)\n\nআয়তক্ষেত্রের ক্ষেত্রফল = দৈর্ঘ্য × প্রস্থ\nবর্গক্ষেত্রের ক্ষেত্রফল = বাহু²'
      })
    });
    assert.strictEqual(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.strictEqual(updateJson.success, true);
    assert.ok(updateJson.data.content.includes('বর্গক্ষেত্রের ক্ষেত্রফল'));
    console.log('   ✓ Note updated successfully');

    // 8. Rename note via PATCH /api/notes/:id/rename
    console.log('8. Testing PATCH /api/notes/:id/rename...');
    const renameRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(createdId)}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        newFilename: 'পরিমাপ_ও_ক্ষেত্রফল_নতুন.md'
      })
    });
    assert.strictEqual(renameRes.status, 200);
    const renameJson = await renameRes.json();
    assert.strictEqual(renameJson.success, true);
    assert.strictEqual(renameJson.data.filename, 'পরিমাপ_ও_ক্ষেত্রফল_নতুন.md');
    const renamedId = renameJson.data.id;
    console.log('   ✓ Note renamed to:', renameJson.data.filename);

    // 9. Full-text search via GET /api/search
    console.log('9. Testing GET /api/search with English & Bengali terms...');
    const searchEngRes = await fetch(`${baseUrl}/api/search?q=BODMAS`);
    const searchEngJson = await searchEngRes.json();
    assert.ok(searchEngJson.data.length >= 1, 'Search for BODMAS should return results');

    const searchBengaliRes = await fetch(`${baseUrl}/api/search?q=${encodeURIComponent('নিউটনের')}`);
    const searchBengaliJson = await searchBengaliRes.json();
    assert.ok(searchBengaliJson.data.length >= 1, 'Search for নিউটনের should return results');
    console.log('   ✓ Full-text search verified for both English and Bengali scripts');

    // 10. Backup archive stream via GET /api/backup
    console.log('10. Testing GET /api/backup (ZIP stream)...');
    const backupRes = await fetch(`${baseUrl}/api/backup`);
    assert.strictEqual(backupRes.status, 200);
    assert.strictEqual(backupRes.headers.get('content-type'), 'application/zip');
    const zipBuffer = await backupRes.arrayBuffer();
    assert.ok(zipBuffer.byteLength > 500, 'Backup ZIP should have content');
    // Check ZIP magic bytes (PK\x03\x04)
    const magic = Buffer.from(zipBuffer.slice(0, 4));
    assert.strictEqual(magic[0], 0x50); // P
    assert.strictEqual(magic[1], 0x4B); // K
    console.log(`   ✓ Backup ZIP archive received successfully (${zipBuffer.byteLength} bytes)`);

    // 11. Delete note via DELETE /api/notes/:id
    console.log('11. Testing DELETE /api/notes/:id...');
    const delRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(renamedId)}`, {
      method: 'DELETE'
    });
    assert.strictEqual(delRes.status, 200);
    const delJson = await delRes.json();
    assert.strictEqual(delJson.success, true);
    console.log('   ✓ Note deleted successfully');

    // 12. Verify deleted note returns 404
    const getDeletedRes = await fetch(`${baseUrl}/api/notes/${encodeURIComponent(renamedId)}`);
    assert.strictEqual(getDeletedRes.status, 404);
    console.log('   ✓ 404 verified for deleted note');

    // 13. Test Multer Latin1 UTF-8 repair logic
    console.log('13. Testing Multer Latin1 encoding repair...');
    const originalBengali = 'গতি_ও_বল.md';
    const latin1Broken = Buffer.from(originalBengali, 'utf8').toString('latin1');
    const repaired = fixMulterEncoding(latin1Broken);
    assert.strictEqual(repaired, originalBengali);
    console.log('   ✓ Latin1 -> UTF-8 Bengali encoding restoration verified');

    // 14. Test Multipart Upload POST /api/upload with Bengali filename
    console.log('14. Testing Multipart Upload POST /api/upload...');
    const uploadForm = new FormData();
    uploadForm.append('class', 'class-8');
    uploadForm.append('subject', 'mathematics');
    uploadForm.append('file', new Blob(['# ত্রিকোণমিতির সূত্রাবলী\n\nsin²θ + cos²θ = 1'], { type: 'text/markdown' }), 'ত্রিকোণমিতি.md');

    const uploadRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: uploadForm
    });
    assert.strictEqual(uploadRes.status, 201);
    const uploadJson = await uploadRes.json();
    assert.strictEqual(uploadJson.success, true);
    assert.strictEqual(uploadJson.data.filename, 'ত্রিকোণমিতি.md');
    console.log('   ✓ Bengali note uploaded successfully via multipart form');

    // 15. Test Collision Avoidance on Upload
    console.log('15. Testing Collision Avoidance on Upload...');
    const collideForm = new FormData();
    collideForm.append('class', 'class-8');
    collideForm.append('subject', 'mathematics');
    collideForm.append('file', new Blob(['# Duplicate Algebra Note'], { type: 'text/markdown' }), 'algebra.md');

    const collideRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: collideForm
    });
    assert.strictEqual(collideRes.status, 201);
    const collideJson = await collideRes.json();
    assert.strictEqual(collideJson.success, true);
    assert.strictEqual(collideJson.data.filename, 'algebra (1).md');
    console.log('   ✓ Collision avoidance verified: algebra.md ->', collideJson.data.filename);

    // 16. Test Rejection of Non-Markdown Files
    console.log('16. Testing File Extension Validation...');
    const badForm = new FormData();
    badForm.append('class', 'class-8');
    badForm.append('subject', 'mathematics');
    badForm.append('file', new Blob(['binary executable content'], { type: 'application/octet-stream' }), 'malicious.exe');

    const badRes = await fetch(`${baseUrl}/api/upload`, {
      method: 'POST',
      body: badForm
    });
    assert.strictEqual(badRes.status, 400);
    const badJson = await badRes.json();
    assert.strictEqual(badJson.success, false);
    assert.strictEqual(badJson.error.code, 'INVALID_FILE_TYPE');
    console.log('   ✓ Non-markdown upload blocked with INVALID_FILE_TYPE');

    console.log('\n========================================');
    console.log(' ALL 16 TEST SUITES PASSED SUCCESSFULLY ');
    console.log('========================================\n');
  } finally {
    cleanupTestFiles();
    server.close();
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
