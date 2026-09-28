import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes, scryptSync } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

test('lead is saved and only the owner can read it', async () => {
  const dataDir = mkdtempSync(join(tmpdir(), 'ilmira-leads-'));
  const salt = randomBytes(16);
  const password = 'test-only-password-12345';
  const hash = `${salt.toString('hex')}:${scryptSync(password, salt, 64).toString('hex')}`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', DATA_DIR: dataDir, ADMIN_PASSWORD_HASH: hash, PORT: '0', PUBLIC_ORIGIN: 'http://127.0.0.1:8080' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  try {
    const port = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server did not start')), 10000);
      child.once('error', reject);
      child.stdout.once('data', buffer => {
        clearTimeout(timeout);
        const match = String(buffer).match(/127\.0\.0\.1:(\d+)/);
        if (match) resolve(Number(match[1])); else reject(new Error(String(buffer)));
      });
    });
    const base = `http://127.0.0.1:${port}`;
    const request = (path, options = {}) => fetch(base + path, options);
    assert.equal((await request('/api/admin/leads')).status, 401);
    assert.equal((await request('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://wrong.example' }, body: '{}' })).status, 403);
    assert.equal((await request('/api/leads', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://ilmirakirim.ru' }, body: '{}' })).status, 403);
    const lead = {
      name: 'Тестовый клиент', email: 'client@example.ru', phone: '+7 917 123-45-67', country: 'RU',
      service: 'Стратегический аудит', messenger: 'telegram', offerAccepted: true,
      personalDataAccepted: true, mailingAccepted: false
    };
    const headers = { 'content-type': 'application/json', origin: 'http://127.0.0.1:8080' };
    assert.equal((await request('/api/leads', { method: 'POST', headers, body: JSON.stringify({ ...lead, personalDataAccepted: false }) })).status, 400);
    const created = await request('/api/leads', { method: 'POST', headers, body: JSON.stringify(lead) });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).id, 1);
    assert.equal((await request('/api/admin/login', { method: 'POST', headers, body: JSON.stringify({ password: 'wrong' }) })).status, 401);
    const login = await request('/api/admin/login', { method: 'POST', headers, body: JSON.stringify({ password }) });
    assert.equal(login.status, 200);
    assert.match(login.headers.get('set-cookie'), /HttpOnly; SameSite=Strict; Path=\/api\/admin; Max-Age=28800; Secure/);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const listed = await request('/api/admin/leads', { headers: { cookie } });
    assert.equal(listed.status, 200);
    const rows = (await listed.json()).leads;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, lead.email);
    const logout = await request('/api/admin/logout', { method: 'POST', headers: { origin: headers.origin, cookie } });
    assert.equal(logout.status, 200);
    assert.equal((await request('/api/admin/leads', { headers: { cookie } })).status, 401);
    const backupDir = join(dataDir, 'backups');
    execFileSync(process.execPath, ['server/backup.mjs'], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, DATA_DIR: dataDir, BACKUP_DIR: backupDir }
    });
    const backup = new DatabaseSync(join(backupDir, `leads-${new Date().toISOString().slice(0, 10)}.sqlite`));
    assert.equal(backup.prepare('SELECT COUNT(*) AS count FROM leads').get().count, 1);
    backup.close();
  } finally {
    child.kill();
    await once(child, 'exit');
    rmSync(dataDir, { recursive: true, force: true });
  }
});
