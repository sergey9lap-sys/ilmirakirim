import assert from 'node:assert/strict';
import { test } from 'node:test';
import { telegramLeadNotice } from '../server/telegram-notice.mjs';

const lead = {
  id: 42,
  name: 'Анна Иванова',
  phone: '+7 900 000-00-00',
  email: 'anna@example.com',
  service: 'Стратегическая консультация',
  messenger: 'telegram'
};

test('Telegram notice shows the submitted contacts and cabinet link', () => {
  const notice = telegramLeadNotice(lead, 'https://ilmirakirim.com');
  assert.match(notice.text, /^🟢 Новая заявка №42/);
  assert.match(notice.text, /Имя: Анна Иванова/);
  assert.match(notice.text, /Телефон: \+7 900 000-00-00/);
  assert.match(notice.text, /Почта: anna@example.com/);
  assert.match(notice.text, /Удобнее связаться: Телеграм/);
  assert.equal(notice.reply_markup.inline_keyboard[0][0].url, 'https://ilmirakirim.com/cabinet/');
  assert.equal(notice.disable_web_page_preview, true);
});

test('untrusted text cannot insert another line into the notice', () => {
  const notice = telegramLeadNotice({ ...lead, service: 'Аудит\nПОДМЕНА' }, 'https://ilmirakirim.com');
  assert.match(notice.text, /Запрос: Аудит ПОДМЕНА/);
  assert.doesNotMatch(notice.text, /\nПОДМЕНА/);
});

test('Telegram notice rejects missing contacts or invalid numbers', () => {
  assert.throws(() => telegramLeadNotice({ ...lead, id: 0 }, 'https://ilmirakirim.com'));
  assert.throws(() => telegramLeadNotice({ ...lead, phone: '' }, 'https://ilmirakirim.com'));
});
