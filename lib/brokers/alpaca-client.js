function getHeaderValue(headers, name) {
  if (!headers) {
    return null;
  }

  if (typeof headers.get === 'function') {
    return headers.get(name);
  }

  if (headers instanceof Map) {
    return headers.get(name);
  }

  return headers[name] ?? headers[name.toLowerCase()] ?? null;
}

async function parseResponseBody(response) {
  const contentType = getHeaderValue(response.headers, 'content-type') ?? '';
  if (contentType.includes('application/json') && typeof response.json === 'function') {
    return response.json();
  }

  if (typeof response.text !== 'function') {
    return null;
  }

  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function buildQueryString(params = {}) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    searchParams.set(key, String(value));
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function createAlpacaClient(config, options = {}) {
  const apiBaseUrl = config?.apiBaseUrl?.trim();
  const apiKey = config?.apiKey?.trim();
  const apiSecret = config?.apiSecret?.trim();
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;

  if (!apiBaseUrl) {
    throw new Error('ALPACA_API_BASE_URL is required.');
  }
  if (!apiKey) {
    throw new Error('ALPACA_API_KEY is required.');
  }
  if (!apiSecret) {
    throw new Error('ALPACA_API_SECRET is required.');
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('No fetch implementation is available for Alpaca client.');
  }

  async function request(method, path, body = null) {
    const url = `${apiBaseUrl.replace(/\/+$/, '')}${path}`;
    const headers = {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    };

    if (body !== null) {
      headers['content-type'] = 'application/json';
    }

    const response = await fetchImpl(url, {
      method,
      headers,
      body: body === null ? undefined : JSON.stringify(body),
    });
    const parsedBody = await parseResponseBody(response);

    if (!response.ok) {
      const detail = typeof parsedBody === 'object' && parsedBody !== null
        ? parsedBody.message ?? response.statusText
        : String(parsedBody ?? response.statusText);
      throw new Error(`Alpaca request failed: ${method} ${path} -> ${response.status} ${detail}`);
    }

    return parsedBody;
  }

  return {
    getAccount() {
      return request('GET', '/account');
    },
    getPositions() {
      return request('GET', '/positions');
    },
    getOpenOrders() {
      return request('GET', '/orders?status=open');
    },
    getCalendar(params = {}) {
      return request('GET', `/calendar${buildQueryString(params)}`);
    },
    submitOrder(orderRequest) {
      return request('POST', '/orders', orderRequest);
    },
  };
}
