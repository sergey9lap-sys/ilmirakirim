import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../request-navigation.js', import.meta.url), 'utf8');
async function setup(hash, mobile, loading = false) {
  const listeners = new Map();
  const calls = [];
  let targetId;
  let resized;
  const sandbox = {
    window: {location: {hash}, matchMedia: () => ({matches: mobile}), scrollY: 100,
      scrollTo: options => calls.push({id: targetId, options}),
      addEventListener: (type, fn) => listeners.set(type, fn),
      removeEventListener: (type, fn) => {if (listeners.get(type) === fn) listeners.delete(type);},
      ResizeObserver: true},
    document: {readyState: loading ? 'loading' : 'complete', fonts: {ready: Promise.resolve()}, body: {},
      getElementById: id => {targetId = id; return {getBoundingClientRect: () => ({top: 450})};}},
    ResizeObserver: class {constructor(fn) {resized = fn;} observe() {} disconnect() {}},
    setTimeout: () => 1, clearTimeout() {}
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
