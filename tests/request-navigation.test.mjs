import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../request-navigation.js', import.meta.url), 'utf8');
async function setup(hash, mobile, loading = false, location = {}) {
  const listeners = new Map();
  const calls = [];
  let targetId;
  let resized;
  const sandbox = {
    window: {location: {hash, search: '', pathname: '/', ...location}, matchMedia: () => ({matches: mobile}), scrollY: 100,
      scrollTo: options => calls.push({id: targetId, options}),
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type, fn) => {if (listeners.get(type) === fn) listeners.delete(type);},
      ResizeObserver: true},
    document: {readyState: loading ? 'loading' : 'complete', fonts: {ready: Promise.resolve()}, body: {},
      getElementById: id => {targetId = id; return {getBoundingClientRect: () => ({top: 450})};}},
    ResizeObserver: class {constructor(fn) {resized = fn;} observe() {} disconnect() {}},
    setTimeout: () => 1, clearTimeout() {}, URLSearchParams
  };
  vm.runInNewContext(source, sandbox);
  await new Promise(resolve => setImmediate(resolve));
  return {calls, listeners, resize: () => resized?.()};
}

test('story link starts at the golden section on mobile and desktop without anchor padding', async () => {
  const mobile = await setup('#request', true);
  assert.equal(mobile.calls[0].id, 'request');
  assert.equal(mobile.calls[0].options.top, 550);
  assert.equal((await setup('#request', false)).calls[0].id, 'request');
  assert.equal((await setup('#request-form', false)).calls[0].id, 'request-form');
  assert.equal((await setup('#about', true)).calls.length, 0);
});

test('waits for load and never overrides manual scrolling or editing', async () => {
  const page = await setup('#request', true, true);
  assert.equal(page.calls.length, 0);
  page.listeners.get('load')();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].options.behavior, 'instant');
  page.resize();
  assert.equal(page.calls.length, 2);
  page.listeners.get('touchstart')();
  page.resize();
  assert.equal(page.calls.length, 2);
});

test('Instagram-safe query and encoded paths open the same golden section', async () => {
  for (const mobile of [true, false]) {
    for (const location of [{search: '?section=request'}, {search: '?utm_source=instagram&section=request&igsh=example'}, {pathname: '/%23request'}, {pathname: '/%23request/'}]) {
      const page = await setup('', mobile, false, location);
      assert.equal(page.calls[0].id, 'request');
      assert.equal(page.calls[0].options.top, 550);
    }
    assert.equal((await setup('', mobile, false, {search: '?section=request-form'})).calls[0].id, 'request-form');
    assert.equal((await setup('', mobile, false, {pathname: '/%23request-form'})).calls[0].id, 'request-form');
  }
});

test('unknown routes never jump, and deliberate fragments override the query', async () => {
  for (const location of [{search: '?section=other'}, {pathname: '/%23about'}, {pathname: '/bad%ZZ'}, {pathname: '/other/%23request'}, {search: '?section=request', hash: '#about'}]) {
    assert.equal((await setup('', true, false, location)).calls.length, 0);
  }
  const page = await setup('', true, false, {search: '?section=request'});
  page.listeners.get('wheel')();
  page.resize();
  assert.equal(page.calls.length, 1);
});
