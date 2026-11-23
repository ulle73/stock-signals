// Discord webhook transport; no access to broker/execution paths.
function getWebhook(base) {
  if (!base) throw new Error('DISCORD_MARKET_RADAR_WEBHOOK_URL is missing');
  const url = new URL(base);
  if (url.protocol !== 'https:' ||
    !['discord.com', 'discordapp.com'].includes(url.hostname) ||
    !/^\/api\/webhooks\/[0-9]+\/[a-zA-Z0-9._-]+\/?$/.test(url.pathname)) {
    throw new Error('Invalid Discord webhook URL');
  }
  return url.origin + url.pathname.replace(/\/$/, '');
}

async function send(url, method, data, fetchImpl = fetch) {
  const response = await fetchImpl(url, {
    method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error('Discord webhook failed: HTTP ' + response.status);
  return response.status === 204 ? {} : response.json();
}

export async function sendRadarStatus(webhook, payload, messageId = null, fetchImpl = fetch) {
  const base = getWebhook(webhook);
  if (messageId) {
    const response = await fetchImpl(base + '/messages/' + encodeURIComponent(messageId), {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (response.status !== 404) {
      if (!response.ok) throw new Error('Discord edit failed: HTTP ' + response.status);
      return { messageId, edited: true };
    }
  }
  const result = await send(base + '?wait=true', 'POST', payload, fetchImpl);
  if (!result.id) throw new Error('Discord did not return a message id');
  return { messageId: String(result.id), edited: false };
}

export async function sendRadarAlert(webhook, payload, fetchImpl = fetch) {
  return send(getWebhook(webhook) + '?wait=true', 'POST', payload, fetchImpl);
}
