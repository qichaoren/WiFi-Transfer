const { ipcRenderer, shell } = require('electron');
const path = require('path');

// State
let pendingFiles = [];

// DOM Elements
const navBtns = document.querySelectorAll('.nav-btn');
const tabContents = document.querySelectorAll('.tab-content');
const subTabBtns = document.querySelectorAll('.sub-tab-btn');
const viewSections = document.querySelectorAll('.view-section');

// Send Tab Elements
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const pendingArea = document.getElementById('pending-files-area');
const pendingList = document.getElementById('pending-list');
const pendingCount = document.getElementById('pending-count');
const clearPendingBtn = document.getElementById('clear-pending-btn');
const shareFileBtn = document.getElementById('share-file-btn');

const textInput = document.getElementById('text-input');
const shareTextBtn = document.getElementById('share-text-btn');
const textHistoryList = document.getElementById('text-history-list');

// Receive Tab Elements
const receivedList = document.getElementById('received-list');
const openReceivedFolderBtn = document.getElementById('open-received-folder-btn');

// History Tab Elements
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// Settings Tab Elements
const connectionText = document.getElementById('connection-text');
const statusIndicator = document.querySelector('.status-indicator');
const qrImage = document.getElementById('qr-image');
const urlText = document.getElementById('url-text');

// --- Navigation Logic ---

// Main Tabs
navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        navBtns.forEach(b => b.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        const tabId = btn.dataset.tab;
        document.getElementById(`${tabId}-tab`).classList.add('active');
    });
});

// Sub Tabs (Send File / Send Text)
subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        subTabBtns.forEach(b => b.classList.remove('active'));
        viewSections.forEach(s => s.classList.remove('active'));
        
        btn.classList.add('active');
        const subTabId = btn.dataset.subtab;
        document.getElementById(`send-${subTabId}-view`).classList.add('active');
    });
});

// --- File Sending Logic ---

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
    if (e.dataTransfer.files.length > 0) {
        addFiles(Array.from(e.dataTransfer.files));
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        addFiles(Array.from(e.target.files));
        fileInput.value = ''; // Reset input
    }
});

function addFiles(files) {
    const newFiles = files.map(f => ({
        path: f.path,
        name: f.name,
        size: f.size
    }));
    
    // Filter duplicates
    const uniqueFiles = newFiles.filter(nf => 
        !pendingFiles.some(pf => pf.path === nf.path)
    );
    
    pendingFiles = [...pendingFiles, ...uniqueFiles];
    updatePendingUI();
}

function removeFile(index) {
    pendingFiles.splice(index, 1);
    updatePendingUI();
}

// Expose to global for inline onclick
window.removeFile = removeFile;

function updatePendingUI() {
    pendingCount.textContent = pendingFiles.length;
    
    if (pendingFiles.length > 0) {
        pendingArea.style.display = 'flex';
        shareFileBtn.disabled = false;
        
        pendingList.innerHTML = pendingFiles.map((file, index) => `
            <div class="file-item">
                <i class="ri-file-text-line file-icon"></i>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-size">${formatSize(file.size)}</div>
                </div>
                <button class="remove-btn" onclick="removeFile(${index})">
                    <i class="ri-close-line"></i>
                </button>
            </div>
        `).join('');
    } else {
        pendingArea.style.display = 'none';
        shareFileBtn.disabled = true;
        pendingList.innerHTML = '';
    }
}

clearPendingBtn.addEventListener('click', () => {
    pendingFiles = [];
    updatePendingUI();
});

shareFileBtn.addEventListener('click', () => {
    if (pendingFiles.length > 0) {
        ipcRenderer.send('share-files', pendingFiles);
        
        // Visual feedback
        const originalText = shareFileBtn.innerHTML;
        shareFileBtn.innerHTML = '<i class="ri-check-line"></i> 发送成功';
        shareFileBtn.disabled = true;
        
        setTimeout(() => {
            shareFileBtn.innerHTML = originalText;
            pendingFiles = [];
            updatePendingUI();
        }, 1500);
    }
});

// --- Text Sending Logic ---

shareTextBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text) {
        ipcRenderer.send('share-text', text);
        
        const originalText = shareTextBtn.innerHTML;
        shareTextBtn.innerHTML = '<i class="ri-check-line"></i> 已发送';
        
        setTimeout(() => {
            shareTextBtn.innerHTML = originalText;
        }, 1500);
        
        textInput.value = '';
    }
});

// --- Receiving Logic ---

ipcRenderer.on('files-received', (event, files) => {
    // Switch to receive tab
    document.querySelector('[data-tab="receive"]').click();
    
    const emptyState = receivedList.querySelector('.empty-state');
    if (emptyState) emptyState.remove();
    
    files.forEach(file => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.innerHTML = `
            <i class="ri-download-line file-icon"></i>
            <div class="file-info">
                <div class="file-name">${file.name}</div>
                <div class="file-size">${formatSize(file.size)}</div>
            </div>
            <button class="secondary-btn" onclick="openFile('${file.path.replace(/\\/g, '\\\\')}')">打开</button>
        `;
        receivedList.insertBefore(div, receivedList.firstChild);
    });
});

window.openFile = (path) => {
    shell.openPath(path);
};

openReceivedFolderBtn.addEventListener('click', () => {
    ipcRenderer.send('open-downloads-folder');
});

// --- History Logic ---

ipcRenderer.on('update-history', (event, { fileBatches, textHistory }) => {
    renderHistory(fileBatches);
    renderTextHistory(textHistory);
});

function renderHistory(batches) {
    if (!batches || batches.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <i class="ri-history-line empty-icon"></i>
                <p>暂无传输历史</p>
            </div>
        `;
        return;
    }

    // Sort by timestamp desc
    const sortedBatches = [...batches].sort((a, b) => b.timestamp - a.timestamp);

    historyList.innerHTML = sortedBatches.map(batch => {
        const date = new Date(batch.timestamp).toLocaleString();
        const fileCount = batch.files.length;
        const fileNames = batch.files.map(f => f.name).join(', ');
        
        return `
            <div class="file-item">
                <i class="ri-folder-zip-line file-icon"></i>
                <div class="file-info">
                    <div class="file-name">发送了 ${fileCount} 个文件</div>
                    <div class="file-size">${date} - ${fileNames}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderTextHistory(texts) {
    if (!texts || texts.length === 0) {
        textHistoryList.innerHTML = '<div style="padding:16px; color:#999; text-align:center;">暂无发送记录</div>';
        return;
    }

    textHistoryList.innerHTML = texts.map(item => `
        <div class="file-item">
            <i class="ri-message-2-line file-icon"></i>
            <div class="file-info">
                <div class="file-name">${item.text}</div>
                <div class="file-size">${new Date(item.timestamp).toLocaleTimeString()}</div>
            </div>
            <button class="text-btn" onclick="copyText('${item.text.replace(/'/g, "\\'")}')">复制</button>
        </div>
    `).join('');
}

window.copyText = (text) => {
    navigator.clipboard.writeText(text);
};

clearHistoryBtn.addEventListener('click', () => {
    ipcRenderer.send('clear-history');
});

// --- Connection & QR ---

ipcRenderer.on('update-qr', (event, { url, qr }) => {
    if (qrImage) qrImage.src = qr;
    if (urlText) urlText.textContent = url;
    
    connectionText.textContent = '服务运行中';
    statusIndicator.classList.add('connected');
});

// Initial Request
ipcRenderer.send('request-qr');
ipcRenderer.send('request-history');

// --- Utils ---

function formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
