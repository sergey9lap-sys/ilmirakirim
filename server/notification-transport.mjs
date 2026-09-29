import { request } from 'node:https';
import { telegramLeadNotice } from './telegram-notice.mjs';

export function tunnelPort(env = process.env) {
  if (!env.TELEGRAM_API_TUNNEL_PORT) return null;
  const port = Number(env.TELEGRAM_API_TUNNEL_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid Telegram tunnel port');
  return port;
}

function sendThroughTunnel(token, method, body, port) {
  return new Promise((resolve, reject) => {
    const req = request({
      hostname: '127.0.0.1',
      port,
      servername: 'api.telegram.org',
      method: 'POST',
      path: `/bot${token}/${method}`,
      headers: { host: 'api.telegram.org', 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
      timeout: 8000
    }, res => {
      let payload = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        payload += chunk;
        if (payload.length > 16_384) req.destroy(new Error('Telegram response too large'));
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(payload);
          if (res.statusCode !== 200 || result.ok !== true) return reject(new Error('Telegram request rejected'));
          resolve(result.result);
        } catch { reject(new Error('Invalid Telegram response')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('Telegram delivery timed out')));
    req.on('error', () => reject(new Error('Telegram delivery failed')));
    req.end(body);
  });
}

export async function telegramApiRequest(method, payload, env = process.env, fetchImpl = fetch, tunnelImpl = sendThroughTunnel) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token || '')) throw new Error('Telegram bot token is missing');
  if (!/^(?:sendMessage|getUpdates|getWebhookInfo)$/.test(method)) throw new Error('Unsupported Telegram method');
  const body = JSON.stringify(payload);
  const port = tunnelPort(env);
  if (port) return tunnelImpl(token, method, body, port);
  try {
    const response = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal: AbortSignal.timeout(8000)
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error('Telegram request rejected');
    return result.result;
  } catch { throw new Error('Telegram delivery failed'); }
}

export async function sendLeadNotification(lead, origin, env = process.env, fetchImpl = fetch, tunnelImpl = sendThroughTunnel) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  return telegramApiRequest('sendMessage', {
    chat_id: env.TELEGRAM_CHAT_ID,
    ...telegramLeadNotice(lead, origin)
  }, env, fetchImpl, tunnelImpl);
}
