const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const config = require('./config');
const apiRouter = require('./routes/api');
const sitemapRouter = require('./routes/sitemap');

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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'src', 'views', 'index.html'));
});

app.get('/note/:id', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'src', 'views', 'note.html'));
});

app.get('/favorites', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'src', 'views', 'favorites.html'));
});

app.get('/search', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'src', 'views', 'search.html'));
});

app.get('/404', (req, res) => {
  res.status(404).sendFile(path.join(__dirname, '..', 'src', 'views', '404.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(config.port, () => {
  console.log(`LinkNote running on ${config.baseUrl}`);
});
