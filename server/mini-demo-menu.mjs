// One-time bot-menu setup. Never polls updates, changes webhooks or sends messages.
import {request} from 'node:https';
import {writeFileSync,readFileSync} from 'node:fs';
const token=process.env.TELEGRAM_BOT_TOKEN,port=Number(process.env.TELEGRAM_API_TUNNEL_PORT||443);
if(!/^\d+:[A-Za-z0-9_-]{30,}$/.test(token||''))throw new Error('Bot configuration is missing');
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid transport configuration');
async function api(method,payload={}){
 if(!['getMe','getChatMenuButton','setChatMenuButton'].includes(method))throw new Error('Method not permitted');
 const body=JSON.stringify(payload);
 return new Promise((resolve,reject)=>{
  const req=request({hostname:process.env.TELEGRAM_API_TUNNEL_PORT?'127.0.0.1':'api.telegram.org',port,servername:'api.telegram.org',method:'POST',path:`/bot${token}/${method}`,headers:{host:'api.telegram.org','content-type':'application/json','content-length':Buffer.byteLength(body)},timeout:15000},res=>{
   let text='';res.setEncoding('utf8');res.on('data',chunk=>{text+=chunk;if(text.length>32768)req.destroy();});res.on('end',()=>{try{const data=JSON.parse(text);if(res.statusCode!==200||!data.ok)reject(new Error('Telegram rejected request'));else resolve(data.result);}catch{reject(new Error('Invalid Telegram response'));}});
  });req.on('error',()=>reject(new Error('Telegram connection failed')));req.on('timeout',()=>req.destroy());req.end(body);
 });
}
const [mode,scope,backupFile]=process.argv.slice(2);
const payload=scope==='global'?{}:/^\d+$/.test(scope||'')?{chat_id:scope}:null;
if(mode==='inspect'){const bot=await api('getMe');const menu=await api('getChatMenuButton',payload||{});console.log(JSON.stringify({username:bot.username,menu}));}
else if(mode==='install'&&payload&&backupFile?.startsWith('/var/backups/')){
 const previous=await api('getChatMenuButton',payload);
 writeFileSync(backupFile,JSON.stringify({payload,previous}),{mode:0o600,flag:'wx'});
 const menu_button={type:'web_app',text:'Демо-кабинет',web_app:{url:'https://ilmirakirim.com/mini-demo/'}};
 await api('setChatMenuButton',{...payload,menu_button});
 const current=await api('getChatMenuButton',payload);
 if(current.type!=='web_app'||current.web_app?.url!==menu_button.web_app.url)throw new Error('Menu verification failed');
 console.log('Demo menu installed and verified. Previous menu saved.');
}else if(mode==='restore'&&backupFile?.startsWith('/var/backups/')){const saved=JSON.parse(readFileSync(backupFile));await api('setChatMenuButton',{...saved.payload,menu_button:saved.previous});console.log('Previous menu restored.');}
else throw new Error('Use: inspect [global|CHAT_ID] | install global|CHAT_ID /var/backups/UNIQUE.json | restore global /var/backups/FILE.json');
