import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { Pool } from "pg";

async function migrate() {
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://ptasks:localdev@localhost:5433/people_tasks",
  });

  // Create migrations tracking table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Get already applied migrations
  const applied = await pool.query("SELECT name FROM migrations ORDER BY name");
  const appliedSet = new Set(applied.rows.map((r: { name: string }) => r.name));

  // Read migration files
  const migrationsDir = join(__dirname, "..", "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`  skip: ${file} (already applied)`);
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), "utf-8");
    console.log(`  apply: ${file}`);

    try {
      await pool.query("BEGIN");
      await pool.query(sql);
      await pool.query("INSERT INTO migrations (name) VALUES ($1)", [file]);
      await pool.query("COMMIT");
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`  FAILED: ${file}`, err);
      process.exit(1);
    }
  }

  console.log("Migrations complete.");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
