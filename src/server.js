const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { Resvg } = require('@resvg/resvg-js');
const config = require('./config');
const apiRouter = require('./routes/api');
const sitemapRouter = require('./routes/sitemap');
const { getNote } = require('./routes/noteUtils');

const app = express();

// OG image cache
let ogImagePng = null;

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

app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.send(`User-agent: *
Allow: /
Sitemap: ${config.baseUrl}/sitemap.xml
`);
});

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
  const ogImage = `${config.baseUrl}/og-image.png`;

  if (!note) {
    let html = NOTE_404_HTML;
    res.status(404).send(html);
    return;
  }

  const title = note.title
    ? `${note.title} - LinkedPad`
    : 'LinkedPad - An Anonymous and Shareable Online Notepad';

  let desc;
  if (note.is_protected) {
    desc = 'This note is password protected.';
  } else {
    const raw = note.content.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    desc = raw.length > 200 ? raw.substring(0, 200) + '...' : raw;
  }

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: desc,
    url: ogUrl,
    image: ogImage,
  });

  let html = NOTE_TEMPLATE
    .replace(/__OG_TITLE__/g, title)
    .replace(/__OG_DESC__/g, desc.replace(/"/g, '&quot;'))
    .replace(/__OG_IMAGE__/g, ogImage)
    .replace(/__OG_URL__/g, ogUrl)
    .replace('__JSON_LD__', jsonLd);

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

app.get('/og-image.png', async (req, res) => {
  if (!ogImagePng) {
    const svgPath = path.join(__dirname, '..', 'public', 'og-image.svg');
    if (!fs.existsSync(svgPath)) return res.status(404).end();
    try {
      const svg = fs.readFileSync(svgPath, 'utf-8');
      const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
      ogImagePng = resvg.render().asPng();
    } catch {
      return res.status(500).end();
    }
  }
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(ogImagePng);
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`LinkedPad running on ${config.baseUrl}`);
});
