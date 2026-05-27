require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
  dbPath: process.env.DB_PATH || './data/notes.db',
  fbAppId: process.env.FB_APP_ID || '1377463457543447',
};
