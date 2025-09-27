async function loadStore() {
    const container = document.getElementById('library');
    const overlay = document.getElementById('overlay');
    const overlayImg = document.getElementById('overlay-img');
    const overlayTitle = document.getElementById('overlay-title');
    const downloadBtn = document.getElementById('download-btn');
    const installBtn = document.getElementById('install-btn');
    const playBtn = document.getElementById('play-btn');
    const libraryBtn = document.getElementById('library-btn');
    const progress = document.getElementById('progress');

    // Fetch games from API
    const res = await fetch('https://smoke.gingr.workers.dev/api/games');
    let games = await res.json();

    // Ensure alphabetical order client-side (case-insensitive)
    games = games.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    container.innerHTML = '';

    // Get installed games
    let installed = [];
    if (window.electronAPI && window.electronAPI.listInstalledGames) {
        installed = await window.electronAPI.listInstalledGames();
    }

    // Normalization: ignore '-', '_' and spaces for comparisons (do not modify on-disk names)
    const normalizeKey = (s) => {
        if (!s) return '';
        return s.toLowerCase().replace(/[-_\s]/g, '');
    };

    const cards = [];
    games.forEach(g => {
        // Only show if not installed (compare normalized names)
        const isInstalled = installed.some(game => normalizeKey(game.name) === normalizeKey(g.name));
        if (!isInstalled) {
            const card = document.createElement('div');
            card.className = 'game-card';
            const img = document.createElement('img');
            img.src = g.cover_url;
            img.alt = g.name;
            const title = document.createElement('div');
            title.className = 'game-title';
            title.textContent = g.name;
            card.appendChild(img);
            card.appendChild(title);
            card.addEventListener('click', () => {
                overlayImg.src = g.cover_url;
                overlayTitle.textContent = g.name;
                progress.textContent = '';
                overlay.style.display = 'flex';

                downloadBtn.style.display = '';
                installBtn.style.display = 'none'; // Only show after download
                libraryBtn.style.display = 'none';

                downloadBtn.onclick = () => {
                    const filename = g.name.replace(/\s+/g,'_') + '.rar';
                    progress.textContent = 'Starting download…';
                    window.electronAPI.downloadGame(g.download_url, filename);
                };
            });
            container.appendChild(card);
            cards.push({ card, name: g.name });
        }
    });

    // Overlay close
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
    });

    // Go to library
    libraryBtn.onclick = () => {
        window.location.href = 'library.html';
    };

    // Search/filtering: ignore -, _ and spaces when matching
    const searchInput = document.getElementById('search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = normalizeKey(searchInput.value || '');
            cards.forEach(({ card, name }) => {
                const key = normalizeKey(name);
                const ok = key.includes(q);
                card.style.display = ok ? '' : 'none';
            });
        });
    }

    // Download progress
    if (window.electronAPI) {
        window.electronAPI.onDownloadProgress((event, { received, total }) => {
            const percent = total ? Math.round((received / total) * 100) : 0;

            function fmt(n) {
                return Number(n).toFixed(3);
            }

            let unitLabel, r, t;
            const KB = 1024;
            const MB = KB * 1024;
            const GB = MB * 1024;
            const TB = GB * 1024;

            if (total < GB) {
                unitLabel = 'MB';
                r = received / MB;
                t = total / MB;
            } else if (total < TB) {
                unitLabel = 'GB';
                r = received / GB;
                t = total / GB;
            } else {
                unitLabel = 'TB';
                r = received / TB;
                t = total / TB;
            }

            progress.textContent = `Downloading: ${percent}% (${fmt(r)} ${unitLabel} of ${fmt(t)} ${unitLabel})`;
        });
        window.electronAPI.onDownloadComplete((event, filepath) => {
            progress.textContent = `Download complete. Installing…`;
            installBtn.style.display = '';
            downloadBtn.style.display = 'none';
        });
        installBtn.onclick = () => {
            // Install logic handled automatically after download in main.js
            progress.textContent = 'Installing…';
        };
        window.electronAPI.onInstallProgress((event, data) => {
            if (data.percent !== undefined) {
                progress.textContent = `Installing: ${data.percent}%`;
            } else if (data.message) {
                progress.textContent = `Installing: ${data.message}`;
            }
        });
        window.electronAPI.onInstallComplete((event, filename) => {
            progress.textContent = `Installation complete: ${filename}`;
            playBtn.style.display = '';
            installBtn.style.display = 'none';
            libraryBtn.style.display = '';
        });
        window.electronAPI.onInstallError((event, filename) => {
            progress.textContent = `Installation failed: ${filename}`;
        });
    }
}
document.addEventListener('DOMContentLoaded', loadStore);
