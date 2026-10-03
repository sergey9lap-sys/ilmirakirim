// Explicit one-recipient preview message. No broadcast or automatic /start handler.
export function demoMessage(chatId){
 const id=String(chatId??'');
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))throw new Error('A private chat ID is required');
 return {
  chat_id:id,
  text:'Ваш личный кабинет\n\nУроки, бонусы и приглашения — в одном месте. Откройте кабинет кнопкой ниже.\n\nПредпросмотр: данные и начисления тестовые.',
  reply_markup:{inline_keyboard:[[{text:'Открыть кабинет',web_app:{url:'https://ilmirakirim.com/mini-demo/'}}]]}
 };
}
