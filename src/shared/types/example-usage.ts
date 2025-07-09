import type { components } from './api';
import { 
  isErrorResponse, 
  isSuccessResponse, 
  extractSuccessOrThrow,
  type MethodName,
  type ResponseByMethod,
  type RequestByMethod 
} from './cross-platform-json';

/**
 * Example: Type-safe handling of cross-platform JSON responses
 */

// Example 1: Working with GetPaywall response
async function handleGetPaywallResponse(crossPlatformJson: string) {
  try {
    const response: ResponseByMethod<'get_paywall'> = JSON.parse(crossPlatformJson);
    
    if (isErrorResponse(response)) {
      console.error(`Paywall error: ${response.error.message} (${response.error.adapty_code})`);
      return null;
    }
    
    if (isSuccessResponse(response)) {
      const paywall = response.success;
      console.log(`Loaded paywall: ${paywall.paywall_name} (${paywall.paywall_id})`);
      return paywall;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Failed to parse paywall response:', error);
    return null;
  }
}

// Example 2: Building a request object
function buildGetPaywallRequest(placementId: string): RequestByMethod<'get_paywall'> {
  return {
    method: 'get_paywall',
    placement_id: placementId,
    fetch_policy: {
      type: 'reload_revalidating_cache_data'
    }
  };
}

// Example 3: Generic response handler  
function handleCrossPlatformResponse<M extends MethodName>(
  json: string,
  method: M
): ResponseByMethod<M> {
  try {
    const response: ResponseByMethod<M> = JSON.parse(json);
    return response;
  } catch (error) {
    // Return an error response
    return {
      error: {
        adapty_code: -1,
        message: `Failed to parse response for ${method}: ${error}`
      }
    } as ResponseByMethod<M>;
  }
}

// Example 4: Type-safe error handling
function processProfileResponse(crossPlatformJson: string) {
  const response: ResponseByMethod<'get_profile'> = JSON.parse(crossPlatformJson);
  
  if (isErrorResponse(response)) {
    // TypeScript knows this is AdaptyError
    const { adapty_code, message, detail } = response.error;
    console.error(`Profile error ${adapty_code}: ${message}`, detail);
    return;
  }
  
  if (isSuccessResponse(response)) {
    // TypeScript knows this is AdaptyProfile from schema
    const profile = response.success;
    console.log(`Profile loaded: ${profile.profile_id}`);
    console.log(`Is test user: ${profile.is_test_user}`);
    
    if (profile.paid_access_levels) {
      Object.keys(profile.paid_access_levels).forEach(levelId => {
        const level = profile.paid_access_levels![levelId];
        console.log(`Access level ${levelId}: active=${level.is_active}`);
      });
    }
  }
}

export {
  handleGetPaywallResponse,
  buildGetPaywallRequest,
  handleCrossPlatformResponse,
  processProfileResponse
}; 
