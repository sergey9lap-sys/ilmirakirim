import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const bootstrap = source.slice(0, source.indexOf('const serviceDialog ='));

function run({ hostname = 'ilmirakirim.ru', consent = false } = {}) {
  const listeners = new Map();
  const insertedScripts = [];
  let cookie = consent ? 'ilmira_cookie_consent=accepted' : '';
  const notice = {
    hidden: true,
    classList: { add() {} },
    setAttribute() {},
    querySelector(selector) {
      return { addEventListener(_event, callback) { listeners.set(selector, callback); } };
    }
  };
  const scriptAnchor = { parentNode: { insertBefore(script) { insertedScripts.push(script.src); } } };
  const document = {
    referrer: '',
    scripts: [],
    querySelector() { return notice; },
    createElement() { return {}; },
    getElementsByTagName() { return [scriptAnchor]; },
    get cookie() { return cookie; },
    set cookie(value) { cookie = value; }
  };
  const window = {
    location: { hostname, protocol: 'https:', href: `https://${hostname}/` },
    matchMedia() { return { matches: false }; },
    setTimeout(callback) { callback(); }
  };

  vm.runInNewContext(bootstrap, { document, window, requestAnimationFrame(callback) { callback(); }, Date });
  return { listeners, insertedScripts, notice, getCookie: () => cookie, window };
}

const firstVisit = run();
assert.equal(firstVisit.notice.hidden, false);
assert.equal(firstVisit.insertedScripts.length, 0);
firstVisit.listeners.get('.cookie-notice-close')();
assert.equal(firstVisit.getCookie(), '');
assert.equal(firstVisit.insertedScripts.length, 0);

const accepted = run();
accepted.listeners.get('.cookie-notice-accept')();
assert.match(accepted.getCookie(), /ilmira_cookie_consent=accepted/);
assert.deepEqual(accepted.insertedScripts, ['https://mc.yandex.ru/metrika/tag.js?id=113009416']);
assert.equal(accepted.window.ym.a[0][0], 113009416);
assert.equal(accepted.window.ym.a[0][1], 'init');

assert.equal(run({ consent: true }).insertedScripts.length, 1);
assert.equal(run({ hostname: 'localhost', consent: true }).insertedScripts.length, 0);

console.log('Metrika consent checks passed');
