import type { AdaptyFlow } from '@adapty/capacitor';

/**
 * Summary of the `AdaptyFlow.uiSchema` field added in 4.1.0 — enough to see
 * at a glance that the UI builder schema actually arrives from native.
 */
export function describeFlowUiSchema(uiSchema: AdaptyFlow['uiSchema']): string {
  if (!uiSchema) {
    return '—';
  }

  const layouts = uiSchema.layouts?.length ?? 0;
  const grids = uiSchema.grids?.length ?? 0;

  return `${layouts} layouts / ${grids} grids`;
}
