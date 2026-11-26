(() => {
  const routePattern = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?headquarters\/warehouse\/[^/]+\/?$/i;
  const resourcePattern = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?encyclopedia\/(\d+)\/resource\/(\d+)\/?$/i;
  const chartRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?market\/resource\/(\d+)\/chart\/?$/i;
  const { settingsKeys, readPreferences, priceRule } = globalThis.scwvPreferences;
  const { tradingDay, dateRange } = globalThis.scwvDates;
  const { uiLanguage, translator } = globalThis.scwvI18n;
  const browserLanguage = chrome.i18n.getUILanguage();
  const quoteClass = 'scwv-quote';
  const formatPrice = Object.fromEntries([2, 3, 4].map(digits => [digits, new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })]));
  const formatTime = Object.fromEntries(['zh-CN', 'en'].map(language => [language, new Intl.DateTimeFormat(language, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })]));
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
  let current;
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

  function readInventory() {
    const path = location.pathname;
    if (!routePattern.test(path)) return null;
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
        return { realm, resource, name, qualities, rows, id: `${path}:${realm}/${resource}:${qualities.join(',')}` };
      }
    }
    return null;
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
    const { precision } = preferences.display;
    return formatPrice[precision === 'auto' ? (amount < 10 ? 3 : 2) : precision].format(amount);
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

  function render(context) {
    const { date } = tradingDay();
    const snapshot = context.snapshot;
    const { display } = preferences;
    const language = uiLanguage(preferences.language, browserLanguage);
    const text = translator(language);

    for (const { quality, line } of context.rows) {
      const { days, discount } = priceRule(preferences, context.resource, quality);
      const entry = snapshot?.quotes.find(quote => quote.quality === quality && quote.days === days);
      const quote = snapshot?.date === date ? entry : undefined;
      const previous = snapshot?.date < date && entry?.status === 'price'
        ? { ...entry, date: snapshot.date }
        : entry?.previous;
      const stalePrice = quote?.status !== 'price' && quote?.status !== 'no-trades' && previous?.date < date;
      const price = stalePrice ? previous : quote;
      const range = dateRange(stalePrice ? previous.date : date, days);
      const status = context.readError ? text('worker') : quoteStatus(quote, snapshot?.stage, text);
      const caption = quote?.retryAt > Date.now() ? text('nextRead', formatTime[language].format(quote.retryAt)) : '';
      const showChart = Boolean(quote && display.chartLink &&
        !['unsupported', 'no-trades', 'sign-in'].includes(quote.status));
      let pill = line.querySelector(`:scope > .${quoteClass}`);
      if (!pill) {
        pill = document.createElement('span');
        pill.className = quoteClass;
        line.append(pill);
      }
      pill.lang = language;
      pill.dataset.layout = display.layout;
      pill.dataset.state = stalePrice ? 'stale' : quote?.status ?? 'checking';
      if (price?.status === 'price') {
        const children = [];
        const label = days === 1 ? text(stalePrice ? 'previousVwap' : 'yesterdayVwap')
          : text(stalePrice ? 'previousPeriodVwap' : 'periodVwap', days);
        if (display.vwap) children.push(textPart(label, priceText(price.vwap)));
        if (display.discounted) children.push(textPart(text('discounted'), priceText(price.vwap * (1 - discount / 100))));
        if (display.date || stalePrice) {
          const day = document.createElement('small');
          day.textContent = range;
          if (stalePrice) {
            const update = !preferences.autoFetch ? text('autoFetchOff')
              : context.readError ? text('awaitingUpdate')
              : !quote || quote.status === 'queued' ? text('updating') : status;
            day.textContent += ` · ${update}`;
          }
          children.push(day);
        }
        if (stalePrice && showChart) children.push(chartLink(context, quality, text));
        const source = text(price.source === 'native' ? 'nativeSource' : 'officialSource');
        const coverage = days > 1 ? ` · ${text('tradingDays', price.daysWithTrades, days)}` : '';
        const progress = stalePrice && preferences.autoFetch ? ` · ${status}${caption ? ` · ${caption}` : ''}` : '';
        pill.title = `Q${quality} · ${range} · ${source}${coverage} · ${text('discountApplied', discount)}${progress}`;
        show(pill, children, JSON.stringify(children.map(child => [child.textContent, child.getAttribute('href')])));
      } else {
        const statusText = document.createElement('span');
        statusText.className = 'scwv-status';
        statusText.textContent = status;
        const children = [statusText];
        const detail = quote?.detail?.stage === 'token' ? ` · ${text('chartToken')}` : '';
        const help = quote?.status === 'forbidden' ? ` · ${text('chartAccess')}` : '';
        if (caption) {
          const captionText = document.createElement('small');
          captionText.textContent = caption;
          children.push(captionText);
        }
        if (showChart) children.push(chartLink(context, quality, text));
        pill.title = `Q${quality} · ${range}${detail}${help}`;
        show(pill, children, `status/${status}/${caption}/${showChart ? `${context.realm}/${context.resource}/${quality}` : ''}`);
      }
    }
  }

  function daysByQuality(context, settings = preferences) {
    return Object.fromEntries(context.qualities.map(quality => [
      quality, priceRule(settings, context.resource, quality).days,
    ]));
  }

  async function readSnapshot(context, peek) {
    try {
      return await chrome.runtime.sendMessage({
        type: 'warehouse-vwap:quotes',
        pathname: location.pathname,
        realm: context.realm,
        resource: context.resource,
        name: context.name,
        qualities: context.qualities,
        daysByQuality: daysByQuality(context),
        autoFetch: preferences.autoFetch,
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
    if (current === context && result) {
      context.snapshot = result;
      context.readError = false;
      render(context);
      if (result.refreshAt <= Date.now() && preferences.autoFetch) {
        result = await readSnapshot(context, false);
      }
    }
    context.pending = false;
    if (current !== context || readInventory()?.id !== context.id) return;

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

  function scan(refreshNow = false) {
    const inventory = readInventory();
    if (!inventory) {
      if (current) {
        current = null;
        clearTimeout(refreshTimer);
        document.querySelectorAll(`.${quoteClass}`).forEach(node => node.remove());
      }
      return;
    }
    if (current?.id !== inventory.id) {
      clearTimeout(refreshTimer);
      current = inventory;
      refreshNow = true;
    } else {
      current.rows = inventory.rows;
      current.name = inventory.name;
    }
    render(current);
    if (refreshNow) void refresh(current);
  }

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.type !== 'scwv:native-daily-chart') return;
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
      reply({ resource: readInventory()?.resource });
      return;
    }
    if (message?.type === 'warehouse-vwap:refresh') {
      void ready.then(() => scan(true));
      return;
    }
    if (message?.type !== 'warehouse-vwap:market') return;
    const { realm, resource, operation, dispatchBy } = message;
    const inventory = readInventory();
    if (!preferences.autoFetch || !inventory || realm !== inventory.realm || resource !== inventory.resource ||
        !Number.isFinite(dispatchBy) || Date.now() >= dispatchBy ||
        (operation?.stage !== 'token' && (operation?.stage !== 'chart' ||
          !inventory.qualities.includes(operation.quality) || typeof operation.token !== 'string'))) {
      reply({ skipped: true });
      return;
    }
    readMarket(operation, inventory).then(reply, () => reply({ status: 0, issue: 'network' }));
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
      if (current) render(current);
    }
    if (!current) return;
    const cacheChanged = changes.quoteCache && current.qualities.some(quality => {
      const key = `${current.realm}/${current.resource}/${quality}`;
      const { oldValue, newValue } = changes.quoteCache;
      return JSON.stringify(oldValue?.entries?.[key]) !== JSON.stringify(newValue?.entries?.[key]);
    });
    if (cacheChanged || previous.autoFetch !== preferences.autoFetch ||
        (settingsChanged.length && JSON.stringify(daysByQuality(current, previous)) !== JSON.stringify(daysByQuality(current)))) {
      void refresh(current);
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
