-- Skema D1: Sistem Pengukuran Produktiviti Syarikat (MPC)
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,          -- M | S | MI
  sector TEXT,
  account TEXT NOT NULL,           -- aktif | menunggu | digantung
  status TEXT NOT NULL,            -- draf | dihantar | disahkan | dikembalikan
  doc TEXT NOT NULL,               -- JSON: profil, years, data, src, phys, physCustom, review, analysis, history
  pw_salt TEXT NOT NULL,
  pw_hash TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_companies_sector ON companies(sector);
CREATE TABLE IF NOT EXISTS admins (username TEXT PRIMARY KEY, pw_salt TEXT NOT NULL, pw_hash TEXT NOT NULL, created_at TEXT);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, role TEXT NOT NULL, subject TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT);
INSERT OR IGNORE INTO config (k, v) VALUES ('minWageMonthly', '1700');
