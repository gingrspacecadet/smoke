const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const os = require('os');
const https = require('https');
const path = require('path');
const { spawn } = require('child_process');

const HOME = os.homedir();
const SMOKE_DIR = path.join(HOME, '.smoke');
const DOWNLOADS_DIR = path.join(SMOKE_DIR, 'downloads');
const APPS_DIR = path.join(SMOKE_DIR, 'apps');

let mainWindow;

// Ensure directories exist
[SMOKE_DIR, DOWNLOADS_DIR, APPS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'store.html')).catch(err => console.error(err));
}

// --- Helper: Install (extract) archive per file ---
function installArchive(srcFile, destDir, event) {
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  // Pick the right 7z binary for the platform
  const binName = process.platform === 'win32'
    ? '7z.exe'
    : '7z'; // Linux/macOS binaries
  const binPath = path.join(__dirname, '../resources/7z', process.platform, binName);

  // 7z args:
  // x = extract with full paths
  // -y = assume yes
  // -bsp1 = show progress percentage on stdout
  const args = ['x', '-y', srcFile, `-o${destDir}`, '-bsp1'];

  const extractor = spawn(binPath, args);

  extractor.stdout.on('data', (chunk) => {
    const str = chunk.toString();
    // 7z prints progress as "%", we can parse it
    const match = str.match(/(\d+)%/);
    if (match) {
      event.sender.send('install-progress', { percent: parseInt(match[1], 10) });
    } else {
      event.sender.send('install-progress', { message: str.trim() });
    }
  });

  extractor.stderr.on('data', (chunk) => {
    console.error('7z error:', chunk.toString());
  });

  extractor.on('close', (code) => {
    if (code === 0) {
      // Mark .exe as executable on Linux/macOS
      if (process.platform !== 'win32') {
        const base = path.basename(srcFile, path.extname(srcFile));

        // Build candidate exe paths to try, in order of preference.
        // We won't construct folder names that contain spaces; instead we try
        // the most common layouts and then fall back to a normalized recursive search.
        const candidates = [];

        // 1) destDir/<base>/<base>.exe  (typical if archive contains a folder named exactly)
        candidates.push(path.join(destDir, base, `${base}.exe`));

        // 2) destDir/<base-without-underscores-or-dashes>/<name>.exe
        const squished = base.replace(/[-_]/g, '');
        if (squished !== base) candidates.push(path.join(destDir, squished, `${squished}.exe`));

        // 3) destDir/<base>.exe (extracted at root)
        candidates.push(path.join(destDir, `${base}.exe`));

        // Try candidates
        let found = null;
        for (const c of candidates) {
          try {
            fs.accessSync(c, fs.constants.F_OK);
            found = c;
            break;
          } catch (e) {
            // continue
          }
        }

        // Last resort: search recursively for any exe that matches base (normalization-only)
        if (!found) {
          const searched = findExeRecursive(destDir, base);
          if (searched) found = searched;
        }

        if (found) {
          try {
            fs.chmodSync(found, 0o755);
          } catch (err) {
            console.error('Failed to chmod exe:', found, err);
          }
        } else {
          console.error('Could not find extracted exe to chmod under', destDir, 'for', base);
        }
      }
      event.sender.send('install-complete', path.basename(srcFile));
    } else {
      event.sender.send('install-error', `7z exited with code ${code}`);
    }
  });
}

function findCoverRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isFile() && entry.name.match(/\.(png|jpe?g)$/i)) {
      return fullPath;
    } else if (entry.isDirectory()) {
      const found = findCoverRecursive(fullPath);
      if (found) return found;
    }
  }

  return null;
}

// Find an .exe under dir. If base is provided, prefer files that match or contain the base name.
function findExeRecursive(dir, base) {
  const exes = [];

  function walk(curr) {
    let entries;
    try {
      entries = fs.readdirSync(curr, { withFileTypes: true });
    } catch (err) {
      return;
    }

    for (const entry of entries) {
      const full = path.join(curr, entry.name);
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.exe')) {
        exes.push(full);
      } else if (entry.isDirectory()) {
        walk(full);
      }
    }
  }

  walk(dir);

  if (!exes.length) return null;

  if (base) {
    // Normalize function: ignore '-', '_' and spaces for matching (remove them).
    const normalize = s => s.toLowerCase().replace(/[-_\s]/g, '');
    const baseKey = normalize(base);

    // prefer exact (after normalization), then contains, else first
    const exact = exes.find(p => normalize(path.basename(p, '.exe')) === baseKey);
    if (exact) return exact;

    const contains = exes.find(p => normalize(path.basename(p, '.exe')).includes(baseKey));
    if (contains) return contains;
  }

  return exes[0];
}

// List installed games with optional cover image
ipcMain.handle('list-installed-games', async () => {
  if (!fs.existsSync(APPS_DIR)) return [];

  const dirs = fs.readdirSync(APPS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^[\w]/.test(d.name) && !d.name.startsWith('_'))
    .map(d => d.name);

  const games = dirs
    .filter(name => {
      // consider installed if an executable exists under the app dir that matches the name
      const gameDir = path.join(APPS_DIR, name);
      const foundExe = findExeRecursive(gameDir, name);
      return !!foundExe;
    })
    .map(name => {
      const gameDir = path.join(APPS_DIR, name);
      const cover = findCoverRecursive(gameDir); // recursively find image
      return { name, cover };
    });

  // Sort alphabetically by name (case-insensitive)
  games.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  return games;
});

// Run a game
ipcMain.handle('run-game', async (_, name) => {
  const gameDir = path.join(APPS_DIR, name);
  // try the straightforward path first, then fall back to recursive lookup that ignores - _ and spaces
  let exePath = path.join(gameDir, `${name}.exe`);
  if (!fs.existsSync(exePath)) {
    exePath = findExeRecursive(gameDir, name);
  }
  if (!exePath) throw new Error('Game executable not found');
  if (process.platform === 'linux') {
    spawn('wine', [exePath], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn(exePath, { detached: true, stdio: 'ignore' }).unref();
  }
  return true;
});

// --- Download + Install handler ---
ipcMain.on('download-game', async (event, { url, filename }) => {
  const dest = path.join(DOWNLOADS_DIR, filename);
  if (fs.existsSync(dest)) {
    // File already downloaded, skip to extraction
    event.sender.send('download-complete', dest);
    try {
      await installArchive(dest, APPS_DIR, event);
    } catch (err) {
      console.error('Install error:', err);
      event.sender.send('install-error', filename);
    }
    return;
  }

  const file = fs.createWriteStream(dest);
  let received = 0;

  https.get(url, (res) => {
    const total = parseInt(res.headers['content-length'], 10) || 0;

    res.on('data', chunk => {
      received += chunk.length;
      event.sender.send('download-progress', { received, total });
    });

    res.pipe(file);

    file.on('finish', async () => {
      file.close();
      event.sender.send('download-complete', dest);

      try {
        const gameName = path.basename(filename, path.extname(filename));
        await installArchive(dest, path.join(APPS_DIR, gameName), event);
      } catch (err) {
        console.error('Install error:', err);
        event.sender.send('install-error', filename);
      }
    });
  }).on('error', err => {
    console.error('Download error:', err);
    event.sender.send('download-error', filename);
  });
});

// --- Electron lifecycle ---
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
