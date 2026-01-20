// Environment-aware API configuration
const API = ''; // Relative path - works for same-origin deployments

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initFileUpload();
    initQueryInput();
    checkHealth();
    fetchStats();
    setInterval(checkHealth, 30000);
});

// ============ HEALTH CHECK ============
async function checkHealth() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    if (!dot || !text) return;

    try {
        const res = await fetch(`${API}/health`);
        if (res.ok) {
            dot.classList.add('online');
            dot.classList.remove('offline');
            text.textContent = 'Online';
        } else {
            throw new Error('Not OK');
        }
    } catch (e) {
        dot.classList.add('offline');
        dot.classList.remove('online');
        text.textContent = 'Offline';
    }
}

// ============ STATS ============
async function fetchStats() {
    try {
        const res = await fetch(`${API}/stats`);
        if (res.ok) {
            const data = await res.json();
            const docEl = document.getElementById('docCount');
            const chunkEl = document.getElementById('chunkCount');
            if (docEl) docEl.textContent = data.docs || 0;
            if (chunkEl) chunkEl.textContent = data.chunks || 0;
        }
    } catch (e) {
        console.log('Stats fetch failed:', e);
    }
}

// ============ FILE UPLOAD ============
function initFileUpload() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                ingestFile();
            }
        });
    }
}

async function ingestFile() {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    const fileBtn = document.getElementById('fileBtn');

    if (!fileInput || !fileInput.files[0]) return;

    const file = fileInput.files[0];

    // Show uploading state
    if (fileName) fileName.textContent = 'Uploading...';
    if (fileBtn) fileBtn.classList.add('attached');

    const formData = new FormData();
    formData.append('file', file);

    try {
        const res = await fetch(`${API}/ingest-file`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();

        if (data.status === 'skipped') {
            showToast(`"${data.filename}" was already uploaded.`, 'warning');
        } else {
            showToast(`Uploaded "${data.filename}" (${data.chunks} chunks)`, 'success');
            fetchStats();
        }
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    } finally {
        // Reset UI
        if (fileInput) fileInput.value = '';
        if (fileName) fileName.textContent = 'Attach PDF or TXT';
        if (fileBtn) fileBtn.classList.remove('attached');
    }
}

// ============ TEXT INPUT ============
function toggleTextInput() {
    const area = document.getElementById('textInputArea');
    const toggle = document.getElementById('textToggle');
    if (area) area.classList.toggle('visible');
    if (toggle) toggle.classList.toggle('active');
}

async function ingestText() {
    const textArea = document.getElementById('textContent');
    if (!textArea) return;

    const text = textArea.value.trim();
    if (!text) {
        showToast('Please enter some text', 'warning');
        return;
    }

    try {
        const res = await fetch(`${API}/ingest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, source: 'pasted-text' })
        });
        const data = await res.json();

        if (data.status === 'skipped') {
            showToast('This text was already in your knowledge base.', 'warning');
        } else {
            showToast(`Added ${data.chunks} chunks to knowledge base`, 'success');
            fetchStats();
        }
        textArea.value = '';
    } catch (err) {
        showToast('Failed to add text: ' + err.message, 'error');
    }
}

// ============ ASK QUESTION ============
function initQueryInput() {
    const queryInput = document.getElementById('query');
    if (queryInput) {
        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                ask();
            }
        });
    }
}

async function ask() {
    const queryInput = document.getElementById('query');
    const messages = document.getElementById('messages');
    const typing = document.getElementById('typing');

    if (!queryInput || !messages) return;

    const query = queryInput.value.trim();
    if (!query) return;

    // Remove welcome message
    const welcome = document.getElementById('welcome');
    if (welcome) welcome.remove();

    // Add user message
    addMessage('You', escapeHtml(query), 'user');
    queryInput.value = '';

    // Show typing indicator
    if (typing) typing.classList.add('active');

    try {
        const res = await fetch(`${API}/query`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const data = await res.json();

        // Hide typing
        if (typing) typing.classList.remove('active');

        // Add AI response
        addAIResponse(data.answer, data.citations);

    } catch (err) {
        if (typing) typing.classList.remove('active');
        addMessage('System', 'Error: ' + err.message, 'error');
    }
}

function addMessage(label, content, type) {
    const messages = document.getElementById('messages');
    if (!messages) return;

    const group = document.createElement('div');
    group.className = 'message-group';

    let contentClass = 'message-content';
    if (type === 'user') contentClass += ' user-text';
    if (type === 'error') contentClass += ' error-msg';

    group.innerHTML = `
        <div class="message-label">${label}</div>
        <div class="${contentClass}">${content}</div>
    `;
    messages.appendChild(group);
    messages.scrollTop = messages.scrollHeight;
}

function addAIResponse(answer, citations) {
    const messages = document.getElementById('messages');
    if (!messages) return;

    const group = document.createElement('div');
    group.className = 'message-group';

    let sourcesHTML = '';
    if (citations && citations.length > 0) {
        sourcesHTML = `
            <div class="sources-section">
                <div class="sources-header">
                    ${citations.length} Source${citations.length > 1 ? 's' : ''} Found
                </div>
                ${citations.map(c => `
                    <div class="source-item">
                        <div class="source-meta">
                            <span class="source-name">${escapeHtml(c.source)}</span>
                            <div class="source-scores">
                                <span class="score-tag">${(c.similarity * 100).toFixed(0)}% sim</span>
                                <span class="score-tag">${(c.relevance * 100).toFixed(0)}% rel</span>
                            </div>
                        </div>
                        <div class="source-text">${escapeHtml(c.text)}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    group.innerHTML = `
        <div class="message-label">Assistant</div>
        <div class="message-content">
            <div class="ai-response">
                <div class="response-body">${answer.replace(/\*/g, '')}</div>
                ${sourcesHTML}
            </div>
        </div>
    `;
    messages.appendChild(group);
    messages.scrollTop = messages.scrollHeight;
}

// ============ UTILITIES ============
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;

    // Add styles if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 14px 24px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                z-index: 9999;
                animation: toastIn 0.3s ease;
            }
            .toast-success { background: #10b981; }
            .toast-error { background: #ef4444; }
            .toast-warning { background: #f59e0b; }
            .toast-info { background: #3b82f6; }
            @keyframes toastIn {
                from { transform: translateY(20px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}
