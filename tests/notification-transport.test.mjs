import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { relayConfigured, sendLeadNotification } from '../server/notification-transport.mjs';

test('relay receives only a signed lead number, not client contacts', async () => {
  const env = { TELEGRAM_RELAY_URL: 'https://space.lpsflow.ru/internal/ilmira-notify', TELEGRAM_RELAY_SECRET: 'a'.repeat(64) };
  let request;
  await sendLeadNotification(42, 'https://ilmirakirim.com', env, async (url, options) => {
    request = { url, ...options };
    return { ok: true, json: async () => ({ ok: true }) };
  });
  assert.equal(request.url, env.TELEGRAM_RELAY_URL);
  assert.equal(request.body, '{"leadId":42}');
  assert.equal(request.headers['x-ilmira-signature'], createHmac('sha256', env.TELEGRAM_RELAY_SECRET)
    .update(`${request.headers['x-ilmira-timestamp']}.${request.body}`).digest('hex'));
  assert.doesNotMatch(request.body, /email|phone|name|contact/i);
});

test('relay settings must be complete and HTTPS', () => {
  assert.throws(() => relayConfigured({ TELEGRAM_RELAY_URL: 'https://space.lpsflow.ru/internal/ilmira-notify' }));
  assert.throws(() => relayConfigured({ TELEGRAM_RELAY_URL: 'http://space.lpsflow.ru/internal/ilmira-notify', TELEGRAM_RELAY_SECRET: 'secret' }));
  assert.equal(relayConfigured({}), false);
});
