import {
  insertExecutionDecision,
  insertExecutionIntent,
  insertExecutionOrder,
} from '../repositories/execution.js';
import { insertBrokerStateSnapshots } from '../repositories/broker-state.js';
import { buildExecutionDecision } from './decision-engine.js';
import { buildBrokerOrderRequest } from './order-mapper.js';
import { fetchAndNormalizeAlpacaState } from './alpaca-state.js';

const DEFAULT_EXECUTION_REPOSITORY = {
  insertExecutionIntent,
  insertExecutionDecision,
  insertExecutionOrder,
};

const DEFAULT_BROKER_STATE_REPOSITORY = {
  insertBrokerStateSnapshots,
};

export async function runExecutionPipeline({
  mode,
  loadIntents,
  brokerClient,
  config,
  executionRepository = DEFAULT_EXECUTION_REPOSITORY,
  brokerStateRepository = DEFAULT_BROKER_STATE_REPOSITORY,
  now = new Date(),
  generateClientOrderId,
  persistSnapshots = true,
}) {
  const intents = await loadIntents();
  const capturedAt = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const { rawState, normalizedState, snapshotRows } = await fetchAndNormalizeAlpacaState({
    brokerClient,
    config,
    capturedAt,
  });

  if (persistSnapshots) {
    await brokerStateRepository.insertBrokerStateSnapshots(snapshotRows);
  }

  const results = [];

  for (const intent of intents) {
    const intentId = await executionRepository.insertExecutionIntent(intent);
    let decision = buildExecutionDecision({
      intent,
      brokerState: normalizedState,
      config,
      mode,
      now,
    });
    let orderId = null;
    let decisionId = null;

    if (decision.decision_status === 'approved_for_send') {
      const brokerOrderRequest = buildBrokerOrderRequest(decision, {
        clientOrderId: generateClientOrderId ? generateClientOrderId({ intentId, intent, decision }) : undefined,
      });

      try {
        const brokerResponse = await brokerClient.submitOrder(brokerOrderRequest);
        decision = {
          ...decision,
          decision_status: 'sent',
        };
        decisionId = await executionRepository.insertExecutionDecision({
          ...decision,
          intent_id: intentId,
          blocking_codes_json: decision.blocking_codes,
          risk_results_json: decision.risk_results,
        });
        orderId = await executionRepository.insertExecutionOrder({
          decision_id: decisionId,
          broker: 'alpaca',
          broker_order_id: brokerResponse.id ?? null,
          symbol: brokerOrderRequest.symbol,
          side: brokerOrderRequest.side,
          order_type: brokerOrderRequest.type,
          time_in_force: brokerOrderRequest.time_in_force,
          qty: brokerOrderRequest.qty ?? null,
          notional: brokerOrderRequest.notional ?? null,
          client_order_id: brokerOrderRequest.client_order_id ?? null,
          request_json: brokerOrderRequest,
          response_json: brokerResponse,
          broker_status: brokerResponse.status ?? 'accepted',
        });
      } catch (error) {
        decision = {
          ...decision,
          decision_status: 'broker_rejected',
          blocking_codes: [...decision.blocking_codes, 'broker_submit_failed'],
          decision_metadata_json: {
            ...decision.decision_metadata_json,
            broker_submit_error: error.message,
          },
        };
        decisionId = await executionRepository.insertExecutionDecision({
          ...decision,
          intent_id: intentId,
          blocking_codes_json: decision.blocking_codes,
          risk_results_json: decision.risk_results,
        });
        orderId = await executionRepository.insertExecutionOrder({
          decision_id: decisionId,
          broker: 'alpaca',
          broker_order_id: null,
          symbol: brokerOrderRequest.symbol,
          side: brokerOrderRequest.side,
          order_type: brokerOrderRequest.type,
          time_in_force: brokerOrderRequest.time_in_force,
          qty: brokerOrderRequest.qty ?? null,
          notional: brokerOrderRequest.notional ?? null,
          client_order_id: brokerOrderRequest.client_order_id ?? null,
          request_json: brokerOrderRequest,
          response_json: { error: error.message },
          broker_status: 'error',
        });
      }
    } else {
      decisionId = await executionRepository.insertExecutionDecision({
        ...decision,
        intent_id: intentId,
        blocking_codes_json: decision.blocking_codes,
        risk_results_json: decision.risk_results,
      });
    }

    results.push({
      intentId,
      decisionId,
      orderId,
      decisionStatus: decision.decision_status,
    });
  }

  return {
    rawState,
    brokerState: normalizedState,
    snapshotCount: snapshotRows.length,
    results,
  };
}
