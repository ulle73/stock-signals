import { evaluateExecutionRiskRules } from './risk-rules.js';

const MIN_ORDER_NOTIONAL_USD = 1;

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundToCents(value) {
  return Math.round(value * 100) / 100;
}

function findPositionForSymbol(positions, symbol) {
  return (positions ?? []).find((position) => String(position.symbol ?? '').trim().toUpperCase() === symbol) ?? null;
}

function buildBlockedDecision(intent, brokerState, mode) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  const blockedReasonCode = intent.adapter_metadata_json?.blocked_reason_code ?? 'intent_blocked';

  return {
    symbol: intent.symbol,
    broker: 'alpaca',
    mode,
    decision_status: 'blocked',
    current_position_qty: toNumber(currentPosition?.qty),
    current_position_market_value: toNumber(currentPosition?.marketValue),
    current_position_side: currentPosition?.side ?? null,
    current_cash: toNumber(brokerState.account?.cash),
    current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
    proposed_order_side: null,
    proposed_order_qty: null,
    proposed_order_notional: null,
    target_position_notional: null,
    blocking_codes: [blockedReasonCode],
    risk_results: [],
    decision_metadata_json: {
      intent_status: intent.intent_status,
      action_hint: intent.action_hint,
    },
  };
}

function buildNoOpDecision(intent, brokerState, mode) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);

  return {
    symbol: intent.symbol,
    broker: 'alpaca',
    mode,
    decision_status: 'no_op',
    current_position_qty: toNumber(currentPosition?.qty),
    current_position_market_value: toNumber(currentPosition?.marketValue),
    current_position_side: currentPosition?.side ?? null,
    current_cash: toNumber(brokerState.account?.cash),
    current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
    proposed_order_side: null,
    proposed_order_qty: null,
    proposed_order_notional: null,
    target_position_notional: null,
    blocking_codes: [],
    risk_results: [],
    decision_metadata_json: {
      intent_status: intent.intent_status,
      action_hint: intent.action_hint,
    },
  };
}

function buildProposal(intent, brokerState) {
  const account = brokerState.account ?? {};
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  const currentPositionQty = toNumber(currentPosition?.qty);
  const currentPositionMarketValue = Math.abs(toNumber(currentPosition?.marketValue));
  const portfolioValue = toNumber(account.portfolioValue ?? account.equity);
  const targetExposurePct = toNumber(intent.target_exposure_pct);
  const targetPositionNotional = roundToCents((portfolioValue * targetExposurePct) / 100);

  if (intent.target_state === 'cash') {
    if (currentPositionQty <= 0 || currentPositionMarketValue < MIN_ORDER_NOTIONAL_USD) {
      return {
        currentPosition,
        currentPositionQty,
        currentPositionMarketValue,
        targetPositionNotional: 0,
        proposal: null,
      };
    }

    return {
      currentPosition,
      currentPositionQty,
      currentPositionMarketValue,
      targetPositionNotional: 0,
      proposal: {
        side: 'sell',
        qty: currentPositionQty,
        notional: null,
        resultingPositionNotional: 0,
      },
    };
  }

  if (intent.target_state === 'long') {
    const deltaNotional = roundToCents(targetPositionNotional - currentPositionMarketValue);
    if (deltaNotional < MIN_ORDER_NOTIONAL_USD) {
      return {
        currentPosition,
        currentPositionQty,
        currentPositionMarketValue,
        targetPositionNotional,
        proposal: null,
      };
    }

    return {
      currentPosition,
      currentPositionQty,
      currentPositionMarketValue,
      targetPositionNotional,
      proposal: {
        side: 'buy',
        qty: null,
        notional: deltaNotional,
        resultingPositionNotional: targetPositionNotional,
      },
    };
  }

  return {
    currentPosition,
    currentPositionQty,
    currentPositionMarketValue,
    targetPositionNotional,
    proposal: null,
  };
}

export function buildExecutionDecision({
  intent,
  brokerState,
  config,
  mode,
  now = new Date(),
}) {
  if (intent.intent_status === 'blocked') {
    return buildBlockedDecision(intent, brokerState, mode);
  }

  if (intent.intent_status === 'no_op') {
    return buildNoOpDecision(intent, brokerState, mode);
  }

  const {
    currentPosition,
    currentPositionQty,
    currentPositionMarketValue,
    targetPositionNotional,
    proposal,
  } = buildProposal(intent, brokerState);

  if (!proposal) {
    return {
      symbol: intent.symbol,
      broker: 'alpaca',
      mode,
      decision_status: 'no_op',
      current_position_qty: currentPositionQty,
      current_position_market_value: currentPositionMarketValue,
      current_position_side: currentPosition?.side ?? null,
      current_cash: toNumber(brokerState.account?.cash),
      current_equity: toNumber(brokerState.account?.equity ?? brokerState.account?.portfolioValue),
      proposed_order_side: null,
      proposed_order_qty: null,
      proposed_order_notional: null,
      target_position_notional: targetPositionNotional,
      blocking_codes: [],
      risk_results: [],
      decision_metadata_json: {
        intent_status: intent.intent_status,
        action_hint: intent.action_hint,
      },
    };
  }

  const riskResults = evaluateExecutionRiskRules({
    intent,
    proposal,
    brokerState,
    config,
    mode,
    now,
  });
  const blockingCodes = riskResults
    .filter((result) => result.status === 'block')
    .map((result) => result.code);

  let decisionStatus;
  if (blockingCodes.length) {
    decisionStatus = 'blocked';
  } else if (mode === 'paper_execute') {
    decisionStatus = 'approved_for_send';
  } else {
    decisionStatus = 'dry_run';
  }

  return {
    symbol: intent.symbol,
    broker: 'alpaca',
    mode,
    decision_status: decisionStatus,
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
    decision_metadata_json: {
      intent_status: intent.intent_status,
      action_hint: intent.action_hint,
    },
  };
}
