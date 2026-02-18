const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('casmAPI', {
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  analyzeVideo: (payload) => ipcRenderer.invoke('analyze-video', payload),
  renderClips: (payload) => ipcRenderer.invoke('render-clips', payload),
  listProjects: () => ipcRenderer.invoke('list-projects'),
  loadProject: (projectPath) => ipcRenderer.invoke('load-project', projectPath),
  getSystemCapabilities: () => ipcRenderer.invoke('system-capabilities')
});
