import { evaluateExecutionRiskRules } from './risk-rules.js';

const MIN_ORDER_NOTIONAL_USD = 1;
const DEFAULTS = {
  rebalancePolicy: 'buffered_band_rebalance',
  targetGrossExposurePct: 95,
  cashBufferPct: 5,
  rebalanceBandRelative: 0.25,
  rebalanceBandAbsolutePct: 1,
  minOrderNotionalUsd: 100,
  minOrderEquityPct: 0.5,
};

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cfg(config, key) { return toNumber(config?.[key], DEFAULTS[key]); }
function roundToCents(value) { return Math.round(value * 100) / 100; }
function roundToQuantity(value) { return Math.round(value * 10_000) / 10_000; }
function roundToWholeShareQuantity(value) { return Math.floor(Math.max(0, value)); }
function policy(config) { return config?.rebalancePolicy ?? config?.executionRebalancePolicy ?? DEFAULTS.rebalancePolicy; }
function findPositionForSymbol(positions, symbol) {
  return (positions ?? []).find((position) => String(position.symbol ?? '').trim().toUpperCase() === symbol) ?? null;
}
function derivePositionSide(position, qty) {
  if (position?.side === 'short') return 'short';
  if (position?.side === 'long') return 'long';
  if (qty < 0) return 'short';
  if (qty > 0) return 'long';
  return null;
}
function getReferencePrice(intent, currentPositionMarketValue, currentPositionAbsQty) {
  const adapterReferencePrice = toNumber(intent.reference_price ?? intent.adapter_metadata_json?.reference_price, null);
  if (adapterReferencePrice && adapterReferencePrice > 0) return adapterReferencePrice;
  if (currentPositionAbsQty > 0 && currentPositionMarketValue >= MIN_ORDER_NOTIONAL_USD) {
    const derivedPrice = currentPositionMarketValue / currentPositionAbsQty;
    return Number.isFinite(derivedPrice) && derivedPrice > 0 ? derivedPrice : null;
  }
  return null;
}
function getEffectiveTargetExposurePct(intent, config) {
  const raw = toNumber(intent.target_exposure_pct);
  const tickerCount = toNumber(intent.adapter_metadata_json?.ticker_count, null);
  if (tickerCount && tickerCount > 0 && raw !== 0) return roundToCents((raw < 0 ? -1 : 1) * cfg(config, 'targetGrossExposurePct') / tickerCount);
  return raw;
}
function minOrderNotional(config, equity) {
  return Math.max(cfg(config, 'minOrderNotionalUsd'), roundToCents((equity * cfg(config, 'minOrderEquityPct')) / 100));
}
function metadata({ intent, config, action, currentWeightPct, targetWeightPct, targetExposurePct, orderNotional = null, reason = null }) {
  const driftPct = Math.abs(currentWeightPct - targetWeightPct);
  return {
    intent_status: intent.intent_status,
    action_hint: intent.action_hint,
    rebalance_policy: policy(config),
    rebalance_action: action,
    current_weight_pct: roundToCents(currentWeightPct),
    target_weight_pct: roundToCents(targetWeightPct),
    effective_target_exposure_pct: roundToCents(targetExposurePct),
    drift_relative: targetWeightPct > 0 ? roundToQuantity(driftPct / targetWeightPct) : null,
    drift_pct: roundToCents(driftPct),
    min_order_notional: roundToCents(minOrderNotional(config, 100000)),
    proposed_order_notional: orderNotional === null ? null : roundToCents(orderNotional),
    skipped_reason: reason,
  };
}
function noTrade(args) { return { proposal: null, proposalMetadata: metadata(args) }; }
function trade(args, proposal) {
  const orderNotional = roundToCents(proposal.orderNotional ?? proposal.notional ?? 0);
  if (orderNotional < args.minimumOrderNotional) return noTrade({ ...args, action: 'skipped_small_order', orderNotional, reason: 'order_below_minimum' });
  return { proposal: { ...proposal, orderNotional }, proposalMetadata: metadata({ ...args, orderNotional }) };
}

function buildBlockedDecision(intent, brokerState, mode, broker) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  const blockedReasonCode = intent.adapter_metadata_json?.blocked_reason_code ?? 'intent_blocked';
  return {
    symbol: intent.symbol, broker, mode, decision_status: 'blocked',
    current_position_qty: toNumber(currentPosition?.qty),
    current_position_market_value: toNumber(currentPosition?.marketValue),
    current_position_side: currentPosition?.side ?? null,
    current_cash: toNumber(brokerState.account?.cash),
    current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
    proposed_order_side: null, proposed_order_qty: null, proposed_order_notional: null,
    target_position_notional: null,
    blocking_codes: [blockedReasonCode], risk_results: [],
    decision_metadata_json: { intent_status: intent.intent_status, action_hint: intent.action_hint },
  };
}
function buildNoOpDecision(intent, brokerState, mode, broker) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  return {
    symbol: intent.symbol, broker, mode, decision_status: 'no_op',
    current_position_qty: toNumber(currentPosition?.qty),
    current_position_market_value: toNumber(currentPosition?.marketValue),
    current_position_side: currentPosition?.side ?? null,
    current_cash: toNumber(brokerState.account?.cash),
    current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
    proposed_order_side: null, proposed_order_qty: null, proposed_order_notional: null,
    target_position_notional: null, blocking_codes: [], risk_results: [],
    decision_metadata_json: { intent_status: intent.intent_status, action_hint: intent.action_hint },
  };
}

function buildExactProposal({ intent, referencePrice, targetPositionNotional, currentQtySigned, currentPositionMarketValue }) {
  if (intent.target_state === 'short' && !referencePrice) return null;
  if (referencePrice) {
    const targetQtyMagnitude = Math.abs(targetPositionNotional) / referencePrice;
    const targetQtySigned = (intent.target_state === 'short' ? -1 : 1) * (intent.target_state === 'short' ? roundToWholeShareQuantity(targetQtyMagnitude) : roundToQuantity(targetQtyMagnitude));
    const deltaQtySigned = roundToQuantity(targetQtySigned - currentQtySigned);
    const orderNotional = roundToCents(Math.abs(deltaQtySigned) * referencePrice);
    if (deltaQtySigned === 0 || orderNotional < MIN_ORDER_NOTIONAL_USD) return null;
    return { side: deltaQtySigned > 0 ? 'buy' : 'sell', qty: Math.abs(deltaQtySigned), notional: null, orderNotional, resultingPositionNotional: Math.abs(targetPositionNotional), rebalanceAction: currentPositionMarketValue <= 0 ? 'enter' : 'rebalance' };
  }
  const notional = roundToCents(targetPositionNotional - currentPositionMarketValue);
  if (notional < MIN_ORDER_NOTIONAL_USD) return null;
  return { side: 'buy', qty: null, notional, orderNotional: notional, resultingPositionNotional: targetPositionNotional, rebalanceAction: currentPositionMarketValue <= 0 ? 'enter' : 'top_up' };
}

function buildBufferedProposal(args) {
  const { intent, brokerState, config, currentPositionMarketValue, currentPositionAbsQty, currentPositionSide, currentQtySigned, referencePrice, targetExposurePct, targetPositionNotional, portfolioValue } = args;
  const account = brokerState.account ?? {};
  const currentWeightPct = portfolioValue > 0 ? currentPositionMarketValue / portfolioValue * 100 : 0;
  const targetWeightPct = Math.abs(targetExposurePct);
  const minimumOrderNotional = minOrderNotional(config, portfolioValue);
  const base = { intent, config, currentWeightPct, targetWeightPct, targetExposurePct, minimumOrderNotional };
  const desiredSide = intent.target_state === 'short' ? 'short' : 'long';
  const lowerWeightPct = Math.max(0, targetWeightPct * (1 - cfg(config, 'rebalanceBandRelative')));
  const upperWeightPct = targetWeightPct * (1 + cfg(config, 'rebalanceBandRelative'));
  const cashBufferNotional = roundToCents(portfolioValue * cfg(config, 'cashBufferPct') / 100);
  const cashAvailable = Math.max(0, roundToCents(toNumber(account.cash) - cashBufferNotional));

  if (currentPositionMarketValue <= 0 || currentPositionAbsQty <= 0) {
    if (intent.target_state === 'short') {
      if (!referencePrice) return noTrade({ ...base, action: 'skipped_missing_reference_price', reason: 'short_entry_requires_reference_price' });
      const qty = roundToWholeShareQuantity(Math.abs(targetPositionNotional) / referencePrice);
      const orderNotional = roundToCents(qty * referencePrice);
      if (qty <= 0) return noTrade({ ...base, action: 'skipped_small_order', orderNotional, reason: 'whole_share_short_quantity_zero' });
      return trade({ ...base, action: 'enter' }, { side: 'sell', qty, notional: null, orderNotional, resultingPositionNotional: orderNotional, rebalanceAction: 'enter' });
    }
    const orderNotional = Math.min(Math.abs(targetPositionNotional), cashAvailable);
    if (orderNotional <= 0) return noTrade({ ...base, action: 'skipped_insufficient_cash', orderNotional: 0, reason: 'cash_buffer_reserved' });
    return trade({ ...base, action: 'enter' }, { side: 'buy', qty: null, notional: roundToCents(orderNotional), orderNotional, resultingPositionNotional: orderNotional, rebalanceAction: 'enter' });
  }

  if (currentPositionSide && currentPositionSide !== desiredSide) {
    const exact = buildExactProposal({ intent, referencePrice, targetPositionNotional, currentQtySigned, currentPositionMarketValue });
    return exact ? trade({ ...base, action: 'flip' }, { ...exact, rebalanceAction: 'flip' }) : noTrade({ ...base, action: 'hold' });
  }
  if (currentWeightPct >= lowerWeightPct && currentWeightPct <= upperWeightPct) return noTrade({ ...base, action: 'hold', reason: 'inside_rebalance_band' });
  if (Math.abs(currentWeightPct - targetWeightPct) < cfg(config, 'rebalanceBandAbsolutePct')) return noTrade({ ...base, action: 'hold', reason: 'below_absolute_drift_threshold' });
  if (!referencePrice) return noTrade({ ...base, action: 'skipped_missing_reference_price', reason: 'rebalance_requires_reference_price' });

  if (currentWeightPct > upperWeightPct) {
    const destinationNotional = roundToCents(portfolioValue * upperWeightPct / 100);
    const orderNotional = Math.max(0, roundToCents(currentPositionMarketValue - destinationNotional));
    const qty = roundToQuantity(orderNotional / referencePrice);
    return trade({ ...base, action: 'trim' }, { side: intent.target_state === 'short' ? 'buy' : 'sell', qty, notional: null, orderNotional, resultingPositionNotional: Math.max(0, currentPositionMarketValue - orderNotional), rebalanceAction: 'trim' });
  }

  const destinationNotional = roundToCents(portfolioValue * lowerWeightPct / 100);
  const requestedOrderNotional = Math.max(0, roundToCents(destinationNotional - currentPositionMarketValue));
  if (intent.target_state === 'short') {
    const qty = roundToWholeShareQuantity(requestedOrderNotional / referencePrice);
    const orderNotional = roundToCents(qty * referencePrice);
    return qty <= 0 ? noTrade({ ...base, action: 'skipped_small_order', orderNotional, reason: 'whole_share_short_quantity_zero' }) : trade({ ...base, action: 'top_up' }, { side: 'sell', qty, notional: null, orderNotional, resultingPositionNotional: currentPositionMarketValue + orderNotional, rebalanceAction: 'top_up' });
  }
  const orderNotional = Math.min(requestedOrderNotional, cashAvailable);
  if (orderNotional <= 0) return noTrade({ ...base, action: 'skipped_insufficient_cash', orderNotional: requestedOrderNotional, reason: 'cash_buffer_reserved' });
  return trade({ ...base, action: 'top_up' }, { side: 'buy', qty: null, notional: roundToCents(orderNotional), orderNotional, resultingPositionNotional: currentPositionMarketValue + orderNotional, rebalanceAction: 'top_up' });
}

function buildProposal(intent, brokerState, config = {}) {
  const account = brokerState.account ?? {};
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  const currentPositionQty = toNumber(currentPosition?.qty);
  const currentPositionAbsQty = Math.abs(currentPositionQty);
  const currentPositionSide = derivePositionSide(currentPosition, currentPositionQty);
  const currentPositionMarketValue = Math.abs(toNumber(currentPosition?.marketValue));
  const portfolioValue = toNumber(account.portfolioValue ?? account.equity);
  const targetExposurePct = getEffectiveTargetExposurePct(intent, config);
  const targetPositionNotional = roundToCents(portfolioValue * targetExposurePct / 100);
  const referencePrice = getReferencePrice(intent, currentPositionMarketValue, currentPositionAbsQty);
  const currentQtySigned = currentPositionSide === 'short' ? -currentPositionAbsQty : currentPositionAbsQty;
  const currentWeightPct = portfolioValue > 0 ? currentPositionMarketValue / portfolioValue * 100 : 0;

  if (intent.target_state === 'cash') {
    if (currentPositionAbsQty <= 0 || currentPositionMarketValue < MIN_ORDER_NOTIONAL_USD) return { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional: 0, proposal: null, proposalMetadata: metadata({ intent, config, action: 'hold_cash', currentWeightPct, targetWeightPct: 0, targetExposurePct: 0, reason: 'already_cash' }) };
    return { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional: 0, proposal: { side: currentPositionSide === 'short' ? 'buy' : 'sell', qty: currentPositionAbsQty, notional: null, orderNotional: currentPositionMarketValue, resultingPositionNotional: 0, rebalanceAction: 'exit' }, proposalMetadata: metadata({ intent, config, action: 'exit', currentWeightPct, targetWeightPct: 0, targetExposurePct: 0, orderNotional: currentPositionMarketValue }) };
  }

  if (intent.target_state !== 'long' && intent.target_state !== 'short') return { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional, proposal: null, proposalMetadata: metadata({ intent, config, action: 'hold', currentWeightPct, targetWeightPct: Math.abs(targetExposurePct), targetExposurePct, reason: 'unsupported_target_state' }) };

  if (policy(config) === 'buffered_band_rebalance') {
    const result = buildBufferedProposal({ intent, brokerState, config, currentPositionMarketValue, currentPositionAbsQty, currentPositionSide, currentQtySigned, referencePrice, targetExposurePct, targetPositionNotional, portfolioValue });
    return { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional: Math.abs(targetPositionNotional), ...result };
  }

  const exact = buildExactProposal({ intent, referencePrice, targetPositionNotional, currentQtySigned, currentPositionMarketValue });
  const targetWeightPct = Math.abs(targetExposurePct);
  return { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional, proposal: exact, proposalMetadata: metadata({ intent, config, action: exact?.rebalanceAction ?? 'hold', currentWeightPct, targetWeightPct, targetExposurePct, orderNotional: exact?.orderNotional ?? 0 }) };
}

export function buildExecutionDecision({ intent, brokerState, config, mode, broker = 'alpaca', now = new Date() }) {
  if (intent.intent_status === 'blocked') return buildBlockedDecision(intent, brokerState, mode, broker);
  if (intent.intent_status === 'no_op') return buildNoOpDecision(intent, brokerState, mode, broker);
  const { currentPosition, currentPositionQty, currentPositionMarketValue, targetPositionNotional, proposal, proposalMetadata } = buildProposal(intent, brokerState, config);
  if (!proposal) {
    return {
      symbol: intent.symbol, broker, mode, decision_status: 'no_op',
      current_position_qty: currentPositionQty,
      current_position_market_value: currentPositionMarketValue,
      current_position_side: currentPosition?.side ?? null,
      current_cash: toNumber(brokerState.account?.cash),
      current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
      proposed_order_side: null, proposed_order_qty: null, proposed_order_notional: null,
      target_position_notional: targetPositionNotional,
      blocking_codes: [], risk_results: [], decision_metadata_json: proposalMetadata,
    };
  }
  const riskResults = evaluateExecutionRiskRules({ intent, proposal, brokerState, config, mode, now });
  const blockingCodes = riskResults.filter((result) => result.status === 'block').map((result) => result.code);
  const decisionStatus = blockingCodes.length ? 'blocked' : mode === 'paper_execute' ? 'approved_for_send' : 'dry_run';
  return {
    symbol: intent.symbol, broker, mode, decision_status: decisionStatus,
    current_position_qty: currentPositionQty,
    current_position_market_value: currentPositionMarketValue,
    current_position_side: currentPosition?.side ?? null,
    current_cash: toNumber(brokerState.account?.cash),
    current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
    proposed_order_side: proposal.side,
    proposed_order_qty: proposal.qty,
    proposed_order_notional: proposal.notional,
    target_position_notional: targetPositionNotional,
    blocking_codes: blockingCodes,
    risk_results: riskResults,
    decision_metadata_json: proposalMetadata,
  };
}
