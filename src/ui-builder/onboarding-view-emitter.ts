import { HANDLER_TO_EVENT_CONFIG, NATIVE_EVENT_TO_HANDLERS, extractOnboardingCallbackArgs } from '@adapty/core';

import { parseOnboardingEvent } from '../coders/parse-onboarding';
import type { LogContext } from '../logger';
import type { OnboardingEventIdType, ParsedOnboardingEvent } from '../types/onboarding-events';

import { BaseViewEmitter } from './base-view-emitter';
import type { OnboardingEventHandlers } from './types';

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
    return (HANDLER_TO_EVENT_CONFIG[event]?.nativeEvent as OnboardingNativeEvent | undefined) ?? null;
  }

  protected getHandlerForNativeEvent(nativeEvent: OnboardingNativeEvent): keyof OnboardingEventHandlers | null {
    return NATIVE_EVENT_TO_HANDLERS[nativeEvent]?.[0] ?? null;
  }

  protected extractCallbackArgs(
    handlerName: keyof OnboardingEventHandlers,
    eventData: ParsedOnboardingEvent,
  ): unknown[] {
    return extractOnboardingCallbackArgs(handlerName, eventData);
  }

  protected getEventViewId(eventData: ParsedOnboardingEvent): string | null {
    return eventData?.view?.id ?? null;
  }

  protected getEmitterName(): string {
    return 'OnboardingViewEmitter';
  }
}
