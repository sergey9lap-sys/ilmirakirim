import assert from 'node:assert/strict';
import { test } from 'node:test';
import { telegramLeadNotice } from '../server/telegram-notice.mjs';

test('Telegram notice is clear and contains no client personal data', () => {
  const notice = telegramLeadNotice(42, 'https://ilmirakirim.com');
  assert.match(notice.text, /Новая заявка с сайта Ильмиры/);
  assert.match(notice.text, /Заявка №42 сохранена/);
  assert.match(notice.text, /закрытом кабинете/);
  assert.equal(notice.reply_markup.inline_keyboard[0][0].url, 'https://ilmirakirim.com/cabinet/');
  assert.equal(notice.disable_web_page_preview, true);
  assert.doesNotMatch(notice.text, /имя|телефон|почт/i);
});

test('Telegram notice rejects invalid lead numbers', () => {
  assert.throws(() => telegramLeadNotice(0, 'https://ilmirakirim.com'));
});
