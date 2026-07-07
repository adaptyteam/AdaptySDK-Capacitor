import {
  FlowEventId,
  HANDLER_TO_NATIVE_EVENT,
  NATIVE_EVENT_RESOLVER,
  extractFlowCallbackArgs,
  filterUndefined,
} from '@adapty/core';
import type { FlowEventIdType, ParsedFlowEvent, FlowPermissionStatus } from '@adapty/core';

import type { Adapty } from '../adapty';
import { parseFlowEvent } from '../coders/parse-flow';
import { Log, LogContext } from '../logger';
import type { components } from '../types/api';

import { BaseViewEmitter } from './base-view-emitter';
import type { FlowEventHandlers } from './types';

type Req = components['requests'];

/**
 * FlowViewEmitter manages event handlers for flow view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 *
 * In addition to the standard synchronous dispatch inherited from
 * {@link BaseViewEmitter}, this emitter handles three asynchronous round-trip
 * events that must reply back to native:
 * - `onRequestPermission` — awaits the async handler, then replies with the status.
 * - `onObserverPurchaseInitiated` — injects start/finish callbacks (observer mode).
 * - `onObserverRestoreInitiated` — injects start/finish callbacks (observer mode).
 */
export class FlowViewEmitter extends BaseViewEmitter<FlowEventHandlers, ParsedFlowEvent, FlowEventIdType> {
  private adapty: Adapty;

  constructor(viewId: string, adapty: Adapty) {
    super(viewId);
    this.adapty = adapty;
  }

  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedFlowEvent {
    const result = parseFlowEvent(rawEventData, ctx);
    if (!result) {
      throw new Error('Failed to parse flow event');
    }
    return result;
  }

  protected getNativeEventForHandler(event: keyof FlowEventHandlers): FlowEventIdType | null {
    return HANDLER_TO_NATIVE_EVENT[event];
  }

  protected getHandlerForNativeEvent(
    nativeEvent: FlowEventIdType,
    eventData: ParsedFlowEvent,
  ): keyof FlowEventHandlers | null {
    return NATIVE_EVENT_RESOLVER[nativeEvent]?.(eventData) ?? null;
  }

  protected extractCallbackArgs(handlerName: keyof FlowEventHandlers, eventData: ParsedFlowEvent): unknown[] {
    return extractFlowCallbackArgs(handlerName, eventData);
  }

  protected getEventViewId(eventData: ParsedFlowEvent): string | null {
    return eventData?.view?.id ?? null;
  }

  protected getEmitterName(): string {
    return 'FlowViewEmitter';
  }

  /**
   * Routes the three asynchronous round-trip events to their dedicated
   * handlers, bypassing the standard synchronous boolean/close dispatch.
   */
  protected override handleSpecialEvent(handlerName: keyof FlowEventHandlers, eventData: ParsedFlowEvent): boolean {
    if (handlerName === 'onRequestPermission' && eventData.id === FlowEventId.DidAskPermission) {
      void this.handlePermissionRequest(eventData);
      return true;
    }
    if (handlerName === 'onObserverPurchaseInitiated' && eventData.id === FlowEventId.ObserverDidInitiatePurchase) {
      this.handleObserverPurchase(eventData);
      return true;
    }
    if (handlerName === 'onObserverRestoreInitiated' && eventData.id === FlowEventId.ObserverDidInitiateRestore) {
      this.handleObserverRestore(eventData);
      return true;
    }
    return false;
  }

  /**
   * Permission is an async round-trip: await the client handler, then reply to
   * native with the resulting status (defaults to `denied` on error/no handler).
   */
  private async handlePermissionRequest(
    event: Extract<ParsedFlowEvent, { id: typeof FlowEventId.DidAskPermission }>,
  ): Promise<void> {
    const handlerData = this.handlers.get('onRequestPermission');
    let status: FlowPermissionStatus = 'denied';
    let detail: string | undefined;
    if (handlerData) {
      try {
        const handler = handlerData.handler as FlowEventHandlers['onRequestPermission'];
        const response = await handler(event.permission, event.customArgs);
        status = response.status;
        detail = response.detail;
      } catch {
        status = 'denied';
      }
    }
    const method = 'flow_view_did_answer_permission';
    const ctx = new LogContext();
    const log = ctx.call({ methodName: method });
    const body = JSON.stringify(
      filterUndefined({
        method,
        event_id: event.eventId,
        status,
        detail,
      } satisfies Req['FlowViewDidAnswerPermission.Request']),
    );
    await this.adapty
      .handleMethodCall(method, body, ctx, log)
      .catch((error) => Log.warn(method, () => `Failed to reply to permission request: ${error}`));
  }

  // Pass a fully-typed request object into `send` so each literal is checked
  // against its own `Req[...]` arm (a `satisfies` on a method-union body cannot
  // narrow, so we type per-call instead).
  private handleObserverPurchase(
    event: Extract<ParsedFlowEvent, { id: typeof FlowEventId.ObserverDidInitiatePurchase }>,
  ): void {
    const handlerData = this.handlers.get('onObserverPurchaseInitiated');
    if (!handlerData) return;
    const send = (body: Req['ObserverPurchaseDidStart.Request'] | Req['ObserverPurchaseDidFinish.Request']) => {
      const ctx = new LogContext();
      const log = ctx.call({ methodName: body.method });
      void this.adapty
        .handleMethodCall(body.method, JSON.stringify(body), ctx, log)
        .catch((error) => Log.warn(body.method, () => `Failed observer purchase signal: ${error}`));
    };
    const handler = handlerData.handler as FlowEventHandlers['onObserverPurchaseInitiated'];
    handler(
      event.product,
      () => send({ method: 'observer_purchase_did_start', event_id: event.eventId }),
      () => send({ method: 'observer_purchase_did_finish', event_id: event.eventId }),
    );
  }

  private handleObserverRestore(
    event: Extract<ParsedFlowEvent, { id: typeof FlowEventId.ObserverDidInitiateRestore }>,
  ): void {
    const handlerData = this.handlers.get('onObserverRestoreInitiated');
    if (!handlerData) return;
    const send = (body: Req['ObserverRestoreDidStart.Request'] | Req['ObserverRestoreDidFinish.Request']) => {
      const ctx = new LogContext();
      const log = ctx.call({ methodName: body.method });
      void this.adapty
        .handleMethodCall(body.method, JSON.stringify(body), ctx, log)
        .catch((error) => Log.warn(body.method, () => `Failed observer restore signal: ${error}`));
    };
    const handler = handlerData.handler as FlowEventHandlers['onObserverRestoreInitiated'];
    handler(
      () => send({ method: 'observer_restore_did_start', event_id: event.eventId }),
      () => send({ method: 'observer_restore_did_finish', event_id: event.eventId }),
    );
  }
}
