import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync, chmodSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tunnelPort, sendLeadNotification } from './notification-transport.mjs';

const origin = process.env.PUBLIC_ORIGIN || 'https://ilmirakirim.com';
const dataDir = process.env.DATA_DIR;
const passwordHash = process.env.ADMIN_PASSWORD_HASH;
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4314);
const secureCookies = process.env.NODE_ENV === 'production';
tunnelPort();

if (!dataDir || !isAbsolute(dataDir)) throw new Error('DATA_DIR must be an absolute path outside the public site');
const siteRoot = resolve(fileURLToPath(new URL('../', import.meta.url)));
if (process.env.NODE_ENV === 'production' && (resolve(dataDir) === siteRoot || resolve(dataDir).startsWith(siteRoot + sep))) {
  throw new Error('DATA_DIR must be outside the public site');
}
if (!passwordHash || !/^[a-f0-9]{32}:[a-f0-9]{128}$/.test(passwordHash)) {
  throw new Error('ADMIN_PASSWORD_HASH is missing or invalid');
}
if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Invalid PORT');
if (!['127.0.0.1', '::1'].includes(host)) throw new Error('Server must listen on loopback only');

mkdirSync(dataDir, { recursive: true, mode: 0o700 });
try { chmodSync(dataDir, 0o700); } catch { /* Windows development filesystem */ }
const db = new DatabaseSync(join(dataDir, 'leads.sqlite'), { timeout: 5000 });
db.exec(`
  PRAGMA journal_mode=WAL;
  PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    country TEXT NOT NULL,
    service TEXT NOT NULL,
    messenger TEXT NOT NULL,
    offer_accepted INTEGER NOT NULL CHECK(offer_accepted = 1),
    personal_data_accepted INTEGER NOT NULL CHECK(personal_data_accepted = 1),
    mailing_accepted INTEGER NOT NULL CHECK(mailing_accepted IN (0, 1))
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_outbox (
    lead_id INTEGER PRIMARY KEY REFERENCES leads(id),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT
  );
`);
const insertLead = db.prepare(`INSERT INTO leads
  (created_at,name,email,phone,country,service,messenger,offer_accepted,personal_data_accepted,mailing_accepted)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
const insertNotice = db.prepare('INSERT INTO notification_outbox (lead_id) VALUES (?)');
const listLeads = db.prepare('SELECT id,created_at,name,email,phone,country,service,messenger,mailing_accepted FROM leads ORDER BY id DESC');

const limits = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const record = limits.get(key);
  if (!record || record.until < now) { limits.set(key, { count: 1, until: now + windowMs }); return false; }
  record.count += 1;
  return record.count > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of limits) if (value.until < now) limits.delete(key);
  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
}, 60 * 60 * 1000).unref();

function json(res, status, value) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'x-frame-options': 'DENY'
  });
  res.end(JSON.stringify(value));
}
function sameOrigin(req) {
  const source = req.headers.origin;
  if (!source) return false;
  try { return new URL(source).origin === origin; } catch { return false; }
}
function clientKey(req) {
  // Only a local Nginx proxy can reach this listener; it overwrites X-Real-IP.
  return String(req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown').slice(0, 80);
}
async function readJson(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new Error('TYPE');
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 12_000) throw new Error('SIZE');
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('JSON'); }
}
function validLead(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const name = String(raw.name || '').trim();
  const email = String(raw.email || '').trim().toLowerCase();
  const phone = String(raw.phone || '').trim();
  const country = String(raw.country || '').trim();
  const service = String(raw.service || '').trim();
  const messenger = String(raw.messenger || '').trim();
  const digits = phone.replace(/\D/g, '');
  if (name.length < 2 || name.length > 80 || /[<>\r\n]/.test(name)) return null;
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (!/^\+?[\d\s().-]+$/.test(phone) || digits.length < 7 || digits.length > 15) return null;
  if (!/^[A-Z]{2}$/.test(country) || service.length < 2 || service.length > 120) return null;
  if (!['telegram', 'whatsapp', 'max'].includes(messenger)) return null;
  if (raw.offerAccepted !== true || raw.personalDataAccepted !== true) return null;
  if (typeof raw.mailingAccepted !== 'boolean') return null;
  return { name, email, phone, country, service, messenger, mailingAccepted: raw.mailingAccepted };
}
function cookieToken(req) {
  const match = String(req.headers.cookie || '').match(/(?:^|;\s*)ilmira_session=([a-f0-9]{64})(?:;|$)/);
  return match?.[1] || null;
}
function authenticated(req) {
  const token = cookieToken(req);
  if (!token) return false;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return Boolean(db.prepare('SELECT 1 FROM sessions WHERE token_hash=? AND expires_at>?').get(tokenHash, Date.now()));
}
function sessionCookie(value, maxAge) {
  return `ilmira_session=${value}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${maxAge}${secureCookies ? '; Secure' : ''}`;
}
function verifyPassword(value) {
  if (typeof value !== 'string' || value.length > 256) return false;
  const [salt, expectedHex] = passwordHash.split(':');
  const actual = scryptSync(value, Buffer.from(salt, 'hex'), 64);
  return timingSafeEqual(actual, Buffer.from(expectedHex, 'hex'));
}
async function sendPendingNotices() {
  if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) return;
  const pending = db.prepare(`SELECT o.lead_id,o.attempts,l.name,l.email,l.phone,l.service,l.messenger
    FROM notification_outbox o JOIN leads l ON l.id=o.lead_id
    WHERE o.sent_at IS NULL AND o.next_attempt_at<=? ORDER BY o.lead_id LIMIT 10`).all(Date.now());
  for (const notice of pending) {
    try {
      await sendLeadNotification({ id: notice.lead_id, ...notice }, origin);
      db.prepare('UPDATE notification_outbox SET sent_at=? WHERE lead_id=?').run(new Date().toISOString(), notice.lead_id);
    } catch (error) {
      const delay = Math.min(3_600_000, 30_000 * 2 ** Math.min(notice.attempts, 7));
      db.prepare('UPDATE notification_outbox SET attempts=attempts+1,next_attempt_at=? WHERE lead_id=?').run(Date.now() + delay, notice.lead_id);
      console.error('Telegram notification failed; will retry', error.message);
    }
  }
}
let notifying = false;
async function scheduleNotices() {
  if (notifying) return;
  notifying = true;
  try { await sendPendingNotices(); } finally { notifying = false; }
}
setInterval(scheduleNotices, 30_000).unref();

const cabinetHtml = readFileSync(fileURLToPath(new URL('./cabinet.html', import.meta.url)));
const cabinetJs = readFileSync(fileURLToPath(new URL('./cabinet.js', import.meta.url)));
const cabinetCss = readFileSync(fileURLToPath(new URL('./cabinet.css', import.meta.url)));
const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', origin);
  try {
    if (url.pathname === '/cabinet/' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'", 'x-robots-tag': 'noindex, nofollow' });
      return res.end(cabinetHtml);
    }
    if (url.pathname === '/cabinet/app.js' || url.pathname === '/cabinet/app.css') {
      const script = url.pathname.endsWith('.js');
      res.writeHead(200, { 'content-type': script ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' });
      return res.end(script ? cabinetJs : cabinetCss);
    }
    if (url.pathname === '/api/leads' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Обновите страницу и попробуйте ещё раз' });
      if (rateLimit(`lead:${clientKey(req)}`, 8, 60 * 60 * 1000)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте позже' });
      const lead = validLead(await readJson(req));
      if (!lead) return json(res, 400, { error: 'Проверьте заполненные поля и согласия' });
      db.exec('BEGIN IMMEDIATE');
      let id;
      try {
        id = Number(insertLead.run(new Date().toISOString(), lead.name, lead.email, lead.phone, lead.country, lead.service, lead.messenger, 1, 1, Number(lead.mailingAccepted)).lastInsertRowid);
        insertNotice.run(id);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
      scheduleNotices();
      return json(res, 201, { ok: true, id });
    }
    if (url.pathname === '/api/admin/login' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Обновите страницу и попробуйте ещё раз' });
      if (rateLimit(`login:${clientKey(req)}`, 6, 15 * 60 * 1000)) return json(res, 429, { error: 'Слишком много попыток. Попробуйте через 15 минут' });
      const body = await readJson(req);
      if (!verifyPassword(body?.password)) return json(res, 401, { error: 'Неверный пароль' });
      const token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions (token_hash,expires_at) VALUES (?,?)').run(createHash('sha256').update(token).digest('hex'), Date.now() + 8 * 60 * 60 * 1000);
      res.setHeader('set-cookie', sessionCookie(token, 8 * 60 * 60));
      return json(res, 200, { ok: true });
    }
    if (url.pathname === '/api/admin/leads' && req.method === 'GET') {
      if (!authenticated(req)) return json(res, 401, { error: 'Войдите, чтобы увидеть заявки' });
      return json(res, 200, { leads: listLeads.all() });
    }
    if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
      if (!sameOrigin(req)) return json(res, 403, { error: 'Обновите страницу и попробуйте ещё раз' });
      const token = cookieToken(req);
      if (token) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(createHash('sha256').update(token).digest('hex'));
      res.setHeader('set-cookie', sessionCookie('', 0));
      return json(res, 200, { ok: true });
    }
    return json(res, 404, { error: 'Не найдено' });
  } catch (error) {
    if (['TYPE', 'SIZE', 'JSON'].includes(error.message)) return json(res, 400, { error: 'Не удалось прочитать данные. Обновите страницу и попробуйте снова' });
    console.error('Request failed', error);
    return json(res, 500, { error: 'Сейчас не удалось обработать запрос. Попробуйте ещё раз позже' });
  }
});
server.listen(port, host, () => console.log(`Lead service listening on ${host}:${server.address().port}`));
