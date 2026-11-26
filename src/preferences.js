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
      theme: ['light', 'dark'].includes(settings.theme) ? settings.theme : 'system',
      display: {
        vwap: showVwap || !showDiscounted,
        discounted: showDiscounted,
        date: display.date !== false,
        chartLink: display.chartLink !== false,
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

  globalThis.scwvPreferences = { MAX_DAYS, settingsKeys, readPreferences, priceRule, validDays };
})();
