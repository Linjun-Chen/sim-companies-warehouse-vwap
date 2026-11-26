(() => {
  const DAY_MS = 86_400_000;
  const DAY_SECONDS = DAY_MS / 1000;
  const isoDate = timestamp => new Date(timestamp * 1000).toISOString().slice(0, 10);

  function tradingDay(now = Date.now()) {
    const todayStart = Math.floor(now / DAY_MS) * DAY_MS;
    const timestamp = (todayStart - DAY_MS) / 1000;
    return { date: isoDate(timestamp), timestamp, nextDay: todayStart + DAY_MS };
  }

  function periodStart(timestamp, days) {
    return timestamp - (days - 1) * DAY_SECONDS;
  }

  function dateRange(lastDate, days) {
    if (days === 1) return `${lastDate} UTC`;
    const firstDate = isoDate(periodStart(Date.parse(lastDate) / 1000, days));
    return `${firstDate} – ${lastDate} UTC`;
  }

  globalThis.scwvDates = { DAY_MS, DAY_SECONDS, tradingDay, periodStart, dateRange };
})();
