#!/bin/sh
# Run database migrations at container startup
# This script is called before the app starts in the Dockerfile CMD

echo "Running database migrations..."
node -e "
const { readFileSync, readdirSync } = require('fs');
const { join } = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  await pool.query(\`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  \`);

  const applied = await pool.query('SELECT name FROM migrations ORDER BY name');
  const appliedSet = new Set(applied.rows.map(r => r.name));

  const migrationsDir = join('/app', 'migrations');
  const files = readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log('  skip:', file);
      continue;
    }
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');
    console.log('  apply:', file);
    try {
      await pool.query('BEGIN');
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES (\$1)', [file]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      console.error('  FAILED:', file, err.message);
      process.exit(1);
    }
  }

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch(err => { console.error(err); process.exit(1); });
"
