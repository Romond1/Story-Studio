import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

let counterWindow: BrowserWindow | null = null;

function createCounterWindow(): void {
  if (counterWindow) {
    counterWindow.focus();
    return;
  }

  counterWindow = new BrowserWindow({
    width: 760,
    height: 420,
    minWidth: 620,
    minHeight: 320,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    alwaysOnTop: true,
    fullscreenable: false,
    skipTaskbar: false,
    title: '20 Questions Counter',
    webPreferences: {
      preload: path.join(__dirname, 'counterPreload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL;
  if (devUrl) {
    void counterWindow.loadURL(`${devUrl}/counter.html`);
  } else {
    void counterWindow.loadFile(path.join(__dirname, '../../renderer/counter.html'));
  }

  counterWindow.on('closed', () => {
    counterWindow = null;
  });
}

app.whenReady().then(() => {
  createCounterWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createCounterWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.on('counter-window:minimize', () => {
  counterWindow?.minimize();
});

ipcMain.on('counter-window:close', () => {
  counterWindow?.close();
});
