const express = require('express');
const db = require('../database');
const { getNoteCount } = require('./noteUtils');
const config = require('../config');

const router = express.Router();

const PER_PAGE = 1000;
let sitemapCache = null;
let sitemapPageCache = {};
let lastCacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000;

function buildSitemapIndex() {
  const total = getNoteCount();
  const pages = Math.ceil(total / PER_PAGE);
  const baseUrl = config.baseUrl;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  xml += `  <sitemap><loc>${baseUrl}/sitemap-home.xml</loc></sitemap>\n`;

  for (let i = 1; i <= pages; i++) {
    xml += `  <sitemap><loc>${baseUrl}/sitemap-${i}.xml</loc></sitemap>\n`;
  }

  xml += '</sitemapindex>';
  return xml;
}

function buildSitemapPage(page) {
  const offset = (page - 1) * PER_PAGE;
  const notes = db.prepare(
    'SELECT short_id, created_at FROM notes WHERE is_protected = 0 ORDER BY id ASC LIMIT ? OFFSET ?'
  ).all(PER_PAGE, offset);

  const baseUrl = config.baseUrl;

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  for (const note of notes) {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}/note/${note.short_id}</loc>\n`;
    xml += `    <lastmod>${note.created_at.replace(' ', 'T')}+00:00</lastmod>\n`;
    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

function buildHomeSitemap() {
  const baseUrl = config.baseUrl;
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  xml += `  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>\n`;
  xml += `  <url><loc>${baseUrl}/search</loc><priority>0.5</priority></url>\n`;
  xml += `  <url><loc>${baseUrl}/favorites</loc><priority>0.3</priority></url>\n`;
  xml += '</urlset>';
  return xml;
}

router.get('/sitemap.xml', (req, res) => {
  if (!sitemapCache || Date.now() - lastCacheTime > CACHE_TTL) {
    sitemapCache = buildSitemapIndex();
    lastCacheTime = Date.now();
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(sitemapCache);
});

router.get('/sitemap-home.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(buildHomeSitemap());
});

router.get('/sitemap-:page.xml', (req, res) => {
  const page = parseInt(req.params.page, 10);
  if (isNaN(page) || page < 1) {
    return res.status(404).send('Not found');
  }

  const cacheKey = `page_${page}`;
  if (!sitemapPageCache[cacheKey] || Date.now() - lastCacheTime > CACHE_TTL) {
    sitemapPageCache[cacheKey] = buildSitemapPage(page);
  }

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.send(sitemapPageCache[cacheKey]);
});

module.exports = router;
