/**
 * Flow reply-event bridge samples for Adapty SDK integration tests
 *
 * These reply methods are sent from JS back to native in response to flow-view
 * events (permission answers, observer-mode purchase/restore lifecycle). They are
 * exercised through the flow-view controller / observer flows rather than a direct
 * public `adapty.*` method, so they live here as wire-shape fixtures that also
 * document the exact JSON payloads and keep API coverage complete.
 */

import type { components } from 'types/api';

/**
 * FlowViewDidAnswerPermission request
 */
export const FLOW_VIEW_DID_ANSWER_PERMISSION_REQUEST: components['requests']['FlowViewDidAnswerPermission.Request'] = {
  method: 'flow_view_did_answer_permission',
  event_id: 'event_123',
  status: 'granted',
};

/**
 * ObserverPurchaseDidStart request
 */
export const OBSERVER_PURCHASE_DID_START_REQUEST: components['requests']['ObserverPurchaseDidStart.Request'] = {
  method: 'observer_purchase_did_start',
  event_id: 'event_123',
};

/**
 * ObserverPurchaseDidFinish request
 */
export const OBSERVER_PURCHASE_DID_FINISH_REQUEST: components['requests']['ObserverPurchaseDidFinish.Request'] = {
  method: 'observer_purchase_did_finish',
  event_id: 'event_123',
};

/**
 * ObserverRestoreDidStart request
 */
export const OBSERVER_RESTORE_DID_START_REQUEST: components['requests']['ObserverRestoreDidStart.Request'] = {
  method: 'observer_restore_did_start',
  event_id: 'event_123',
};

/**
 * ObserverRestoreDidFinish request
 */
export const OBSERVER_RESTORE_DID_FINISH_REQUEST: components['requests']['ObserverRestoreDidFinish.Request'] = {
  method: 'observer_restore_did_finish',
  event_id: 'event_123',
};
