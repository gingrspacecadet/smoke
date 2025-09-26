-- Migration number: 0002 	 2025-09-26T15:50:02.290Z
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cover_type TEXT NOT NULL,         -- 'image/png' or 'image/jpeg'
  cover_data TEXT NOT NULL,         -- base64 string of the image
  download_url TEXT NOT NULL
);
