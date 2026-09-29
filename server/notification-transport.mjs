import { createHmac } from 'node:crypto';
import { telegramLeadNotice } from './telegram-notice.mjs';

export function relayConfigured(env = process.env) {
  const hasUrl = Boolean(env.TELEGRAM_RELAY_URL);
  const hasSecret = Boolean(env.TELEGRAM_RELAY_SECRET);
  if (hasUrl !== hasSecret) throw new Error('TELEGRAM_RELAY_URL and TELEGRAM_RELAY_SECRET must be set together');
  if (hasUrl && new URL(env.TELEGRAM_RELAY_URL).protocol !== 'https:') {
    throw new Error('TELEGRAM_RELAY_URL must use HTTPS');
  }
  return hasUrl;
}

export async function sendLeadNotification(leadId, origin, env = process.env, fetchImpl = fetch) {
  if (relayConfigured(env)) {
    const body = JSON.stringify({ leadId });
    const timestamp = String(Date.now());
    const signature = createHmac('sha256', env.TELEGRAM_RELAY_SECRET)
      .update(`${timestamp}.${body}`).digest('hex');
    const response = await fetchImpl(env.TELEGRAM_RELAY_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ilmira-timestamp': timestamp,
        'x-ilmira-signature': signature
      },
      body,
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) throw new Error(`Notification relay status ${response.status}`);
    const result = await response.json();
    if (!result.ok) throw new Error('Notification relay rejected delivery');
    return;
  }

  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const response = await fetchImpl(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, ...telegramLeadNotice(leadId, origin) }),
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`Telegram status ${response.status}`);
  const result = await response.json();
  if (!result.ok) throw new Error('Telegram rejected notification');
}
