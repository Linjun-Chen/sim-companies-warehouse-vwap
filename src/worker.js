import { createQuoteService, GAME_ORIGIN, tradingDay } from './market.js';
import './i18n.js';
import './preferences.js';

const { loadCatalog, languages } = globalThis.scwvI18n;
const { patchProductRules, validDiscount } = globalThis.scwvPreferences;
const { getQuotes, rememberNative } = createQuoteService({
  local: chrome.storage.local,
  session: chrome.storage.session,
});
const warehouseRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?headquarters\/warehouse(?:\/[^/]+)?\/?$/i;
const chartRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?market\/resource\/(\d+)\/chart\/?$/i;
const validQuality = quality => Number.isInteger(quality) && quality >= 0 && quality <= 12;
const validResource = resource => Number.isSafeInteger(resource) && resource > 0;
const midnightAlarm = 'warehouse-vwap:utc-midnight';
let catalogUpdate = Promise.resolve();

function scheduleMidnight() {
  return chrome.alarms.create(midnightAlarm, { when: tradingDay(Date.now()).nextDay });
}

async function refreshOpenWarehouses() {
  const tabs = await chrome.tabs.query({ url: `${GAME_ORIGIN}/*`, discarded: false });
  await Promise.allSettled(tabs.filter(tab => tab.url && warehouseRoute.test(new URL(tab.url).pathname))
    .map(tab => chrome.tabs.sendMessage(tab.id, { type: 'warehouse-vwap:refresh' }, { frameId: 0 })));
}

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== midnightAlarm) return;
  void scheduleMidnight();
  void refreshOpenWarehouses();
});
void chrome.alarms.get(midnightAlarm).then(alarm => {
  if (!alarm) return scheduleMidnight();
});

function rememberProduct(resource, name) {
  if (typeof name !== 'string' || !name.trim() || name.length > 128) return;
  const update = catalogUpdate.then(async () => {
    const { knownProducts = {} } = await chrome.storage.local.get('knownProducts');
    if (knownProducts[resource] === name) return;
    await chrome.storage.local.set({ knownProducts: { ...knownProducts, [resource]: name } });
  });
  catalogUpdate = update.catch(() => {});
  return catalogUpdate;
}

async function requestFromWarehouse(sender, realm, resource, operation, dispatchBy) {
  let timer;
  try {
    return await Promise.race([
      chrome.tabs.sendMessage(sender.tab.id, {
        type: 'warehouse-vwap:market',
        realm,
        resource,
        operation,
        dispatchBy,
      }, { documentId: sender.documentId }),
      new Promise(resolve => {
        timer = setTimeout(() => resolve({ status: 0, issue: 'timeout' }), 18_000);
      }),
    ]) ?? { status: 0, issue: 'tab' };
  } catch {
    // Navigation can unload the content script after an authorized request started.
    return { status: 0, issue: 'tab' };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id ||
      sender.frameId !== 0 || !sender.url || !sender.documentId || !Number.isInteger(sender.tab?.id)) return;
  const url = new URL(sender.url);
  if (url.origin !== GAME_ORIGIN) return;

  // The isolated script reads the live pathname after in-page navigation.
  const { pathname = url.pathname, realm, resource, products, autoFetch, peek, quality, data, startedAt } = message ?? {};
  if (typeof pathname !== 'string') return;
  if (message?.type === 'warehouse-vwap:locale' && warehouseRoute.test(pathname) &&
      Object.hasOwn(languages, message.language)) {
    loadCatalog(message.language).then(reply, () => reply(null));
    return true;
  }
  if (message?.type === 'warehouse-vwap:discounts' && warehouseRoute.test(pathname) && validResource(resource)) {
    const { changes } = message;
    if (!Array.isArray(changes) || changes.length > 14 || !changes.every(change => change &&
        (change.quality === null || validQuality(change.quality)) &&
        (change.discount === null || validDiscount(change.discount)))) return;
    patchProductRules(resource, changes.map(({ quality, discount }) => ({ quality, discount })))
      .then(() => reply(true), () => reply(false));
    return true;
  }
  if (message?.type === 'warehouse-vwap:native-chart') {
    if (Number(chartRoute.exec(pathname)?.[1]) !== resource ||
        ![0, 1].includes(realm) || !validQuality(quality) || data?.interval !== '1d' ||
        !Array.isArray(data.candles)) return;
    rememberNative({ realm, resource, quality, data, startedAt }).then(reply, () => reply(false));
    return true;
  }

  if (message?.type !== 'warehouse-vwap:quotes' || !warehouseRoute.test(pathname) ||
      ![0, 1, 2].includes(realm) ||
      !Array.isArray(products) || products.length === 0 ||
      !products.every(product => validResource(product?.resource) &&
        Array.isArray(product.qualities) && product.qualities.length > 0 &&
        product.qualities.length <= 13 && product.qualities.every(validQuality))) return;

  const automatic = autoFetch !== false;
  const quotes = getQuotes({
    realm,
    products,
    autoFetch: automatic,
    request: automatic && !peek
      ? (operation, deadline, resource) => requestFromWarehouse(sender, realm, resource, operation, deadline)
      : undefined,
  });
  for (const { resource, name } of products) {
    if (name) void rememberProduct(resource, name);
  }
  quotes.then(reply, () => reply(null));
  return true;
});
