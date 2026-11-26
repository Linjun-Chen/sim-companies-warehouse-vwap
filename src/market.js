import './preferences.js';
import './dates.js';

export const GAME_ORIGIN = 'https://www.simcompanies.com';
export const REQUEST_INTERVAL_MS = 5 * 60_000;
export const { DAY_MS, tradingDay } = globalThis.scwvDates;
const { DAY_SECONDS, periodStart } = globalThis.scwvDates;
const ERROR_RETRY_MS = 30 * 60_000;
const DISPATCH_WINDOW_MS = 5_000;
const CACHE_FORMAT = 4;
const { MAX_DAYS, validDays } = globalThis.scwvPreferences;

function numberValue(value) {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : value;
}

export function decodeDailySeries(data, timestamp) {
  if (data?.interval !== '1d' || !Array.isArray(data.candles)) return null;

  const earliest = periodStart(timestamp, MAX_DAYS);
  const dates = new Set();
  const series = [];
  for (const candle of data.candles) {
    if (!Array.isArray(candle)) return null;
    const time = numberValue(candle[0]);
    if (!Number.isSafeInteger(time) || time % DAY_SECONDS !== 0) return null;
    if (time < earliest || time > timestamp) continue;
    if (dates.has(time)) return null;
    dates.add(time);

    // Official chart tuple: epoch seconds, open, high, low, close, volume, VWAP.
    const volume = numberValue(candle[5]);
    const vwap = numberValue(candle[6]);
    if (volume === 0) continue;
    if (!Number.isFinite(volume) || volume <= 0 || !Number.isFinite(vwap) || vwap <= 0) return null;
    series.push([time, volume, vwap]);
  }
  return series;
}

export function periodQuote(series, timestamp, days) {
  const start = periodStart(timestamp, days);
  let totalVolume = 0;
  let tradedValue = 0;
  let count = 0;
  let lastVwap;
  for (const [date, volume, vwap] of series) {
    if (date < start || date > timestamp) continue;
    totalVolume += volume;
    tradedValue += vwap * volume;
    lastVwap = vwap;
    count += 1;
  }
  if (!count) return { status: 'no-trades' };
  return { status: 'price', vwap: count === 1 ? lastVwap : tradedValue / totalVolume, daysWithTrades: count };
}

function readCache(stored) {
  if (stored?.format === CACHE_FORMAT) return stored;
  const cache = { format: CACHE_FORMAT, entries: {} };
  if (![2, 3].includes(stored?.format) || !stored.date) return cache;

  for (const [key, entry] of Object.entries(stored.entries ?? {})) {
    const dated = { ...entry, date: stored.date };
    const field = entry.series || ['price', 'no-trades'].includes(entry.status) ? 'saved' : 'failure';
    cache.entries[key] = { [field]: dated };
  }
  return cache;
}

function cachedQuote(saved, days) {
  if (saved?.series) {
    const timestamp = Date.parse(saved.date) / 1000;
    return { ...periodQuote(saved.series, timestamp, days), source: saved.source };
  }
  if (days === 1) return saved;
}

function retryAfter(header, now) {
  if (!header) return 0;
  const date = /^\d+$/.test(header) ? now + Number(header) * 1000 : Date.parse(header);
  return Number.isFinite(date) ? date : 0;
}

function validToken(token) {
  return typeof token === 'string' && token.length > 0 && token.length <= 2048 &&
    token !== '.' && token !== '..' && /^[\x21-\x7e]+$/.test(token) && !/[/\\]/.test(token);
}

function quoteError(stage, result, issue = result.issue) {
  let status = 'unavailable';
  if (result.status === 401 || issue === 'redirect') status = 'sign-in';
  if (result.status === 403) status = 'forbidden';
  if (result.status === 429) status = 'rate-limited';
  return { status, detail: { stage, issue, httpStatus: result.status || undefined } };
}

export function createQuoteService({ local, session, clock = Date.now }) {
  let pending = Promise.resolve();

  async function reserveRequest(request, operation, previousLimit) {
    // Persist the reservation before handing off to the tab. The tab checks the
    // dispatch deadline before fetching, including when it wakes from suspension.
    const dispatchBy = clock() + DISPATCH_WINDOW_MS;
    await local.set({ nextRequestAt: dispatchBy + REQUEST_INTERVAL_MS });
    const result = await request(operation, dispatchBy);
    const finishedAt = clock();
    const nextRequestAt = result.skipped
      ? previousLimit
      : Math.max(finishedAt + REQUEST_INTERVAL_MS, retryAfter(result.retryAfter, finishedAt));
    await local.set({ nextRequestAt });
    return { ...result, nextRequestAt };
  }

  async function load(context) {
    const { realm, resource, qualities, request, autoFetch = Boolean(request), daysByQuality } = context;
    const daysFor = quality => validDays(daysByQuality?.[quality]) ? daysByQuality[quality] : 1;
    const now = clock();
    const day = tradingDay(now);
    if (realm === 2) {
      return {
        date: day.date,
        refreshAt: day.nextDay,
        quotes: qualities.map(quality => ({ quality, days: daysFor(quality), status: 'unsupported' })),
      };
    }

    const [storage, sessionData] = await Promise.all([
      local.get(['quoteCache', 'nextRequestAt']),
      session.get(['chartToken', 'tokenError']),
    ]);
    const cache = readCache(storage.quoteCache);
    const key = quality => `${realm}/${resource}/${quality}`;
    const quoteFor = quality => {
      const { saved, failure } = cache.entries[key(quality)] ?? {};
      const quote = saved?.date === day.date ? cachedQuote(saved, daysFor(quality)) : undefined;
      return quote ?? (failure?.date === day.date ? failure : undefined);
    };
    let nextRequestAt = storage.nextRequestAt ?? 0;
    let { chartToken, tokenError } = sessionData;
    let tokenRetryAt = tokenError?.retryAt ?? 0;
    const quality = qualities.find(level => {
      const entry = quoteFor(level);
      return !entry || (entry.retryAt !== undefined && entry.retryAt <= now);
    });

    if (request && quality !== undefined && now >= Math.max(nextRequestAt, tokenRetryAt)) {
      const stage = chartToken ? 'chart' : 'token';
      const operation = chartToken ? { stage, token: chartToken, quality } : { stage };
      const result = await reserveRequest(request, operation, nextRequestAt);
      nextRequestAt = result.nextRequestAt;

      if (!result.skipped && stage === 'token') {
        const token = result.data?.token;
        if (result.status === 200 && validToken(token)) {
          chartToken = token;
          await session.set({ chartToken: token });
          await session.remove('tokenError');
          tokenError = undefined;
          tokenRetryAt = 0;
        } else {
          tokenRetryAt = Math.max(nextRequestAt, now + ERROR_RETRY_MS);
          tokenError = {
            ...quoteError(stage, result, result.issue ?? (result.status === 200 ? 'schema' : undefined)),
            retryAt: tokenRetryAt,
          };
          await session.set({ tokenError });
        }
      }

      if (!result.skipped && stage === 'chart') {
        const entryKey = key(quality);
        const existing = cache.entries[entryKey] ?? {};
        const series = result.status === 200 && !result.issue ? decodeDailySeries(result.data, day.timestamp) : null;
        let failure;
        if (series) {
          cache.entries[entryKey] = { saved: { date: day.date, series, source: 'automatic' } };
        } else if (result.status === 404 && !quoteFor(quality)?.refreshToken) {
          chartToken = undefined;
          await session.remove('chartToken');
          failure = { status: 'queued', retryAt: nextRequestAt, refreshToken: true, detail: { issue: 'renew-token' } };
        } else if (result.status === 404) {
          failure = quoteError(stage, result);
        } else {
          failure = {
            ...quoteError(stage, result, result.issue ?? (result.status === 200 ? 'schema' : undefined)),
            retryAt: Math.max(nextRequestAt, now + ERROR_RETRY_MS),
          };
        }
        if (failure) cache.entries[entryKey] = { ...existing, failure: { date: day.date, ...failure } };
        await local.set({ quoteCache: cache });
      }
    }

    let refreshAt = day.nextDay;
    const quotes = qualities.map(level => {
      const entry = quoteFor(level);
      const open = !entry || entry.retryAt !== undefined;
      const retryAt = autoFetch && open
        ? Math.max(nextRequestAt, tokenRetryAt, entry?.retryAt ?? 0)
        : undefined;
      if (autoFetch && open) refreshAt = Math.min(refreshAt, retryAt);
      const failure = open && now < tokenRetryAt ? tokenError : entry;
      const saved = cache.entries[key(level)]?.saved;
      const previous = saved?.date < day.date ? cachedQuote(saved, daysFor(level)) : undefined;
      return {
        quality: level,
        days: daysFor(level),
        status: failure?.status ?? (autoFetch ? 'queued' : 'cache-only'),
        detail: failure?.detail,
        vwap: entry?.vwap,
        daysWithTrades: entry?.daysWithTrades,
        source: entry?.source,
        retryAt,
        previous: previous?.status === 'price' ? { ...previous, date: saved.date } : undefined,
      };
    });
    return { date: day.date, refreshAt, stage: chartToken ? 'chart' : 'token', quotes };
  }

  async function rememberNative({ realm, resource, quality, data }, day) {
    const series = decodeDailySeries(data, day.timestamp);
    if (!series) return false;
    const stored = await local.get(['quoteCache']);
    const cache = readCache(stored.quoteCache);
    const key = `${realm}/${resource}/${quality}`;
    const entry = cache.entries[key];
    if (entry?.saved?.date > day.date) return false;
    cache.entries[key] = { saved: { date: day.date, series, source: 'native' } };
    if (entry?.failure?.date > day.date) cache.entries[key].failure = entry.failure;
    await local.set({ quoteCache: cache });
    return true;
  }

  // Rate reservations and cache writes share one queue across open tabs.
  function serialize(next) {
    const response = pending.then(next);
    pending = response.catch(() => {});
    return response;
  }

  return {
    getQuotes: context => context.request ? serialize(() => load(context)) : load(context),
    rememberNative: chart => {
      const now = clock();
      const { startedAt } = chart;
      const day = tradingDay(Number.isFinite(startedAt) && startedAt > 0 ? Math.min(startedAt, now) : now);
      return serialize(() => rememberNative(chart, day));
    },
  };
}
