import { parseOnboardingEvent } from '../shared/coders/parse';
import type { LogContext } from '../shared/logger';

import { BaseViewEmitter, type BaseEventConfig } from './base-view-emitter';
import type { OnboardingEventHandlers } from './types';

type EventName = keyof OnboardingEventHandlers;

/**
 * OnboardingViewEmitter manages event handlers for onboarding view events.
 * Each event type can have only one handler - new handlers replace existing ones.
 */
export class OnboardingViewEmitter extends BaseViewEmitter<OnboardingEventHandlers, Record<string, any>> {
  protected getEventConfig(event: keyof OnboardingEventHandlers): BaseEventConfig | undefined {
    return HANDLER_TO_EVENT_CONFIG[event as EventName];
  }

  protected parseEventData(rawEventData: string, ctx: LogContext): Record<string, any> {
    return parseOnboardingEvent(rawEventData, ctx) as Record<string, any>;
  }

  protected getPossibleHandlers(nativeEvent: string): (keyof OnboardingEventHandlers)[] {
    return NATIVE_EVENT_TO_HANDLERS[nativeEvent] || [];
  }

  protected extractCallbackArgs(handlerName: keyof OnboardingEventHandlers, eventData: Record<string, any>): any[] {
    return extractCallbackArgs(handlerName as EventName, eventData);
  }

  protected getEventViewId(eventData: Record<string, any>): string | null {
    return eventData?.view?.id ?? null;
  }

  protected shouldCallHandler(
    _handlerName: keyof OnboardingEventHandlers,
    _config: BaseEventConfig,
    _eventData: Record<string, any>,
  ): boolean {
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

function extractCallbackArgs(handlerName: keyof OnboardingEventHandlers, eventArg: Record<string, any>): any[] {
  const actionId = eventArg['id'] || '';
  const meta = eventArg['meta'];
  const event = eventArg['event'];
  const action = eventArg['action'];

  switch (handlerName) {
    case 'onClose':
    case 'onCustom':
    case 'onPaywall':
      return [actionId, meta];
    case 'onStateUpdated':
      return [action, meta];
    case 'onFinishedLoading':
      return [meta];
    case 'onAnalytics':
      return [event, meta];
    case 'onError':
      return [eventArg['error']];
    default:
      return [];
  }
}
