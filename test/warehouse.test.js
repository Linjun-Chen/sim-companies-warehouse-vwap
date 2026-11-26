import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { REQUEST_INTERVAL_MS, tradingDay } from '../src/market.js';

const extensionId = 'test-warehouse-extension';
const qualities = Array.from({ length: 13 }, (_, quality) => quality);
const controls = await readFile(new URL('../src/warehouse.js', import.meta.url), 'utf8');
const settingsScript = await readFile(new URL('../src/preferences.js', import.meta.url), 'utf8');
const datesScript = await readFile(new URL('../src/dates.js', import.meta.url), 'utf8');
const i18nScript = await readFile(new URL('../src/i18n.js', import.meta.url), 'utf8');

function stockRow(quality) {
  const star = '<svg data-icon="star"></svg>';
  const badge = quality > 3 ? `${quality}${star}` : star.repeat(quality);
  return `<div data-grade="${quality}">
    <div><span><b>32,000</b></span><span>${badge}</span></div>
    <div><div><span>6,86 €</span></div></div>
  </div>`;
}

function deliver(listener, message, sender) {
  return new Promise(resolve => {
    if (listener(message, sender, resolve) !== true) resolve(undefined);
  });
}

test('all grades queue automatically, reopen from cache and refresh at UTC midnight', async t => {
  let now = Date.parse('2026-11-25T12:00:00Z');
  t.mock.method(Date, 'now', () => now);
  const page = new JSDOM(`<!doctype html><main>
    <div id="stock"><div><b>Silicon</b><div><a href="/zh-CN/encyclopedia/0/resource/16/"><img></a></div></div>
      ${qualities.map(stockRow).join('')}
    </div>
    <aside id="contracts">${stockRow(5)}</aside>
  </main>`, {
    url: 'https://www.simcompanies.com/zh-CN/headquarters/warehouse/silicon',
    runScripts: 'outside-only',
  });
  const { window } = page;
  t.after(() => window.close());
  Object.defineProperty(window.document, 'visibilityState', { value: 'hidden' });

  const local = { discount: 0 };
  const session = {};
  const changeListeners = [];
  const api = values => ({
    async get(keys) {
      return Object.fromEntries([keys].flat().map(key => [key, structuredClone(values[key])]));
    },
    async set(changes) { Object.assign(values, structuredClone(changes)); },
    async remove(key) { delete values[key]; },
  });
  const storage = {
    local: api(local),
    session: api(session),
    onChanged: { addListener(listener) { changeListeners.push(listener); } },
  };
  const sender = {
    id: extensionId,
    url: window.location.href,
    frameId: 0,
    documentId: 'warehouse-document',
    tab: { id: 41, active: false },
  };
  let workerListener;
  let pageListener;
  let alarmListener;
  let scheduledAlarm;
  const oldChrome = globalThis.chrome;
  t.after(() => { globalThis.chrome = oldChrome; });
  globalThis.chrome = {
    storage,
    runtime: { id: extensionId, onMessage: { addListener(listener) { workerListener = listener; } } },
    alarms: {
      async get() { return scheduledAlarm; },
      async create(name, { when }) { scheduledAlarm = { name, scheduledTime: when }; },
      onAlarm: { addListener(listener) { alarmListener = listener; } },
    },
    tabs: {
      async query(query) {
        assert.deepEqual(query, { url: 'https://www.simcompanies.com/*', discarded: false });
        return [{ id: 41, url: window.location.href }, { id: 42, url: 'https://www.simcompanies.com/market/resource/16/chart/' }];
      },
      async sendMessage(tabId, message, options) {
        assert.equal(tabId, 41);
        if (message.type === 'warehouse-vwap:refresh') assert.equal(options.frameId, 0);
        else assert.equal(options.documentId, sender.documentId);
        return deliver(pageListener, message, { id: extensionId });
      },
    },
  };
  await import('../src/worker.js');
  window.chrome = {
    storage,
    i18n: { getUILanguage: () => 'zh-CN' },
    runtime: {
      id: extensionId,
      onMessage: { addListener(listener) { pageListener = listener; } },
      sendMessage: message => deliver(workerListener, message, sender),
    },
  };
  window.Date = class extends Date {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  window.AbortSignal = AbortSignal;
  const requests = [];
  const midnight = tradingDay(now).nextDay;
  let finishRequest;
  window.fetch = async (path, options) => {
    assert.equal(options.method, 'GET');
    assert.equal(options.credentials, 'same-origin');
    assert.equal(options.redirect, 'manual');
    requests.push({ time: now, path });
    if (path === '/api/v3/market-chart-token/') return Response.json({ token: 'test:token=' });

    const chart = /^\/api\/v3\/market-chart\/test%3Atoken%3D\/0\/16\/(\d+)\/1d\/$/.exec(path);
    assert.ok(chart);
    const quality = Number(chart[1]);
    if (now === midnight) await new Promise(resolve => { finishRequest = resolve; });
    return Response.json({
      interval: '1d',
      candles: [[tradingDay(now).timestamp, 7, 10, 6, 9, 50, (now < midnight ? 8 : 9) + quality / 10]],
    });
  };

  let handle = 0;
  const timers = new Map();
  window.setTimeout = (callback, delay) => {
    timers.set(++handle, { callback, at: now + delay });
    return handle;
  };
  window.clearTimeout = id => timers.delete(id);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  async function advance(milliseconds) {
    now += milliseconds;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now && timers.delete(id)) timer.callback();
    }
    await settle();
  }
  const line = quality => window.document.querySelector(`#stock [data-grade="${quality}"] .scwv-quote`);
  window.eval(settingsScript);
  window.eval(datesScript);
  window.eval(i18nScript);
  window.eval(controls);
  await settle();

  assert.equal(scheduledAlarm.scheduledTime, midnight);
  assert.equal(requests.length, 1);
  const product = await deliver(pageListener, { type: 'warehouse-vwap:product' }, { id: extensionId });
  assert.equal(product.resource, 16);
  assert.match(line(0).textContent, /排队读取日线/);
  assert.match(line(12).textContent, /下次检查/);
  assert.equal(window.document.querySelector('#contracts .scwv-quote'), null);
  for (const quality of qualities) {
    await advance(REQUEST_INTERVAL_MS);
    const price = (8 + quality / 10).toFixed(3);
    assert.ok(line(quality).textContent.includes(`昨日 VWAP $${price}`), `Q${quality}`);
    assert.ok(line(quality).textContent.includes('2026-11-24 UTC'));
  }
  assert.equal(requests.length, 14);
  assert.ok(requests.slice(1).every((request, index) => request.time - requests[index].time >= REQUEST_INTERVAL_MS));

  for (const listener of changeListeners) listener({ discount: { newValue: 5 } }, 'local');
  assert.match(line(5).textContent, /昨日 VWAP \$8\.500.*折后 \$8\.075/);
  for (const listener of changeListeners) listener({ quoteSettings: { newValue: { language: 'en' } } }, 'local');
  assert.equal(line(5).lang, 'en');
  assert.match(line(5).textContent, /Yesterday’s VWAP \$8\.500.*Discounted \$8\.075/);
  for (const listener of changeListeners) listener({ quoteSettings: { newValue: { language: 'auto' } } }, 'local');
  assert.equal(line(5).lang, 'zh-CN');
  assert.match(line(5).textContent, /昨日 VWAP \$8\.500.*折后 \$8\.075/);
  assert.equal(requests.length, 14);

  const rules = { 16: { discount: 10, days: 3, qualities: { 5: { discount: 0 }, 6: { days: 1 } } } };
  for (const listener of changeListeners) listener({ productRules: { newValue: rules } }, 'local');
  await settle();
  assert.match(line(5).textContent, /3 日 VWAP \$8\.500.*折后 \$8\.500/);
  assert.match(line(6).textContent, /昨日 VWAP \$8\.600.*折后 \$7\.740/);
  assert.match(line(7).textContent, /3 日 VWAP \$8\.700.*折后 \$7\.830/);
  assert.equal(requests.length, 14);

  const reopen = async () => {
    window.history.pushState({}, '', '/zh-CN/headquarters/warehouse');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    assert.equal(line(5), null);
    window.history.pushState({}, '', '/zh-CN/headquarters/warehouse/silicon');
    window.dispatchEvent(new window.PopStateEvent('popstate'));
    await settle();
  };
  await reopen();
  assert.match(line(5).textContent, /3 日 VWAP \$8\.500.*2026-11-24 UTC/);
  assert.equal(requests.length, 14);

  for (const listener of changeListeners) listener({ quoteSettings: { newValue: { display: { date: false } } } }, 'local');
  assert.doesNotMatch(line(5).textContent, /UTC/);
  now = midnight;
  alarmListener(scheduledAlarm);
  await settle();
  assert.equal(scheduledAlarm.scheduledTime, tradingDay(now).nextDay);
  assert.equal(requests.length, 15);
  assert.equal(requests.at(-1).time, midnight);
  assert.match(line(5).textContent, /上次 3 日 VWAP \$8\.500.*2026-11-24 UTC · 更新中/);
  assert.equal(line(5).dataset.state, 'stale');
  assert.doesNotMatch(line(6).textContent, /昨日 VWAP/);

  finishRequest();
  await settle();
  assert.match(line(0).textContent, /3 日 VWAP \$9\.000/);
  assert.equal(line(0).dataset.state, 'price');
  assert.equal(line(5).dataset.state, 'stale');
  await reopen();
  assert.match(line(5).textContent, /上次 3 日 VWAP \$8\.500.*2026-11-24 UTC/);
  assert.equal(requests.length, 15);

  window.document.querySelector('#stock a').href = '/zh-CN/encyclopedia/1/resource/16/';
  await settle();
  await advance(80);
  assert.match(line(5).textContent, /排队读取日线/);
  assert.doesNotMatch(line(5).textContent, /\$8\.500/);
  assert.equal(requests.length, 15);
});
