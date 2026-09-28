const loginView = document.querySelector('#login-view');
const leadsView = document.querySelector('#leads-view');
const loginForm = document.querySelector('#login-form');
const loginStatus = document.querySelector('#login-status');
const leadsStatus = document.querySelector('#leads-status');
const leadList = document.querySelector('#lead-list');
const search = document.querySelector('#search');
const logout = document.querySelector('#logout');
let leads = [];

function showLogin() {
  loginView.hidden = false;
  leadsView.hidden = true;
  logout.hidden = true;
  leads = [];
  leadList.replaceChildren();
}
function leadWord(count) {
  if (count % 100 >= 11 && count % 100 <= 14) return 'заявок';
  if (count % 10 === 1) return 'заявка';
  if (count % 10 >= 2 && count % 10 <= 4) return 'заявки';
  return 'заявок';
}
function showLeads() {
  loginView.hidden = true;
  leadsView.hidden = false;
  logout.hidden = false;
}
function detail(label, value) {
  const row = document.createElement('div');
  row.className = 'detail';
  const title = document.createElement('dt');
  title.textContent = label;
  const text = document.createElement('dd');
  text.textContent = value;
  row.append(title, text);
  return row;
}
function contact(label, value, href) {
  const row = detail(label, value);
  const dd = row.querySelector('dd');
  dd.textContent = '';
  const link = document.createElement('a');
  link.href = href;
  link.textContent = value;
  dd.append(link);
  return row;
}
function render() {
  const query = search.value.trim().toLocaleLowerCase('ru');
  const visible = leads.filter(lead => [lead.name, lead.email, lead.phone, lead.service].some(value => value.toLocaleLowerCase('ru').includes(query)));
  document.querySelector('#lead-count').textContent = `${leads.length} ${leadWord(leads.length)}`;
  leadList.replaceChildren();
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = leads.length ? 'По вашему запросу заявок нет' : 'Пока заявок нет. Новые обращения появятся здесь.';
    leadList.append(empty);
    return;
  }
  visible.forEach(lead => {
    const card = document.createElement('article');
    card.className = 'lead';
    const head = document.createElement('div');
    head.className = 'lead-head';
    const title = document.createElement('h2');
    title.textContent = lead.name;
    const date = document.createElement('time');
    date.dateTime = lead.created_at;
    date.textContent = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(lead.created_at));
    head.append(title, date);
    const service = document.createElement('p');
    service.className = 'service';
    service.textContent = lead.service;
    const details = document.createElement('dl');
    details.append(
      contact('Телефон', lead.phone, `tel:${lead.phone.replace(/[^\d+]/g, '')}`),
      contact('Почта', lead.email, `mailto:${lead.email}`),
      detail('Страна', lead.country),
      detail('Мессенджер', { telegram: 'Телеграм', whatsapp: 'Ватсап', max: 'Макс' }[lead.messenger] || lead.messenger),
      detail('Рассылка', lead.mailing_accepted ? 'Согласие получено' : 'Не согласился')
    );
    card.append(head, service, details);
    leadList.append(card);
  });
}
async function loadLeads() {
  if (leadsView.hidden) loginStatus.textContent = 'Проверяем доступ…';
  else leadsStatus.textContent = 'Загружаем заявки…';
  try {
    const response = await fetch('/api/admin/leads', { credentials: 'same-origin' });
    if (response.status === 401) {
      showLogin();
      loginStatus.textContent = '';
      return;
    }
    if (!response.ok) throw new Error('Не удалось загрузить заявки. Обновите страницу.');
    const payload = await response.json();
    leads = payload.leads;
    leadsStatus.textContent = '';
    loginStatus.textContent = '';
    showLeads();
    render();
  } catch (error) {
    if (leadsView.hidden) loginStatus.textContent = 'Не удалось проверить доступ. Проверьте соединение и обновите страницу.';
    else leadsStatus.textContent = 'Не удалось загрузить заявки. Проверьте соединение и обновите страницу.';
  }
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;
  loginStatus.textContent = 'Проверяем пароль…';
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, credentials: 'same-origin',
      body: JSON.stringify({ password: loginForm.querySelector('[name="password"]').value })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Не удалось войти. Попробуйте ещё раз.');
    loginForm.reset();
    loginStatus.textContent = '';
    await loadLeads();
  } catch (error) { loginStatus.textContent = error.message; }
  finally { button.disabled = false; }
});
search.addEventListener('input', render);
logout.addEventListener('click', async () => {
  logout.disabled = true;
  leadsStatus.textContent = '';
  try {
    const response = await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' });
    if (!response.ok) throw new Error('Не удалось выйти. Попробуйте ещё раз.');
    showLogin();
  } catch (error) {
    leadsStatus.textContent = 'Не удалось выйти. Проверьте соединение и повторите попытку — вы всё ещё вошли в кабинет.';
  } finally {
    logout.disabled = false;
  }
});
loadLeads();
