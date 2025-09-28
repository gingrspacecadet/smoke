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

    let currentCame = null;

    // small notify helper (best-effort)
    async function notify(opts) {
        try {
            if (window.electronAPI && window.electronAPI.notify) {
                // don't block on notify; fire-and-forget
                window.electronAPI.notify(opts).catch(()=>{});
            }
        } catch (e) {
            // ignore
            console.debug('notify failed', e);
        }
    }

    // Helper: format bytes into MB/GB/TB with 3 decimal places
    function formatBytes(size) {
        const KB = 1024;
        const MB = KB * 1024;
        const GB = MB * 1024;
        const TB = GB * 1024;
        function fmt(n) { return Number(n).toFixed(3); }
        if (size < MB) {
            return `${fmt(size / MB)} MB`;
        } else if (size < GB) {
            return `${fmt(size / GB)} GB`;
        } else if (size < TB) {
            return `${fmt(size / GB)} GB`;
        }
        return `${fmt(size / TB)} TB`;
    }

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
            card.addEventListener('click', async () => {
                currentGame = g;
                overlayImg.src = g.cover_url;
                overlayTitle.textContent = g.name;
                progress.textContent = '';
                overlay.style.display = 'flex';

                downloadBtn.style.display = '';
                installBtn.style.display = 'none'; // Only show after download
                libraryBtn.style.display = 'none';
                playBtn.style.display = 'none';
                // Clear and hide the download size until we fetch it
                const sizeEl = document.getElementById('download-size');
                if (sizeEl) {
                    sizeEl.style.display = 'none';
                    sizeEl.textContent = '';
                }

                // Try to fetch game details (including size_bytes) from our API
                try {
                    const detailRes = await fetch(`https://smoke.gingr.workers.dev/api/games/${g.id}`);
                    if (detailRes.ok) {
                        const details = await detailRes.json();
                        if (details.size_bytes !== undefined && details.size_bytes !== null) {
                            const formatted = formatBytes(details.size_bytes);
                            if (sizeEl) {
                                sizeEl.textContent = `(${formatted})`;
                                sizeEl.style.display = '';
                            }
                        }
                    }
                } catch (err) {
                    // ignore failures to probe size
                }

                // install progress notification milestone tracking
                let lastInstallNotifyPercent = -1;

                downloadBtn.onclick = async () => {
                    const filename = g.name.replace(/\s+/g,'_') + '.rar';
                    progress.textContent = 'Starting download...';
                    notify({
                        title: 'Starting download',
                        body: `Downloading ${g.name}`,
                        icon: g.cover_url,
                        timeoutMs: 8000
                    });
                    // start download (main process will handle and emit progress)
                    window.electronAPI.downloadGame(g.download_url, filename);
                };

                // in case user pressed install manually (we rely on main to auto-install on download completion,
                // but keep the button wired if they want to trigger)
                installBtn.onclick = () => {
                    progress.textContent = 'Installing...';
                };

                // Listen for events while overlay open (handlers are global below too, but local vars help)
                // We'll set up local listeners on the global API (the global handlers are also set up
                // further down to handle other overlays)
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

    // Download & Install handling (global wiring)
    if (window.electronAPI) {
        // Download progress
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

        // When download completes, enable install button and notify
        window.electronAPI.onDownloadComplete((event, filepath) => {
        progress.textContent = `Download complete. Installing...`;
        installBtn.style.display = '';
        downloadBtn.style.display = 'none';

        notify({
            title: 'Download Complete',
            body: `${currentGame?.name ?? 'Game'} downloaded — installing now.`,
            icon: currentGame?.cover_url,
            timeoutMs: 8000
        });
        });

        // Install progress updates (throttled notifications)
        let lastNotifiedInstallPercent = -1;
        window.electronAPI.onInstallProgress((event, data) => {
            if (data.percent !== undefined) {
                progress.textContent = `Installing: ${data.percent}%`;

                // notify at 10% intervals (10,20,...,90) and at 100
                const pct = Math.max(0, Math.min(100, Math.floor(data.percent)));
                const milestone = Math.floor(pct / 10) * 10;
                if (pct === 100 || milestone !== lastNotifiedInstallPercent && pct >= 10 && pct % 10 === 0) {
                    lastNotifiedInstallPercent = milestone === 0 ? lastNotifiedInstallPercent : milestone;
                    notify({
                        title: 'Installing',
                        body: `${Math.round(pct)}% installed`,
                        timeoutMs: 4000
                    });
                }
            } else if (data.message) {
                progress.textContent = `Installing: ${data.message}`;
            }
        });

        // Install complete
        window.electronAPI.onInstallComplete((event, filename) => {
        progress.textContent = `Installation complete: ${filename}`;
        playBtn.style.display = '';
        installBtn.style.display = 'none';
        libraryBtn.style.display = '';

        // notify with actions: Play, Open folder
        notify({
            title: 'Install Complete',
            body: `${currentGame?.name ?? filename} installed.`,
            icon: currentGame?.cover_url,
            timeoutMs: 12000,
            actions: [
            { label: 'Play', type: 'play', payload: { name: currentGame?.name } },
            { label: 'Open Folder', type: 'open-folder', payload: { name: currentGame?.name } }
            ]
        });

        // refresh library after a short delay
        setTimeout(() => loadStore(), 700);
        });

        // Install error
        window.electronAPI.onInstallError((event, filenameOrMessage) => {
        progress.textContent = `Installation failed: ${String(filenameOrMessage)}`;
        notify({
            title: 'Install Failed',
            body: String(filenameOrMessage),
            icon: currentGame?.cover_url,
            timeoutMs: 10000
        });
        });
    }
}
document.addEventListener('DOMContentLoaded', loadStore);