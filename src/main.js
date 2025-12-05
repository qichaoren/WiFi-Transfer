const { app, BrowserWindow, ipcMain, shell } = require('electron');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const ip = require('ip');
const QRCode = require('qrcode');
const path = require('path');
const archiver = require('archiver');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');

// Configure upload storage
const uploadDir = path.join(app.getPath('userData'), 'ReceivedFiles');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
})

const upload = multer({ storage: storage });

let mainWindow;
// Store batches of files: { batchId: { timestamp, files: [{ id, name, path, size }] } }
let fileBatches = new Map();
// Store text history: [{ id, text, timestamp }]
let textHistory = [];

const PORT = 3000;
let wss;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    icon: path.join(__dirname, 'assets', 'ico.png'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  startServer();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function startServer() {
  const expressApp = express();
  const server = http.createServer(expressApp);
  wss = new WebSocket.Server({ server });

  expressApp.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'mobile.html'));
  });

  // Handle mobile uploads
  expressApp.post('/upload', upload.array('files'), (req, res) => {
    const files = req.files;
    if (!files || files.length === 0) {
        return res.status(400).send('No files uploaded.');
    }

    const receivedFiles = files.map(f => ({
        name: f.originalname,
        path: f.path,
        size: f.size,
        timestamp: Date.now()
    }));

    // Notify desktop
    if (mainWindow) {
        mainWindow.webContents.send('files-received', receivedFiles);
    }

    res.send('Upload success');
  });

  // Single file download
  expressApp.get('/download/:batchId/:fileId', (req, res) => {
    const { batchId, fileId } = req.params;
    const batch = fileBatches.get(batchId);
    
    if (!batch) return res.status(404).send('Batch not found');
    
    const file = batch.files.find(f => f.id === fileId);
    if (!file) return res.status(404).send('File not found');

    res.download(file.path, file.name);
  });

  // Batch download (ZIP)
  expressApp.get('/download-batch/:batchId', (req, res) => {
    const { batchId } = req.params;
    const batch = fileBatches.get(batchId);
    
    if (!batch) return res.status(404).send('Batch not found');

    const archive = archiver('zip', { zlib: { level: 9 } });
    
    res.attachment(`batch-${batchId.substr(0, 8)}.zip`);
    archive.pipe(res);

    batch.files.forEach(file => {
      archive.file(file.path, { name: file.name });
    });

    archive.finalize();
  });

  wss.on('connection', (ws) => {
    console.log('Client connected');
    sendHistoryToClient(ws);
  });

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    generateQR();
  });
}

function broadcast(data) {
  if (!wss) return;
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

function sendHistoryToClient(ws) {
    const history = {
        type: 'history',
        batches: Array.from(fileBatches.entries()).map(([id, batch]) => ({
            id,
            timestamp: batch.timestamp,
            files: batch.files.map(f => ({
                id: f.id,
                name: f.name,
                size: f.size,
                url: getFileUrl(id, f.id)
            })),
            zipUrl: getBatchUrl(id)
        })),
        texts: textHistory
    };
    ws.send(JSON.stringify(history));
}

function sendHistoryToRenderer() {
    if (!mainWindow) return;
    
    const batches = Array.from(fileBatches.values());
    mainWindow.webContents.send('update-history', {
        fileBatches: batches,
        textHistory: textHistory
    });
}

function getFileUrl(batchId, fileId) {
    const localIp = ip.address();
    return `http://${localIp}:${PORT}/download/${batchId}/${fileId}`;
}

function getBatchUrl(batchId) {
    const localIp = ip.address();
    return `http://${localIp}:${PORT}/download-batch/${batchId}`;
}

ipcMain.on('share-text', async (event, text) => {
  const textItem = {
      id: crypto.randomUUID(),
      text,
      timestamp: Date.now()
  };
  textHistory.unshift(textItem);
  if (textHistory.length > 20) textHistory.pop();

  broadcast({
      type: 'new-text',
      data: textItem
  });
  
  sendHistoryToRenderer();
});

ipcMain.on('share-files', async (event, files) => {
  const batchId = crypto.randomUUID();
  const batchFiles = files.map(f => ({
      id: crypto.randomUUID(),
      path: f.path,
      name: f.name,
      size: f.size
  }));

  const batch = {
      timestamp: Date.now(),
      files: batchFiles
  };
  
  fileBatches.set(batchId, batch);

  if (fileBatches.size > 10) {
      const firstKey = fileBatches.keys().next().value;
      fileBatches.delete(firstKey);
  }

  const broadcastData = {
      id: batchId,
      timestamp: batch.timestamp,
      files: batchFiles.map(f => ({
          id: f.id,
          name: f.name,
          size: f.size,
          url: getFileUrl(batchId, f.id)
      })),
      zipUrl: getBatchUrl(batchId)
  };

  broadcast({
      type: 'new-batch',
      data: broadcastData
  });
  
  sendHistoryToRenderer();
});

ipcMain.on('request-history', () => {
    sendHistoryToRenderer();
});

ipcMain.on('clear-history', () => {
    fileBatches.clear();
    textHistory = [];
    sendHistoryToRenderer();
    // Optionally notify mobile clients to clear too, but usually history is local session
});

ipcMain.on('open-downloads-folder', () => {
    shell.openPath(uploadDir);
});

ipcMain.on('request-qr', () => {
    generateQR();
});

async function generateQR() {
  const localIp = ip.address();
  const url = `http://${localIp}:${PORT}`;
  try {
    const qr = await QRCode.toDataURL(url);
    if (mainWindow) {
        mainWindow.webContents.send('update-qr', { url, qr });
    }
  } catch (err) {
    console.error(err);
  }
}
