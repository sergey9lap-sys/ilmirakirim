import { backup, DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const { DATA_DIR, BACKUP_DIR } = process.env;
if (!DATA_DIR || !BACKUP_DIR || !isAbsolute(DATA_DIR) || !isAbsolute(BACKUP_DIR)) {
  throw new Error('DATA_DIR and BACKUP_DIR must be absolute paths on the Russian server');
}
mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(join(DATA_DIR, 'leads.sqlite'));
const target = join(BACKUP_DIR, `leads-${new Date().toISOString().slice(0, 10)}.sqlite`);
await backup(db, target);
db.close();
try { chmodSync(target, 0o600); } catch { /* Windows development filesystem */ }
console.log(`Backup created: ${target}`);
