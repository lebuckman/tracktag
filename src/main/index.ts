import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { optimizer, is } from '@electron-toolkit/utils'
import { registerIpcHandlers, cleanScratch } from './ipc'
import { selfUpdateYtdlp, notifyIfAppUpdateAvailable } from './lib/updater'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1080,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#08080b',
    // Traffic lights float over the ambient background; the renderer
    // provides a drag strip along the top edge.
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // A file dropped outside the drop zone would otherwise navigate the
  // window to its file:// URL and blank the app.
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  // F12 devtools in dev; swallow Cmd+R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpcHandlers()
  void cleanScratch()

  const win = createWindow()
  void selfUpdateYtdlp()
  void notifyIfAppUpdateAvailable(win)
})

// TrackTag is a single-window utility, so closing the window (red traffic
// light or Cmd+W) quits outright rather than lingering in the dock the way
// a typical macOS document app would.
app.on('window-all-closed', () => {
  app.quit()
})
