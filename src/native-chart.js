(() => {
  const chartRoute = /^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?market\/resource\/(\d+)\/chart\/?$/i;
  const dailyEndpoint = /^\/api\/v3\/market-chart\/[^/]+\/([01])\/(\d+)\/(\d+)\/1d\/$/;

  function chartRequest(method, input) {
    if (typeof method !== 'string' || method.toUpperCase() !== 'GET') return;
    const product = chartRoute.exec(location.pathname)?.[1];
    if (!product) return;
    try {
      const url = new URL(input, location.href);
      if (url.origin !== location.origin) return;
      const match = dailyEndpoint.exec(url.pathname);
      if (!match || match[2] !== product || Number(match[3]) > 12) return;
      return {
        href: url.href, realm: Number(match[1]), resource: Number(product), quality: Number(match[3]),
        startedAt: Date.now(),
      };
    } catch {
      return;
    }
  }

  function publish({ realm, resource, quality, startedAt }, data) {
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
    const chart = chartRequest(args[0], args[1]);
    if (chart) {
      tracked.set(this, chart);
      this.addEventListener('loadend', () => {
        if (tracked.get(this) !== chart || this.status !== 200 || this.responseURL !== chart.href) return;
        try {
          publish(chart, this.responseType === 'json' ? this.response : JSON.parse(this.responseText));
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
    const chart = chartRequest(args[1]?.method ?? input?.method ?? 'GET', input?.url ?? input);
    if (chart) {
      void response.then(async result => {
        if (result.status === 200 && result.url === chart.href) publish(chart, await result.clone().json());
      }).catch(() => {});
    }
    return response;
  };
})();
