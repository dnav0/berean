import { app, shell, BrowserWindow, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import Database from 'better-sqlite3'
import { initSchema } from './db/schema'
import { registerHandlers } from './db/handlers'
import { initVault } from './db/vault'

// Keep dev and production data completely separate.
// In dev mode, userData goes to  …/Berean/__dev/  so test notes never
// appear when running a packaged release on the same machine.
if (!app.isPackaged) {
  app.setPath('userData', join(app.getPath('userData'), '__dev'))
}

let db: Database.Database

function createDatabase(): void {
  const dbPath = join(app.getPath('userData'), 'berean.db')
  db = new Database(dbPath)
  initSchema(db)
  registerHandlers(db)
  initVault()
}

function setupAutoUpdater(): void {
  // Only run updater in production
  if (is.dev) return

  // Public repo: releases are downloadable without authentication.
  // If you ever move to a private repo, set a fine-grained PAT
  // (contents:read only) in the GH_TOKEN env var and uncomment:
  //   autoUpdater.requestHeaders = { Authorization: `token ${process.env.GH_TOKEN}` }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', () => {
    // Download starts automatically; nothing to show yet
  })

  autoUpdater.on('update-downloaded', () => {
    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update ready',
        message: 'A new version of Berean has been downloaded.',
        detail: 'Restart the app to apply the update.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0
      })
      .then(({ response }) => {
        if (response === 0) autoUpdater.quitAndInstall()
      })
  })

  autoUpdater.on('error', (err) => {
    console.error('Auto-updater error:', err)
  })

  // Check once on startup, then every 4 hours
  autoUpdater.checkForUpdates()
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000)
}

function resolveIcon(): Electron.NativeImage | undefined {
  // In dev: load from the build/ source folder
  // In production: electron-builder puts resources next to the asar
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(process.resourcesPath ?? '', 'icon.png')
  ]
  for (const p of candidates) {
    if (existsSync(p)) return nativeImage.createFromPath(p)
  }
  return undefined
}

function createWindow(): void {
  const icon = resolveIcon()

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? { titleBarStyle: 'hiddenInset' }
      : { titleBarStyle: 'default', ...(icon ? { icon } : {}) }),
    backgroundColor: '#FAFAFA',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  electronApp.setAppUserModelId('app.getberean.berean')

  // Set dock icon on macOS in dev (production uses the app bundle icon)
  if (process.platform === 'darwin' && is.dev) {
    const icon = resolveIcon()
    if (icon) app.dock.setIcon(icon)
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createDatabase()
  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (db) db.close()
  if (process.platform !== 'darwin') app.quit()
})
