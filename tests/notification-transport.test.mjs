import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sendLeadNotification, telegramApiRequest, tunnelPort } from '../server/notification-transport.mjs';

const lead = { id: 42, name: 'Анна', phone: '+7 900 000-00-00', email: 'anna@example.com', service: 'Аудит', messenger: 'telegram' };
const env = { TELEGRAM_BOT_TOKEN: `123:${'x'.repeat(35)}`, TELEGRAM_CHAT_ID: '456', TELEGRAM_API_TUNNEL_PORT: '1443' };

test('tunnel receives a Telegram message with contacts, never a relay request', async () => {
  let sent;
  await sendLeadNotification(lead, 'https://ilmirakirim.com', env, undefined, async (token, method, body, port) => {
    sent = { token, method, payload: JSON.parse(body), port };
    return { message_id: 1 };
  });
  assert.equal(sent.method, 'sendMessage');
  assert.equal(sent.port, 1443);
  assert.equal(sent.payload.chat_id, '456');
  assert.match(sent.payload.text, /Анна/);
  assert.match(sent.payload.text, /anna@example.com/);
});

test('direct Telegram API remains available if the tunnel is removed', async () => {
  let url;
  const result = await telegramApiRequest('getWebhookInfo', {}, { TELEGRAM_BOT_TOKEN: env.TELEGRAM_BOT_TOKEN }, async (requestUrl) => {
    url = requestUrl;
    return { ok: true, json: async () => ({ ok: true, result: { url: '' } }) };
  });
  assert.equal(url, `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
  assert.deepEqual(result, { url: '' });
});

test('tunnel port and API method are validated', async () => {
  assert.equal(tunnelPort({}), null);
  assert.throws(() => tunnelPort({ TELEGRAM_API_TUNNEL_PORT: 'not-a-port' }));
  await assert.rejects(() => telegramApiRequest('deleteWebhook', {}, env));
});
