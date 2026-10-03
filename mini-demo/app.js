import {initialState,safeState,balance,referralUrl,storageKey,lessons,completedLessons} from './model.js?v=3';
const tg=window.Telegram?.WebApp;
// Browser-only demo. No Telegram identity or personal information is collected or sent.
try{tg?.ready();tg?.expand();tg?.setHeaderColor('#ffffff');tg?.setBackgroundColor('#ffffff');}catch{}
let state=initialState();try{state=safeState(JSON.parse(localStorage.getItem(storageKey)));}catch{}
const $=selector=>document.querySelector(selector),status=$('#status');let statusTimer,currentLesson=0;
function notify(message){clearTimeout(statusTimer);status.textContent=message;statusTimer=setTimeout(()=>{status.textContent='';},5000);}
function persist(){let saved=true;try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{saved=false;notify('Не удалось сохранить прогресс. Он останется доступен до закрытия кабинета.');}render();return saved;}
function render(){
 document.querySelectorAll('[data-balance]').forEach(node=>{node.textContent=balance(state).toLocaleString('ru-RU');});
 $('#simulate').disabled=state.paid;$('#simulate').textContent=state.paid?'Бонус добавлен':'Добавить 1 000 тестовых бонусов';
 $('#simulation-state').textContent=state.paid?'Повторное начисление отключено. Начать заново можно ниже.':'';
 $('#pending-status').textContent=state.paid?'Консультация оплачена':'Ожидает оплаты';$('#pending-bonus').textContent=state.paid?'+1 000':'—';$('#simulated-entry').hidden=!state.paid;
 const completed=completedLessons(state),nextIndex=lessons.findIndex(lesson=>!state[lesson.key]);
 $('#lesson-count').textContent=`${completed} из 3 пройдено`;$('#lesson-progress').value=completed;
 $('#home-lesson-count').textContent=`${completed} из 3 уроков`;
 const next=lessons[nextIndex<0?0:nextIndex];$('#next-lesson-title').textContent=nextIndex<0?'Все три урока пройдены':next.title;
 $('#next-lesson-description').textContent=nextIndex<0?'Вы можете вернуться к упражнениям в любое время.':next.description;
 $('#continue-lesson').href=nextIndex<0?'#lessons':`#lesson-${nextIndex+1}`;$('#continue-lesson').textContent=nextIndex<0?'Открыть мои уроки':'Продолжить обучение';
 document.querySelectorAll('[data-lesson-status]').forEach(node=>{const index=Number(node.dataset.lessonStatus);node.textContent=state[lessons[index].key]?'Пройдено':`Текст · ${lessons[index].minutes} минуты`;});
 const done=state[lessons[currentLesson].key];$('#complete-lesson').disabled=done;$('#complete-lesson').textContent=done?'Урок пройден':'Отметить урок пройденным';$('#lesson-state').textContent=done?'Можно вернуться к уроку в списке.':'';
}
const url=referralUrl(location.origin,location.pathname.endsWith('/')?location.pathname:location.pathname.slice(0,location.pathname.lastIndexOf('/')+1));$('#referral-link').value=url;
function loadLesson(index){
 currentLesson=index;const lesson=lessons[index];$('#reader-title').textContent=lesson.title;$('#reader-meta').textContent=`Урок ${index+1} из 3 · ${lesson.minutes} минуты`;
 $('#reader-intro').textContent=lesson.intro;$('#reader-subheading').textContent=lesson.subheading;
 $('#reader-questions').replaceChildren(...lesson.questions.map(question=>{const item=document.createElement('li');item.textContent=question;return item;}));$('#reader-ending').textContent=lesson.ending;
}
function route(){
 const name=location.hash.slice(1)||(new URLSearchParams(location.search).get('ref')==='demo'?'welcome':'home');
 const match=/^lesson-([1-3])$/.exec(name);let target=match?'lesson':['home','invite','bonuses','lessons','profile','welcome'].includes(name)?name:'home';
 if(match)loadLesson(Number(match[1])-1);
 document.querySelectorAll('main>section').forEach(section=>{section.hidden=section.id!==target;});
 const navTarget=target==='lesson'?'lessons':target==='invite'?'bonuses':target==='welcome'?'home':target;
 document.querySelectorAll('.bottom-nav a').forEach(a=>{if(a.hash==='#'+navTarget)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 status.textContent='';window.scrollTo(0,0);render();
 try{if(target==='home'){tg?.BackButton.hide();}else{tg?.BackButton.show();}}catch{}
}
function focusCurrentView(){const heading=document.querySelector('main>section:not([hidden]) h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
window.addEventListener('hashchange',()=>{route();focusCurrentView();});try{tg?.BackButton.onClick(()=>{location.hash=location.hash.startsWith('#lesson-')?'lessons':'home';});}catch{}
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);notify('Ссылка скопирована.');}catch{$('#referral-link').focus();$('#referral-link').select();notify('Не удалось скопировать автоматически. Нажмите и удерживайте выделенную ссылку, затем выберите «Скопировать».');}});
$('#share-link').addEventListener('click',async()=>{
 const message='Приглашаю посмотреть кабинет Ильмиры Кирим. Это предпросмотр с тестовыми данными.';
 if(tg?.initData){try{tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`);return;}catch{}}
 if(navigator.share){try{await navigator.share({title:'Кабинет Ильмиры Кирим',text:message,url});return;}catch(error){if(error.name==='AbortError')return;}}
 $('#copy-link').click();
});
document.querySelectorAll('[data-external]').forEach(link=>{link.addEventListener('click',event=>{if(!tg?.initData)return;try{if(link.href.startsWith('https://t.me/'))tg.openTelegramLink(link.href);else tg.openLink(link.href);event.preventDefault();}catch{}});});
$('#simulate').addEventListener('click',()=>{if(state.paid)return;state.paid=true;if(persist())notify('Добавлено 1 000 тестовых бонусов. Баланс и история обновлены.');});
$('#reset').addEventListener('click',()=>{state=initialState();if(persist())notify('Тестовый баланс и прогресс уроков сброшены.');});
$('#complete-lesson').addEventListener('click',()=>{state[lessons[currentLesson].key]=true;if(persist())notify('Урок пройден.');});
route();
