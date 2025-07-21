import type { EventHandlers } from './types';
import { AdaptyCapacitorPlugin } from '../../plugin';

type EventName = keyof EventHandlers;

interface CapacitorEventSubscription {
    remove: () => Promise<void>;
}

interface CapacitorEventArg {
  data: string; // JSON string from native
}

interface ParsedEventData {
  view?: {
    id: string;
    placement_id?: string;
    variation_id?: string;
  };
  action?: {
    type: string;
    value?: any;
  };
  product?: any;
  product_id?: string;
  purchased_result?: any;
  error?: any;
  profile?: any;
  id: string;
}

interface CapacitorEventArg {
    data: string; // JSON string from native
}

interface ParsedEventData {
    view?: {
        id: string;
        placement_id?: string;
        variation_id?: string;
    };
    action?: {
        type: string;
        value?: any;
    };
    product?: any;
    product_id?: string;
    purchased_result?: any;
    error?: any;
    profile?: any;
    id: string;
}

export class ViewEmitter {
    private viewId: string;
    private eventListeners: Map<string, CapacitorEventSubscription> = new Map();
    private handlers: Map<
        string,
        {
            handler: EventHandlers[keyof EventHandlers];
            config: (typeof HANDLER_TO_EVENT_CONFIG)[keyof typeof HANDLER_TO_EVENT_CONFIG];
            onRequestClose: () => Promise<void>;
        }[]
    > = new Map();

    constructor(viewId: string) {
        this.viewId = viewId;
    }

    public addListener(
        event: EventName,
        callback: EventHandlers[EventName],
        onRequestClose: () => Promise<void>,
    ): CapacitorEventSubscription {
        const viewId = this.viewId;
        const config = HANDLER_TO_EVENT_CONFIG[event];

        if (!config) {
            throw new Error(`No event config found for handler: ${event}`);
        }

        const handlersForEvent = this.handlers.get(config.nativeEvent) ?? [];
        handlersForEvent.push({
            handler: callback,
            config,
            onRequestClose,
        });
        this.handlers.set(config.nativeEvent, handlersForEvent);

        if (!this.eventListeners.has(config.nativeEvent)) {
            const handlers = this.handlers;
            const subscription = (AdaptyCapacitorPlugin as any).addListener(
                config.nativeEvent,
                function (arg: CapacitorEventArg) {
                    console.log('[ViewEmitter] Received event:', config.nativeEvent, 'data:', arg);

                    // Strict validation: events must come in {data: "json_string"} format
                    if (!arg || typeof arg !== 'object' || !arg.data) {
                        const error = `[ViewEmitter] Invalid event format received. Expected {data: "json_string"}, got: ${JSON.stringify(arg)}`;
                        console.error(error);
                        throw new Error(error);
                    }

                    const rawEventData: string = arg.data;
                    console.log('[ViewEmitter] Extracted raw event data from wrapper:', rawEventData);

                    // Parse JSON string
                    let eventData: ParsedEventData;
                    if (typeof rawEventData === 'string') {
                        try {
                            eventData = JSON.parse(rawEventData) as ParsedEventData;
                            console.log('[ViewEmitter] Parsed JSON event data:', eventData);
                        } catch (error) {
                            const errorMsg = `[ViewEmitter] Failed to parse event data JSON: ${error}. Raw data: ${rawEventData}`;
                            console.error(errorMsg);
                            throw new Error(errorMsg);
                        }
                    } else {
                        const errorMsg = `[ViewEmitter] Expected event data to be JSON string, got ${typeof rawEventData}: ${rawEventData}`;
                        console.error(errorMsg);
                        throw new Error(errorMsg);
                    }

                    const eventViewId = eventData?.view?.id ?? null;
                    if (viewId !== eventViewId) {
                        console.log('[ViewEmitter] Event filtered out - view mismatch:', eventViewId, 'vs', viewId);
                        return;
                    }

                    const eventHandlers = handlers.get(config.nativeEvent) ?? [];
                    for (const { handler, config, onRequestClose } of eventHandlers) {
                        if (
                            config.propertyMap &&
                            eventData?.action?.type !== config.propertyMap['action']
                        ) {
                            console.log('[ViewEmitter] Event filtered out - action mismatch:', eventData?.action?.type, 'vs', config.propertyMap['action']);
                            continue;
                        }

                        const callbackArgs = extractCallbackArgs(
                            config.handlerName,
                            eventData,
                        );
                        console.log('[ViewEmitter] Calling handler:', config.handlerName, 'with args:', callbackArgs);

                        const cb = handler as (...args: typeof callbackArgs) => boolean;
                        try {
                            const shouldClose = cb(...callbackArgs);
                            console.log('[ViewEmitter] Handler result:', shouldClose);

                            if (shouldClose) {
                                console.log('[ViewEmitter] Requesting close due to handler result');
                                onRequestClose().catch((error) => {
                                    console.error('[ViewEmitter] Error during onRequestClose:', error);
                                });
                            }
                        } catch (error) {
                            console.error('[ViewEmitter] Error in event handler:', error);
                        }
                    }
                },
            );
            this.eventListeners.set(config.nativeEvent, subscription);
        }

        return this.eventListeners.get(config.nativeEvent)!;
    }

    public removeAllListeners() {
        console.log('[ViewEmitter] Removing all listeners for view:', this.viewId);
        this.eventListeners.forEach(subscription => {
            subscription.remove().catch((error) => {
                console.warn('[ViewEmitter] Failed to remove listener:', error);
            });
        });
        this.eventListeners.clear();
        this.handlers.clear();
    }
}

type UiEventMapping = {
    [nativeEventId: string]: {
        handlerName: keyof EventHandlers;
        propertyMap?: {
            [key: string]: string;
        };
    }[];
};

/**
 * Mapping of native events to event handlers
 * Each native event can trigger multiple handlers based on action type or other properties
 *
 * Event Flow:
 * 1. Native code sends event (e.g., "paywall_view_did_perform_action")
 * 2. ViewEmitter receives event and checks view ID match
 * 3. For events with propertyMap, filters by action type (e.g., action.type === "close")
 * 4. Calls appropriate handler function
 * 5. If handler returns true, requests paywall close
 */
const UI_EVENT_MAPPINGS: UiEventMapping = {
    // User actions like close button, back button, URL taps, custom actions
    paywall_view_did_perform_action: [
        {
            handlerName: 'onCloseButtonPress' as keyof EventHandlers,
            propertyMap: {
                action: 'close',
            },
        },
        {
            handlerName: 'onAndroidSystemBack' as keyof EventHandlers,
            propertyMap: {
                action: 'system_back',
            },
        },
        {
            handlerName: 'onUrlPress' as keyof EventHandlers,
            propertyMap: {
                action: 'open_url',
            },
        },
        {
            handlerName: 'onCustomAction' as keyof EventHandlers,
            propertyMap: {
                action: 'custom',
            },
        },
    ],

    // Product selection events
    paywall_view_did_select_product: [{ handlerName: 'onProductSelected' as keyof EventHandlers }],

    // Purchase flow events
    paywall_view_did_start_purchase: [{ handlerName: 'onPurchaseStarted' as keyof EventHandlers }],
    paywall_view_did_finish_purchase: [{ handlerName: 'onPurchaseCompleted' as keyof EventHandlers }],
    paywall_view_did_fail_purchase: [{ handlerName: 'onPurchaseFailed' as keyof EventHandlers }],

    // Restore flow events
    paywall_view_did_start_restore: [{ handlerName: 'onRestoreStarted' as keyof EventHandlers }],
    paywall_view_did_finish_restore: [{ handlerName: 'onRestoreCompleted' as keyof EventHandlers }],
    paywall_view_did_fail_restore: [{ handlerName: 'onRestoreFailed' as keyof EventHandlers }],

    // Paywall lifecycle events
    paywall_view_did_appear: [{ handlerName: 'onPaywallShown' as keyof EventHandlers }],
    paywall_view_did_disappear: [{ handlerName: 'onPaywallClosed' as keyof EventHandlers }],

    // Error events
    paywall_view_did_fail_rendering: [{ handlerName: 'onRenderingFailed' as keyof EventHandlers }],
    paywall_view_did_fail_loading_products: [
        { handlerName: 'onLoadingProductsFailed' as keyof EventHandlers },
    ],

    // Web payment events
    paywall_view_did_finish_web_payment_navigation: [
        { handlerName: 'onWebPaymentNavigationFinished' as keyof EventHandlers },
    ],
};

const HANDLER_TO_EVENT_CONFIG: Record<
    EventName,
    {
        nativeEvent: string;
        propertyMap?: { [key: string]: string };
        handlerName: EventName;
    }
> = Object.entries(UI_EVENT_MAPPINGS).reduce(
    (acc, [nativeEvent, mappings]) => {
        mappings.forEach(({ handlerName, propertyMap }) => {
            acc[handlerName] = {
                nativeEvent,
                propertyMap,
                handlerName,
            };
        });
        return acc;
    },
    {} as Record<
        EventName,
        {
            nativeEvent: string;
            propertyMap?: { [key: string]: string };
            handlerName: EventName;
        }
    >,
);

function extractCallbackArgs(
    handlerName: EventName,
    eventArg: ParsedEventData,
) {
    switch (handlerName) {
        case 'onProductSelected':
            return [eventArg.product_id];
        case 'onPurchaseStarted':
            return [eventArg.product];
        case 'onPurchaseCompleted':
            return [eventArg.purchased_result, eventArg.product];
        case 'onPurchaseFailed':
            return [eventArg.error, eventArg.product];
        case 'onRestoreCompleted':
            return [eventArg.profile];
        case 'onRestoreFailed':
        case 'onRenderingFailed':
        case 'onLoadingProductsFailed':
            return [eventArg.error];
        case 'onCustomAction':
        case 'onUrlPress':
            return [eventArg.action?.value];
        case 'onWebPaymentNavigationFinished':
            return [eventArg.product, eventArg.error];
        case 'onCloseButtonPress':
        case 'onAndroidSystemBack':
        case 'onPaywallShown':
        case 'onPaywallClosed':
        case 'onRestoreStarted':
        default:
            return [];
    }
}
