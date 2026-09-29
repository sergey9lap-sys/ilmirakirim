import { telegramLeadNotice } from './telegram-notice.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

const [mode, chatId] = process.argv.slice(2);
const api = `https://api.telegram.org/bot${token}`;

async function telegram(method, body) {
  const response = await fetch(`${api}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000)
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(`Telegram ${method} failed`);
  return result.result;
}

if (mode === 'list-start-chats' && !chatId) {
  const webhook = await telegram('getWebhookInfo', {});
  if (webhook.url) throw new Error('A webhook is configured; do not use getUpdates while it is active');
  const updates = await telegram('getUpdates', { limit: 100, timeout: 0, allowed_updates: ['message'] });
  const chats = new Map();
  for (const update of updates) {
    const message = update.message;
    if (message?.chat?.type === 'private' && /^\/start(?:\s|$)/.test(message.text || '')) {
      chats.set(message.chat.id, {
        id: message.chat.id,
        username: message.from?.username || null,
        name: [message.from?.first_name, message.from?.last_name].filter(Boolean).join(' ')
      });
    }
  }
  console.log(JSON.stringify([...chats.values()], null, 2));
} else if (mode === 'send-preview' && /^\d+$/.test(chatId || '')) {
  const notice = telegramLeadNotice(123, process.env.PUBLIC_ORIGIN || 'https://ilmirakirim.com');
  await telegram('sendMessage', {
    chat_id: chatId,
    ...notice,
    text: `🧪 Тест уведомления — не настоящая заявка\n\n${notice.text}`
  });
  console.log('Preview sent');
} else {
  console.error('Usage: node server/test-telegram-notice.mjs list-start-chats | send-preview CHAT_ID');
  process.exitCode = 2;
}
