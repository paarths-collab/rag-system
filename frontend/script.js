// Environment-aware API configuration
const API = ''; // Relative path fits all same-origin deployments (localhost & production)

let supabase = null;

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initFileUpload();
    initDropZone();
    fetchDocumentStats();
    checkHealth();
    setInterval(checkHealth, 30000); // Poll every 30 seconds
});

// Toast Notification
function showToast(message, type = "info") {
    // Remove existing toast
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;

    // Add styles if not present
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
                max-width: 400px;
            }
            .toast-success { background: #10b981; }
            .toast-error { background: #ef4444; }
            .toast-warning { background: #f59e0b; }
            .toast-info { background: #3b82f6; }
            .toast button {
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                padding: 0;
                margin-left: 8px;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}




// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
        });
    });
}

// Health Check
async function checkHealth() {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const res = await fetch(`${API}/health`, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json'
            }
        });

        clearTimeout(timeoutId);

        if (res.ok) {
            dot.className = 'status-dot online';
            text.textContent = 'Online';
            console.log('Backend is online');
        } else {
            throw new Error(`HTTP ${res.status}`);
        }
    } catch (e) {
        console.error('Health check failed:', e);
        dot.className = 'status-dot offline';

        if (e.name === 'AbortError') {
            text.textContent = 'Timeout';
        } else if (e.message.includes('Failed to fetch')) {
            text.textContent = 'Connection Failed';
        } else {
            text.textContent = 'Offline';
        }
    }
}

function switchSection(section) {
    currentSection = section;

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.section === section);
    });

    // Update sections
    document.querySelectorAll('.section').forEach(sec => {
        sec.classList.remove('active');
    });
    document.getElementById(`${section}-section`).classList.add('active');

    // Update header
    const titles = {
        chat: { title: 'AI Chat', subtitle: 'Ask questions about your documents' },
        upload: { title: 'Upload Documents', subtitle: 'Add files or paste text to your knowledge base' },
        documents: { title: 'Documents', subtitle: 'View your ingested documents' }
    };

    document.getElementById('page-title').textContent = titles[section].title;
    document.querySelector('.subtitle').textContent = titles[section].subtitle;

    if (section === 'documents') {
        fetchDocumentStats();
    }
}

// Stats
async function fetchDocumentStats() {
    try {
        const res = await fetch(`${API}/stats`);
        if (res.ok) {
            const data = await res.json();
            documentStats = data;
            document.getElementById('doc-count').textContent = data.docs || 0;
            document.getElementById('chunk-count').textContent = data.chunks || 0;
        }
    } catch (err) {
        // Stats endpoint may not exist, ignore
    }
}

// Drop Zone
function initDropZone() {
    const dropZone = document.getElementById('dropZone');
    if (!dropZone) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'));
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'));
    });

    dropZone.addEventListener('drop', handleDrop);
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        document.getElementById('fileInput').files = files;
        handleFileSelect();
    }
}

function handleFileSelect() {
    const fileInput = document.getElementById('fileInput');
    const fileName = document.getElementById('fileName');
    if (fileInput.files.length > 0) {
        fileName.textContent = `Selected: ${fileInput.files[0].name}`;
    }
}

// Handle Enter key in input
function handleKeyPress(event) {
    if (event.key === "Enter") {
        ask();
    }
}

// Toast Notifications
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
        error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };

    toast.innerHTML = `
        <div class="toast-icon">${icons[type]}</div>
        <span class="toast-message">${message}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// Sources Panel
function toggleSourcesPanel() {
    const panel = document.getElementById('sources-panel');
    panel.classList.toggle('open');
}

// Ingest Text
async function ingest() {
    const textObj = document.getElementById("text");
    const text = textObj.value;
    if (!text) {
        showToast("Please enter text to ingest", "warning");
        return;
    }

    const btn = event.target.closest('.btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<span>Processing...</span>';
    btn.disabled = true;

    try {
        const res = await fetch(`${API}/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, source: "user-input" })
        });
        const data = await res.json();
        if (data.status === "skipped") {
            showToast("This text was already uploaded. Skipping duplicate.", "warning");
        } else {
            showToast(`Successfully ingested ${data.chunks} chunks!`, "success");
            fetchDocumentStats();
        }
        textObj.value = "";
    } catch (err) {
        showToast("Error ingesting text: " + err.message, "error");
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// Ingest File
// File Upload
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
    const fileInput = document.getElementById("fileInput");
    const file = fileInput.files[0];

    if (!file) return;

    // UI Feedback
    const fileBtn = document.getElementById("fileBtn");
    const fileName = document.getElementById("fileName");
    const originalText = fileName.textContent;

    fileName.textContent = 'Uploading...';
    if (fileBtn) fileBtn.classList.add('attached');

    const formData = new FormData();
    formData.append("file", file);

    try {
        const res = await fetch(`${API}/ingest-file`, {
            method: "POST",
            body: formData
        });
        const data = await res.json();

        if (data.status === "skipped") {
            showToast(`"${data.filename}" was already uploaded.`, "warning");
        } else {
            showToast(`Successfully ingested "${data.filename}" (${data.chunks} chunks)!`, "success");
            fetchDocumentStats();
        }

        // Reset input
        fileInput.value = "";
        fileName.textContent = "Attach PDF or TXT";
        if (fileBtn) fileBtn.classList.remove('attached');

    } catch (err) {
        showToast("Error uploading file: " + err.message, "error");
        fileName.textContent = "Error";
        setTimeout(() => {
            fileName.textContent = "Attach PDF or TXT";
            if (fileBtn) fileBtn.classList.remove('attached');
        }, 2000);
    }
}

// Ask Question
async function ask() {
    const queryObj = document.getElementById("query");
    const query = queryObj.value.trim();
    if (!query) {
        showToast("Please enter a question", "warning");
        return;
    }

    const chatMessages = document.getElementById("chat-messages");
    const sourcesContainer = document.getElementById("sources");

    // Clear welcome message if present
    const welcomeMsg = chatMessages.querySelector('.welcome-message');
    if (welcomeMsg) welcomeMsg.remove();

    // Add user message
    chatMessages.innerHTML += `
        <div class="message user">
            <div class="message-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
            </div>
            <div class="message-content">${escapeHtml(query)}</div>
        </div>
    `;

    // Add loading message
    const loadingId = 'loading-' + Date.now();
    chatMessages.innerHTML += `
        <div class="message assistant" id="${loadingId}">
            <div class="message-avatar">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                    <path d="M2 17l10 5 10-5"/>
                    <path d="M2 12l10 5 10-5"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;

    chatMessages.scrollTop = chatMessages.scrollHeight;
    queryObj.value = "";

    try {
        const res = await fetch(`${API}/query`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query })
        });

        if (!res.ok) {
            throw new Error(`Server returned ${res.status}`);
        }

        const data = await res.json();

        // Remove loading and add response
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            const answerHTML = marked.parse(data.answer);
            const hasSources = data.citations && data.citations.length > 0;

            loadingEl.querySelector('.message-content').innerHTML = `
                ${answerHTML}
                ${hasSources ? `
                    <button class="sources-toggle" onclick="toggleSourcesPanel()">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                            <polyline points="14,2 14,8 20,8"/>
                        </svg>
                        View ${data.citations.length} sources
                    </button>
                ` : ''}
            `;

            // Update sources panel
            if (hasSources) {
                sourcesContainer.innerHTML = data.citations.map((c, i) => `
                    <div class="source-card">
                        <div class="source-header">
                            <span class="source-name">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                </svg>
                                ${c.source}
                            </span>
                            <div class="score-badges">
                                <span class="score-badge similarity">${(c.similarity * 100).toFixed(0)}% sim</span>
                                <span class="score-badge relevance">${(c.relevance * 100).toFixed(0)}% rel</span>
                            </div>
                        </div>
                        <div class="source-text">${escapeHtml(c.text)}</div>
                    </div>
                `).join('');
            }
        }

        chatMessages.scrollTop = chatMessages.scrollHeight;

    } catch (err) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) {
            loadingEl.querySelector('.message-content').innerHTML = `
                <p style="color: #ef4444;">Error: ${err.message}</p>
            `;
        }
        showToast("Failed to get response: " + err.message, "error");
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
