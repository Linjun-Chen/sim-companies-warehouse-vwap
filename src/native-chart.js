(() => {
  const chartRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?market\/resource\/(\d+)\/chart\/?$/i;
  const dailyEndpoint = /^\/api\/v3\/market-chart\/[^/]+\/([01])\/(\d+)\/(\d+)\/1d\/$/;
  const stockEndpoint = /^\/api\/v3\/resources\/(\d+)\/$/;
  const realmEndpoint = /^\/api\/v1\/realm\/[012]\/(switch|sync)\/$/;
  const stock = new Map();
  let sequence = 0;
  let lastAuth = 0;
  let lastSwitch = 0;
  let company;

  function observedRequest(method, input) {
    try {
      const url = new URL(input, location.href);
      if (url.origin !== location.origin) return;
      const verb = method.toUpperCase();
      const { href, pathname } = url;
      if (verb === 'POST') {
        const realmChange = realmEndpoint.exec(pathname);
        if (realmChange) return { kind: realmChange[1], href, sequence: ++sequence };
      }
      if (verb !== 'GET') return;
      if (pathname === '/api/v3/companies/auth-data/') return { kind: 'sync', href, sequence: ++sequence };
      const stockRequest = stockEndpoint.exec(pathname);
      if (stockRequest) return { kind: 'inventory', href, companyId: Number(stockRequest[1]), sequence: ++sequence };
      const product = chartRoute.exec(location.pathname)?.[1];
      const match = product && dailyEndpoint.exec(pathname);
      if (!match || match[2] !== product || Number(match[3]) > 12) return;
      return {
        kind: 'chart', href, realm: Number(match[1]), resource: Number(product), quality: Number(match[3]),
        startedAt: Date.now(),
      };
    } catch {
      return;
    }
  }

  function publishInventory() {
    window.postMessage({
      type: 'scwv:native-inventory',
      realm: company?.realmId,
      products: stock.get(company?.companyId)?.products,
    }, location.origin);
  }

  function rememberStock(request, data) {
    if (!Array.isArray(data) || request.sequence < lastSwitch ||
        stock.get(request.companyId)?.sequence > request.sequence) return;
    const owned = new Map();
    for (const { kind, quality, amount } of data) {
      if (!(amount > 0) || !Number.isSafeInteger(kind) || kind < 1 ||
          !Number.isInteger(quality) || quality < 0 || quality > 12) continue;
      if (!owned.has(kind)) owned.set(kind, new Set());
      owned.get(kind).add(quality);
    }
    const products = [...owned].map(([resource, qualities]) => ({
      resource, qualities: [...qualities].sort((a, b) => a - b),
    }));
    stock.set(request.companyId, { sequence: request.sequence, products });
    if (request.companyId === company?.companyId) publishInventory();
  }

  function publish(request, data) {
    if (request.kind === 'inventory') {
      rememberStock(request, data);
      return;
    }
    if (request.kind !== 'chart') {
      if (request.sequence < lastAuth) return;
      if (request.kind === 'switch') {
        if (data?.status !== 'redirect') return;
        lastSwitch = request.sequence;
      }
      lastAuth = request.sequence;
      const active = data?.authCompany;
      const previous = company;
      company = Number.isSafeInteger(active?.companyId) && [0, 1, 2].includes(active.realmId)
        ? { companyId: active.companyId, realmId: active.realmId }
        : undefined;
      if (previous?.companyId !== company?.companyId || previous?.realmId !== company?.realmId) {
        stock.delete(previous?.companyId);
        publishInventory();
      }
      return;
    }

    const { realm, resource, quality, startedAt } = request;
    if (data?.interval !== '1d' || !Array.isArray(data.candles)) return;
    window.postMessage({
      type: 'scwv:native-daily-chart',
      realm, resource, quality, startedAt,
      data: { interval: '1d', candles: data.candles },
    }, location.origin);
  }

  const open = XMLHttpRequest.prototype.open;
  const tracked = new WeakMap();
  XMLHttpRequest.prototype.open = function (...args) {
    const result = open.apply(this, args);
    tracked.delete(this);
    const request = observedRequest(args[0], args[1]);
    if (request) {
      tracked.set(this, request);
      this.addEventListener('loadend', () => {
        if (tracked.get(this) !== request || this.status !== 200 || this.responseURL !== request.href) return;
        try {
          publish(request, this.responseType === 'json' ? this.response : JSON.parse(this.responseText));
        } catch {
          // The game's request and response are left intact.
        }
      }, { once: true });
    }
    return result;
  };

  const fetch = window.fetch;
  window.fetch = function (...args) {
    const response = fetch.apply(this, args);
    const input = args[0];
    const request = observedRequest(args[1]?.method ?? input?.method ?? 'GET', input?.url ?? input);
    if (request) {
      void response.then(async result => {
        if (result.status === 200 && result.url === request.href) publish(request, await result.clone().json());
      }).catch(() => {});
    }
    return response;
  };
})();
