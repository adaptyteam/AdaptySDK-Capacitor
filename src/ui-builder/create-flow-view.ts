import { adapty } from '../adapty-instance';
import type { AdaptyFlow } from '../types';

import { FlowViewController } from './flow-view-controller';
import type { CreateFlowViewParamsInput } from './types';

/**
 * Creates a flow view controller. Use it to further configure a view or present it.
 *
 * @see {@link https://adapty.io/docs/capacitor-present-paywalls | [DOC] Creating a flow view}
 *
 * @param {AdaptyFlow} flow - flow to present (from `adapty.getFlow(...)`).
 * @param {CreateFlowViewParamsInput} [params] - additional params.
 * @returns {Promise<FlowViewController>}
 * @throws {AdaptyError} if the flow has no view configured or view creation fails.
 */
export async function createFlowView(
  flow: AdaptyFlow,
  params: CreateFlowViewParamsInput = {},
): Promise<FlowViewController> {
  return FlowViewController.create(flow, params, adapty);
}
