import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');

function loadClient() {
  let registration;
  const listeners = new Set();
  const opened = [];
  const document = {
    addEventListener(type, handler, capture) {
      assert.equal(type, 'click');
      assert.equal(capture, true);
      listeners.add(handler);
    },
    removeEventListener(type, handler, capture) {
      assert.equal(type, 'click');
      assert.equal(capture, true);
      listeners.delete(handler);
    },
    createElement() {
      return {
        style: {},
        click() { opened.push(this.href); },
        remove() {},
      };
    },
    body: { appendChild() {} },
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load(value) { registration = value; } } },
    document,
  });
  const cleanups = [];
  const ctx = { effect(setup) { cleanups.push(setup()); } };
  return {
    factory: registration.factory,
    listeners,
    opened,
    ctx,
    dispose() { for (const cleanup of cleanups.splice(0)) cleanup(); },
  };
}

test('factory exports a Cordis plugin without installing listeners', () => {
  const client = loadClient();
  for (let i = 0; i < 2; i += 1) {
    assert.equal(typeof client.factory(() => {}).apply, 'function');
    assert.equal(client.listeners.size, 0);
  }
});

test('listeners follow plugin activation and disposal', () => {
  const client = loadClient();
  const plugin = client.factory(() => {});
  for (let i = 0; i < 2; i += 1) {
    plugin.apply(client.ctx);
    assert.equal(client.listeners.size, 1);
    client.dispose();
    assert.equal(client.listeners.size, 0);
  }
});

test('absolute file links retain line selection and other clicks are unchanged', () => {
  const client = loadClient();
  client.factory(() => {}).apply(client.ctx);
  const click = (path, text, file) => {
    let prevented = false;
    let stopped = false;
    const button = {
      className: 'fileMention',
      getAttribute() { return path; },
      textContent: text,
      __reactFiber$test: { memoizedProps: { file } },
    };
    for (const handler of client.listeners) handler({
      target: { closest() { return button; } },
      preventDefault() { prevented = true; },
      stopPropagation() { stopped = true; },
    });
    return { prevented, stopped };
  };
  assert.deepEqual(click('/tmp/a b.ts', 'file L42-L50'), { prevented: true, stopped: true });
  assert.equal(client.opened.at(-1), 'vscode://file/tmp/a%20b.ts:42');
  click('/tmp/a.ts', 'file L99', { path: '/tmp/a.ts', line: 12 });
  assert.equal(client.opened.at(-1), 'vscode://file/tmp/a.ts:12');
  click('C:/work/a.ts', 'file L7');
  assert.equal(client.opened.at(-1), 'vscode://fileC%3A/work/a.ts:7');
  assert.deepEqual(click('relative.ts', 'file L42'), { prevented: false, stopped: false });
  assert.equal(client.opened.length, 3);
  client.dispose();
});
