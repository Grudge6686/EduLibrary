/**
 * EduLibrary Markdown Pipeline
 * Uses bundled offline Marked and DOMPurify for zero-dependency safe rendering
 */
const MarkdownRenderer = {
  initialized: false,

  init() {
    if (this.initialized) return;

    if (typeof marked !== 'undefined') {
      marked.use({
        gfm: true,
        breaks: true,
        pedantic: false
      });
    }

    this.initialized = true;
  },

  /**
   * Render raw markdown text to safe HTML
   */
  render(markdownText) {
    if (!markdownText || typeof markdownText !== 'string') {
      return '<div class="empty-document-placeholder"><p>No content in this note yet.</p></div>';
    }

    this.init();

    let rawHtml = '';
    try {
      if (typeof marked !== 'undefined' && marked.parse) {
        rawHtml = marked.parse(markdownText);
      } else {
        // Fallback plain text renderer if script not loaded yet
        rawHtml = `<pre>${this.escapeHtml(markdownText)}</pre>`;
      }
    } catch (err) {
      console.error('Marked parsing error:', err);
      rawHtml = `<div class="render-error">Error rendering markdown: ${this.escapeHtml(err.message)}</div><pre>${this.escapeHtml(markdownText)}</pre>`;
    }

    // Sanitize with DOMPurify
    let safeHtml = rawHtml;
    if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
      safeHtml = DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'rel', 'class'],
        ALLOWED_TAGS: [
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'ul', 'ol', 'li',
          'blockquote', 'code', 'pre', 'hr', 'br', 'strong', 'em', 'del',
          'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'span', 'div',
          'input', 'details', 'summary', 'sub', 'sup', 'mark'
        ]
      });
    }

    return safeHtml;
  },

  /**
   * Enhance rendered container with interactive elements:
   * - Copy button on code blocks
   * - Callout alert styling ([!NOTE], [!TIP], [!IMPORTANT], [!WARNING])
   * - Responsive table wrapper
   */
  enhance(container) {
    if (!container) return;

    // 1. Wrap tables in responsive scrollers
    const tables = container.querySelectorAll('table');
    tables.forEach((table) => {
      if (!table.parentElement.classList.contains('table-responsive')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'table-responsive';
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(table);
      }
    });

    // 2. Add copy buttons to code blocks
    const preBlocks = container.querySelectorAll('pre');
    preBlocks.forEach((pre) => {
      if (pre.querySelector('.copy-code-btn')) return;

      const code = pre.querySelector('code');
      const copyBtn = document.createElement('button');
      copyBtn.className = 'copy-code-btn';
      copyBtn.type = 'button';
      copyBtn.setAttribute('title', 'Copy code to clipboard');
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <span>Copy</span>
      `;

      copyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const textToCopy = code ? code.innerText : pre.innerText;
        try {
          await navigator.clipboard.writeText(textToCopy);
          copyBtn.classList.add('copied');
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.classList.remove('copied');
            copyBtn.querySelector('span').textContent = 'Copy';
          }, 2000);
        } catch {
          // Fallback copy
          const textarea = document.createElement('textarea');
          textarea.value = textToCopy;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
          copyBtn.querySelector('span').textContent = 'Copied!';
          setTimeout(() => {
            copyBtn.querySelector('span').textContent = 'Copy';
          }, 2000);
        }
      });

      pre.style.position = 'relative';
      pre.appendChild(copyBtn);
    });

    // 3. Transform alert blockquotes: [!NOTE], [!TIP], [!IMPORTANT], [!WARNING], [!CAUTION]
    const blockquotes = container.querySelectorAll('blockquote');
    blockquotes.forEach((bq) => {
      const firstP = bq.querySelector('p');
      if (!firstP) return;

      const text = firstP.innerHTML.trim();
      const alertMatch = text.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s*<br\s*\/?>)?/i);

      if (alertMatch) {
        const type = alertMatch[1].toUpperCase();
        bq.classList.add('academic-alert', `alert-${type.toLowerCase()}`);

        // Strip the [!TYPE] marker and add an alert title header
        const remaining = text.replace(alertMatch[0], '').trim();
        firstP.innerHTML = remaining;

        const header = document.createElement('div');
        header.className = 'alert-heading';
        header.innerHTML = `<strong>${type}</strong>`;
        bq.insertBefore(header, bq.firstChild);
      }
    });

    // 4. Ensure external links open safely
    const links = container.querySelectorAll('a[href^="http://"], a[href^="https://"]');
    links.forEach((a) => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};

window.MarkdownRenderer = MarkdownRenderer;
