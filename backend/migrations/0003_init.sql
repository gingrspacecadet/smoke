-- Migration number: 0003 	 2025-09-26T15:51:50.175Z
CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cover_uri TEXT NOT NULL,         -- whole data URI string
  download_url TEXT NOT NULL
);

