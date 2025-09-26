async function loadGames() {
  const res = await fetch('http://localhost:8787/api/games');
  const games = await res.json();
  const container = document.getElementById('games');
  container.innerHTML = '';

  games.forEach(g => {
    const card = document.createElement('div');
    card.className = 'game-card';
    card.innerHTML = `
      <img src="${g.cover_url}" alt="${g.name}" class="cover">
      <h2>${g.name}</h2>
      <a href="game.html?id=${g.id}">View</a>
    `;
    container.appendChild(card);
  });
}
document.addEventListener('DOMContentLoaded', loadGames);
