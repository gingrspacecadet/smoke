async function loadLibrary() {
  const container = document.getElementById('library');
  const overlay = document.getElementById('overlay');
  const overlayImg = document.getElementById('overlay-img');
  const overlayTitle = document.getElementById('overlay-title');
  const playBtn = document.getElementById('play-btn');

  // Parse URL params for auto-select
  const params = new URLSearchParams(window.location.search);
  const selectedGame = params.get('selected');

  try {
    // Get installed games
    const installed = await window.electronAPI.listInstalledGames();
    if (!installed.length) {
      container.textContent = 'No games installed.';
      return;
    }

    // Fetch all games from API for cover URLs
    const res = await fetch('https://smoke.gingr.workers.dev/api/games');
    const apiGames = await res.json();

    container.innerHTML = '';

    // Normalize helper: lower, remove parenthetical text, strip version tokens
    const normalize = (s) => {
      if (!s) return '';
      let t = s.toLowerCase();

      // Remove parenthetical groups first: "Name (v1.2)" -> "Name "
      t = t.replace(/\([^)]*\)/g, ' ');

      // Replace common separators with space so tokens split cleanly
      t = t.replace(/[-_]/g, ' ');

      // Remove explicit version tokens with v/ver/version prefix, e.g. "v1", "version1.2.3"
      t = t.replace(/\b(?:v|ver|version)[ _-]*\d+(?:\.\d+)*\b/gi, ' ');

      // Remove dotted versions like "1.2" or "1.2.3" (only dotted forms)
      t = t.replace(/\b\d+(?:\.\d+)+\b/g, ' ');

      // Collapse whitespace and trim
      t = t.replace(/\s+/g, ' ').trim();

      return t;
    };

    // Key-normalize for searching (remove spaces)
    const normalizeKey = s => normalize(s).replace(/\s+/g, '');

    let autoSelected = false;
    const cards = [];

    installed.forEach(g => {
      const card = document.createElement('div');
      card.className = 'game-card';

      // Find API game for cover_url (compare normalized names)
      const apiGame = apiGames.find(ag => normalize(ag.name) === normalize(g.name));
      const img = document.createElement('img');
      img.src = apiGame && apiGame.cover_url ? apiGame.cover_url : 'placeholder.jpg';
      img.alt = g.name;

      const title = document.createElement('div');
      title.className = 'game-title';
      title.textContent = g.name;

      card.appendChild(img);
      card.appendChild(title);

      card.addEventListener('click', () => {
        overlayImg.src = img.src;
        overlayTitle.textContent = g.name;
        playBtn.onclick = () => {
          window.electronAPI.runGame(g.name);
          overlay.style.display = 'none';
        };
        overlay.style.display = 'flex';
      });

      container.appendChild(card);
      cards.push({ card, name: g.name });

      // Auto-select if matches URL param (normalize both sides)
      if (!autoSelected && selectedGame && normalize(g.name) === normalize(selectedGame)) {
        setTimeout(() => {
          card.click();
        }, 300);
        autoSelected = true;
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.style.display = 'none';
    });

    // Search/filtering: ignore -, _ and spaces and strip versions when matching
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

  } catch (err) {
    console.error(err);
    container.textContent = 'Error loading library.';
  }
}

loadLibrary();