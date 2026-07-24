import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const dbPath =
  process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "farm.db");

function migrateMergedFromJson(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(fields)").all() as {
    name: string;
  }[];
  if (!columns.some((c) => c.name === "merged_from")) return;

  const rows = sqlite
    .prepare("SELECT id, merged_from FROM fields WHERE merged_from IS NOT NULL")
    .all() as { id: number; merged_from: string }[];

  const findByNumber = sqlite.prepare("SELECT id FROM fields WHERE number = ?");
  const insertMerge = sqlite.prepare(
    "INSERT OR IGNORE INTO field_merges (merged_field_id, source_field_id) VALUES (?, ?)",
  );

  const migrate = sqlite.transaction(() => {
    for (const row of rows) {
      let numbers: unknown;
      try {
        numbers = JSON.parse(row.merged_from);
      } catch {
        continue;
      }
      if (!Array.isArray(numbers)) continue;
      for (const n of numbers) {
        if (typeof n !== "number") continue;
        const source = findByNumber.get(n) as { id: number } | undefined;
        if (!source || source.id === row.id) continue;
        insertMerge.run(row.id, source.id);
      }
    }
    sqlite.exec("ALTER TABLE fields DROP COLUMN merged_from");
  });

  migrate();
}

function migrateHarvestSortOrder(sqlite: Database.Database) {
  const columns = sqlite.prepare("PRAGMA table_info(harvests)").all() as {
    name: string;
  }[];
  if (columns.length === 0) return;
  if (columns.some((c) => c.name === "sort_order")) return;

  sqlite.exec(`
    ALTER TABLE harvests ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    UPDATE harvests SET sort_order = id;
  `);
}

// ponytail: the single-field harvests table was replaced by the multi-field one,
// which takes over the `harvests` name. Drop once every DB has been through this.
function migrateAdvancedHarvestsToHarvests(sqlite: Database.Database) {
  const hasLegacyHarvests = (
    sqlite.prepare("PRAGMA table_info(harvests)").all() as { name: string }[]
  ).some((c) => c.name === "field_id");

  const hasAdvancedHarvests =
    sqlite
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'advanced_harvests'",
      )
      .get() != null;

  if (!hasLegacyHarvests && !hasAdvancedHarvests) return;

  const migrate = sqlite.transaction(() => {
    if (hasLegacyHarvests) {
      sqlite.exec("DROP TABLE harvests");
    }
    if (hasAdvancedHarvests) {
      sqlite.exec(`
        ALTER TABLE advanced_harvests RENAME TO harvests;
        ALTER TABLE advanced_harvest_fields RENAME TO harvest_fields;
      `);
    }
  });

  migrate();
}

function openSqlite() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return sqlite;
}

function migrateAll(sqlite: Database.Database) {
  migrateAdvancedHarvestsToHarvests(sqlite);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL UNIQUE,
      size_ha REAL NOT NULL,
      purchase_cost REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS field_merges (
      merged_field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      source_field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      PRIMARY KEY (merged_field_id, source_field_id)
    );

    CREATE TABLE IF NOT EXISTS harvests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      crop_type TEXT,
      liters REAL,
      sale_amount REAL,
      wage_payment REAL,
      vehicle_leasing_cost REAL,
      fertilizer_cost REAL,
      seed_cost REAL,
      fuel_cost REAL
    );

    CREATE TABLE IF NOT EXISTS harvest_fields (
      harvest_id INTEGER NOT NULL REFERENCES harvests(id) ON DELETE CASCADE,
      field_id INTEGER NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
      PRIMARY KEY (harvest_id, field_id)
    );
  `);

  migrateMergedFromJson(sqlite);
  migrateHarvestSortOrder(sqlite);
}

// ponytail: HMR reuses the drizzle client, so migrations must run on every module load
const globalForDb = globalThis as unknown as {
  farmDb?: ReturnType<typeof drizzle<typeof schema>>;
  farmSqlite?: Database.Database;
};

const sqlite = globalForDb.farmSqlite ?? openSqlite();
migrateAll(sqlite);

export const db = globalForDb.farmDb ?? drizzle(sqlite, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDb.farmSqlite = sqlite;
  globalForDb.farmDb = db;
}
