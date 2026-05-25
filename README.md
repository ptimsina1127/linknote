# LinkNote - Anonymous Online Notepad

A minimal, anonymous notepad web app. Create a note, get a short 5-character link, and share it with anyone. No sign-up required.

**Live at**: [https://linkedpad.me](https://linkedpad.me)

---

## Architecture Overview

```
Browser                          Azure App Service (Node.js)
┌──────────┐    HTTPS/API        ┌─────────────────────────────┐
│          │ ◄─────────────────► │  Express Server             │
│  HTML    │    fetch()          │  ├── Routes (/api/*)        │
│  CSS     │                     │  ├── Views (static HTML)    │
│  JS      │                     │  ├── Static Files (/public) │
│          │                     │  └── SQLite Database         │
└──────────┘                     └─────────────────────────────┘
                                          │
                                     ┌────┘
                                     ▼
                               ┌────────────┐
                               │  SQLite DB  │
                               │ notes.db    │
                               └────────────┘
```

### Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| Backend | Node.js + Express | HTTP server, routing, API logic |
| Database | SQLite (better-sqlite3) | Note storage, file-based |
| Frontend | Vanilla JS + HTML/CSS | Browser UI |
| Hosting | Azure App Service (Linux) | Production server |
| DNS | linkedpad.me | Custom domain |
| SSL | Azure Free Managed Certificate | HTTPS |

---

## How It Works

### 1. Creating a Note

**Frontend flow** (`src/views/index.html` + `public/js/app.js`):

1. User types content in the giant `<textarea>`
2. Optionally adds a title and/or password
3. Clicks "Share" or presses Ctrl+Enter
4. `app.js` sends `POST /api/note` with `{ title, content, password }`
5. On success, a modal shows the short URL (`/note/abc123`)

**Backend flow** (`src/routes/api.js` + `src/routes/noteUtils.js`):

1. Validates input (content required, max 50KB, password min 4 chars)
2. Rate limiter checks: max 5 creates per minute per IP
3. Generates a unique 5-character Base62 ID using `nanoid`
4. If password provided, hashes it with `bcrypt` (10 rounds)
5. Inserts into SQLite: `INSERT INTO notes (short_id, title, content, password_hash, ...)`
6. Returns `{ short_id: "abc123" }`

### 2. Viewing a Note

**Frontend flow** (`src/views/note.html` + `public/js/note.js`):

1. User visits `/note/abc123`
2. Server serves `note.html` (static HTML)
3. `note.js` extracts the ID from the URL
4. Fetches `GET /api/note/abc123`
5. If unprotected → renders the content immediately
6. If protected (and not yet verified) → shows password prompt
7. User enters password → `POST /api/note/abc123/verify`
8. If correct → session stores `verified[abc123] = true` → renders content

**Backend flow**:

1. `GET /api/note/:id` looks up `short_id` in SQLite
2. Returns JSON: `{ short_id, title, content, is_protected, verified }`
3. If protected and not in session → `content: null`
4. `POST /api/note/:id/verify` compares password with `bcrypt.compare`

### 3. Password Protection

- When creating: if password is set, `bcrypt.hash(password, 10)` is stored; `is_protected = 1`
- When viewing: content is `null` until password is verified
- Session-based: once verified, `req.session.verified[short_id] = true` persists for the browser session
- Password-protected notes are **excluded from search results**
- Rate-limited: max 5 verification attempts per minute per IP

### 4. Speech-to-Text

**File**: `public/js/speech.js`

- Feature-detects `window.webkitSpeechRecognition` (Chrome/Edge only)
- Adds a mic button to the toolbar only if supported
- On press: starts Web Speech API recognition
- On result: maps spoken words to text:
  - "enter" → newline
  - "full stop" → `. `
  - "question mark" → `? `
  - "comma" → `, `
- Inserts processed text at cursor position in the textarea
- Recording indicator: red pulsing dot, stops on silence or manual tap

### 5. Favorites

**File**: `public/js/favorites.js` + `public/js/favorites-page.js`

- Stored entirely in browser `localStorage` under key `linknote_favorites`
- Format: `{ "abc123": { title: "My Note", added: 1685000000 } }`
- Star toggle button on note view and search results
- `/favorites` page:
  1. Reads all favorited IDs from localStorage
  2. Fetches each note's metadata via `GET /api/note/:id/meta`
  3. Removes notes that return 404 (deleted)
  4. Renders clickable list sorted by creation date

### 6. Duplicate

**File**: `public/js/note.js` — `duplicateBtn` handler

1. Reads current note's content (already fetched)
2. Sends `POST /api/note` with same content + "(copy)" title
3. Redirects to the new note's URL
4. Toast: "Note duplicated! You can now edit this copy."

### 7. Export / Download

**File**: `src/routes/api.js` — `GET /api/note/:id/download`

- Sets headers: `Content-Type: text/plain; charset=utf-8`
- Content-Disposition: `attachment; filename="note-abc123.txt"`
- If password-protected, checks session for verification first
- Streams raw content as file download

### 8. Search

**Backend** (`src/routes/api.js` — `GET /api/search`):

```
/api/search?q=hello+world&sort=desc&page=1
```

- Splits query into individual words
- SQL: `WHERE (title LIKE '%word1%' OR content LIKE '%word1%') AND (... word2 ...)`
- Only returns unprotected notes (`is_protected = 0`)
- Sorts by `created_at` ASC or DESC
- Paginated: 20 results per page
- Returns `{ notes: [...], total, page, totalPages }`

**Frontend** (`public/js/search.js`):

- Debounced input (300ms)
- Live results as user types
- Sort toggle button (↓ Newest / ↑ Oldest)
- Pagination controls with page numbers

### 9. Sitemap

**File**: `src/routes/sitemap.js`

- `/sitemap.xml` → sitemap index linking to:
  - `/sitemap-home.xml` (home, search, favorites pages)
  - `/sitemap-1.xml`, `/sitemap-2.xml`, etc. (note URLs, 1000 per page)
- Only unprotected notes included
- Generated dynamically, cached for 1 hour in memory

### 10. URL Shortening

- ID: 5 characters from alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789`
- Generated via `nanoid.customAlphabet(alphabet, 5)`
- 62^5 = ~916 million possible combinations
- Collision check: retries up to 10 times if ID already exists

---

## API Reference

| Method | Route | Description | Rate Limit |
|--------|-------|-------------|-----------|
| POST | `/api/note` | Create a note | 5/min |
| GET | `/api/note/:id` | Get note content | - |
| POST | `/api/note/:id/verify` | Verify password | 5/min |
| GET | `/api/note/:id/meta` | Get note metadata only | - |
| GET | `/api/note/:id/download` | Download as .txt | - |
| GET | `/api/search?q=&sort=&page=` | Search notes | - |

### POST /api/note

**Request**:
```json
{ "title": "My Note", "content": "Hello world", "password": "secret" }
```

**Response**:
```json
{ "short_id": "aB3xK" }
```

### GET /api/note/:id

**Response** (unprotected):
```json
{
  "short_id": "aB3xK",
  "title": "My Note",
  "created_at": "2026-05-25 12:00:00",
  "is_protected": false,
  "verified": false,
  "content": "Hello world"
}
```

**Response** (protected, not verified):
```json
{
  "short_id": "aB3xK",
  "title": "My Note",
  "created_at": "2026-05-25 12:00:00",
  "is_protected": true,
  "verified": false,
  "content": null
}
```

### POST /api/note/:id/verify

**Request**:
```json
{ "password": "secret" }
```

**Response** (success):
```json
{ "success": true, "content": "Hello world", "title": "My Note" }
```

**Response** (failure):
```json
{ "success": false, "error": "Incorrect password" }
```

---

## Database Schema

```sql
CREATE TABLE notes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  short_id        TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL DEFAULT '',
  content         TEXT NOT NULL,
  password_hash   TEXT,
  is_protected    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_short_id ON notes(short_id);
CREATE INDEX idx_created_at ON notes(created_at);
CREATE INDEX idx_protected ON notes(is_protected);
```

---

## Security

- **Helmet**: HTTP security headers (XSS, clickjacking, etc.)
- **Rate limiting**: 5 creates/min, 5 password attempts/min per IP
- **Input validation**: content max 50KB, title max 200 chars, password min 4 chars
- **XSS prevention**: All user content rendered via `textContent` (never `innerHTML`)
- **Password hashing**: bcrypt with 10 salt rounds
- **Session**: express-session with `SameSite=Strict` cookie
- **HTTPS**: Enforced via Azure App Service HTTPS-only setting

---

## Development

### Prerequisites
- Node.js 22+
- npm

### Local Setup
```bash
git clone https://github.com/ptimsina1127/linknote.git
cd linknote
npm install
cp .env.example .env
npm start
```

Open http://localhost:3000

### Project Structure
```
src/
├── server.js              # Express entry, middleware, static routes
├── config.js              # Environment config
├── database.js            # SQLite initialization
├── routes/
│   ├── api.js             # All API endpoints
│   ├── noteUtils.js       # Shared DB functions
│   └── sitemap.js         # Sitemap generation
├── views/                 # Static HTML pages
│   ├── index.html         # Home / editor
│   ├── note.html          # Note view
│   ├── search.html        # Search page
│   ├── favorites.html     # Favorites page
│   └── 404.html           # Not found
public/
├── css/style.css          # Dark theme styles
└── js/
    ├── app.js             # Home page logic
    ├── note.js            # Note view logic
    ├── speech.js          # Speech-to-text
    ├── favorites.js       # Favorites module (localStorage)
    ├── favorites-page.js  # Favorites page rendering
    └── search.js          # Search page
```

---

## Deployment

Deployed to Azure App Service via GitHub Actions.

1. Push to `main` branch
2. GitHub Actions runs `npm ci --production`
3. Deploys to Azure App Service using publish profile
4. Environment variables configure the app at runtime

---

## Features Summary

- [x] Create anonymous notes with 5-char short links
- [x] Password protection with bcrypt
- [x] Speech-to-text (Chrome/Edge)
- [x] Favorites (localStorage-based)
- [x] Duplicate notes
- [x] Download notes as .txt
- [x] Multi-word search with AND logic
- [x] Sort search ASC/DESC
- [x] Paginated search results
- [x] Dynamic sitemaps
- [x] UTF-8 full support
- [x] Dark theme UI
- [x] Rate limiting
- [x] HTTPS and security headers
