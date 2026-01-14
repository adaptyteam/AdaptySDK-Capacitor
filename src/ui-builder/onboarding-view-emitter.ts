import { parseOnboardingEvent } from '../shared/coders/parse-onboarding';
import type { LogContext } from '../shared/logger';
import { OnboardingEventId } from '../shared/types/onboarding-events';
import type { OnboardingEventIdType, ParsedOnboardingEvent } from '../shared/types/onboarding-events';

import { BaseViewEmitter } from './base-view-emitter';
import type { OnboardingEventHandlers } from './types';

type EventName = keyof OnboardingEventHandlers;
type OnboardingNativeEvent = OnboardingEventIdType;

/**
 * OnboardingViewEmitter manages event handlers for onboarding view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class OnboardingViewEmitter extends BaseViewEmitter<
  OnboardingEventHandlers,
  ParsedOnboardingEvent,
  OnboardingNativeEvent
> {
  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedOnboardingEvent {
    const result = parseOnboardingEvent(rawEventData, ctx);
    if (!result) {
      throw new Error('Failed to parse onboarding event');
    }
    return result;
  }

  protected getNativeEventForHandler(event: keyof OnboardingEventHandlers): OnboardingNativeEvent | null {
    return HANDLER_TO_NATIVE_EVENT[event as EventName];
  }

  protected getHandlerForNativeEvent(nativeEvent: OnboardingNativeEvent): keyof OnboardingEventHandlers | null {
    return NATIVE_EVENT_RESOLVER[nativeEvent] ?? null;
  }

  protected extractCallbackArgs(
    handlerName: keyof OnboardingEventHandlers,
    eventData: ParsedOnboardingEvent,
  ): unknown[] {
    return extractCallbackArgs(handlerName as EventName, eventData);
  }

  protected getEventViewId(eventData: ParsedOnboardingEvent): string | null {
    return eventData?.view?.id ?? null;
  }

  protected getEmitterName(): string {
    return 'OnboardingViewEmitter';
  }
}

const HANDLER_TO_NATIVE_EVENT: Record<EventName, OnboardingNativeEvent> = {
  onError: 'onboarding_did_fail_with_error',
  onAnalytics: 'onboarding_on_analytics_action',
  onFinishedLoading: 'onboarding_did_finish_loading',
  onClose: 'onboarding_on_close_action',
  onCustom: 'onboarding_on_custom_action',
  onPaywall: 'onboarding_on_paywall_action',
  onStateUpdated: 'onboarding_on_state_updated_action',
};

const NATIVE_EVENT_RESOLVER: Record<OnboardingNativeEvent, EventName> = {
  onboarding_did_fail_with_error: 'onError',
  onboarding_on_analytics_action: 'onAnalytics',
  onboarding_did_finish_loading: 'onFinishedLoading',
  onboarding_on_close_action: 'onClose',
  onboarding_on_custom_action: 'onCustom',
  onboarding_on_paywall_action: 'onPaywall',
  onboarding_on_state_updated_action: 'onStateUpdated',
};

type ExtractedArgs<T extends keyof OnboardingEventHandlers> = Parameters<OnboardingEventHandlers[T]>;

function extractCallbackArgs<T extends keyof OnboardingEventHandlers>(
  _handlerName: T,
  event: ParsedOnboardingEvent,
): ExtractedArgs<T> {
  switch (event.id) {
    case OnboardingEventId.Close:
    case OnboardingEventId.Custom:
    case OnboardingEventId.Paywall:
      return [event.actionId, event.meta] as ExtractedArgs<T>;

    case OnboardingEventId.StateUpdated:
      return [event.action, event.meta] as ExtractedArgs<T>;

    case OnboardingEventId.FinishedLoading:
      return [event.meta] as ExtractedArgs<T>;

    case OnboardingEventId.Analytics:
      return [
        {
          ...event.event,
          // Add backward compatibility: populate element_id from elementId
          element_id: event.event.elementId,
        },
        event.meta,
      ] as ExtractedArgs<T>;

    case OnboardingEventId.Error:
      return [event.error] as ExtractedArgs<T>;
  }
}
