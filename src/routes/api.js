const express = require('express');
const rateLimit = require('express-rate-limit');
const { createNote, getNote, verifyPassword, updateNote, searchNotes } = require('./noteUtils');

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many note creations. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const updateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many updates. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many password attempts. Please wait.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/note', createLimiter, (req, res) => {
  try {
    const { title, content, password } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }
    if (title && title.length > 200) {
      return res.status(400).json({ error: 'Title too long (max 200 chars)' });
    }
    if (content.length > 50000) {
      return res.status(400).json({ error: 'Content too long (max 50KB)' });
    }
    if (password && password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters' });
    }

    const shortId = createNote(title || '', content, password);
    res.json({ short_id: shortId });
  } catch (err) {
    console.error('Create error:', err);
    res.status(500).json({ error: 'Failed to create note' });
  }
});

router.get('/note/:id', (req, res) => {
  const note = getNote(req.params.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  let verified = false;
  if (req.session.verified && req.session.verified[note.short_id]) {
    verified = true;
  }

  const response = {
    short_id: note.short_id,
    title: note.title,
    created_at: note.created_at,
    is_protected: !!note.is_protected,
    verified,
    content: null,
  };

  if (!note.is_protected || verified) {
    response.content = note.content;
  }

  res.json(response);
});

router.post('/note/:id/verify', verifyLimiter, (req, res) => {
  const note = getNote(req.params.id);

  if (!note || !note.is_protected) {
    return res.status(404).json({ error: 'Note not found or not protected' });
  }

  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  if (verifyPassword(note.password_hash, password)) {
    if (!req.session.verified) {
      req.session.verified = {};
    }
    req.session.verified[note.short_id] = true;
    res.json({ success: true, content: note.content, title: note.title });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

router.get('/note/:id/meta', (req, res) => {
  const note = getNote(req.params.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  res.json({
    short_id: note.short_id,
    title: note.title,
    created_at: note.created_at,
    is_protected: !!note.is_protected,
  });
});

router.put('/note/:id', (req, res, next) => { updateLimiter(req, res, next); }, (req, res) => {
  try {
    const note = getNote(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    if (note.is_protected) {
      const verified = req.session.verified && req.session.verified[note.short_id];
      if (!verified) {
        return res.status(401).json({ error: 'Password required. Verify first.' });
      }
    }

    const { title, content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content cannot be empty' });
    }
    if (title && title.length > 200) {
      return res.status(400).json({ error: 'Title too long (max 200 chars)' });
    }
    if (content.length > 50000) {
      return res.status(400).json({ error: 'Content too long (max 50KB)' });
    }

    const updated = updateNote(req.params.id, title || '', content);
    if (updated) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to update note' });
    }
  } catch (err) {
    console.error('Update error:', err);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

router.get('/note/:id/download', (req, res) => {
  const note = getNote(req.params.id);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  if (note.is_protected) {
    const verified = req.session.verified && req.session.verified[note.short_id];
    if (!verified) {
      return res.status(401).json({ error: 'Password required. Verify first.' });
    }
  }

  const filename = note.title
    ? `note-${note.short_id}-${note.title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 50)}.txt`
    : `note-${note.short_id}.txt`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(note.content);
});

router.get('/search', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const sort = req.query.sort === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = 20;
    const offset = (page - 1) * limit;

    if (!q) {
      return res.json({ notes: [], total: 0, page, totalPages: 0 });
    }

    const words = q.split(/\s+/).filter(w => w.length > 0);

    if (words.length === 0) {
      return res.json({ notes: [], total: 0, page, totalPages: 0 });
    }

    const result = searchNotes(words, sort, limit, offset);

    res.json({
      notes: result.notes,
      total: result.total,
      page,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

module.exports = router;
