const messengerNames = { telegram: 'Телеграм', whatsapp: 'Ватсап', max: 'MAX' };

function oneLine(value, maxLength) {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Cf}]+/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .slice(0, maxLength);
}

export function telegramLeadNotice(lead, origin) {
  if (!Number.isSafeInteger(lead?.id) || lead.id < 1) throw new Error('Invalid lead ID');
  const name = oneLine(lead.name, 80);
  const phone = oneLine(lead.phone, 30);
  const email = oneLine(lead.email, 120);
  const service = oneLine(lead.service, 120);
  if (!name || !phone || !email) throw new Error('Lead contacts are incomplete');
  const cabinetUrl = new URL('/cabinet/', origin).toString();
  const lines = [
    `🟢 Новая заявка №${lead.id}`,
    '',
    `Имя: ${name}`,
    `Телефон: ${phone}`,
    `Почта: ${email}`
  ];
  if (service) lines.push(`Запрос: ${service}`);
  if (messengerNames[lead.messenger]) lines.push(`Удобнее связаться: ${messengerNames[lead.messenger]}`);
  return {
    text: lines.join('\n'),
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [[{ text: 'Открыть заявки', url: cabinetUrl }]] }
  };
}
