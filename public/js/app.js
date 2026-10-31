/**
 * EduLibrary Frontend Application Controller
 * Handles SPA state, theme switching, views, modals, editor, and search
 */
(function() {
  'use strict';

  // Application State
  const state = {
    currentView: 'dashboard',
    classesData: null,
    selectedClass: 'class-5',
    selectedSubject: 'mathematics',
    currentNote: null,
    isDirty: false,
    viewMode: 'reader', // 'reader' | 'split' | 'editor'
    searchDebounceTimer: null
  };

  // DOM Elements Cache
  const elements = {
    // Views
    viewDashboard: document.getElementById('view-dashboard'),
    viewExplorer: document.getElementById('view-explorer'),
    viewEditorReader: document.getElementById('view-editor-reader'),

    // Theme
    themeToggleBtn: document.getElementById('theme-toggle-btn'),
    themeIconSun: document.getElementById('theme-icon-sun'),
    themeIconMoon: document.getElementById('theme-icon-moon'),

    // Brand / Home
    btnBrandHome: document.getElementById('btn-brand-home'),

    // Dashboard Elements
    statTotalNotes: document.getElementById('stat-total-notes'),
    statClassesCount: document.getElementById('stat-classes-count'),
    statStorageSize: document.getElementById('stat-storage-size'),
    statSystemState: document.getElementById('stat-system-state'),
    dashboardClassesGrid: document.getElementById('dashboard-classes-grid'),
    dashboardRecentTbody: document.getElementById('dashboard-recent-notes-tbody'),
    btnHeroExplore: document.getElementById('btn-hero-explore'),
    btnHeroNew: document.getElementById('btn-hero-new'),

    // Explorer Elements
    sidebarClassesTree: document.getElementById('sidebar-classes-tree'),
    btnSidebarRefresh: document.getElementById('btn-sidebar-refresh'),
    explorerBreadcrumbs: document.getElementById('explorer-breadcrumbs'),
    sortSelect: document.getElementById('sort-select'),
    btnExplorerNewNote: document.getElementById('btn-explorer-new-note'),
    explorerNotesList: document.getElementById('explorer-notes-list'),

    // Reader & Editor Elements
    btnBackToExplorer: document.getElementById('btn-back-to-explorer'),
    readerPathText: document.getElementById('reader-path-text'),
    unsavedIndicator: document.getElementById('unsaved-indicator'),
    btnModeReader: document.getElementById('btn-mode-reader'),
    btnModeSplit: document.getElementById('btn-mode-split'),
    btnModeEditor: document.getElementById('btn-mode-editor'),
    btnSaveNote: document.getElementById('btn-save-note'),
    btnRenameNote: document.getElementById('btn-rename-note'),
    btnPrintNote: document.getElementById('btn-print-note'),
    btnDeleteNote: document.getElementById('btn-delete-note'),
    workspacePanels: document.getElementById('workspace-panels'),
    markdownEditor: document.getElementById('markdown-editor'),
    renderedMarkdownContent: document.getElementById('rendered-markdown-content'),
    editorCharCounter: document.getElementById('editor-char-counter'),
    editorCursorPos: document.getElementById('editor-cursor-pos'),

    // Header Actions
    btnHeaderNewNote: document.getElementById('btn-header-new-note'),
    btnHeaderUpload: document.getElementById('btn-header-upload'),
    btnHeaderBackup: document.getElementById('btn-header-backup'),

    // Search
    globalSearchInput: document.getElementById('global-search-input'),
    searchClearBtn: document.getElementById('search-clear-btn'),
    searchResultsDropdown: document.getElementById('search-results-dropdown'),

    // Modals
    modalNewNote: document.getElementById('modal-new-note'),
    formNewNote: document.getElementById('form-new-note'),
    newNoteClass: document.getElementById('new-note-class'),
    newNoteSubject: document.getElementById('new-note-subject'),
    newNoteFilename: document.getElementById('new-note-filename'),
    newNoteTemplate: document.getElementById('new-note-template'),

    modalUploadNote: document.getElementById('modal-upload-note'),
    formUploadNote: document.getElementById('form-upload-note'),
    uploadNoteClass: document.getElementById('upload-note-class'),
    uploadNoteSubject: document.getElementById('upload-note-subject'),
    uploadDropZone: document.getElementById('upload-drop-zone'),
    uploadFileInput: document.getElementById('upload-file-input'),
    uploadFileLabel: document.getElementById('upload-file-label'),
    btnSubmitUpload: document.getElementById('btn-submit-upload'),

    modalRenameNote: document.getElementById('modal-rename-note'),
    formRenameNote: document.getElementById('form-rename-note'),
    renameInputFilename: document.getElementById('rename-input-filename'),

    modalDeleteConfirm: document.getElementById('modal-delete-confirm'),
    deleteConfirmMessage: document.getElementById('delete-confirm-message'),
    btnConfirmDeleteAction: document.getElementById('btn-confirm-delete-action'),

    // Toast Container
    toastContainer: document.getElementById('toast-container')
  };

  /**
   * Templates for initial note creation
   */
  const TEMPLATES = {
    blank: '',
    academic: `# Lesson Title

## 1. Learning Objectives
* Understand key concepts
* Apply formulas and problem-solving techniques

## 2. Core Concepts
Write detailed theoretical explanations here.

## 3. Important Formulas & Equations
\`\`\`text
Formula: a² + b² = c²
\`\`\`

> [!NOTE]
> Review foundational prerequisites before starting this topic.

## 4. Practice Exercises
1. Exercise 1: State the fundamental principle.
2. Exercise 2: Solve for x.
`,
    bengali: `# পাঠের শিরোনাম (অধ্যায়)

## ১. শিখনফল
* মূল ধারণা ও সূত্র স্পষ্টভাবে উপলব্ধি করা
* সমস্যা সমাধান ও বাস্তব প্রয়োগ

## ২. মৌলিক তত্ত্ব ও ব্যাখ্যা
এখানে বিস্তারিত তাত্ত্বিক আলোচনা লিপিবদ্ধ করুন।

## ৩. গুরুত্বপূর্ণ সূত্রাবলী
\`\`\`text
গতিশক্তি E = ½ mv²
\`\`\`

> [!NOTE]
> পূর্ববর্তী পাঠের গাণিতিক সমস্যাগুলি পুনরায় অনুশীলন করুন।

## ৪. অনুশীলনী প্রশ্নমালা
১. মৌলিক সংজ্ঞা ব্যাখ্যা করো।
২. গাণিতিক উদাহরণ সমাধান করো।
`
  };

  /**
   * Notification Toast System
   */
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = '';
    if (type === 'success') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
    } else if (type === 'error') {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>';
    } else {
      iconSvg = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    }

    toast.innerHTML = `
      <div style="flex-shrink: 0;">${iconSvg}</div>
      <div style="flex: 1; word-break: break-word;">${message}</div>
    `;

    elements.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 300ms ease, transform 300ms ease';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /**
   * Theme Management (Light / Dark mode persistence)
   */
  function initTheme() {
    const savedTheme = localStorage.getItem('edulibrary-theme') || 'light';
    applyTheme(savedTheme);

    elements.themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      const next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem('edulibrary-theme', next);
    });
  }

  function applyTheme(theme) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      elements.themeIconSun.style.display = 'none';
      elements.themeIconMoon.style.display = 'block';
    } else {
      document.documentElement.removeAttribute('data-theme');
      elements.themeIconSun.style.display = 'block';
      elements.themeIconMoon.style.display = 'none';
    }
  }

  /**
   * Navigation View Switcher
   */
  function switchView(viewName) {
    if (state.isDirty && state.currentView === 'editor-reader' && viewName !== 'editor-reader') {
      const confirmLeave = confirm('You have unsaved changes in your note. Are you sure you want to leave without saving?');
      if (!confirmLeave) return;
    }

    state.currentView = viewName;
    elements.viewDashboard.classList.remove('active');
    elements.viewExplorer.classList.remove('active');
    elements.viewEditorReader.classList.remove('active');

    if (viewName === 'dashboard') {
      elements.viewDashboard.classList.add('active');
      loadDashboard();
    } else if (viewName === 'explorer') {
      elements.viewExplorer.classList.add('active');
      renderExplorerTree();
      loadExplorerNotes();
    } else if (viewName === 'editor-reader') {
      elements.viewEditorReader.classList.add('active');
    }
  }

  /**
   * Format bytes to readable string
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format ISO date string
   */
  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  const DEFAULT_CLASSES = [
    { id: 'class-5', name: 'Class 5', bengaliName: 'পঞ্চম শ্রেণি' },
    { id: 'class-6', name: 'Class 6', bengaliName: 'ষষ্ঠ শ্রেণি' },
    { id: 'class-7', name: 'Class 7', bengaliName: 'সপ্তম শ্রেণি' },
    { id: 'class-8', name: 'Class 8', bengaliName: 'অষ্টম শ্রেণি' },
    { id: 'class-9', name: 'Class 9', bengaliName: 'নবম শ্রেণি' },
    { id: 'class-10', name: 'Class 10', bengaliName: 'দশম শ্রেণি' }
  ];

  /**
   * Populate Class Selectors in Modals
   */
  function populateClassSelectors(classes) {
    const list = (classes && classes.length) ? classes : DEFAULT_CLASSES;
    const currentNew = elements.newNoteClass.value;
    const currentUpload = elements.uploadNoteClass.value;

    const optionsHtml = list.map(c => 
      `<option value="${c.id}">${c.name} (${c.bengaliName})</option>`
    ).join('');

    elements.newNoteClass.innerHTML = optionsHtml;
    elements.uploadNoteClass.innerHTML = optionsHtml;

    if (currentNew) elements.newNoteClass.value = currentNew;
    if (currentUpload) elements.uploadNoteClass.value = currentUpload;

    if (elements.newNoteClass.selectedIndex === -1 && elements.newNoteClass.options.length) {
      elements.newNoteClass.selectedIndex = 0;
    }
    if (elements.uploadNoteClass.selectedIndex === -1 && elements.uploadNoteClass.options.length) {
      elements.uploadNoteClass.selectedIndex = 0;
    }
  }

  /**
   * Load and Render Dashboard
   */
  async function loadDashboard() {
    try {
      const [classStats, recentNotes] = await Promise.all([
        API.getClasses(),
        API.getNotes({ sort: 'mtime', order: 'desc' })
      ]);

      state.classesData = classStats.classes;
      populateClassSelectors(state.classesData);

      // Update Metrics
      elements.statTotalNotes.textContent = classStats.totalNotes;
      elements.statClassesCount.textContent = `${classStats.classCount} Classes`;
      elements.statStorageSize.textContent = formatBytes(classStats.totalStorageBytes);

      // Render Classes Cards Grid
      renderDashboardClasses(classStats.classes);

      // Render Recent Notes
      renderDashboardRecentNotes(recentNotes.slice(0, 8));
    } catch (err) {
      showToast(`Failed to load dashboard: ${err.message}`, 'error');
    }
  }

  function renderDashboardClasses(classes) {
    if (!classes || !classes.length) {
      elements.dashboardClassesGrid.innerHTML = '<p class="text-muted">No classes configured.</p>';
      return;
    }

    elements.dashboardClassesGrid.innerHTML = classes.map(cls => `
      <div class="class-card" data-class-id="${cls.id}">
        <div class="class-card-header">
          <div class="class-name-container">
            <span class="class-title">${cls.name}</span>
            <span class="class-subtitle">${cls.bengaliName}</span>
          </div>
          <span class="class-total-badge">${cls.totalNotes} ${cls.totalNotes === 1 ? 'Note' : 'Notes'}</span>
        </div>
        <div class="subjects-list">
          ${cls.subjects.map(sub => `
            <div class="subject-item-btn" data-class="${cls.id}" data-subject="${sub.id}">
              <div class="subject-item-title">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                </svg>
                <span>${sub.name} (${sub.bengaliName})</span>
              </div>
              <span class="subject-note-badge">${sub.noteCount}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `).join('');

    // Attach click listeners to subject buttons on dashboard
    elements.dashboardClassesGrid.querySelectorAll('.subject-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.selectedClass = btn.dataset.class;
        state.selectedSubject = btn.dataset.subject;
        switchView('explorer');
      });
    });
  }

  function renderDashboardRecentNotes(notes) {
    if (!notes || !notes.length) {
      elements.dashboardRecentTbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 32px;">
            No notes found. Create or upload your first note!
          </td>
        </tr>
      `;
      return;
    }

    elements.dashboardRecentTbody.innerHTML = notes.map(note => `
      <tr>
        <td>
          <div class="note-title-cell" data-note-id="${note.id}">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
            <span>${note.title}</span>
          </div>
        </td>
        <td><span class="badge-tag">${note.className}</span></td>
        <td><span class="badge-tag">${note.subjectName}</span></td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formatBytes(note.size)}</td>
        <td style="color: var(--text-muted); font-size: 0.85rem;">${formatDate(note.mtime)}</td>
        <td style="text-align: right;">
          <button class="btn btn-sm btn-outline btn-open-recent" data-note-id="${note.id}">Open</button>
        </td>
      </tr>
    `).join('');

    // Attach click listeners
    elements.dashboardRecentTbody.querySelectorAll('.note-title-cell, .btn-open-recent').forEach(el => {
      el.addEventListener('click', () => {
        openNote(el.dataset.noteId, 'reader');
      });
    });
  }

  /**
   * Render Explorer Sidebar Tree
   */
  function renderExplorerTree() {
    if (!state.classesData) return;

    elements.sidebarClassesTree.innerHTML = state.classesData.map(cls => {
      const isClassSelected = cls.id === state.selectedClass;
      return `
        <div class="tree-class-group">
          <div class="tree-class-header ${isClassSelected ? 'expanded' : ''}" data-class-id="${cls.id}">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform var(--transition-fast);">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
              <span>${cls.name} <span style="font-size: 0.8rem; color: var(--text-muted);">(${cls.bengaliName})</span></span>
            </div>
            <span class="badge-tag" style="font-size: 0.7rem;">${cls.totalNotes}</span>
          </div>
          <div class="tree-subjects-group" style="${isClassSelected ? 'display: flex;' : 'display: none;'}">
            ${cls.subjects.map(sub => {
              const isActive = isClassSelected && sub.id === state.selectedSubject;
              return `
                <div class="tree-subject-item ${isActive ? 'active' : ''}" data-class="${cls.id}" data-subject="${sub.id}">
                  <span>${sub.name}</span>
                  <span class="subject-note-badge">${sub.noteCount}</span>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    // Tree class header toggling
    elements.sidebarClassesTree.querySelectorAll('.tree-class-header').forEach(header => {
      header.addEventListener('click', () => {
        const group = header.nextElementSibling;
        const isExpanded = header.classList.toggle('expanded');
        group.style.display = isExpanded ? 'flex' : 'none';
      });
    });

    // Tree subject item selection
    elements.sidebarClassesTree.querySelectorAll('.tree-subject-item').forEach(item => {
      item.addEventListener('click', () => {
        elements.sidebarClassesTree.querySelectorAll('.tree-subject-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        state.selectedClass = item.dataset.class;
        state.selectedSubject = item.dataset.subject;
        loadExplorerNotes();
      });
    });
  }

  /**
   * Load Explorer Notes for selected Class & Subject
   */
  async function loadExplorerNotes() {
    try {
      const [sortField, sortOrder] = elements.sortSelect.value.split(':');
      const notes = await API.getNotes({
        class: state.selectedClass,
        subject: state.selectedSubject,
        sort: sortField,
        order: sortOrder
      });

      // Update Breadcrumbs
      const curClassObj = state.classesData ? state.classesData.find(c => c.id === state.selectedClass) : null;
      const curClassName = curClassObj ? `${curClassObj.name} (${curClassObj.bengaliName})` : state.selectedClass;
      const curSubName = state.selectedSubject === 'mathematics' ? 'Mathematics (গণিত)' : 'Physical Science (ভৌত বিজ্ঞান)';

      elements.explorerBreadcrumbs.innerHTML = `
        <span>${curClassName}</span>
        <span class="breadcrumb-separator">/</span>
        <span style="color: var(--accent-blue);">${curSubName}</span>
        <span class="badge-tag" style="margin-left: 6px;">${notes.length} notes</span>
      `;

      if (!notes.length) {
        elements.explorerNotesList.innerHTML = `
          <div class="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <h3>No notes yet in this subject</h3>
            <p style="margin-bottom: 16px;">Create a new Markdown note or upload an existing file to get started.</p>
            <div style="display: flex; gap: 10px;">
              <button class="btn btn-primary" id="btn-empty-create-note">Create Note</button>
              <button class="btn btn-secondary" id="btn-empty-upload-note">Upload Note</button>
            </div>
          </div>
        `;

        document.getElementById('btn-empty-create-note')?.addEventListener('click', () => openNewNoteModal(state.selectedClass, state.selectedSubject));
        document.getElementById('btn-empty-upload-note')?.addEventListener('click', () => openUploadModal(state.selectedClass, state.selectedSubject));
        return;
      }

      elements.explorerNotesList.innerHTML = `
        <div class="notes-grid">
          ${notes.map(note => `
            <div class="note-card" data-note-id="${note.id}">
              <div class="note-card-title">${note.title}</div>
              <div class="note-card-meta">
                <span>${formatBytes(note.size)}</span>
                <span>•</span>
                <span>${formatDate(note.mtime)}</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); margin-bottom: 12px; word-break: break-all;">
                ${note.filename}
              </div>
              <div class="note-card-actions">
                <button class="btn btn-sm btn-outline btn-card-edit" data-note-id="${note.id}" title="Edit in Editor Mode">Edit</button>
                <button class="btn btn-sm btn-primary btn-card-read" data-note-id="${note.id}" title="Read in Academic View">Read</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;

      // Event delegation for card clicks
      elements.explorerNotesList.querySelectorAll('.note-card').forEach(card => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('.btn-card-edit')) {
            e.stopPropagation();
            openNote(card.dataset.noteId, 'split');
          } else {
            openNote(card.dataset.noteId, 'reader');
          }
        });
      });
    } catch (err) {
      showToast(`Failed to load notes: ${err.message}`, 'error');
    }
  }

  /**
   * Open Note in Reader & Editor View
   */
  async function openNote(noteId, preferredMode = 'reader') {
    try {
      const note = await API.getNote(noteId);
      state.currentNote = note;
      state.isDirty = false;
      elements.unsavedIndicator.classList.remove('active');

      // Update Breadcrumb & Title
      elements.readerPathText.textContent = `${note.className} > ${note.subjectName} > ${note.filename}`;

      // Set editor value
      elements.markdownEditor.value = note.content;
      updateEditorMetrics();

      // Render Markdown preview
      renderMarkdownView();

      // Switch mode and show view
      setViewMode(preferredMode);
      switchView('editor-reader');
    } catch (err) {
      showToast(`Error opening note: ${err.message}`, 'error');
    }
  }

  /**
   * Update View Mode (Reader, Split, Editor)
   */
  function setViewMode(mode) {
    state.viewMode = mode;
    elements.workspacePanels.className = `workspace-panels-container mode-${mode}`;

    elements.btnModeReader.classList.toggle('active', mode === 'reader' || mode === 'reader-only');
    elements.btnModeSplit.classList.toggle('active', mode === 'split');
    elements.btnModeEditor.classList.toggle('active', mode === 'editor' || mode === 'editor-only');

    if (mode === 'split' || mode === 'reader' || mode === 'reader-only') {
      renderMarkdownView();
    }
  }

  /**
   * Render Markdown using offline pipeline and DOMPurify
   */
  function renderMarkdownView() {
    const rawMarkdown = elements.markdownEditor.value;
    const safeHtml = MarkdownRenderer.render(rawMarkdown);
    elements.renderedMarkdownContent.innerHTML = safeHtml;
    MarkdownRenderer.enhance(elements.renderedMarkdownContent);
  }

  /**
   * Update Character, Word & Cursor Metrics
   */
  function updateEditorMetrics() {
    const text = elements.markdownEditor.value;
    const charCount = text.length;
    const wordCount = (text.trim().match(/\S+/g) || []).length;
    elements.editorCharCounter.textContent = `Chars: ${charCount} | Words: ${wordCount}`;
  }

  /**
   * Save Note Handler
   */
  async function saveCurrentNote() {
    if (!state.currentNote) return;

    try {
      elements.btnSaveNote.disabled = true;
      elements.btnSaveNote.querySelector('span').textContent = 'Saving...';

      const content = elements.markdownEditor.value;
      const updated = await API.updateNote(state.currentNote.id, content);

      state.currentNote = updated;
      state.isDirty = false;
      elements.unsavedIndicator.classList.remove('active');
      renderMarkdownView();

      showToast(`Saved note "${updated.filename}" successfully`, 'success');
    } catch (err) {
      showToast(`Failed to save note: ${err.message}`, 'error');
    } finally {
      elements.btnSaveNote.disabled = false;
      elements.btnSaveNote.querySelector('span').textContent = 'Save (Ctrl+S)';
    }
  }

  /**
   * Real-Time Search Debounce
   */
  function setupSearch() {
    elements.globalSearchInput.addEventListener('input', (e) => {
      const query = e.target.value;

      elements.searchClearBtn.style.display = query ? 'block' : 'none';

      clearTimeout(state.searchDebounceTimer);
      if (!query.trim()) {
        elements.searchResultsDropdown.classList.remove('active');
        elements.searchResultsDropdown.innerHTML = '';
        return;
      }

      state.searchDebounceTimer = setTimeout(async () => {
        try {
          const results = await API.searchNotes(query.trim());
          renderSearchResults(results, query.trim());
        } catch (err) {
          console.error('Search error:', err);
        }
      }, 250);
    });

    elements.searchClearBtn.addEventListener('click', () => {
      elements.globalSearchInput.value = '';
      elements.searchClearBtn.style.display = 'none';
      elements.searchResultsDropdown.classList.remove('active');
      elements.searchResultsDropdown.innerHTML = '';
      elements.globalSearchInput.focus();
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.header-search-container')) {
        elements.searchResultsDropdown.classList.remove('active');
      }
    });

    // Keyboard navigation in search
    elements.globalSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        elements.searchResultsDropdown.classList.remove('active');
      }
    });
  }

  function highlightMatches(text, query) {
    if (!text || !query) return MarkdownRenderer.escapeHtml(text || '');
    const escapedText = MarkdownRenderer.escapeHtml(text);
    const escapedQuery = MarkdownRenderer.escapeHtml(query);
    const regex = new RegExp(`(${escapedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return escapedText.replace(regex, '<span class="search-highlight">$1</span>');
  }

  function renderSearchResults(results, query) {
    if (!results || !results.length) {
      elements.searchResultsDropdown.innerHTML = `
        <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.9rem;">
          No matches found for "<strong>${MarkdownRenderer.escapeHtml(query)}</strong>"
        </div>
      `;
      elements.searchResultsDropdown.classList.add('active');
      return;
    }

    elements.searchResultsDropdown.innerHTML = results.map(item => `
      <div class="search-result-item" data-note-id="${item.id}">
        <div class="search-result-header">
          <div class="search-result-title">${highlightMatches(item.title, query)}</div>
          <span class="search-result-path">${item.className} / ${item.subjectName}</span>
        </div>
        <div class="search-result-snippet">${highlightMatches(item.snippet, query)}</div>
      </div>
    `).join('');

    elements.searchResultsDropdown.classList.add('active');

    elements.searchResultsDropdown.querySelectorAll('.search-result-item').forEach(item => {
      item.addEventListener('click', () => {
        elements.searchResultsDropdown.classList.remove('active');
        openNote(item.dataset.noteId, 'reader');
      });
    });
  }

  /**
   * Modals Setup
   */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  function setupModals() {
    // Generic close modal button handlers
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.dataset.closeModal);
      });
    });

    // Close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // NEW NOTE MODAL
    elements.formNewNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      const classSlug = elements.newNoteClass.value;
      const subjectSlug = elements.newNoteSubject.value;
      const filename = elements.newNoteFilename.value.trim();
      const templateKey = elements.newNoteTemplate.value;
      const initialContent = TEMPLATES[templateKey] || '';

      try {
        const newNote = await API.createNote({
          classSlug,
          subjectSlug,
          filename,
          content: initialContent
        });

        closeModal('modal-new-note');
        elements.formNewNote.reset();
        showToast(`Created note "${newNote.filename}"`, 'success');

        // Refresh Explorer if needed and open in split mode
        state.selectedClass = classSlug;
        state.selectedSubject = subjectSlug;
        openNote(newNote.id, 'split');
      } catch (err) {
        showToast(`Failed to create note: ${err.message}`, 'error');
      }
    });

    // UPLOAD NOTE MODAL
    const dropZone = elements.uploadDropZone;
    const fileInput = elements.uploadFileInput;

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('dragover');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        updateFileLabel();
      }
    });

    fileInput.addEventListener('change', updateFileLabel);

    function updateFileLabel() {
      if (fileInput.files.length) {
        const file = fileInput.files[0];
        elements.uploadFileLabel.textContent = `Selected: ${file.name} (${formatBytes(file.size)})`;

        // Smart class & subject detection from filename
        const fnameLower = file.name.toLowerCase();
        for (let i = 5; i <= 10; i++) {
          if (fnameLower.includes(`class ${i}`) || fnameLower.includes(`class-${i}`) || fnameLower.includes(`class_${i}`)) {
            elements.uploadNoteClass.value = `class-${i}`;
            break;
          }
        }
        if (fnameLower.includes('physic') || fnameLower.includes('science') || fnameLower.includes('ভৌত') || fnameLower.includes('বিজ্ঞান')) {
          elements.uploadNoteSubject.value = 'physical-science';
        } else if (fnameLower.includes('math') || fnameLower.includes('গণিত') || fnameLower.includes('algebra') || fnameLower.includes('বীজগণিত')) {
          elements.uploadNoteSubject.value = 'mathematics';
        }
      } else {
        elements.uploadFileLabel.textContent = 'Click or Drag & Drop Markdown file here';
      }
    }

    elements.formUploadNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!fileInput.files.length) {
        showToast('Please select a file to upload', 'error');
        return;
      }

      const file = fileInput.files[0];
      const classSlug = elements.uploadNoteClass.value;
      const subjectSlug = elements.uploadNoteSubject.value;

      const formData = new FormData();
      formData.append('class', classSlug);
      formData.append('subject', subjectSlug);
      formData.append('file', file);

      try {
        elements.btnSubmitUpload.disabled = true;
        elements.btnSubmitUpload.textContent = 'Uploading...';

        const uploadedNote = await API.uploadNote(formData);

        closeModal('modal-upload-note');
        elements.formUploadNote.reset();
        elements.uploadFileLabel.textContent = 'Click or Drag & Drop Markdown file here';
        showToast(`Uploaded "${uploadedNote.filename}" successfully`, 'success');

        state.selectedClass = classSlug;
        state.selectedSubject = subjectSlug;
        openNote(uploadedNote.id, 'reader');
      } catch (err) {
        showToast(`Upload failed: ${err.message}`, 'error');
      } finally {
        elements.btnSubmitUpload.disabled = false;
        elements.btnSubmitUpload.textContent = 'Upload Note';
      }
    });

    // RENAME NOTE MODAL
    elements.formRenameNote.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!state.currentNote) return;

      const newFilename = elements.renameInputFilename.value.trim();
      if (!newFilename) return;

      try {
        const renamed = await API.renameNote(state.currentNote.id, newFilename);
        state.currentNote = renamed;
        elements.readerPathText.textContent = `${renamed.className} > ${renamed.subjectName} > ${renamed.filename}`;
        closeModal('modal-rename-note');
        showToast(`Renamed to "${renamed.filename}"`, 'success');
      } catch (err) {
        showToast(`Rename failed: ${err.message}`, 'error');
      }
    });

    // DELETE NOTE CONFIRM MODAL
    elements.btnConfirmDeleteAction.addEventListener('click', async () => {
      if (!state.currentNote) return;

      try {
        await API.deleteNote(state.currentNote.id);
        closeModal('modal-delete-confirm');
        showToast('Note deleted successfully', 'success');
        state.isDirty = false;
        state.currentNote = null;
        switchView('explorer');
      } catch (err) {
        showToast(`Delete failed: ${err.message}`, 'error');
      }
    });
  }

  function openNewNoteModal(defaultClass, defaultSubject) {
    if (!elements.newNoteClass.children.length) {
      populateClassSelectors(state.classesData || DEFAULT_CLASSES);
    }
    const targetClass = defaultClass || state.selectedClass || 'class-8';
    elements.newNoteClass.value = targetClass;
    if (elements.newNoteClass.selectedIndex === -1 && elements.newNoteClass.options.length) {
      elements.newNoteClass.selectedIndex = 0;
    }

    if (defaultSubject) {
      elements.newNoteSubject.value = defaultSubject;
    } else if (state.selectedSubject) {
      elements.newNoteSubject.value = state.selectedSubject;
    }
    elements.newNoteFilename.value = '';
    openModal('modal-new-note');
    setTimeout(() => elements.newNoteFilename.focus(), 100);
  }

  function openUploadModal(defaultClass, defaultSubject) {
    if (!elements.uploadNoteClass.children.length) {
      populateClassSelectors(state.classesData || DEFAULT_CLASSES);
    }
    const targetClass = defaultClass || state.selectedClass || 'class-8';
    elements.uploadNoteClass.value = targetClass;
    if (elements.uploadNoteClass.selectedIndex === -1 && elements.uploadNoteClass.options.length) {
      elements.uploadNoteClass.selectedIndex = 0;
    }

    if (defaultSubject) {
      elements.uploadNoteSubject.value = defaultSubject;
    } else if (state.selectedSubject) {
      elements.uploadNoteSubject.value = state.selectedSubject;
    }
    openModal('modal-upload-note');
  }

  /**
   * Bind All UI and Keyboard Event Listeners
   */
  function bindEvents() {
    // Brand home navigation
    elements.btnBrandHome.addEventListener('click', () => switchView('dashboard'));
    elements.btnHeroExplore.addEventListener('click', () => switchView('explorer'));
    elements.btnHeroNew.addEventListener('click', () => openNewNoteModal());

    // Header buttons
    elements.btnHeaderNewNote.addEventListener('click', () => openNewNoteModal(state.selectedClass, state.selectedSubject));
    elements.btnHeaderUpload.addEventListener('click', () => openUploadModal(state.selectedClass, state.selectedSubject));
    elements.btnExplorerNewNote.addEventListener('click', () => openNewNoteModal(state.selectedClass, state.selectedSubject));

    // Explorer sidebar refresh
    elements.btnSidebarRefresh.addEventListener('click', async () => {
      const stats = await API.getClasses();
      state.classesData = stats.classes;
      renderExplorerTree();
      loadExplorerNotes();
      showToast('Curriculum notes refreshed', 'info');
    });

    // Sort select change
    elements.sortSelect.addEventListener('change', () => {
      loadExplorerNotes();
    });

    // Reader & Editor Navigation
    elements.btnBackToExplorer.addEventListener('click', () => {
      switchView('explorer');
    });

    // Mode tabs
    elements.btnModeReader.addEventListener('click', () => setViewMode('reader-only'));
    elements.btnModeSplit.addEventListener('click', () => setViewMode('split'));
    elements.btnModeEditor.addEventListener('click', () => setViewMode('editor-only'));

    // Note actions
    elements.btnSaveNote.addEventListener('click', saveCurrentNote);

    elements.btnRenameNote.addEventListener('click', () => {
      if (!state.currentNote) return;
      elements.renameInputFilename.value = state.currentNote.filename;
      openModal('modal-rename-note');
      setTimeout(() => elements.renameInputFilename.focus(), 100);
    });

    elements.btnPrintNote.addEventListener('click', () => {
      // Ensure reader content is up-to-date before printing
      renderMarkdownView();
      window.print();
    });

    elements.btnDeleteNote.addEventListener('click', () => {
      if (!state.currentNote) return;
      elements.deleteConfirmMessage.textContent = `Are you sure you want to permanently delete "${state.currentNote.filename}"? This action cannot be undone.`;
      openModal('modal-delete-confirm');
    });

    // Editor input listener for live preview and dirty flag
    let liveRenderTimeout;
    elements.markdownEditor.addEventListener('input', () => {
      state.isDirty = true;
      elements.unsavedIndicator.classList.add('active');
      updateEditorMetrics();

      if (state.viewMode === 'split') {
        clearTimeout(liveRenderTimeout);
        liveRenderTimeout = setTimeout(renderMarkdownView, 60);
      }
    });

    // Update cursor position in editor status bar
    elements.markdownEditor.addEventListener('keyup', updateCursorPos);
    elements.markdownEditor.addEventListener('click', updateCursorPos);

    function updateCursorPos() {
      const selStart = elements.markdownEditor.selectionStart;
      const text = elements.markdownEditor.value.slice(0, selStart);
      const lines = text.split('\n');
      const lineNum = lines.length;
      const colNum = lines[lines.length - 1].length + 1;
      elements.editorCursorPos.textContent = `Ln ${lineNum}, Col ${colNum}`;
    }

    // Support Tab key in textarea for code/markdown indent
    elements.markdownEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = elements.markdownEditor.selectionStart;
        const end = elements.markdownEditor.selectionEnd;
        elements.markdownEditor.value = elements.markdownEditor.value.substring(0, start) + '  ' + elements.markdownEditor.value.substring(end);
        elements.markdownEditor.selectionStart = elements.markdownEditor.selectionEnd = start + 2;
        state.isDirty = true;
        elements.unsavedIndicator.classList.add('active');
        if (state.viewMode === 'split') renderMarkdownView();
      }
    });

    // Global keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      // Ctrl+S / Cmd+S save
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (state.currentView === 'editor-reader') {
          saveCurrentNote();
        }
      }

      // Ctrl+K search focus
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        elements.globalSearchInput.focus();
        elements.globalSearchInput.select();
      }

      // Escape key to close modals or search dropdown
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop.active').forEach(m => m.classList.remove('active'));
        elements.searchResultsDropdown.classList.remove('active');
      }
    });

    // Warn on window close if unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (state.isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    });
  }

  /**
   * Application Initialization
   */
  async function init() {
    initTheme();
    if (elements.btnHeaderBackup) {
      elements.btnHeaderBackup.href = API.getBackupUrl();
    }
    populateClassSelectors(DEFAULT_CLASSES);
    setupSearch();
    setupModals();
    bindEvents();
    await loadDashboard();
  }

  // Bootstrap when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
