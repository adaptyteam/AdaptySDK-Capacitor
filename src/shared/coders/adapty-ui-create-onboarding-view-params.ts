import { CreateOnboardingViewParamsInput } from '../../ui-builder/types';
import type { components } from '../types/api';

type Req = components['requests'];
type Serializable = Partial<Pick<Req['AdaptyUICreateOnboardingView.Request'], 'external_urls_presentation'>>;

export class AdaptyUICreateOnboardingViewParamsCoder {
  encode(data: CreateOnboardingViewParamsInput): Serializable {
    const result: Serializable = {};

    if (data.externalUrlsPresentation) {
      result.external_urls_presentation = data.externalUrlsPresentation;
    }

    return result;
  }
}

