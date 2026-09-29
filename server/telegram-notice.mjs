export function telegramLeadNotice(leadId, origin) {
  if (!Number.isSafeInteger(leadId) || leadId < 1) throw new Error('Invalid lead ID');
  const cabinetUrl = new URL('/cabinet/', origin).toString();
  return {
    text: `🟢 Новая заявка с сайта Ильмиры\n\nЗаявка №${leadId} сохранена. Контакты и запрос клиента — в закрытом кабинете.\n\nОткройте кабинет, чтобы связаться с клиентом.`,
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [[{ text: 'Открыть заявки', url: cabinetUrl }]]
    }
  };
}
