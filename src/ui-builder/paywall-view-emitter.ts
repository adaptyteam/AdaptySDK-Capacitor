import { parsePaywallEvent } from '../shared/coders/parse-paywall';
import type { LogContext } from '../shared/logger';
import { PaywallEventId } from '../shared/types/paywall-events';
import type { ParsedPaywallEvent, PaywallEventIdType } from '../shared/types/paywall-events';

import { BaseViewEmitter } from './base-view-emitter';
import type { EventHandlers } from './types';

type EventName = keyof EventHandlers;

/**
 * PaywallViewEmitter manages event handlers for paywall view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class PaywallViewEmitter extends BaseViewEmitter<EventHandlers, ParsedPaywallEvent, PaywallEventIdType> {
  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedPaywallEvent {
    const result = parsePaywallEvent(rawEventData, ctx);
    if (!result) {
      throw new Error('Failed to parse paywall event');
    }
    return result;
  }

  protected getNativeEventForHandler(event: keyof EventHandlers): PaywallEventIdType | null {
    return HANDLER_TO_NATIVE_EVENT[event as EventName];
  }

  protected getHandlerForNativeEvent(
    nativeEvent: PaywallEventIdType,
    eventData: ParsedPaywallEvent,
  ): keyof EventHandlers | null {
    const resolver = NATIVE_EVENT_RESOLVER[nativeEvent];
    if (!resolver) {
      return null;
    }
    return resolver(eventData) as keyof EventHandlers | null;
  }

  protected extractCallbackArgs(handlerName: keyof EventHandlers, eventData: ParsedPaywallEvent): unknown[] {
    return extractCallbackArgs(handlerName as EventName, eventData);
  }

  protected getEventViewId(eventData: ParsedPaywallEvent): string | null {
    return eventData?.view?.id ?? null;
  }

  protected getEmitterName(): string {
    return 'PaywallViewEmitter';
  }
}

const NATIVE_EVENT_RESOLVER: Record<PaywallEventIdType, (event: ParsedPaywallEvent) => EventName | null> = {
  [PaywallEventId.DidPerformAction]: (event) => {
    if (event.id !== PaywallEventId.DidPerformAction) {
      return null;
    }

    const actionMap: Record<string, EventName> = {
      close: 'onCloseButtonPress',
      system_back: 'onAndroidSystemBack',
      open_url: 'onUrlPress',
      custom: 'onCustomAction',
    };

    return actionMap[event.action.type] ?? null;
  },
  [PaywallEventId.DidAppear]: () => 'onAppeared',
  [PaywallEventId.DidDisappear]: () => 'onDisappeared',
  [PaywallEventId.DidSelectProduct]: () => 'onProductSelected',
  [PaywallEventId.DidStartPurchase]: () => 'onPurchaseStarted',
  [PaywallEventId.DidFinishPurchase]: () => 'onPurchaseCompleted',
  [PaywallEventId.DidFailPurchase]: () => 'onPurchaseFailed',
  [PaywallEventId.DidStartRestore]: () => 'onRestoreStarted',
  [PaywallEventId.DidFinishRestore]: () => 'onRestoreCompleted',
  [PaywallEventId.DidFailRestore]: () => 'onRestoreFailed',
  [PaywallEventId.DidFailRendering]: () => 'onRenderingFailed',
  [PaywallEventId.DidFailLoadingProducts]: () => 'onLoadingProductsFailed',
  [PaywallEventId.DidFinishWebPaymentNavigation]: () => 'onWebPaymentNavigationFinished',
};

const HANDLER_TO_NATIVE_EVENT: Record<EventName, PaywallEventIdType> = {
  onCloseButtonPress: PaywallEventId.DidPerformAction,
  onAndroidSystemBack: PaywallEventId.DidPerformAction,
  onUrlPress: PaywallEventId.DidPerformAction,
  onCustomAction: PaywallEventId.DidPerformAction,
  onProductSelected: PaywallEventId.DidSelectProduct,
  onPurchaseStarted: PaywallEventId.DidStartPurchase,
  onPurchaseCompleted: PaywallEventId.DidFinishPurchase,
  onPurchaseFailed: PaywallEventId.DidFailPurchase,
  onRestoreStarted: PaywallEventId.DidStartRestore,
  onRestoreCompleted: PaywallEventId.DidFinishRestore,
  onRestoreFailed: PaywallEventId.DidFailRestore,
  onAppeared: PaywallEventId.DidAppear,
  onDisappeared: PaywallEventId.DidDisappear,
  onRenderingFailed: PaywallEventId.DidFailRendering,
  onLoadingProductsFailed: PaywallEventId.DidFailLoadingProducts,
  onWebPaymentNavigationFinished: PaywallEventId.DidFinishWebPaymentNavigation,
};

type ExtractedArgs<T extends keyof EventHandlers> = Parameters<EventHandlers[T]>;

function extractCallbackArgs<T extends keyof EventHandlers>(
  handlerName: T,
  event: ParsedPaywallEvent,
): ExtractedArgs<T> {
  switch (event.id) {
    case PaywallEventId.DidSelectProduct:
      return [event.productId] as ExtractedArgs<T>;

    case PaywallEventId.DidStartPurchase:
      return [event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishPurchase:
      return [event.purchaseResult, event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFailPurchase:
      return [event.error, event.product] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishRestore:
      return [event.profile] as ExtractedArgs<T>;

    case PaywallEventId.DidFailRestore:
    case PaywallEventId.DidFailRendering:
    case PaywallEventId.DidFailLoadingProducts:
      return [event.error] as ExtractedArgs<T>;

    case PaywallEventId.DidPerformAction:
      if (handlerName === 'onUrlPress' || handlerName === 'onCustomAction') {
        return [event.action.value ?? ''] as ExtractedArgs<T>;
      }
      return [] as ExtractedArgs<T>;

    case PaywallEventId.DidFinishWebPaymentNavigation:
      return [event.product, event.error] as unknown as ExtractedArgs<T>;

    case PaywallEventId.DidAppear:
    case PaywallEventId.DidDisappear:
    case PaywallEventId.DidStartRestore:
      return [] as ExtractedArgs<T>;
  }
}
