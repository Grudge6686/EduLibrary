/**
 * EduLibrary Frontend API Client
 * Wraps all backend endpoints with standard JSON envelope parsing
 */
const API = {
  /**
   * Determine base API URL
   * If accessed from another port (e.g. VS Code Live Server on port 5500),
   * route requests to the EduLibrary backend running on port 3000.
   */
  getBaseApiUrl() {
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.port === '3000') {
        return '';
      }
      const host = window.location.hostname || 'localhost';
      return `http://${host}:3000`;
    }
    return '';
  },

  /**
   * Helper to perform fetch with JSON error handling
   */
  async request(url, options = {}) {
    try {
      const baseUrl = this.getBaseApiUrl();
      const targetUrl = url.startsWith('/api') ? `${baseUrl}${url}` : url;
      const response = await fetch(targetUrl, options);
      const isJson = response.headers.get('content-type')?.includes('application/json');

      if (!response.ok) {
        if (isJson) {
          const json = await response.json();
          const err = new Error(json.error?.message || `Request failed with status ${response.status}`);
          err.code = json.error?.code || 'HTTP_ERROR';
          err.status = response.status;
          throw err;
        } else {
          const text = await response.text();
          const err = new Error(text || `Request failed with status ${response.status}`);
          err.status = response.status;
          throw err;
        }
      }

      if (isJson) {
        const json = await response.json();
        return json.data;
      }
      return await response.text();
    } catch (error) {
      console.error(`API Error [${options.method || 'GET'} ${url}]:`, error);
      throw error;
    }
  },

  /**
   * Health check and system metrics
   */
  async getHealth() {
    return this.request('/api/health');
  },

  /**
   * Class and subject hierarchy with note counts
   */
  async getClasses() {
    return this.request('/api/classes');
  },

  /**
   * Query notes with optional filtering and sorting
   */
  async getNotes(params = {}) {
    const query = new URLSearchParams();
    if (params.class) query.append('class', params.class);
    if (params.subject) query.append('subject', params.subject);
    if (params.sort) query.append('sort', params.sort);
    if (params.order) query.append('order', params.order);

    const queryString = query.toString();
    const url = `/api/notes${queryString ? `?${queryString}` : ''}`;
    return this.request(url);
  },

  /**
   * Retrieve single note with full raw content
   */
  async getNote(id) {
    return this.request(`/api/notes/${encodeURIComponent(id)}`);
  },

  /**
   * Create new note from editor
   */
  async createNote({ classSlug, subjectSlug, filename, content }) {
    return this.request('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class: classSlug,
        subject: subjectSlug,
        filename,
        content
      })
    });
  },

  /**
   * Upload file via multipart/form-data
   */
  async uploadNote(formData) {
    return this.request('/api/upload', {
      method: 'POST',
      body: formData // Multer handles boundary automatically
    });
  },

  /**
   * Save / update note content
   */
  async updateNote(id, content) {
    return this.request(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  },

  /**
   * Rename note
   */
  async renameNote(id, newFilename) {
    return this.request(`/api/notes/${encodeURIComponent(id)}/rename`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newFilename })
    });
  },

  /**
   * Delete note
   */
  async deleteNote(id) {
    return this.request(`/api/notes/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  /**
   * Full text search across notes and content
   */
  async searchNotes(query) {
    if (!query || !query.trim()) return [];
    return this.request(`/api/search?q=${encodeURIComponent(query.trim())}`);
  },

  /**
   * URL for direct ZIP backup download
   */
  getBackupUrl() {
    return `${this.getBaseApiUrl()}/api/backup`;
  }
};

window.API = API;
