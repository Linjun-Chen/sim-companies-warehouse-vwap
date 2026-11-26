(() => {
  const routePattern = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?headquarters\/warehouse(?:\/([^/]+))?\/?$/i;
  const resourcePattern = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?encyclopedia\/(\d+)\/resource\/(\d+)\/?$/i;
  const chartRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?market\/resource\/(\d+)\/chart\/?$/i;
  const { settingsKeys, readPreferences, priceRule } = globalThis.scwvPreferences;
  const { tradingDay, dateRange } = globalThis.scwvDates;
  const { uiLanguage, direction, translator } = globalThis.scwvI18n;
  const productNames = globalThis.scwvProductNames;
  const browserLanguage = chrome.i18n.getUILanguage();
  const quoteClass = 'scwv-quote';
  const catalogReads = new Map();
  const priceFormats = new Map();
  const timeFormats = new Map();
  const statuses = {
    'cache-only': 'cacheMissing',
    'sign-in': 'signIn',
    forbidden: 'forbidden',
    'rate-limited': 'rateLimited',
    unsupported: 'unsupported',
  };
  const issues = {
    network: 'network',
    timeout: 'timeout',
    tab: 'tabClosed',
    json: 'badJson',
    schema: 'badSchema',
  };
  const storedPreferences = {};
  let preferences = readPreferences();
  let language;
  let text;
  let inventory;
  let current;
  let overview;
  let overviewKey;
  let discountEditor;
  let scanTimer;
  let refreshTimer;

  function getQuality(badge) {
    if (badge?.tagName !== 'SPAN') return null;
    const stars = badge.querySelectorAll('svg[data-icon="star"]').length;
    const label = badge.textContent.trim();
    if (!label && badge.childElementCount === stars && stars <= 3) return stars;
    if (stars === 1 && /^(?:[4-9]|1[0-2])$/.test(label)) return Number(label);
    return null;
  }

  function getStockRow(row) {
    if (row.tagName !== 'DIV') return null;
    const line = [...row.children].find(child =>
      child.tagName === 'DIV' && child.querySelector(':scope > span:first-child > b'));
    if (!line) return null;

    // The quantity/quality line is followed by the game's unit cost breakdown.
    if (!line.nextElementSibling?.querySelector(':scope > div:last-child > span')) return null;
    const quality = getQuality(line.children[1]);
    return quality === null ? null : { quality, line };
  }

  function readDetail() {
    for (const link of document.querySelectorAll('a[href*="/encyclopedia/"][href*="/resource/"]')) {
      if (link.origin !== location.origin || !link.querySelector(':scope > img')) continue;
      const match = resourcePattern.exec(link.pathname);
      const header = link.parentElement?.parentElement;
      const inventory = header?.parentElement;
      const name = header?.querySelector(':scope > b')?.textContent.trim();
      if (!match || !inventory || !name) continue;

      const rows = [...inventory.children].filter(row => row !== header).map(getStockRow).filter(Boolean);
      if (rows.length) {
        const realm = Number(match[1]);
        const resource = Number(match[2]);
        const qualities = [...new Set(rows.map(row => row.quality))];
        return { realm, resource, name, qualities, rows: rows.map(row => ({ ...row, resource })) };
      }
    }
    return null;
  }

  function readContext() {
    const path = location.pathname;
    const route = routePattern.exec(path);
    if (!route) return null;

    const isOverview = !route[1];
    const detail = isOverview ? null : readDetail();
    if (!isOverview && !detail) return null;
    const realm = detail?.realm ?? inventory?.realm;
    const stocked = inventory?.realm === realm ? inventory?.products : undefined;
    const products = preferences.scope === 'stock' || isOverview ? [...(stocked ?? [])] : [];
    if (detail) {
      const index = products.findIndex(product => product.resource === detail.resource);
      if (index >= 0) products.splice(index, 1);
      const { resource, name, qualities } = detail;
      products.unshift({ resource, name, qualities });
    }
    if (!products.length) return null;
    const autoFetch = preferences.autoFetch && (preferences.scope === 'stock' || !isOverview);
    const id = JSON.stringify([path, realm, products.map(({ resource, qualities }) => [resource, qualities])]);
    return { id, realm, detail, isOverview, products, autoFetch };
  }

  function show(node, children, key) {
    if (node.dataset.rendered === key) return;
    node.replaceChildren(...children);
    node.dataset.rendered = key;
  }

  async function readMarket(operation, inventory) {
    const tokenRequest = operation.stage === 'token';
    const path = tokenRequest
      ? '/api/v3/market-chart-token/'
      : `/api/v3/market-chart/${encodeURIComponent(operation.token)}/${inventory.realm}/${inventory.resource}/${operation.quality}/1d/`;
    let response;
    try {
      response = await fetch(path, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        redirect: 'manual',
        cache: 'no-cache',
        signal: AbortSignal.timeout(12_000),
      });
    } catch (error) {
      return { status: 0, issue: error?.name === 'TimeoutError' ? 'timeout' : 'network' };
    }
    const status = response.status;
    if (response.type === 'opaqueredirect' || (status >= 300 && status < 400)) {
      return { status, issue: 'redirect' };
    }
    if (!response.ok) return { status, retryAfter: response.headers.get('Retry-After') };
    try {
      const data = await response.json();
      return {
        status,
        data: tokenRequest ? { token: data?.token } : { interval: data?.interval, candles: data?.candles },
      };
    } catch (error) {
      return { status, issue: error?.name === 'TimeoutError' ? 'timeout' : 'json' };
    }
  }

  function textPart(label, value) {
    const part = document.createElement('span');
    const number = document.createElement('b');
    number.textContent = value;
    part.append(`${label} `, number);
    return part;
  }

  function priceText(amount) {
    const { precision, localizedNumbers } = preferences.display;
    const digits = precision === 'auto' ? (amount < 10 ? 3 : 2) : precision;
    const locale = localizedNumbers ? language : 'en-US';
    const key = `${locale}/${digits}`;
    if (!priceFormats.has(key)) {
      priceFormats.set(key, new Intl.NumberFormat(locale, {
        style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: digits, maximumFractionDigits: digits,
      }));
    }
    return priceFormats.get(key).format(amount);
  }

  function productName(resource) {
    const names = productNames?.[resource]?.split(' / ');
    return names?.[language === 'zh-CN' ? 0 : 1] ?? `${text('product')} #${resource}`;
  }

  function openDiscountEditor(resource, quality, line) {
    if (discountEditor?.open) return;
    const product = preferences.productRules[resource] ?? {};
    const dialog = document.createElement('dialog');
    dialog.className = 'scwv-discount-editor';
    dialog.lang = language;
    dialog.dir = direction(language);
    dialog.dataset.theme = preferences.theme;
    dialog.dataset.path = location.pathname;
    const title = document.createElement('h2');
    title.id = 'scwv-discount-title';
    const detail = current?.detail;
    const name = detail?.resource === resource ? detail.name : productName(resource);
    title.textContent = `${name} · ${text('discount')}`;
    dialog.setAttribute('aria-labelledby', title.id);

    const form = document.createElement('form');
    const fields = document.createElement('div');
    fields.className = 'scwv-discount-fields';
    const inputs = [];
    function addField(container, label, quality, value) {
      const field = document.createElement('label');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '100';
      input.step = '0.01';
      input.inputMode = 'decimal';
      input.defaultValue = value ?? '';
      field.append(label, input);
      container.append(field);
      inputs.push({ quality, input });
      return field;
    }
    const base = addField(form, text('productDefault'), null, product.discount);
    base.className = 'scwv-discount-default';
    for (let grade = 0; grade <= 12; grade += 1) {
      addField(fields, `Q${grade}`, grade, product.qualities?.[grade]?.discount);
    }
    function updateInheritance() {
      const [{ input: productDiscount }, ...grades] = inputs;
      productDiscount.placeholder = preferences.discount;
      for (const { input } of grades) input.placeholder = productDiscount.value || productDiscount.placeholder;
    }
    updateInheritance();
    base.addEventListener('input', updateInheritance);

    const hint = document.createElement('p');
    hint.textContent = text('inheritDiscount');
    const actions = document.createElement('div');
    actions.className = 'scwv-discount-actions';
    const notice = document.createElement('output');
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = text('cancel');
    cancel.addEventListener('click', () => dialog.close());
    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = text('save');
    actions.append(notice, cancel, save);
    form.append(fields, hint, actions);
    form.addEventListener('submit', async event => {
      event.preventDefault();
      const changes = inputs.filter(({ input }) => input.value !== input.defaultValue)
        .map(({ quality, input }) => ({ quality, discount: input.value === '' ? null : input.valueAsNumber }));
      save.disabled = true;
      const saved = !changes.length || await chrome.runtime.sendMessage({
        type: 'warehouse-vwap:discounts', pathname: location.pathname, resource, changes,
      }).catch(() => false);
      if (saved) {
        dialog.close();
      } else {
        notice.textContent = text('saveFailed');
        save.disabled = false;
      }
    });

    dialog.addEventListener('close', () => {
      dialog.remove();
      if (discountEditor === dialog) discountEditor = undefined;
      if (dialog.dataset.path === location.pathname) line.querySelector('.scwv-discount-trigger')?.focus();
    });
    dialog.append(title, form);
    document.body.append(dialog);
    discountEditor = dialog;
    dialog.showModal();
    const selected = inputs[quality + 1].input;
    selected.focus();
    selected.select();
  }

  function discountButton(resource, quality, discount, line) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scwv-discount-trigger';
    button.dir = 'ltr';
    button.textContent = `${discount}%`;
    button.title = text('editDiscounts');
    button.setAttribute('aria-label', `${text('editDiscounts')} · Q${quality} · ${text('discountApplied', discount)}`);
    button.setAttribute('aria-haspopup', 'dialog');
    button.addEventListener('click', event => {
      event.stopPropagation();
      openDiscountEditor(resource, quality, line);
    });
    return button;
  }

  function timeText(timestamp) {
    if (!timeFormats.has(language)) {
      timeFormats.set(language, new Intl.DateTimeFormat(language, {
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
      }));
    }
    return timeFormats.get(language).format(timestamp);
  }

  function quoteStatus(quote, stage, text) {
    if (!quote) return text('checking');
    if (quote.status === 'no-trades') return text(quote.days === 1 ? 'noTradesYesterday' : 'noTradesPeriod');
    if (quote.status === 'queued') {
      if (quote.detail?.issue === 'renew-token') return text('renewingToken');
      if (quote.retryAt <= Date.now()) return text(stage === 'token' ? 'gettingToken' : 'checkingChart');
      return text(stage === 'token' ? 'waitingForToken' : 'queued');
    }
    const { httpStatus, issue } = quote.detail ?? {};
    return text(statuses[quote.status] ?? issues[issue] ?? (httpStatus ? 'unavailableHttp' : 'unavailable'), httpStatus);
  }

  function chartLink({ realm, resource }, quality, text) {
    const link = document.createElement('a');
    link.href = `/market/resource/${resource}/chart/?realm=${realm}&quality=${quality}`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = text('chart');
    link.title = text('chartHint', quality);
    link.addEventListener('click', event => event.stopPropagation());
    return link;
  }

  function overviewRows(context, date, snapshot, quotes) {
    // This is the game's warehouse product grid. Keep the summary inside it
    // so it follows the game's scroll container and disappears with the page.
    const grid = context.isOverview && preferences.display.overview && document.querySelector('.e14va4ca7');
    if (!grid) {
      overview?.remove();
      overview = undefined;
      return [];
    }
    if (overview?.parentElement !== grid) {
      overview = document.createElement('details');
      overview.className = 'scwv-overview';
      overview.append(document.createElement('summary'), document.createElement('div'));
      grid.append(overview);
      overviewKey = undefined;
    }
    overview.lang = language;
    overview.dir = direction(language);
    const [summary, list] = overview.children;
    let updated = 0;
    let total = 0;
    for (const { resource, qualities } of context.products) {
      total += qualities.length;
      if (snapshot?.date !== date) continue;
      for (const quality of qualities) {
        const { days } = priceRule(preferences, resource, quality);
        const status = quotes.get(`${resource}/${quality}/${days}`)?.status;
        if (status === 'price' || status === 'no-trades') updated += 1;
      }
    }
    const summaryLabel = text('overviewSummary', updated, total);
    if (summary.textContent !== summaryLabel) summary.textContent = summaryLabel;
    const key = `${context.id}/${language}`;
    if (key === overviewKey) return context.overviewRows;

    context.overviewRows = [];
    const groups = context.products.map(({ resource, qualities }) => {
      const group = document.createElement('div');
      const name = document.createElement('b');
      name.textContent = productName(resource);
      group.append(name);
      for (const quality of qualities) {
        const line = document.createElement('div');
        line.textContent = `Q${quality}`;
        line.dataset.resource = resource;
        line.dataset.quality = quality;
        group.append(line);
        context.overviewRows.push({ resource, quality, line });
      }
      return group;
    });
    list.replaceChildren(...groups);
    overviewKey = key;
    return context.overviewRows;
  }

  function render(context) {
    if (!text) return;
    const { date } = tradingDay();
    const snapshot = context.snapshot;
    const { display } = preferences;
    const quotes = new Map(snapshot?.quotes.map(quote => [`${quote.resource}/${quote.quality}/${quote.days}`, quote]));
    const rows = context.detail?.rows ?? overviewRows(context, date, snapshot, quotes);

    for (const { resource, quality, line } of rows) {
      const { days, discount } = priceRule(preferences, resource, quality);
      const entry = quotes.get(`${resource}/${quality}/${days}`);
      const quote = snapshot?.date === date ? entry : undefined;
      const previous = snapshot?.date < date && entry?.status === 'price'
        ? { ...entry, date: snapshot.date }
        : entry?.previous;
      const stalePrice = quote?.status !== 'price' && quote?.status !== 'no-trades' && previous?.date < date;
      const price = stalePrice ? previous : quote;
      const range = dateRange(stalePrice ? previous.date : date, days);
      const status = context.readError ? text('worker') : quoteStatus(quote, snapshot?.stage, text);
      const caption = quote?.retryAt > Date.now() ? text('nextRead', timeText(quote.retryAt)) : '';
      const showChart = Boolean(quote && display.chartLink &&
        !['unsupported', 'no-trades', 'sign-in'].includes(quote.status));
      const chart = { realm: context.realm, resource };
      let pill = line.querySelector(`:scope > .${quoteClass}`);
      if (!pill) {
        pill = document.createElement('span');
        pill.className = quoteClass;
        line.append(pill);
      }
      pill.lang = language;
      pill.dir = direction(language);
      pill.dataset.layout = display.layout;
      pill.dataset.state = stalePrice ? 'stale' : quote?.status ?? 'checking';
      const children = [];
      const edit = display.discounted ? discountButton(resource, quality, discount, line) : null;
      if (price?.status === 'price') {
        const label = days === 1 ? text(stalePrice ? 'previousVwap' : 'yesterdayVwap')
          : text(stalePrice ? 'previousPeriodVwap' : 'periodVwap', days);
        if (display.vwap) children.push(textPart(label, priceText(price.vwap)));
        if (edit) {
          const part = textPart(text('discounted'), priceText(price.vwap * (1 - discount / 100)));
          part.append(' ', edit);
          children.push(part);
        }
        if (display.date || stalePrice) {
          const day = document.createElement('small');
          day.textContent = range;
          if (stalePrice) {
            const update = !context.autoFetch || context.readError ? text('awaitingUpdate')
              : !quote || quote.status === 'queued' ? text('updating') : status;
            day.textContent += ` · ${update}`;
          }
          children.push(day);
        }
        if (stalePrice && showChart) children.push(chartLink(chart, quality, text));
        const source = text(price.source === 'native' ? 'nativeSource' : 'officialSource');
        const coverage = days > 1 && Number.isInteger(price.daysWithTrades)
          ? text('tradingDays', price.daysWithTrades, days) : '';
        if (coverage && display.coverage) {
          const count = document.createElement('small');
          count.textContent = coverage;
          children.push(count);
        }
        const progress = stalePrice && context.autoFetch ? ` · ${status}${caption ? ` · ${caption}` : ''}` : '';
        pill.title = [ `Q${quality}`, range, source, coverage, text('discountApplied', discount) ]
          .filter(Boolean).join(' · ') + progress;
      } else {
        const statusText = document.createElement('span');
        statusText.className = 'scwv-status';
        statusText.textContent = status;
        children.push(statusText);
        if (edit) children.push(edit);
        const detail = quote?.detail?.stage === 'token' ? ` · ${text('chartToken')}` : '';
        const help = quote?.status === 'forbidden' ? ` · ${text('chartAccess')}` : '';
        if (caption) {
          const captionText = document.createElement('small');
          captionText.textContent = caption;
          children.push(captionText);
        }
        if (showChart) children.push(chartLink(chart, quality, text));
        pill.title = `Q${quality} · ${range}${detail}${help}`;
      }
      show(pill, children, JSON.stringify([language, resource, quality,
        ...children.map(child => [child.textContent, child.getAttribute('href')])]));
    }
  }

  function pricePeriods(context, settings = preferences) {
    return context.products.map(product => ({
      ...product,
      daysByQuality: Object.fromEntries(product.qualities.map(quality => [
        quality, priceRule(settings, product.resource, quality).days,
      ])),
    }));
  }

  async function readSnapshot(context, peek) {
    try {
      return await chrome.runtime.sendMessage({
        type: 'warehouse-vwap:quotes',
        pathname: location.pathname,
        realm: context.realm,
        products: pricePeriods(context),
        autoFetch: context.autoFetch,
        peek,
      });
    } catch {
      return null;
    }
  }

  async function refresh(context) {
    if (current !== context) return;
    if (context.pending) {
      context.refreshAgain = true;
      return;
    }
    clearTimeout(refreshTimer);
    context.pending = true;
    let result = await readSnapshot(context, true);

    // Paint existing prices before the next market request can block a row.
    if (current === context && readContext()?.id === context.id && result) {
      context.snapshot = result;
      context.readError = false;
      render(context);
      if (result.refreshAt <= Date.now() && context.autoFetch) {
        result = await readSnapshot(context, false);
      }
    }
    context.pending = false;
    if (current !== context || readContext()?.id !== context.id) return;

    if (result) context.snapshot = result;
    context.readError = !result;
    render(context);
    if (context.refreshAgain) {
      context.refreshAgain = false;
      void refresh(context);
      return;
    }
    const wait = result ? Math.max(1000, result.refreshAt - Date.now()) : 15 * 60_000;
    refreshTimer = setTimeout(() => {
      render(context);
      void refresh(context);
    }, wait);
  }

  async function updateLocale() {
    const next = uiLanguage(preferences.language, browserLanguage);
    if (next === language) return;
    if (!catalogReads.has(next)) {
      catalogReads.set(next, chrome.runtime.sendMessage({
        type: 'warehouse-vwap:locale', pathname: location.pathname, language: next,
      }).catch(() => null));
    }
    const messages = await catalogReads.get(next);
    if (!messages) {
      catalogReads.delete(next);
      return;
    }
    if (next !== uiLanguage(preferences.language, browserLanguage)) return;
    language = next;
    text = translator(messages);
    if (current) render(current);
  }

  function scan(refreshNow = false) {
    if (discountEditor?.open && discountEditor.dataset.path !== location.pathname) discountEditor.close();
    const context = readContext();
    if (!context) {
      if (current) {
        current = null;
        clearTimeout(refreshTimer);
        overview?.remove();
        overview = undefined;
        document.querySelectorAll(`.${quoteClass}`).forEach(node => node.remove());
      }
      return;
    }
    if (current?.id !== context.id) {
      clearTimeout(refreshTimer);
      if (current?.realm === context.realm) context.snapshot = current.snapshot;
      if (!context.isOverview) {
        overview?.remove();
        overview = undefined;
      }
      current = context;
      refreshNow = true;
    } else {
      current.detail = context.detail;
      current.products = context.products;
      current.autoFetch = context.autoFetch;
    }
    void updateLocale();
    render(current);
    if (refreshNow) void refresh(current);
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    if (event.data?.type === 'scwv:native-inventory') {
      const { realm, products } = event.data;
      inventory = [0, 1, 2].includes(realm) && Array.isArray(products) ? { realm, products } : undefined;
      void ready.then(() => { if (document.body) scan(); });
      return;
    }
    if (event.data?.type !== 'scwv:native-daily-chart') return;
    const { resource, realm, quality, data, startedAt } = event.data;
    const pathname = location.pathname;
    if (Number(chartRoute.exec(pathname)?.[1]) !== resource) return;
    void chrome.runtime.sendMessage({
      type: 'warehouse-vwap:native-chart', pathname, resource, realm, quality, data, startedAt,
    }).catch(() => {});
  });

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    if (message?.type === 'warehouse-vwap:product') {
      reply({ resource: readContext()?.detail?.resource });
      return;
    }
    if (message?.type === 'warehouse-vwap:refresh') {
      void ready.then(() => scan(true));
      return;
    }
    if (message?.type !== 'warehouse-vwap:market') return;
    const { realm, resource, operation, dispatchBy } = message;
    const context = readContext();
    const product = context?.products.find(product => product.resource === resource);
    if (!context?.autoFetch || realm !== context.realm || !product ||
        !Number.isFinite(dispatchBy) || Date.now() >= dispatchBy ||
        (operation?.stage !== 'token' && (operation?.stage !== 'chart' ||
          !product.qualities.includes(operation.quality) || typeof operation.token !== 'string'))) {
      reply({ skipped: true });
      return;
    }
    readMarket(operation, { realm, resource }).then(reply, () => reply({ status: 0, issue: 'network' }));
    return true;
  });

  const ready = chrome.storage.local.get(settingsKeys).catch(() => ({})).then(settings => {
    Object.assign(storedPreferences, { ...settings, ...storedPreferences });
    preferences = readPreferences(storedPreferences);
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const previous = preferences;
    const settingsChanged = settingsKeys.filter(key => Object.hasOwn(changes, key));
    if (settingsChanged.length) {
      for (const key of settingsChanged) storedPreferences[key] = changes[key].newValue;
      preferences = readPreferences(storedPreferences);
    }
    if (!current) return;
    const cacheChanged = changes.quoteCache && current.products.some(({ resource, qualities }) => qualities.some(quality => {
      const key = `${current.realm}/${resource}/${quality}`;
      const { oldValue, newValue } = changes.quoteCache;
      return JSON.stringify(oldValue?.entries?.[key]) !== JSON.stringify(newValue?.entries?.[key]);
    }));
    if (cacheChanged || previous.autoFetch !== preferences.autoFetch ||
        previous.scope !== preferences.scope ||
        (settingsChanged.length &&
          JSON.stringify(pricePeriods(current, previous)) !== JSON.stringify(pricePeriods(current)))) {
      scan(true);
    } else if (settingsChanged.length) {
      void updateLocale();
      render(current);
    }
  });

  async function startWarehouse() {
    await ready;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scan(true);
    });
    window.addEventListener('pageshow', () => scan(true));
    window.addEventListener('popstate', () => scan(true));
    new MutationObserver(() => {
      if (scanTimer || (!current && !routePattern.test(location.pathname))) return;
      scanTimer = setTimeout(() => {
        scanTimer = undefined;
        scan();
      }, 80);
    }).observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['href'],
    });
    scan();
  }
  if (document.body) void startWarehouse();
  else document.addEventListener('DOMContentLoaded', startWarehouse, { once: true });
})();
