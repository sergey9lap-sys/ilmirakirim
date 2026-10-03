import test from 'node:test';import assert from 'node:assert/strict';
import {demoMessage} from '../server/mini-demo-message.mjs';
test('Preview message launches the Mini App from a single private-chat button',()=>{
 const payload=demoMessage('123456789');assert.equal(payload.chat_id,'123456789');assert.match(payload.text,/Предпросмотр/);
 assert.deepEqual(payload.reply_markup.inline_keyboard,[[{text:'Открыть кабинет',web_app:{url:'https://ilmirakirim.com/mini-demo/'}}]]);
 assert.equal(payload.reply_markup.inline_keyboard[0][0].url,undefined);
});
test('Preview cannot be broadcast to global, a group or an arbitrary username',()=>{
 for(const id of ['global','@username','-123456','0','1.5','9007199254740992',undefined])assert.throws(()=>demoMessage(id));
});
