const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('./config');

const dbDir = path.dirname(config.dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    short_id        TEXT NOT NULL UNIQUE,
    title           TEXT NOT NULL DEFAULT '',
    content         TEXT NOT NULL,
    password_hash   TEXT,
    is_protected    INTEGER NOT NULL DEFAULT 0,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_short_id ON notes(short_id);
  CREATE INDEX IF NOT EXISTS idx_created_at ON notes(created_at);
  CREATE INDEX IF NOT EXISTS idx_protected ON notes(is_protected);
`);

module.exports = db;
