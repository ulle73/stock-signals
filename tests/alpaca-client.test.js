import test from 'node:test';
import assert from 'node:assert/strict';
import { createAlpacaClient } from '../lib/brokers/alpaca-client.js';

test('alpaca client sends authenticated account request to configured paper endpoint', async () => {
  const calls = [];
  const client = createAlpacaClient(
    {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      apiKey: 'KEY123',
      apiSecret: 'SECRET456',
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ id: 'acct_1' }),
          text: async () => JSON.stringify({ id: 'acct_1' }),
        };
      },
    }
  );

  const account = await client.getAccount();

  assert.deepEqual(account, { id: 'acct_1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://paper-api.alpaca.markets/v2/account');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.headers['APCA-API-KEY-ID'], 'KEY123');
  assert.equal(calls[0].options.headers['APCA-API-SECRET-KEY'], 'SECRET456');
});

test('alpaca client submits market order payload without embedding credentials in body', async () => {
  const calls = [];
  const client = createAlpacaClient(
    {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      apiKey: 'KEY123',
      apiSecret: 'SECRET456',
    },
    {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({ id: 'ord_1', status: 'accepted' }),
          text: async () => JSON.stringify({ id: 'ord_1', status: 'accepted' }),
        };
      },
    }
  );

  const response = await client.submitOrder({
    symbol: 'SPY',
    side: 'buy',
    type: 'market',
    time_in_force: 'day',
    notional: '1000',
  });

  assert.deepEqual(response, { id: 'ord_1', status: 'accepted' });
  assert.equal(calls[0].url, 'https://paper-api.alpaca.markets/v2/orders');
  assert.equal(JSON.parse(calls[0].options.body).symbol, 'SPY');
  assert.equal(JSON.parse(calls[0].options.body).notional, '1000');
});

test('alpaca client builds calendar query strings for next-session lookups', async () => {
  const calls = [];
  const client = createAlpacaClient(
    {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      apiKey: 'KEY123',
      apiSecret: 'SECRET456',
    },
    {
      fetchImpl: async (url) => {
        calls.push(url);
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ([]),
          text: async () => '[]',
        };
      },
    }
  );

  const response = await client.getCalendar({ start: '2026-06-05', end: '2026-06-12' });

  assert.deepEqual(response, []);
  assert.equal(calls[0], 'https://paper-api.alpaca.markets/v2/calendar?start=2026-06-05&end=2026-06-12');
});

test('alpaca client error messages do not leak credentials', async () => {
  const client = createAlpacaClient(
    {
      apiBaseUrl: 'https://paper-api.alpaca.markets/v2',
      apiKey: 'KEY123',
      apiSecret: 'SECRET456',
    },
    {
      fetchImpl: async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ message: 'unauthorized' }),
        text: async () => JSON.stringify({ message: 'unauthorized' }),
      }),
    }
  );

  await assert.rejects(
    async () => client.getAccount(),
    (error) => {
      assert.match(error.message, /GET \/account/);
      assert.doesNotMatch(error.message, /KEY123/);
      assert.doesNotMatch(error.message, /SECRET456/);
      return true;
    }
  );
});
