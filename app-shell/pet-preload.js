const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('petMedia', { read: () => ipcRenderer.invoke('pet:bytes') });
