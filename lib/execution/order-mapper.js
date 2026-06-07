import { formatIndicatorValueForStorage } from '../utils/rolling-indicators.js';

export function buildBrokerOrderRequest(decision, options = {}) {
  if (decision.decision_status !== 'approved_for_send') {
    throw new Error(`Cannot build broker order request for decision status: ${decision.decision_status}`);
  }

  if (!['buy', 'sell'].includes(decision.proposed_order_side)) {
    throw new Error(`Cannot build broker order request for order side: ${decision.proposed_order_side}`);
  }

  const request = {
    symbol: decision.symbol,
    side: decision.proposed_order_side,
    type: 'market',
    time_in_force: 'day',
  };

  if (decision.proposed_order_qty !== null && decision.proposed_order_qty !== undefined) {
    request.qty = formatIndicatorValueForStorage(decision.proposed_order_qty);
  } else if (decision.proposed_order_notional !== null && decision.proposed_order_notional !== undefined) {
    request.notional = formatIndicatorValueForStorage(decision.proposed_order_notional);
  } else {
    throw new Error(`Cannot build broker order request without qty or notional for ${decision.symbol}`);
  }

  if (options.clientOrderId) {
    request.client_order_id = options.clientOrderId;
  }

  return request;
}
