import {initialState,safeState,balance,referralUrl,storageKey} from './model.js';
const tg=window.Telegram?.WebApp;
// No initData, account IDs or personal information is sent or used in this demo.
try{tg?.ready();tg?.expand();tg?.setHeaderColor('#ffffff');tg?.setBackgroundColor('#ffffff');}catch{}
let state=initialState();try{state=safeState(JSON.parse(localStorage.getItem(storageKey)));}catch{}
const $=selector=>document.querySelector(selector),status=$('#status');let statusTimer;
function notify(message){clearTimeout(statusTimer);status.textContent=message;statusTimer=setTimeout(()=>{status.textContent='';},5000);}
function persist(){try{localStorage.setItem(storageKey,JSON.stringify(state));}catch{notify('В этом браузере прогресс сохранится только до закрытия страницы.');}render();}
function render(){document.querySelectorAll('[data-balance]').forEach(node=>{node.textContent=balance(state).toLocaleString('ru-RU');});$('#simulate').disabled=state.paid;$('#simulate').textContent=state.paid?'Тестовый бонус начислен':'Начислить тестовый бонус';$('#simulation-state').textContent=state.paid?'Повторное нажатие не начисляет бонус второй раз.':'';$('#pending-status').textContent=state.paid?'Оплата подтверждена · ваш тест':'Ожидает оплаты · пример';$('#pending-bonus').textContent=state.paid?'+1 000':'—';$('#simulated-entry').hidden=!state.paid;$('#lesson-state').textContent=state.lessonRead?'Пример отмечен просмотренным.':'';$('#complete-lesson').disabled=state.lessonRead;}
const url=referralUrl(location.origin,location.pathname.endsWith('/')?location.pathname:location.pathname.slice(0,location.pathname.lastIndexOf('/')+1));$('#referral-link').value=url;
function route(){const name=location.hash.slice(1)|| (new URLSearchParams(location.search).get('ref')==='demo'?'welcome':'home');const allowed=['home','invite','bonuses','lessons','welcome'];const target=allowed.includes(name)?name:'home';document.querySelectorAll('main>section').forEach(section=>{section.hidden=section.id!==target;});document.querySelectorAll('.bottom-nav a').forEach(a=>{if(a.hash==='#'+target)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});window.scrollTo(0,0);try{if(target==='home'){tg?.BackButton.hide();}else{tg?.BackButton.show();}}catch{}}
function focusCurrentView(){const heading=document.querySelector('main>section:not([hidden]) h1');if(heading){heading.tabIndex=-1;heading.focus({preventScroll:true});}}
window.addEventListener('hashchange',()=>{route();focusCurrentView();});try{tg?.BackButton.onClick(()=>{location.hash='home';});}catch{}
$('#copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(url);notify('Тестовая ссылка скопирована.');}catch{$('#referral-link').focus();$('#referral-link').select();notify('Выделили ссылку. Нажмите и удерживайте её, чтобы скопировать.');}});
$('#share-link').addEventListener('click',async()=>{const message='Посмотрите тестовый кабинет Ильмиры. Это пример, бонусы не настоящие.';if(tg?.initData){try{tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`);return;}catch{}}if(navigator.share){try{await navigator.share({title:'Ильмира Кирим — тестовый кабинет',text:message,url});return;}catch(error){if(error.name==='AbortError')return;}}$('#copy-link').click();});
$('#simulate').addEventListener('click',()=>{if(state.paid)return;state.paid=true;persist();notify('Добавили 1 000 тестовых бонусов. Настоящие деньги не начисляются.');});
$('#reset').addEventListener('click',()=>{state=initialState();persist();$('#lesson-body').hidden=true;notify('Демонстрация возвращена к исходному состоянию.');});
$('#open-lesson').addEventListener('click',()=>{$('#lesson-body').hidden=false;$('#lesson-body').focus();$('#lesson-body').scrollIntoView({block:'start'});});
$('#complete-lesson').addEventListener('click',()=>{state.lessonRead=true;persist();notify('Пример урока отмечен просмотренным.');});
render();route();
