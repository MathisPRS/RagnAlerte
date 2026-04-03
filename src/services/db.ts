import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';

let db: Database | null = null;
let sqlJs: Awaited<ReturnType<typeof initSqlJs>> | null = null;

const DB_KEY = 'lumina_flow_db';

async function loadOrCreateDb(): Promise<Database> {
  if (!sqlJs) {
    sqlJs = await initSqlJs({
      locateFile: () => '/sql-wasm.wasm',
    });
  }

  const saved = localStorage.getItem(DB_KEY);
  if (saved) {
    const arr = Uint8Array.from(atob(saved), (c) => c.charCodeAt(0));
    db = new sqlJs.Database(arr);
  } else {
    db = new sqlJs.Database();
  }

  applyMigrations(db);
  return db;
}

function saveDb(database: Database) {
  const data = database.export();
  const b64 = btoa(String.fromCharCode(...data));
  localStorage.setItem(DB_KEY, b64);
}

function applyMigrations(database: Database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cycles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT,
      cycle_length INTEGER,
      notes TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      mood INTEGER,
      libido INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS symptoms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      symptom_type TEXT NOT NULL,
      UNIQUE(user_id, date, symptom_type),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
  saveDb(database);
}

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await loadOrCreateDb();
  }
  return db;
}

export function persistDb() {
  if (db) saveDb(db);
}

// ============ USER ============

export async function createUser(
  email: string,
  passwordHash: string,
  name: string
): Promise<number> {
  const database = await getDb();
  database.run(
    `INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)`,
    [email, passwordHash, name]
  );
  const result = database.exec(`SELECT last_insert_rowid() as id`);
  persistDb();
  return result[0].values[0][0] as number;
}

export async function getUserByEmail(email: string) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, email, password_hash, name, created_at FROM users WHERE email = ?`,
    [email]
  );
  if (!result.length || !result[0].values.length) return null;
  const [id, em, pw, nm, ca] = result[0].values[0];
  return { id: id as number, email: em as string, password_hash: pw as string, name: nm as string, created_at: ca as string };
}

export async function getUserById(id: number) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, email, password_hash, name, created_at FROM users WHERE id = ?`,
    [id]
  );
  if (!result.length || !result[0].values.length) return null;
  const [uid, em, pw, nm, ca] = result[0].values[0];
  return { id: uid as number, email: em as string, password_hash: pw as string, name: nm as string, created_at: ca as string };
}

export async function updateUserEmail(userId: number, email: string) {
  const database = await getDb();
  database.run(`UPDATE users SET email = ? WHERE id = ?`, [email, userId]);
  persistDb();
}

export async function updateUserPassword(userId: number, passwordHash: string) {
  const database = await getDb();
  database.run(`UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]);
  persistDb();
}

// ============ CYCLES ============

export async function saveCycle(
  userId: number,
  startDate: string,
  endDate?: string
): Promise<number> {
  const database = await getDb();

  // Check if cycle for this start date already exists
  const existing = database.exec(
    `SELECT id FROM cycles WHERE user_id = ? AND start_date = ?`,
    [userId, startDate]
  );

  if (existing.length && existing[0].values.length) {
    const cycleId = existing[0].values[0][0] as number;
    database.run(
      `UPDATE cycles SET end_date = ? WHERE id = ?`,
      [endDate ?? null, cycleId]
    );
    persistDb();
    return cycleId;
  }

  // Calculate cycle length from previous cycle
  const prev = database.exec(
    `SELECT start_date FROM cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT 1`,
    [userId]
  );

  let cycleLength: number | null = null;
  if (prev.length && prev[0].values.length) {
    const prevStart = new Date(prev[0].values[0][0] as string);
    const currStart = new Date(startDate);
    const diff = Math.round((currStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 14 && diff < 50) cycleLength = diff;
  }

  database.run(
    `INSERT INTO cycles (user_id, start_date, end_date, cycle_length) VALUES (?, ?, ?, ?)`,
    [userId, startDate, endDate ?? null, cycleLength]
  );
  const result = database.exec(`SELECT last_insert_rowid() as id`);
  persistDb();
  return result[0].values[0][0] as number;
}

export async function getCycles(userId: number) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, user_id, start_date, end_date, cycle_length, notes FROM cycles WHERE user_id = ? ORDER BY start_date DESC`,
    [userId]
  );
  if (!result.length) return [];
  return result[0].values.map((row) => ({
    id: row[0] as number,
    user_id: row[1] as number,
    start_date: row[2] as string,
    end_date: row[3] as string | null,
    cycle_length: row[4] as number | null,
    notes: row[5] as string | null,
  }));
}

export async function updateCycle(
  cycleId: number,
  startDate: string,
  endDate: string | null
) {
  const database = await getDb();
  database.run(
    `UPDATE cycles SET start_date = ?, end_date = ? WHERE id = ?`,
    [startDate, endDate, cycleId]
  );
  persistDb();
}

// Save (or update) a cycle from a Set of selected day strings.
// Derives start_date = min(days), end_date = max(days).
// If the last cycle has no end_date and its start_date is within the selected days,
// we update it; otherwise we create a new entry.
export async function saveCycleFromDays(
  userId: number,
  selectedDays: string[]
): Promise<void> {
  if (!selectedDays.length) return;
  const sorted = [...selectedDays].sort();
  const startDate = sorted[0];
  const endDate = sorted[sorted.length - 1] === startDate ? null : sorted[sorted.length - 1];

  const database = await getDb();

  // Check if there's an existing cycle that overlaps
  const existing = database.exec(
    `SELECT id, start_date FROM cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT 1`,
    [userId]
  );

  if (existing.length && existing[0].values.length) {
    const cycleId = existing[0].values[0][0] as number;
    const existingStart = existing[0].values[0][1] as string;
    // Update if the new start matches the existing one, or if the existing cycle has no end
    const noEnd = database.exec(
      `SELECT id FROM cycles WHERE id = ? AND end_date IS NULL`,
      [cycleId]
    );
    if (existingStart === startDate || (noEnd.length && noEnd[0].values.length)) {
      database.run(
        `UPDATE cycles SET start_date = ?, end_date = ? WHERE id = ?`,
        [startDate, endDate, cycleId]
      );
      persistDb();
      return;
    }
  }

  // Create new cycle
  const prev = database.exec(
    `SELECT start_date FROM cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT 1`,
    [userId]
  );
  let cycleLength: number | null = null;
  if (prev.length && prev[0].values.length) {
    const prevStart = new Date(prev[0].values[0][0] as string);
    const currStart = new Date(startDate);
    const diff = Math.round((currStart.getTime() - prevStart.getTime()) / (1000 * 60 * 60 * 24));
    if (diff > 14 && diff < 50) cycleLength = diff;
  }
  database.run(
    `INSERT INTO cycles (user_id, start_date, end_date, cycle_length) VALUES (?, ?, ?, ?)`,
    [userId, startDate, endDate, cycleLength]
  );
  persistDb();
}

export async function endCurrentCycle(userId: number, endDate: string) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id FROM cycles WHERE user_id = ? AND end_date IS NULL ORDER BY start_date DESC LIMIT 1`,
    [userId]
  );
  if (!result.length || !result[0].values.length) return;
  const cycleId = result[0].values[0][0] as number;
  database.run(`UPDATE cycles SET end_date = ? WHERE id = ?`, [endDate, cycleId]);
  persistDb();
}

export async function getLastCycle(userId: number) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, user_id, start_date, end_date, cycle_length, notes FROM cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT 1`,
    [userId]
  );
  if (!result.length || !result[0].values.length) return null;
  const row = result[0].values[0];
  return {
    id: row[0] as number,
    user_id: row[1] as number,
    start_date: row[2] as string,
    end_date: row[3] as string | null,
    cycle_length: row[4] as number | null,
    notes: row[5] as string | null,
  };
}

// ============ DAILY LOGS ============

export async function saveDailyLog(
  userId: number,
  date: string,
  mood: number | null,
  libido: number | null,
  notes: string | null
) {
  const database = await getDb();
  database.run(
    `INSERT INTO daily_logs (user_id, date, mood, libido, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, date) DO UPDATE SET
       mood = excluded.mood,
       libido = excluded.libido,
       notes = excluded.notes,
       updated_at = datetime('now')`,
    [userId, date, mood, libido, notes]
  );
  persistDb();
}

export async function getDailyLog(userId: number, date: string) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, user_id, date, mood, libido, notes, created_at, updated_at FROM daily_logs WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  if (!result.length || !result[0].values.length) return null;
  const row = result[0].values[0];
  return {
    id: row[0] as number,
    user_id: row[1] as number,
    date: row[2] as string,
    mood: row[3] as number | null,
    libido: row[4] as number | null,
    notes: row[5] as string | null,
    created_at: row[6] as string,
    updated_at: row[7] as string,
  };
}

export async function getAllDailyLogs(userId: number) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, user_id, date, mood, libido, notes, created_at, updated_at FROM daily_logs WHERE user_id = ? ORDER BY date DESC`,
    [userId]
  );
  if (!result.length) return [];
  return result[0].values.map((row) => ({
    id: row[0] as number,
    user_id: row[1] as number,
    date: row[2] as string,
    mood: row[3] as number | null,
    libido: row[4] as number | null,
    notes: row[5] as string | null,
    created_at: row[6] as string,
    updated_at: row[7] as string,
  }));
}

// ============ SYMPTOMS ============

export async function saveSymptoms(
  userId: number,
  date: string,
  symptoms: string[]
) {
  const database = await getDb();
  // Delete existing for that day
  database.run(
    `DELETE FROM symptoms WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  for (const s of symptoms) {
    database.run(
      `INSERT OR IGNORE INTO symptoms (user_id, date, symptom_type) VALUES (?, ?, ?)`,
      [userId, date, s]
    );
  }
  persistDb();
}

export async function getSymptomsForDate(userId: number, date: string) {
  const database = await getDb();
  const result = database.exec(
    `SELECT symptom_type FROM symptoms WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  if (!result.length) return [];
  return result[0].values.map((row) => row[0] as string);
}

export async function getAllSymptoms(userId: number) {
  const database = await getDb();
  const result = database.exec(
    `SELECT id, user_id, date, symptom_type FROM symptoms WHERE user_id = ? ORDER BY date DESC`,
    [userId]
  );
  if (!result.length) return [];
  return result[0].values.map((row) => ({
    id: row[0] as number,
    user_id: row[1] as number,
    date: row[2] as string,
    symptom_type: row[3] as string,
  }));
}

// Returns a Set of date strings (YYYY-MM-DD) that have any logged data for the given month
export async function getDaysWithDataForMonth(userId: number, year: number, month: number): Promise<Set<string>> {
  const database = await getDb();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;

  const logResult = database.exec(
    `SELECT DISTINCT date FROM daily_logs WHERE user_id = ? AND date LIKE ? AND (mood IS NOT NULL OR libido IS NOT NULL OR notes IS NOT NULL)`,
    [userId, `${prefix}%`]
  );

  const symptomResult = database.exec(
    `SELECT DISTINCT date FROM symptoms WHERE user_id = ? AND date LIKE ?`,
    [userId, `${prefix}%`]
  );

  const dates = new Set<string>();
  if (logResult.length) logResult[0].values.forEach((row) => dates.add(row[0] as string));
  if (symptomResult.length) symptomResult[0].values.forEach((row) => dates.add(row[0] as string));
  return dates;
}

// ============ NO-PERIOD MODE ============

export function getNoPeriodMode(userId: number): { enabled: boolean; referenceDate: string | null } {
  const raw = localStorage.getItem(`ragn_no_period_${userId}`);
  if (!raw) return { enabled: false, referenceDate: null };
  try {
    return JSON.parse(raw);
  } catch {
    return { enabled: false, referenceDate: null };
  }
}

export function setNoPeriodMode(userId: number, enabled: boolean, referenceDate: string | null) {
  localStorage.setItem(`ragn_no_period_${userId}`, JSON.stringify({ enabled, referenceDate }));
}

// Supprime toutes les données de l'utilisateur (cycles, logs, symptômes)
// sans supprimer le compte lui-même.
export async function resetUserData(userId: number) {
  const database = await getDb();
  database.run(`DELETE FROM cycles WHERE user_id = ?`, [userId]);
  database.run(`DELETE FROM daily_logs WHERE user_id = ?`, [userId]);
  database.run(`DELETE FROM symptoms WHERE user_id = ?`, [userId]);
  persistDb();
  // Efface aussi le mode sans règles
  localStorage.removeItem(`ragn_no_period_${userId}`);
}

export async function exportUserData(userId: number) {
  const cycles = await getCycles(userId);
  const logs = await getAllDailyLogs(userId);
  const symptoms = await getAllSymptoms(userId);
  return { cycles, daily_logs: logs, symptoms };
}
