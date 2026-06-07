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

function roundToQuantity(value) {
  return Math.round(value * 10_000) / 10_000;
}

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
  if (adapterReferencePrice && adapterReferencePrice > 0) {
    return adapterReferencePrice;
  }

  if (currentPositionAbsQty > 0 && currentPositionMarketValue >= MIN_ORDER_NOTIONAL_USD) {
    const derivedPrice = currentPositionMarketValue / currentPositionAbsQty;
    return Number.isFinite(derivedPrice) && derivedPrice > 0 ? derivedPrice : null;
  }

  return null;
}

function buildBlockedDecision(intent, brokerState, mode, broker) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);
  const blockedReasonCode = intent.adapter_metadata_json?.blocked_reason_code ?? 'intent_blocked';

  return {
    symbol: intent.symbol,
    broker,
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

function buildNoOpDecision(intent, brokerState, mode, broker) {
  const currentPosition = findPositionForSymbol(brokerState.positions, intent.symbol);

  return {
    symbol: intent.symbol,
    broker,
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
  const currentPositionAbsQty = Math.abs(currentPositionQty);
  const currentPositionSide = derivePositionSide(currentPosition, currentPositionQty);
  const currentPositionMarketValue = Math.abs(toNumber(currentPosition?.marketValue));
  const portfolioValue = toNumber(account.portfolioValue ?? account.equity);
  const targetExposurePct = toNumber(intent.target_exposure_pct);
  const targetPositionNotional = roundToCents((portfolioValue * targetExposurePct) / 100);
  const referencePrice = getReferencePrice(intent, currentPositionMarketValue, currentPositionAbsQty);
  const currentQtySigned = currentPositionSide === 'short' ? -currentPositionAbsQty : currentPositionAbsQty;

  if (intent.target_state === 'cash') {
    if (currentPositionAbsQty <= 0 || currentPositionMarketValue < MIN_ORDER_NOTIONAL_USD) {
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
        side: currentPositionSide === 'short' ? 'buy' : 'sell',
        qty: currentPositionAbsQty,
        notional: null,
        resultingPositionNotional: 0,
      },
    };
  }

  if (intent.target_state === 'long' || intent.target_state === 'short') {
    const targetQtySigned = referencePrice
      ? ((intent.target_state === 'short' ? -1 : 1) * roundToQuantity(Math.abs(targetPositionNotional) / referencePrice))
      : null;

    if (targetQtySigned !== null) {
      const deltaQtySigned = roundToQuantity(targetQtySigned - currentQtySigned);
      const deltaNotional = roundToCents(Math.abs(deltaQtySigned) * referencePrice);

      if (deltaNotional < MIN_ORDER_NOTIONAL_USD || deltaQtySigned === 0) {
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
          side: deltaQtySigned > 0 ? 'buy' : 'sell',
          qty: Math.abs(roundToQuantity(deltaQtySigned)),
          notional: null,
          resultingPositionNotional: Math.abs(targetPositionNotional),
        },
      };
    }

    if (intent.target_state === 'short') {
      return {
        currentPosition,
        currentPositionQty,
        currentPositionMarketValue,
        targetPositionNotional,
        proposal: null,
      };
    }

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
  broker = 'alpaca',
  now = new Date(),
}) {
  if (intent.intent_status === 'blocked') {
    return buildBlockedDecision(intent, brokerState, mode, broker);
  }

  if (intent.intent_status === 'no_op') {
    return buildNoOpDecision(intent, brokerState, mode, broker);
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
      broker,
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
    broker,
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
