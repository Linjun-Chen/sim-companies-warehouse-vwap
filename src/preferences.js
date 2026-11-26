(() => {
  const MAX_DAYS = 365;
  const settingsKeys = ['discount', 'quoteSettings', 'productRules'];
  const numberInRange = (value, min, max) => Number.isFinite(value) && value >= min && value <= max;
  const validDiscount = value => numberInRange(value, 0, 100);
  const validDays = value => Number.isInteger(value) && numberInRange(value, 1, MAX_DAYS);

  function readPreferences(stored = {}) {
    const settings = stored.quoteSettings ?? {};
    const discount = validDiscount(settings.discount) ? settings.discount : stored.discount;
    const display = settings.display ?? {};
    const showVwap = display.vwap !== false;
    const showDiscounted = display.discounted !== false;
    return {
      discount: validDiscount(discount) ? discount : 0,
      days: validDays(settings.days) ? settings.days : 1,
      autoFetch: settings.autoFetch !== false,
      scope: settings.scope === 'detail' ? 'detail' : 'stock',
      theme: ['light', 'dark'].includes(settings.theme) ? settings.theme : 'system',
      language: settings.language ?? 'auto',
      display: {
        vwap: showVwap || !showDiscounted,
        discounted: showDiscounted,
        date: display.date !== false,
        chartLink: display.chartLink !== false,
        overview: display.overview !== false,
        coverage: display.coverage === true,
        localizedNumbers: display.localizedNumbers === true,
        precision: [2, 3, 4].includes(display.precision) ? display.precision : 'auto',
        layout: display.layout === 'stacked' ? 'stacked' : 'inline',
      },
      productRules: stored.productRules ?? {},
    };
  }

  function priceRule(preferences, productId, quality) {
    const product = preferences.productRules[productId] ?? {};
    const grade = product.qualities?.[quality] ?? {};
    return {
      discount: [grade.discount, product.discount, preferences.discount].find(validDiscount),
      days: [grade.days, product.days, preferences.days].find(validDays),
    };
  }

  function patchProductRules(productId, changes) {
    return navigator.locks.request('warehouse-vwap:product-rules', async () => {
      const { productRules = {} } = await chrome.storage.local.get('productRules');
      if (!changes.length) return productRules;
      const product = productRules[productId] ?? {};
      const qualities = product.qualities ?? {};
      for (const { quality, ...fields } of changes) {
        const rule = quality === null ? product : qualities[quality] ?? {};
        for (const [field, value] of Object.entries(fields)) {
          if (value === null) delete rule[field];
          else rule[field] = value;
        }
        if (quality === null) continue;
        if (Object.keys(rule).length) qualities[quality] = rule;
        else delete qualities[quality];
      }
      if (Object.keys(qualities).length) product.qualities = qualities;
      else delete product.qualities;
      if (Object.keys(product).length) productRules[productId] = product;
      else delete productRules[productId];
      await chrome.storage.local.set({ productRules });
      return productRules;
    });
  }

  globalThis.scwvPreferences = {
    MAX_DAYS, settingsKeys, readPreferences, priceRule, patchProductRules, validDiscount, validDays,
  };
})();
