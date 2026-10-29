CREATE TABLE IF NOT EXISTS spawns (
  name TEXT NOT NULL,
  cx INTEGER NOT NULL,
  cy INTEGER NOT NULL,
  r1 TEXT NOT NULL,
  r2 TEXT,
  r3 TEXT,
  updated INTEGER NOT NULL,
  PRIMARY KEY (name, cx, cy)
);
CREATE INDEX IF NOT EXISTS spawns_name ON spawns (name);
