const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const Store = require('electron-store');
const { runAnalysis, renderClips, listProjects, loadProject, saveProject, getSystemCapabilities } = require('./services/videoPipeline');

const store = new Store({
  name: 'casm-clips-settings',
  defaults: {
    outputDir: path.join(os.homedir(), 'Videos', 'CasmClips'),
    captionStyle: 'neon',
    fontFamily: 'Inter',
    gpuAcceleration: true,
    autoMusic: false,
    language: 'auto',
    clipsPerVideo: 5,
    minClipSeconds: 15,
    maxClipSeconds: 60
  }
});

function ensureOutputDir() {
  const outputDir = store.get('outputDir');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
}

function createWindow() {
  ensureOutputDir();

  const win = new BrowserWindow({
    width: 1520,
    height: 920,
    minWidth: 1200,
    minHeight: 760,
    backgroundColor: '#090909',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.loadFile(path.join(__dirname, 'src/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-video-file', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Select local video file',
    properties: ['openFile'],
    filters: [
      { name: 'Videos', extensions: ['mp4', 'mov', 'mkv', 'avi', 'webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-settings', () => store.store);
ipcMain.handle('save-settings', (_event, settings) => {
  Object.entries(settings).forEach(([key, value]) => {
    store.set(key, value);
  });
  ensureOutputDir();
  return store.store;
});

ipcMain.handle('analyze-video', async (_event, payload) => {
  const settings = store.store;
  const analysis = await runAnalysis(payload, settings);
  await saveProject(analysis.projectFile, analysis.project);
  return analysis;
});

ipcMain.handle('render-clips', async (_event, payload) => {
  const settings = store.store;
  const rendered = await renderClips(payload, settings);
  await saveProject(rendered.projectFile, rendered.project);
  return rendered;
});

ipcMain.handle('list-projects', () => listProjects(store.get('outputDir')));
ipcMain.handle('load-project', (_event, projectPath) => loadProject(projectPath));
ipcMain.handle('system-capabilities', () => getSystemCapabilities());
