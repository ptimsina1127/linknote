const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const apiRouter = require('./routes/api');
const sitemapRouter = require('./routes/sitemap');
const { getNote } = require('./routes/noteUtils');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true, limit: '50kb' }));
app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: true,
  cookie: { sameSite: 'strict' },
}));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', apiRouter);
app.use('/', sitemapRouter);

function loadHtml(file) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'views', file), 'utf-8');
  return html.replace(/__BASE__/g, config.baseUrl);
}

const INDEX_HTML = loadHtml('index.html');
const SEARCH_HTML = loadHtml('search.html');
const FAVORITES_HTML = loadHtml('favorites.html');
const NOTE_404_HTML = loadHtml('404.html');
const NOTE_TEMPLATE = loadHtml('note.html');

app.get('/', (req, res) => {
  res.send(INDEX_HTML);
});

app.get('/note/:id', (req, res) => {
  const note = getNote(req.params.id);

  const ogUrl = `${config.baseUrl}/note/${req.params.id}`;
  const ogImage = `${config.baseUrl}/og-image.svg`;

  if (!note) {
    let html = NOTE_404_HTML;
    res.status(404).send(html);
    return;
  }

  const title = note.title
    ? `${note.title} - LinkedPad`
    : 'LinkedPad - A Fast Shareable Notepad';

  let desc;
  if (note.is_protected) {
    desc = 'This note is password protected.';
  } else {
    const raw = note.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    desc = raw.length > 200 ? raw.substring(0, 200) + '...' : raw;
  }

  let html = NOTE_TEMPLATE
    .replace(/__OG_TITLE__/g, title)
    .replace(/__OG_DESC__/g, desc.replace(/"/g, '&quot;'))
    .replace(/__OG_IMAGE__/g, ogImage)
    .replace(/__OG_URL__/g, ogUrl);

  res.send(html);
});

app.get('/favorites', (req, res) => {
  res.send(FAVORITES_HTML);
});

app.get('/search', (req, res) => {
  res.send(SEARCH_HTML);
});

app.get('/404', (req, res) => {
  res.status(404).send(NOTE_404_HTML);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`LinkedPad running on ${config.baseUrl}`);
});
