const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'compilations.db');

// Ensure data directory exists
const fs = require('fs');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS compilation_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    snippet TEXT NOT NULL,
    snippet_hash TEXT NOT NULL,
    result TEXT NOT NULL,
    success INTEGER NOT NULL
  )
`);

// Prepared statement for efficient inserts with deduplication
const insertStmt = db.prepare(`
  INSERT INTO compilation_logs (timestamp, snippet, snippet_hash, result, success)
  SELECT ?, ?, ?, ?, ?
  WHERE NOT EXISTS (SELECT 1 FROM compilation_logs WHERE snippet_hash = ?)
`);

/**
 * Log a compilation request to the database
 * @param {string} snippet - The Verifex code snippet
 * @param {string} result - The execution output
 * @param {boolean} success - Whether compilation succeeded
 */
function logCompilation(snippet, result, success) {
  const timestamp = new Date().toISOString();
  const hash = crypto.createHash('sha256').update(snippet).digest('hex');

  try {
    insertStmt.run(timestamp, snippet, hash, result, success ? 1 : 0, hash);
  } catch (err) {
    console.error('Failed to log compilation:', err);
  }
}

module.exports = {
  logCompilation,
  db
};
