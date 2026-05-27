const { customAlphabet } = require('nanoid');
const bcrypt = require('bcrypt');
const db = require('../database');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ID_LENGTH = 5;
const generateId = customAlphabet(ALPHABET, ID_LENGTH);

function generateShortId() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const id = generateId();
    const existing = db.prepare('SELECT id FROM notes WHERE short_id = ?').get(id);
    if (!existing) return id;
  }
  throw new Error('Failed to generate unique ID');
}

function createNote(title, content, password) {
  const shortId = generateShortId();
  let passwordHash = null;
  let isProtected = 0;

  if (password && password.length >= 4) {
    passwordHash = bcrypt.hashSync(password, 10);
    isProtected = 1;
  }

  const stmt = db.prepare(
    'INSERT INTO notes (short_id, title, content, password_hash, is_protected) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(shortId, title, content, passwordHash, isProtected);

  return shortId;
}

function getNote(shortId) {
  return db.prepare('SELECT * FROM notes WHERE short_id = ?').get(shortId);
}

function verifyPassword(hash, password) {
  return bcrypt.compareSync(password, hash);
}

function getRecentNotes(limit = 20, offset = 0) {
  return db.prepare(
    'SELECT short_id, title, created_at, is_protected FROM notes WHERE is_protected = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);
}

function searchNotes(words, sort, limit, offset) {
  const conditions = words.map(() => '(title LIKE ? OR content LIKE ?)');
  const params = [];
  for (const word of words) {
    const pattern = `%${word}%`;
    params.push(pattern, pattern);
  }
  params.push(limit, offset);

  const order = sort === 'asc' ? 'ASC' : 'DESC';
  const whereClause = conditions.join(' AND ');

  const notes = db.prepare(
    `SELECT short_id, title, created_at, is_protected FROM notes WHERE is_protected = 0 AND ${whereClause} ORDER BY created_at ${order} LIMIT ? OFFSET ?`
  ).all(...params);

  const countResult = db.prepare(
    `SELECT COUNT(*) as total FROM notes WHERE is_protected = 0 AND ${whereClause}`
  ).get(...words.map(w => [`%${w}%`, `%${w}%`]).flat());

  return { notes, total: countResult.total };
}

function getNoteCount() {
  return db.prepare('SELECT COUNT(*) as total FROM notes WHERE is_protected = 0').get().total;
}

function updateNote(shortId, title, content, password) {
  let sql, params;

  if (password !== undefined) {
    let passwordHash = null;
    let isProtected = 0;
    if (password && password.length >= 4) {
      passwordHash = bcrypt.hashSync(password, 10);
      isProtected = 1;
    }
    sql = "UPDATE notes SET title = ?, content = ?, password_hash = ?, is_protected = ?, updated_at = datetime('now') WHERE short_id = ?";
    params = [title, content, passwordHash, isProtected, shortId];
  } else {
    sql = "UPDATE notes SET title = ?, content = ?, updated_at = datetime('now') WHERE short_id = ?";
    params = [title, content, shortId];
  }

  const result = db.prepare(sql).run(...params);
  return result.changes > 0;
}

module.exports = {
  createNote,
  getNote,
  verifyPassword,
  updateNote,
  getRecentNotes,
  searchNotes,
  getNoteCount,
};
