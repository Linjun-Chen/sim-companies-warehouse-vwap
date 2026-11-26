import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createQuoteService, decodeDailySeries, periodQuote, REQUEST_INTERVAL_MS, tradingDay,
} from '../src/market.js';

const GAME_DAY = Date.parse('2026-11-25T12:00:00Z');
const DAY_SECONDS = 86_400;
const { timestamp: yesterday } = tradingDay(GAME_DAY);
const stock = { realm: 0, resource: 16, qualities: [5, 6, 7] };

function candles(...points) {
  return { interval: '1d', candles: points };
}

function daily(timestamp, vwap, volume = 250) {
  return [timestamp, 7.5, 9.5, 7, 8, volume, vwap];
}

function decodeDailyQuote(data, timestamp) {
  const series = decodeDailySeries(data, timestamp);
  if (!series) return { status: 'unavailable' };
  const { status, vwap } = periodQuote(series, timestamp, 1);
  return status === 'price' ? { status, vwap } : { status };
}

function storage() {
  const values = {};
  return {
    values,
    async get(keys) { return structuredClone(Object.fromEntries(keys.map(key => [key, values[key]]))); },
    async set(changes) { Object.assign(values, structuredClone(changes)); },
    async remove(key) { delete values[key]; },
  };
}

function scenario(respond) {
  const local = storage();
  const session = storage();
  const calls = [];
  let time = GAME_DAY;
  const dependencies = { local, session, clock: () => time };
  const restart = () => {
    const { getQuotes, rememberNative } = createQuoteService(dependencies);
    const service = context => getQuotes({
      async request(operation, deadline) {
        assert.ok(deadline > time);
        const call = { realm: context.realm, resource: context.resource, ...operation, time };
        calls.push(call);
        return respond(call, calls.length);
      },
      ...context,
    });
    return Object.assign(service, { rememberNative });
  };
  return {
    local,
    session,
    calls,
    service: restart(),
    restart,
    advance: (milliseconds = REQUEST_INTERVAL_MS) => { time += milliseconds; },
  };
}

test('selects the exact UTC date and uses the official VWAP field', () => {
  assert.equal(tradingDay(Date.parse('2026-11-25T07:59:59+08:00')).date, '2026-11-23');
  assert.equal(tradingDay(Date.parse('2026-11-25T08:00:00+08:00')).date, '2026-11-24');
  const points = candles(
    daily(yesterday + DAY_SECONDS, 200),
    daily(yesterday, 8.50321),
    daily(yesterday - DAY_SECONDS, 5),
  );
  assert.deepEqual(decodeDailyQuote(points, yesterday), { status: 'price', vwap: 8.50321 });
  assert.deepEqual(decodeDailyQuote(candles(points.candles[1]), yesterday), { status: 'price', vwap: 8.50321 });
  const decimalStrings = daily(yesterday, '8.50321', '250').map(String);
  assert.deepEqual(decodeDailyQuote(candles(decimalStrings), yesterday), { status: 'price', vwap: 8.50321 });
});

test('distinguishes missing daily candles, zero volume and incompatible data', () => {
  assert.deepEqual(decodeDailyQuote(candles(daily(yesterday - DAY_SECONDS, 30)), yesterday), { status: 'no-trades' });
  assert.deepEqual(decodeDailyQuote(candles(), yesterday), { status: 'no-trades' });
  assert.deepEqual(decodeDailyQuote(candles(daily(yesterday, null, 0)), yesterday), { status: 'no-trades' });
  assert.deepEqual(decodeDailyQuote(candles(daily(yesterday, null)), yesterday), { status: 'unavailable' });
  assert.deepEqual(decodeDailyQuote(candles(daily(yesterday * 1000 + 1, 8)), yesterday), { status: 'unavailable' });
  assert.deepEqual(decodeDailyQuote({ ...candles(), interval: '1h' }, yesterday), { status: 'unavailable' });
  assert.deepEqual(decodeDailyQuote(candles(daily(yesterday, 8), daily(yesterday, 9)), yesterday), { status: 'unavailable' });
});

test('a two-day period includes both completed days and excludes the current day', () => {
  const { date, timestamp } = tradingDay(Date.parse('2027-01-02T00:00:00Z'));
  const series = decodeDailySeries(candles(
    daily(timestamp - 2 * DAY_SECONDS, 100, 500),
    daily(timestamp - DAY_SECONDS, 6, 75),
    daily(timestamp, 10, 25),
    daily(timestamp + DAY_SECONDS, 200, 500),
  ), timestamp);
  assert.deepEqual(periodQuote(series, timestamp, 1), { status: 'price', vwap: 10, daysWithTrades: 1 });
  assert.deepEqual(periodQuote(series, timestamp, 2), { status: 'price', vwap: 7, daysWithTrades: 2 });
  assert.equal(globalThis.scwvDates.dateRange(date, 1), '2027-01-01 UTC');
  assert.equal(globalThis.scwvDates.dateRange(date, 2), '2026-12-31 – 2027-01-01 UTC');
});

test('reuses native series immediately and weights the chosen days by volume', async () => {
  const sim = scenario(() => assert.fail('Cache reads must add zero requests'));
  sim.local.values.nextRequestAt = GAME_DAY + REQUEST_INTERVAL_MS;
  const native = { realm: 0, resource: 16, quality: 5 };
  const data = candles(
    daily(yesterday - 3 * DAY_SECONDS, 99),
    daily(yesterday - 2 * DAY_SECONDS, 8.5, 150),
    daily(yesterday - DAY_SECONDS, null, 0),
    daily(yesterday, 10, 50),
    daily(yesterday + DAY_SECONDS, 9999),
  );
  assert.equal(await sim.service.rememberNative({ ...native, data }), true);
  assert.equal(sim.local.values.nextRequestAt, GAME_DAY + REQUEST_INTERVAL_MS);
  assert.equal(sim.session.values.chartToken, undefined);

  const config = { ...stock, request: undefined, daysByQuality: { 5: 3 } };
  const quote = (await sim.service(config)).quotes[0];
  assert.equal(quote.vwap, 8.875);
  assert.equal(quote.days, 3);
  assert.equal(quote.daysWithTrades, 2);
  assert.equal(quote.source, 'native');
  const [dailyPrice, missing] = (await sim.service({ ...config, daysByQuality: { 5: 1 } })).quotes;
  assert.equal(dailyPrice.vwap, 10);
  assert.equal(missing.status, 'cache-only');
  assert.equal((await sim.service({ ...config, realm: 1 })).quotes[0].status, 'cache-only');
  assert.equal(sim.calls.length, 0);
});

test('keeps old single-day prices during upgrade and fetches extended history only when requested', async () => {
  const sim = scenario(() => assert.fail('Cache reads must add zero requests'));
  sim.local.values.quoteCache = {
    date: tradingDay(GAME_DAY).date,
    format: 2,
    entries: { '0/16/5': { status: 'price', vwap: 8.5 } },
  };
  const config = { ...stock, request: undefined };
  assert.equal((await sim.service(config)).quotes[0].vwap, 8.5);
  const [first, second] = (await sim.service({ ...config, daysByQuality: { 5: 7 }, autoFetch: true })).quotes;
  assert.equal(first.status, 'queued');
  assert.equal(second.status, 'queued');
  assert.equal(first.days, 7);
  assert.equal(first.vwap, undefined);
  assert.equal(sim.calls.length, 0);
});

test('queues separate grades, shares the limit across tabs, and preserves the limit across worker restarts', async () => {
  const sim = scenario(({ stage, time, quality }) => {
    if (stage === 'token') return { status: 200, data: { token: 'chart-session:a=' } };
    return { status: 200, data: candles(daily(tradingDay(time).timestamp, 8 + quality / 10)) };
  });
  const [first, second] = await Promise.all([sim.service(stock), sim.service(stock)]);
  assert.deepEqual(first.quotes.map(q => q.status), ['queued', 'queued', 'queued']);
  assert.deepEqual(first, second);
  assert.equal(sim.calls.length, 1);
  assert.equal(sim.local.values.chartToken, undefined);
  assert.equal(sim.session.values.chartToken, 'chart-session:a=');

  sim.advance(REQUEST_INTERVAL_MS - 1);
  const restarted = sim.restart();
  assert.deepEqual(await restarted(stock), first);
  sim.advance(1);
  const [q5, cachedQ5] = await Promise.all([restarted(stock), restarted(stock)]);
  assert.equal(q5.quotes[0].vwap, 8.5);
  assert.deepEqual(q5, cachedQ5);
  assert.equal(sim.calls.length, 2);
  sim.advance();
  assert.equal((await restarted(stock)).quotes[1].vwap, 8.6);
  sim.advance();
  assert.equal((await restarted(stock)).quotes[2].vwap, 8.7);
  sim.advance();
  assert.deepEqual((await restarted(stock)).quotes.map(q => q.vwap), [8.5, 8.6, 8.7]);
  assert.deepEqual(sim.calls.map(call => [call.stage, call.quality]), [
    ['token', undefined], ['chart', 5], ['chart', 6], ['chart', 7],
  ]);
  assert.ok(sim.calls.slice(1).every((call, index) => call.time - sim.calls[index].time >= REQUEST_INTERVAL_MS));
});

test('switching realms, resources and dates does not expose another quote', async () => {
  const sim = scenario(({ stage, time, realm, resource, quality }) => {
    if (stage === 'token') return { status: 200, data: { token: 'market-token' } };
    return { status: 200, data: candles(daily(tradingDay(time).timestamp, realm * 100 + resource + quality)) };
  });
  await sim.service(stock);
  sim.advance();
  assert.equal((await sim.service(stock)).quotes[0].vwap, 21);
  const other = { ...stock, realm: 1 };
  assert.equal((await sim.service(other)).quotes[0].status, 'queued');
  assert.equal((await sim.service({ ...stock, resource: 17 })).quotes[0].status, 'queued');
  assert.equal((await sim.service({ ...stock, realm: 2 })).quotes[0].status, 'unsupported');
  sim.advance();
  assert.equal((await sim.service(other)).quotes[0].vwap, 121);
  assert.equal((await sim.service(stock)).quotes[0].vwap, 21);

  sim.advance(12 * 3_600_000);
  const afterDay = await sim.service({ ...stock, request: undefined });
  assert.equal(afterDay.date, '2026-11-25');
  assert.equal(afterDay.quotes[0].vwap, undefined);
  assert.equal(afterDay.quotes[0].previous.vwap, 21);
  assert.equal(afterDay.quotes[0].previous.date, '2026-11-24');
  assert.equal(afterDay.quotes[1].previous, undefined);
  assert.equal((await sim.service({ ...other, request: undefined })).quotes[0].previous.vwap, 121);
  assert.equal(sim.calls.length, 3);
});

test('migrates per-grade quotes and keeps them through a failed UTC rollover', async () => {
  const sim = scenario(({ stage, time, quality }, count) => {
    assert.equal(stage, 'chart');
    if (count === 1) return { status: 503 };
    if (quality === 6) return { status: 200, data: candles() };
    return { status: 200, data: candles(daily(tradingDay(time).timestamp, 9 + quality / 10)) };
  });
  sim.local.values.quoteCache = {
    date: tradingDay(GAME_DAY).date,
    format: 3,
    entries: Object.fromEntries([5, 6, 7].map(quality => [
      `0/16/${quality}`, { series: [[yesterday, 250, 8 + quality / 10]], source: 'automatic' },
    ])),
  };
  sim.session.values.chartToken = 'test-token';
  const mixedDays = { ...stock, daysByQuality: { 7: 3 } };
  const endOfDay = tradingDay(GAME_DAY).nextDay;
  const peek = { ...mixedDays, autoFetch: true, request: undefined };
  const reopened = await sim.restart()(mixedDays);
  assert.deepEqual(reopened.quotes.map(quote => quote.vwap), [8.5, 8.6, 8.7]);
  assert.equal(reopened.refreshAt, endOfDay);
  assert.equal(sim.calls.length, 0);

  sim.advance(endOfDay - GAME_DAY);
  const crossed = await sim.restart()(peek);
  assert.equal(crossed.date, '2026-11-25');
  assert.ok(crossed.refreshAt <= endOfDay);
  assert.deepEqual(crossed.quotes.map(quote => quote.previous.vwap), [8.5, 8.6, 8.7]);
  assert.ok(crossed.quotes.every(quote => quote.previous.date === '2026-11-24'));
  assert.equal(sim.calls.length, 0);

  const failed = await sim.service(mixedDays);
  assert.equal(failed.quotes[0].status, 'unavailable');
  assert.equal(failed.quotes[0].previous.vwap, 8.5);
  assert.equal(sim.calls[0].time, endOfDay);
  assert.equal(sim.local.values.quoteCache.format, 4);
  assert.deepEqual(await sim.restart()(mixedDays), failed);
  assert.equal(sim.calls.length, 1);

  sim.advance();
  const empty = await sim.service(mixedDays);
  assert.equal(empty.quotes[1].status, 'no-trades');
  assert.equal(empty.quotes[1].previous, undefined);
  assert.equal(empty.quotes[0].previous.vwap, 8.5);
  sim.advance();
  const updated = await sim.service(mixedDays);
  assert.equal(updated.quotes[2].vwap, 9.7);
  assert.equal(updated.quotes[2].previous, undefined);
  assert.equal(updated.quotes[0].previous.vwap, 8.5);

  sim.advance(4 * REQUEST_INTERVAL_MS);
  const finished = await sim.service(mixedDays);
  assert.deepEqual(finished.quotes.map(quote => quote.status), ['price', 'no-trades', 'price']);
  assert.equal(finished.quotes[0].vwap, 9.5);
  assert.deepEqual(sim.calls.map(call => call.quality), [5, 6, 7, 5]);
  assert.ok(sim.calls.slice(1).every((call, index) => call.time - sim.calls[index].time >= REQUEST_INTERVAL_MS));
  await sim.restart()(mixedDays);
  assert.equal(sim.calls.length, 4);
});

test('a native response for a request started before midnight cannot publish an unfinished candle', async () => {
  const sim = scenario(() => assert.fail('Native reuse must add zero requests'));
  const midnight = tradingDay(GAME_DAY).nextDay;
  sim.advance(midnight - GAME_DAY);
  const chart = { realm: 0, resource: 16, quality: 5 };
  const oldChart = {
    ...chart,
    startedAt: midnight - 1,
    data: candles(daily(yesterday, 8.5), daily(yesterday + DAY_SECONDS, 99)),
  };
  const peek = { ...stock, request: undefined };
  assert.equal(await sim.service.rememberNative(oldChart), true);
  const [before] = (await sim.service(peek)).quotes;
  assert.equal(before.vwap, undefined);
  assert.equal(before.previous.vwap, 8.5);
  assert.equal(before.previous.date, '2026-11-24');

  assert.equal(await sim.service.rememberNative({
    ...chart, startedAt: midnight, data: candles(daily(yesterday + DAY_SECONDS, 9.5)),
  }), true);
  assert.equal(await sim.service.rememberNative(oldChart), false);
  const [after] = (await sim.service(peek)).quotes;
  assert.equal(after.vwap, 9.5);
  assert.equal(after.previous, undefined);
});

test('requests one fresh chart token after a 404 without retrying immediately', async () => {
  const sim = scenario(({ stage }, count) => {
    if (stage === 'token') return { status: 200, data: { token: count === 1 ? 'old-token' : 'new-token' } };
    return { status: 404 };
  });
  const q5 = { ...stock, qualities: [5] };
  await sim.service(q5);
  sim.advance();
  assert.equal((await sim.service(q5)).quotes[0].status, 'queued');
  assert.equal(sim.session.values.chartToken, undefined);
  assert.equal(sim.calls.length, 2);
  sim.advance();
  await sim.service(q5);
  sim.advance();
  assert.equal((await sim.service(q5)).quotes[0].status, 'unavailable');
  sim.advance();
  await sim.service(q5);
  assert.equal(sim.calls.length, 4);
});

test('reports chart authentication and respects Retry-After globally', async () => {
  const denied = scenario(() => ({ status: 403 }));
  const status = await denied.service(stock);
  assert.deepEqual(status.quotes.map(q => q.status), ['forbidden', 'forbidden', 'forbidden']);
  assert.deepEqual(status.quotes[0].detail, { stage: 'token', issue: undefined, httpStatus: 403 });
  denied.advance();
  await denied.service(stock);
  assert.equal(denied.calls.length, 1);

  const limited = scenario(() => ({ status: 429, retryAfter: '2400' }));
  assert.equal((await limited.service(stock)).quotes[0].status, 'rate-limited');
  assert.equal(limited.local.values.nextRequestAt, GAME_DAY + 2_400_000);
  limited.advance(2_399_999);
  await limited.service({ ...stock, resource: 4 });
  assert.equal(limited.calls.length, 1);
});

test('distinguishes the game login redirect and malformed chart data', async () => {
  const redirect = scenario(() => ({ status: 0, issue: 'redirect' }));
  assert.equal((await redirect.service(stock)).quotes[0].status, 'sign-in');

  const malformed = scenario(({ stage }) => stage === 'token'
    ? { status: 200, data: { token: 'market-token' } }
    : { status: 200, data: { candles: [] } });
  await malformed.service(stock);
  malformed.advance();
  assert.deepEqual((await malformed.service(stock)).quotes[0].detail,
    { stage: 'chart', issue: 'schema', httpStatus: 200 });
});

test('a stale warehouse page skips dispatch and releases its reservation', async () => {
  const sim = scenario((_call, count) => count === 1
    ? { skipped: true }
    : { status: 200, data: { token: 'market-token' } });
  await sim.service(stock);
  assert.equal(sim.local.values.nextRequestAt, 0);
  await sim.service({ ...stock, resource: 17 });
  assert.equal(sim.session.values.chartToken, 'market-token');
  assert.equal(sim.local.values.nextRequestAt, GAME_DAY + REQUEST_INTERVAL_MS);
});
