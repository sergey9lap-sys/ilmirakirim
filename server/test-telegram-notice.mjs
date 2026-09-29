import { telegramLeadNotice } from './telegram-notice.mjs';
import { telegramApiRequest } from './notification-transport.mjs';

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error('TELEGRAM_BOT_TOKEN is required');

const [mode, chatId] = process.argv.slice(2);
const telegram = telegramApiRequest;

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
  const notice = telegramLeadNotice({
    id: 123,
    name: 'Тестовый клиент',
    phone: '+7 900 000-00-00',
    email: 'test@example.com',
    service: 'Тестовая заявка',
    messenger: 'telegram'
  }, process.env.PUBLIC_ORIGIN || 'https://ilmirakirim.com');
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
