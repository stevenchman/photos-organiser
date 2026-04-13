const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

// ── Single-instance lock ───────────────────────────────────────────────────
// Prevents a second instance from launching and corrupting localStorage/GPU cache
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

const PORT = 5173;
const FLASK_URL = `http://127.0.0.1:${PORT}`;
const IS_PACKAGED = app.isPackaged;

let flaskProcess = null;
let mainWindow = null;

function startFlask() {
  let exe, args, cwd;

  if (IS_PACKAGED) {
    const backendDir = path.join(process.resourcesPath, 'flex-backend');
    exe = path.join(backendDir, 'flex-backend.exe');
    args = [];
    cwd = backendDir;
  } else {
    exe = path.join(__dirname, '..', 'venv', 'Scripts', 'python.exe');
    args = [path.join(__dirname, '..', 'app.py')];
    cwd = path.join(__dirname, '..');
  }

  const ffmpegDir = IS_PACKAGED
    ? path.join(process.resourcesPath, 'ffmpeg')
    : null;

  flaskProcess = spawn(exe, args, {
    cwd,
    env: {
      ...process.env,
      ELECTRON: '1',
      ...(ffmpegDir ? { FFMPEG_DIR: ffmpegDir } : {}),
    },
    windowsHide: true,
  });

  flaskProcess.stdout.on('data', d => console.log('[flask]', d.toString().trim()));
  flaskProcess.stderr.on('data', d => console.error('[flask]', d.toString().trim()));
}

function waitForFlask(retries = 30, delay = 500) {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      http.get(FLASK_URL, res => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (retries-- <= 0) return reject(new Error('Flask did not start in time'));
        setTimeout(attempt, delay);
      });
    };
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#040609',
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(FLASK_URL);
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('maximize',   () => mainWindow.webContents.send('window-state', 'maximized'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', 'normal'));
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.flex.app');
  startFlask();
  try {
    await waitForFlask();
    createWindow();
  } catch (err) {
    console.error(err.message);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (flaskProcess) flaskProcess.kill();
  app.quit();
});

// ── Window controls ────────────────────────────────────────────────────────
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());
