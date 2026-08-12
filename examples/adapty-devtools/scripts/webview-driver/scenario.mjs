// Built-in scenarios, expressed as the same step strings `wvd do` takes so there is
// only ever one execution path.

/**
 * Activate the SDK, load a flow, present it, read back the locale the native view
 * actually used, then close it via the WebView dismiss button.
 *
 * Two deliberate choices, both learned the hard way in Task 7:
 *
 * 1. The settle after `click:flow-present-btn` is a `sleep`, not a `wait`. There is NO
 *    DOM signal for "the native view is now on screen": #flow-view-locale-value mounts
 *    when FlowController calls setFlowView(view), which happens BEFORE `await
 *    view.present()`. Waiting on it would let the chain go green — and call dismiss() —
 *    while presentation was still in flight, or even if it failed outright.
 * 2. The final assertion is that #flow-view-locale-value disappears, not that the
 *    result banner says so. onDisappeared writes to the banner, and so does the app's
 *    async product-loading failure, so the banner text is a race. The readout unmounts
 *    with flowView, which is deterministic.
 */
function flowScenario({ placement, locale }) {
  return [
    'click:sdk-activate-btn',
    'wait:flow-load-btn',
    ...(placement ? [`set:flow-placement-input=${placement}`] : []),
    ...(locale ? [`set:flow-view-locale-input=${locale}`] : []),
    'click:flow-load-btn',
    'wait:flow-present-btn:enabled',
    'read:flow-name-value',
    'read:flow-config-locale-value',
    'click:flow-present-btn',
    'sleep:3000',
    'read:flow-view-locale-value',
    'click:flow-dismiss-btn',
    'wait:flow-view-locale-value:absent',
  ];
}

const BUILDERS = { flow: flowScenario };

export const SCENARIO_NAMES = Object.keys(BUILDERS);

export function scenarioSteps(name, options = {}) {
  const builder = BUILDERS[name];
  if (!builder) throw new Error(`unknown scenario "${name}" — known: ${SCENARIO_NAMES.join(', ')}`);
  return builder(options);
}
