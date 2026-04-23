const { app, BrowserWindow, ipcMain, shell, Menu, Tray, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { fork } = require('child_process');

// Auto-updater (optional - graceful if not configured)
let autoUpdater;
try {
  const { autoUpdater: updater } = require('electron-updater');
  autoUpdater = updater;
} catch {
  console.log('[electron] electron-updater not installed, skipping auto-update');
}

const isDev = !app.isPackaged;
let mainWindow;
let tray;
let serverProcess;
let splashWindow;

// Simple JSON-based persistent store (no extra dependencies)
const STORE_PATH = path.join(app.getPath('userData'), 'app-store.json');
const DEFAULT_STORE = {
  windowState: { width: 1440, height: 900, x: undefined, y: undefined, maximized: false },
  autoStart: false,
  minimizeToTray: true,
  notifications: true,
};

function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf-8'));
      return { ...DEFAULT_STORE, ...data };
    }
  } catch (err) {
    console.error('[store] failed to load:', err);
  }
  return { ...DEFAULT_STORE };
}

function saveStore(data) {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[store] failed to save:', err);
  }
}

const store = loadStore();

function getServerPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'dist', 'boot.js');
  }
  return path.join(process.resourcesPath, 'app', 'dist', 'boot.js');
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const splashHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0; display: flex; align-items: center; justify-content: center;
          height: 100vh; background: #0D0D0F; color: #fff; font-family: Inter, sans-serif;
          flex-direction: column; border-radius: 16px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .logo { font-size: 28px; font-weight: 600; letter-spacing: -0.5px; margin-bottom: 8px; }
        .accent { color: #3B6AFF; }
        .status { font-size: 12px; color: rgba(255,255,255,0.4); min-height: 18px; }
        .progress-container {
          width: 200px; height: 3px; background: rgba(255,255,255,0.08);
          border-radius: 2px; margin-top: 20px; overflow: hidden;
        }
        .progress-bar {
          width: 0%; height: 100%; background: #3B6AFF;
          border-radius: 2px; transition: width 0.4s ease;
        }
        .version { font-size: 10px; color: rgba(255,255,255,0.25); margin-top: 16px; }
      </style>
    </head>
    <body>
      <div class="logo"><span class="accent">AI</span> Agent Stack</div>
      <div class="status" id="status">Starting server...</div>
      <div class="progress-container">
        <div class="progress-bar" id="progress"></div>
      </div>
      <div class="version" id="version"></div>
      <script>
        const statusEl = document.getElementById('status');
        const progressEl = document.getElementById('progress');
        const versionEl = document.getElementById('version');
        const msgs = [
          { t: 'Starting server...', p: 15 },
          { t: 'Connecting to database...', p: 35 },
          { t: 'Loading agents...', p: 60 },
          { t: 'Initializing workflows...', p: 80 },
          { t: 'Almost ready...', p: 95 },
        ];
        let i = 0;
        const interval = setInterval(() => {
          const m = msgs[i % msgs.length];
          statusEl.textContent = m.t;
          progressEl.style.width = m.p + '%';
          i++;
        }, 1200);
        window.addEventListener('DOMContentLoaded', () => {
          versionEl.textContent = 'v' + (navigator.userAgent.match(/AI-Agent-Stack\\/([\\d.]+)/)?.[1] || '');
        });
      </script>
    </body>
    </html>
  `;

  splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml));
  splashWindow.center();
}

function createWindow() {
  const windowState = store.windowState;

  mainWindow = new BrowserWindow({
    width: windowState.width,
    height: windowState.height,
    x: windowState.x,
    y: windowState.y,
    minWidth: 1024,
    minHeight: 640,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
    backgroundColor: '#0A0A0C',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (windowState.maximized) {
    mainWindow.maximize();
  }

  const loadApp = (retries = 60) => {
    if (retries <= 0) {
      dialog.showErrorBox(
        'Server Error',
        'The backend server failed to start. Please check your database configuration and try again.'
      );
      return;
    }
    mainWindow.loadURL('http://localhost:3000').catch(() => {
      setTimeout(() => loadApp(retries - 1), 500);
    });
  };

  mainWindow.webContents.on('did-finish-load', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Save window state on change
  const saveState = () => {
    const bounds = mainWindow.getBounds();
    store.windowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: mainWindow.isMaximized(),
    };
    saveStore(store);
  };

  mainWindow.on('resize', saveState);
  mainWindow.on('move', saveState);
  mainWindow.on('maximize', saveState);
  mainWindow.on('unmaximize', saveState);

  // Close to tray instead of quitting
  mainWindow.on('close', (event) => {
    if (!app.isQuiting && tray && store.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    } else {
      saveState();
    }
  });

  setTimeout(() => loadApp(), 1000);
}

function createTray() {
  let trayIcon;
  try {
    const { nativeImage } = require('electron');
    trayIcon = nativeImage.createFromPath(path.join(__dirname, '..', 'build', 'icon.ico'));
    if (process.platform === 'darwin') {
      trayIcon = trayIcon.resize({ width: 16, height: 16 });
    }
  } catch {
    trayIcon = undefined;
  }

  tray = new Tray(trayIcon || path.join(__dirname, '..', 'public', 'favicon.ico'));

  const buildContextMenu = () => {
    return Menu.buildFromTemplate([
      {
        label: 'Show App',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        },
      },
      {
        label: 'Start on Login',
        type: 'checkbox',
        checked: store.autoStart,
        click: (item) => {
          const enabled = item.checked;
          store.autoStart = enabled;
          saveStore(store);
          app.setLoginItemSettings({
            openAtLogin: enabled,
            path: app.getPath('exe'),
          });
        },
      },
      {
        label: 'Minimize to Tray',
        type: 'checkbox',
        checked: store.minimizeToTray,
        click: (item) => {
          store.minimizeToTray = item.checked;
          saveStore(store);
        },
      },
      {
        label: 'Desktop Notifications',
        type: 'checkbox',
        checked: store.notifications,
        click: (item) => {
          store.notifications = item.checked;
          saveStore(store);
        },
      },
      { type: 'separator' },
      {
        label: 'Check for Updates',
        click: () => {
          if (autoUpdater) {
            autoUpdater.checkForUpdatesAndNotify().catch((err) => {
              console.log('[auto-updater] check failed:', err.message);
            });
          } else {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Auto Updater',
              message: 'Auto-updater is not configured. Please download updates manually.',
            });
          }
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuiting = true;
          app.quit();
        },
      },
    ]);
  };

  tray.setToolTip('AI Agent Stack');
  tray.setContextMenu(buildContextMenu());
  tray.on('click', () => {
    if (mainWindow) {
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  });
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reload();
          },
        },
        {
          label: 'Force Reload',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            if (mainWindow) mainWindow.webContents.reloadIgnoringCache();
          },
        },
        {
          label: 'Toggle DevTools',
          accelerator: isDev ? 'F12' : 'CmdOrCtrl+Shift+I',
          click: () => {
            if (mainWindow) mainWindow.webContents.toggleDevTools();
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize to Tray',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            if (mainWindow) mainWindow.hide();
          },
        },
        {
          label: 'Always on Top',
          type: 'checkbox',
          click: (item) => {
            if (mainWindow) mainWindow.setAlwaysOnTop(item.checked);
          },
        },
        { type: 'separator' },
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Check for Updates',
          click: () => {
            if (autoUpdater) {
              autoUpdater.checkForUpdatesAndNotify().catch(() => {
                dialog.showMessageBox(mainWindow, {
                  type: 'info',
                  title: 'Auto Updater',
                  message: 'No updates available.',
                });
              });
            } else {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'Auto Updater',
                message: 'Auto-updater is not installed.',
              });
            }
          },
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            if (mainWindow) {
              mainWindow.webContents.executeJavaScript(`
                document.dispatchEvent(new KeyboardEvent('keydown', { key: '?' }));
              `);
            }
          },
        },
        { type: 'separator' },
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About AI Agent Stack',
              message: 'AI Agent Stack Orchestrator',
              detail: `Version: ${app.getVersion()}\nElectron: ${process.versions.electron}\nNode: ${process.versions.node}\nChrome: ${process.versions.chrome}`,
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function startServer() {
  const serverPath = getServerPath();
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '3000',
    DATABASE_URL: process.env.DATABASE_URL || 'mysql://root@localhost:3306/agentstack',
  };

  try {
    serverProcess = fork(serverPath, {
      env,
      stdio: 'pipe',
      silent: true,
    });

    serverProcess.stdout?.on('data', (data) => {
      console.log(`[Server] ${data}`);
    });

    serverProcess.stderr?.on('data', (data) => {
      console.error(`[Server Error] ${data}`);
    });

    serverProcess.on('error', (err) => {
      console.error('Server failed to start:', err);
      dialog.showErrorBox('Server Error', `Failed to start backend server:\n${err.message}`);
    });

    serverProcess.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
      if (code !== 0 && code !== null) {
        dialog.showErrorBox('Server Crashed', `The backend server exited unexpectedly (code ${code}). Please restart the application.`);
      }
    });
  } catch (err) {
    console.error('Failed to fork server:', err);
    dialog.showErrorBox('Startup Error', `Could not start the application server:\n${err.message}`);
  }
}

function checkForUpdates() {
  if (!autoUpdater) return;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: `A new version (${info.version}) is available.`,
      detail: 'The update will be downloaded in the background and installed when you restart the app.',
    });
  });

  autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'Update downloaded. Restart now to install?',
      buttons: ['Restart', 'Later'],
      defaultId: 0,
    }).then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[auto-updater] error:', err);
  });

  // Check after 5 seconds
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((err) => {
      console.log('[auto-updater] check failed:', err.message);
    });
  }, 5000);
}

// Desktop notification handler
ipcMain.handle('notification:show', (_, { title, body }) => {
  if (!store.notifications) return;
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'AI Agent Stack',
      body: body || '',
      silent: false,
    }).show();
  }
});

// Settings handlers
ipcMain.handle('settings:get', (_, key) => store[key]);
ipcMain.handle('settings:set', (_, key, value) => {
  store[key] = value;
  saveStore(store);
});

// App control
ipcMain.handle('app:restart', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  app.relaunch();
  app.quit();
});

ipcMain.handle('app:get-version', () => app.getVersion());

app.whenReady().then(() => {
  // Set auto-start based on stored preference
  app.setLoginItemSettings({
    openAtLogin: store.autoStart,
    path: app.getPath('exe'),
  });

  createSplashWindow();
  startServer();
  createMenu();
  createWindow();
  createTray();
  checkForUpdates();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow) {
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (serverProcess) {
      serverProcess.kill();
      serverProcess = null;
    }
    app.quit();
  }
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});
