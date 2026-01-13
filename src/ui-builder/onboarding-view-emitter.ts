import { parseOnboardingEvent } from '../shared/coders/parse-onboarding';
import type { LogContext } from '../shared/logger';
import { OnboardingEventId } from '../shared/types/onboarding-events';
import type { ParsedOnboardingEvent } from '../shared/types/onboarding-events';

import { BaseViewEmitter, type BaseEventConfig } from './base-view-emitter';
import type { OnboardingEventHandlers } from './types';

type EventName = keyof OnboardingEventHandlers;

/**
 * OnboardingViewEmitter manages event handlers for onboarding view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class OnboardingViewEmitter extends BaseViewEmitter<OnboardingEventHandlers, ParsedOnboardingEvent> {
  protected getEventConfig(event: keyof OnboardingEventHandlers): BaseEventConfig | undefined {
    return HANDLER_TO_EVENT_CONFIG[event as EventName];
  }

  protected parseEventData(rawEventData: string, ctx: LogContext): ParsedOnboardingEvent {
    const result = parseOnboardingEvent(rawEventData, ctx);
    if (!result) {
      throw new Error('Failed to parse onboarding event');
    }
    return result;
  }

  protected getPossibleHandlers(nativeEvent: string): (keyof OnboardingEventHandlers)[] {
    return NATIVE_EVENT_TO_HANDLERS[nativeEvent] || [];
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

  protected shouldCallHandler(): boolean {
    // Onboarding events don't use propertyMap filtering
    return true;
  }

  protected getEmitterName(): string {
    return 'OnboardingViewEmitter';
  }
}

type UiEventMapping = {
  [nativeEventId: string]: {
    handlerName: keyof OnboardingEventHandlers;
  }[];
};

const ONBOARDING_EVENT_MAPPINGS: UiEventMapping = {
  onboarding_did_fail_with_error: [{ handlerName: 'onError' }],
  onboarding_on_analytics_action: [{ handlerName: 'onAnalytics' }],
  onboarding_did_finish_loading: [{ handlerName: 'onFinishedLoading' }],
  onboarding_on_close_action: [{ handlerName: 'onClose' }],
  onboarding_on_custom_action: [{ handlerName: 'onCustom' }],
  onboarding_on_paywall_action: [{ handlerName: 'onPaywall' }],
  onboarding_on_state_updated_action: [{ handlerName: 'onStateUpdated' }],
};

const HANDLER_TO_EVENT_CONFIG: Record<
  keyof OnboardingEventHandlers,
  {
    nativeEvent: string;
    handlerName: keyof OnboardingEventHandlers;
  }
> = Object.entries(ONBOARDING_EVENT_MAPPINGS).reduce(
  (acc, [nativeEvent, mappings]) => {
    mappings.forEach(({ handlerName }) => {
      acc[handlerName] = {
        nativeEvent,
        handlerName,
      };
    });
    return acc;
  },
  {} as Record<
    keyof OnboardingEventHandlers,
    {
      nativeEvent: string;
      handlerName: keyof OnboardingEventHandlers;
    }
  >,
);

// Reverse mapping: nativeEvent -> EventName[]
const NATIVE_EVENT_TO_HANDLERS: Record<string, EventName[]> = Object.entries(HANDLER_TO_EVENT_CONFIG).reduce(
  (acc, [handlerName, config]) => {
    if (!acc[config.nativeEvent]) {
      acc[config.nativeEvent] = [];
    }
    acc[config.nativeEvent].push(handlerName as EventName);
    return acc;
  },
  {} as Record<string, EventName[]>,
);

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
