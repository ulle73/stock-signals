import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

export function buildBrokerOrderRequest(decision, options = {}) {
  if (decision.decision_status !== 'approved_for_send') {
    throw new Error(`Cannot build broker order request for decision status: ${decision.decision_status}`);
  }

  if (decision.proposed_order_side === 'buy') {
    const request = {
      symbol: decision.symbol,
      side: 'buy',
      type: 'market',
      time_in_force: 'day',
      notional: formatIndicatorValueForStorage(decision.proposed_order_notional),
    };

    if (options.clientOrderId) {
      request.client_order_id = options.clientOrderId;
    }

    return request;
  }

  if (decision.proposed_order_side === 'sell') {
    const request = {
      symbol: decision.symbol,
      side: 'sell',
      type: 'market',
      time_in_force: 'day',
      qty: formatIndicatorValueForStorage(decision.proposed_order_qty),
    };

    if (options.clientOrderId) {
      request.client_order_id = options.clientOrderId;
    }

    return request;
  }

  throw new Error(`Cannot build broker order request for order side: ${decision.proposed_order_side}`);
}
