# @adapty/capacitor

Official Adapty SDK for Capacitor

## Install

```bash
npm install @adapty/capacitor
npx cap sync
```

## API

<docgen-index>

* [`activate(...)`](#activate)
* [`getPaywall(...)`](#getpaywall)
* [`getPaywallForDefaultAudience(...)`](#getpaywallfordefaultaudience)
* [`getPaywallProducts(...)`](#getpaywallproducts)
* [`getOnboarding(...)`](#getonboarding)
* [`getOnboardingForDefaultAudience(...)`](#getonboardingfordefaultaudience)
* [`getProfile()`](#getprofile)
* [`identify(...)`](#identify)
* [`logShowPaywall(...)`](#logshowpaywall)
* [`openWebPaywall(...)`](#openwebpaywall)
* [`createWebPaywallUrl(...)`](#createwebpaywallurl)
* [`logout()`](#logout)
* [`makePurchase(...)`](#makepurchase)
* [`presentCodeRedemptionSheet()`](#presentcoderedemptionsheet)
* [`reportTransaction(...)`](#reporttransaction)
* [`restorePurchases()`](#restorepurchases)
* [`setFallback(...)`](#setfallback)
* [`setIntegrationIdentifier(...)`](#setintegrationidentifier)
* [`setLogLevel(...)`](#setloglevel)
* [`updateAttribution(...)`](#updateattribution)
* [`updateCollectingRefundDataConsent(...)`](#updatecollectingrefunddataconsent)
* [`updateRefundPreference(...)`](#updaterefundpreference)
* [`updateProfile(...)`](#updateprofile)
* [`isActivated()`](#isactivated)
* [`getCurrentInstallationStatus()`](#getcurrentinstallationstatus)
* [`addListener(...)`](#addlistener)
* [`removeAllListeners()`](#removealllisteners)
* [Interfaces](#interfaces)
* [Type Aliases](#type-aliases)

</docgen-index>

<docgen-api>
<!--Update the source file JSDoc comments and rerun docgen to update the docs below-->

### activate(...)

```typescript
activate(options: { apiKey: string; params?: ActivateParamsInput; }) => Promise<void>
```

Initializes the Adapty SDK. This method must be called in order for the SDK to work.

| Param         | Type                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ apiKey: string; params?: <a href="#activateparamsinput">ActivateParamsInput</a>; }</code> |

--------------------


### getPaywall(...)

```typescript
getPaywall(options: { placementId: string; locale?: string; params?: GetPlacementParamsInput; }) => Promise<AdaptyPaywall>
```

Gets a paywall by placement ID

| Param         | Type                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ placementId: string; locale?: string; params?: <a href="#getplacementparamsinput">GetPlacementParamsInput</a>; }</code> |

**Returns:** <code>Promise&lt;<a href="#adaptypaywall">AdaptyPaywall</a>&gt;</code>

--------------------


### getPaywallForDefaultAudience(...)

```typescript
getPaywallForDefaultAudience(options: { placementId: string; locale?: string; params?: GetPlacementForDefaultAudienceParamsInput; }) => Promise<AdaptyPaywall>
```

Gets a paywall for default audience by placement ID

| Param         | Type                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ placementId: string; locale?: string; params?: <a href="#getplacementfordefaultaudienceparamsinput">GetPlacementForDefaultAudienceParamsInput</a>; }</code> |

**Returns:** <code>Promise&lt;<a href="#adaptypaywall">AdaptyPaywall</a>&gt;</code>

--------------------


### getPaywallProducts(...)

```typescript
getPaywallProducts(options: { paywall: AdaptyPaywall; }) => Promise<AdaptyPaywallProduct[]>
```

Gets products for a specific paywall

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ paywall: <a href="#adaptypaywall">AdaptyPaywall</a>; }</code> |

**Returns:** <code>Promise&lt;AdaptyPaywallProduct[]&gt;</code>

--------------------


### getOnboarding(...)

```typescript
getOnboarding(options: { placementId: string; locale?: string; params?: GetPlacementParamsInput; }) => Promise<AdaptyOnboarding>
```

Gets an onboarding by placement ID

| Param         | Type                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ placementId: string; locale?: string; params?: <a href="#getplacementparamsinput">GetPlacementParamsInput</a>; }</code> |

**Returns:** <code>Promise&lt;<a href="#adaptyonboarding">AdaptyOnboarding</a>&gt;</code>

--------------------


### getOnboardingForDefaultAudience(...)

```typescript
getOnboardingForDefaultAudience(options: { placementId: string; locale?: string; params?: GetPlacementForDefaultAudienceParamsInput; }) => Promise<AdaptyOnboarding>
```

Gets an onboarding for default audience by placement ID

| Param         | Type                                                                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ placementId: string; locale?: string; params?: <a href="#getplacementfordefaultaudienceparamsinput">GetPlacementForDefaultAudienceParamsInput</a>; }</code> |

**Returns:** <code>Promise&lt;<a href="#adaptyonboarding">AdaptyOnboarding</a>&gt;</code>

--------------------


### getProfile()

```typescript
getProfile() => Promise<AdaptyProfile>
```

Gets the current user profile

**Returns:** <code>Promise&lt;<a href="#adaptyprofile">AdaptyProfile</a>&gt;</code>

--------------------


### identify(...)

```typescript
identify(options: { customerUserId: string; }) => Promise<void>
```

Identifies the user with a customer user ID

| Param         | Type                                     |
| ------------- | ---------------------------------------- |
| **`options`** | <code>{ customerUserId: string; }</code> |

--------------------


### logShowPaywall(...)

```typescript
logShowPaywall(options: { paywall: AdaptyPaywall; }) => Promise<void>
```

Logs that a paywall was shown to the user

| Param         | Type                                                                  |
| ------------- | --------------------------------------------------------------------- |
| **`options`** | <code>{ paywall: <a href="#adaptypaywall">AdaptyPaywall</a>; }</code> |

--------------------


### openWebPaywall(...)

```typescript
openWebPaywall(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct; }) => Promise<void>
```

Opens a web paywall

| Param         | Type                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`options`** | <code>{ paywallOrProduct: <a href="#adaptypaywall">AdaptyPaywall</a> \| <a href="#adaptypaywallproduct">AdaptyPaywallProduct</a>; }</code> |

--------------------


### createWebPaywallUrl(...)

```typescript
createWebPaywallUrl(options: { paywallOrProduct: AdaptyPaywall | AdaptyPaywallProduct; }) => Promise<string>
```

Creates a URL for web paywall

| Param         | Type                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **`options`** | <code>{ paywallOrProduct: <a href="#adaptypaywall">AdaptyPaywall</a> \| <a href="#adaptypaywallproduct">AdaptyPaywallProduct</a>; }</code> |

**Returns:** <code>Promise&lt;string&gt;</code>

--------------------




### logout()

```typescript
logout() => Promise<void>
```

Logs out the current user

--------------------


### makePurchase(...)

```typescript
makePurchase(options: { product: AdaptyPaywallProduct; params?: MakePurchaseParamsInput; }) => Promise<AdaptyPurchaseResult>
```

Makes a purchase of a product

| Param         | Type                                                                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`options`** | <code>{ product: <a href="#adaptypaywallproduct">AdaptyPaywallProduct</a>; params?: <a href="#makepurchaseparamsinput">MakePurchaseParamsInput</a>; }</code> |

**Returns:** <code>Promise&lt;<a href="#adaptypurchaseresult">AdaptyPurchaseResult</a>&gt;</code>

--------------------


### presentCodeRedemptionSheet()

```typescript
presentCodeRedemptionSheet() => Promise<void>
```

Presents code redemption sheet (iOS only)

--------------------


### reportTransaction(...)

```typescript
reportTransaction(options: { transactionId: string; variationId?: string; }) => Promise<void>
```

Reports a transaction to Adapty

| Param         | Type                                                          |
| ------------- | ------------------------------------------------------------- |
| **`options`** | <code>{ transactionId: string; variationId?: string; }</code> |

--------------------


### restorePurchases()

```typescript
restorePurchases() => Promise<AdaptyProfile>
```

Restores user purchases

**Returns:** <code>Promise&lt;<a href="#adaptyprofile">AdaptyProfile</a>&gt;</code>

--------------------


### setFallback(...)

```typescript
setFallback(options: { fileLocation: FileLocation; }) => Promise<void>
```

Sets fallback paywalls from a file

| Param         | Type                                                                     |
| ------------- | ------------------------------------------------------------------------ |
| **`options`** | <code>{ fileLocation: <a href="#filelocation">FileLocation</a>; }</code> |

--------------------




### setIntegrationIdentifier(...)

```typescript
setIntegrationIdentifier(options: { key: string; value: string; }) => Promise<void>
```

Sets an integration identifier

| Param         | Type                                         |
| ------------- | -------------------------------------------- |
| **`options`** | <code>{ key: string; value: string; }</code> |

--------------------


### setLogLevel(...)

```typescript
setLogLevel(options: { logLevel?: LogLevel; logger?: LoggerConfig; }) => Promise<void>
```

Sets the log level for the SDK or configures JS logger sinks

| Param         | Type                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ logLevel?: <a href="#loglevel">LogLevel</a>; logger?: <a href="#loggerconfig">LoggerConfig</a>; }</code> |

--------------------


### updateAttribution(...)

```typescript
updateAttribution(options: { attribution: Record<string, any>; source: string; }) => Promise<void>
```

Updates attribution data for the current user

| Param         | Type                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| **`options`** | <code>{ attribution: <a href="#record">Record</a>&lt;string, any&gt;; source: string; }</code> |

--------------------


### updateCollectingRefundDataConsent(...)

```typescript
updateCollectingRefundDataConsent(options: { consent: boolean; }) => Promise<void>
```

Updates collecting refund data consent (iOS only)

| Param         | Type                               |
| ------------- | ---------------------------------- |
| **`options`** | <code>{ consent: boolean; }</code> |

--------------------


### updateRefundPreference(...)

```typescript
updateRefundPreference(options: { refundPreference: RefundPreference; }) => Promise<void>
```

Updates refund preference (iOS only)

| Param         | Type                                       |
| ------------- | ------------------------------------------ |
| **`options`** | <code>{ refundPreference: string; }</code> |

--------------------


### updateProfile(...)

```typescript
updateProfile(options: { params: Partial<AdaptyProfileParameters>; }) => Promise<void>
```

Updates the user profile

| Param         | Type                                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`options`** | <code>{ params: <a href="#partial">Partial</a>&lt;<a href="#adaptyprofileparameters">AdaptyProfileParameters</a>&gt;; }</code> |

--------------------


### isActivated()

```typescript
isActivated() => Promise<boolean>
```

Checks if the SDK is activated

**Returns:** <code>Promise&lt;boolean&gt;</code>

--------------------


### getCurrentInstallationStatus()

```typescript
getCurrentInstallationStatus() => Promise<AdaptyInstallationStatus>
```

Gets the current installation status

**Returns:** <code>Promise&lt;<a href="#adaptyinstallationstatus">AdaptyInstallationStatus</a>&gt;</code>

--------------------


### addListener(...)

```typescript
addListener<T extends keyof EventPayloadMap>(eventName: T, listenerFunc: (data: EventPayloadMap[T]) => void) => Promise<PluginListenerHandle>
```

Adds a strongly-typed event listener

Supported events:
- onLatestProfileLoad → { profile: AdaptyProfile }
- onInstallationDetailsSuccess → { details: AdaptyInstallationDetails }
- onInstallationDetailsFail → { error: AdaptyError }

| Param              | Type                                                     |
| ------------------ | -------------------------------------------------------- |
| **`eventName`**    | <code>T extends keyof EventPayloadMap</code>            |
| **`listenerFunc`** | <code>(data: EventPayloadMap[T]) =&gt; void</code>      |

**Returns:** <code>Promise&lt;<a href="#pluginlistenerhandle">PluginListenerHandle</a>&gt;</code>

--------------------


### removeAllListeners()

```typescript
removeAllListeners() => Promise<void>
```

Removes all listeners

--------------------


### Interfaces


#### AdaptyPaywall

Describes an object that represents a paywall.
Used in {@link Adapty.getPaywall} method.

| Prop                       | Type                                                                  | Description                                                                          |
| -------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **`placement`**            | <code><a href="#adaptyplacement">AdaptyPlacement</a></code>           |                                                                                      |
| **`hasViewConfiguration`** | <code>boolean</code>                                                  | If `true`, it is possible to fetch the view object and use it with AdaptyUI library. |
| **`name`**                 | <code>string</code>                                                   | A paywall name.                                                                      |
| **`remoteConfig`**         | <code><a href="#adaptyremoteconfig">AdaptyRemoteConfig</a></code>     | A remote config configured in Adapty Dashboard for this paywall.                     |
| **`variationId`**          | <code>string</code>                                                   | An identifier of a variation, used to attribute purchases to this paywall.           |
| **`products`**             | <code>ProductReference[]</code>                                       | Array of initial products info                                                       |
| **`id`**                   | <code>string</code>                                                   |                                                                                      |
| **`version`**              | <code>number</code>                                                   |                                                                                      |
| **`webPurchaseUrl`**       | <code>string</code>                                                   |                                                                                      |
| **`payloadData`**          | <code>string</code>                                                   |                                                                                      |
| **`paywallBuilder`**       | <code><a href="#adaptypaywallbuilder">AdaptyPaywallBuilder</a></code> |                                                                                      |


#### AdaptyPlacement

| Prop                      | Type                 | Description                                                                                    |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| **`abTestName`**          | <code>string</code>  | Parent A/B test name.                                                                          |
| **`audienceName`**        | <code>string</code>  | A name of an audience to which the paywall belongs.                                            |
| **`id`**                  | <code>string</code>  | ID of a placement configured in Adapty Dashboard.                                              |
| **`revision`**            | <code>number</code>  | Current revision (version) of a paywall. Every change within a paywall creates a new revision. |
| **`isTrackingPurchases`** | <code>boolean</code> |                                                                                                |
| **`audienceVersionId`**   | <code>string</code>  |                                                                                                |


#### AdaptyRemoteConfig

Describes an object that represents a remote config of a paywall.

| Prop             | Type                                                         | Description                                                           |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| **`lang`**       | <code>string</code>                                          | Identifier of a paywall locale.                                       |
| **`data`**       | <code><a href="#record">Record</a>&lt;string, any&gt;</code> | A custom dictionary configured in Adapty Dashboard for this paywall.  |
| **`dataString`** | <code>string</code>                                          | A custom JSON string configured in Adapty Dashboard for this paywall. |


#### ProductReference

| Prop           | Type                                                                   |
| -------------- | ---------------------------------------------------------------------- |
| **`vendorId`** | <code>string</code>                                                    |
| **`adaptyId`** | <code>string</code>                                                    |
| **`ios`**      | <code>{ promotionalOfferId?: string; winBackOfferId?: string; }</code> |
| **`android`**  | <code>{ basePlanId?: string; offerId?: string; }</code>                |


#### AdaptyPaywallBuilder

| Prop       | Type                |
| ---------- | ------------------- |
| **`id`**   | <code>string</code> |
| **`lang`** | <code>string</code> |


#### AdaptyPaywallProduct

Describes an object that represents a product.
Used in {@link Adapty.getPaywallProducts} method and in {@link Adapty.makePurchase} method.

| Prop                       | Type                                                                            | Description                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **`localizedDescription`** | <code>string</code>                                                             | A description of the product.                                                                    |
| **`regionCode`**           | <code>string</code>                                                             | The region code of the locale used to format the price of the product. ISO 3166 ALPHA-2 (US, DE) |
| **`localizedTitle`**       | <code>string</code>                                                             | The name of the product.                                                                         |
| **`paywallABTestName`**    | <code>string</code>                                                             | Same as `abTestName` property of the parent {@link <a href="#adaptypaywall">AdaptyPaywall</a>}.  |
| **`paywallName`**          | <code>string</code>                                                             | Same as `name` property of the parent {@link <a href="#adaptypaywall">AdaptyPaywall</a>}.        |
| **`price`**                | <code><a href="#adaptyprice">AdaptyPrice</a></code>                             | The cost of the product in the local currency                                                    |
| **`adaptyId`**             | <code>string</code>                                                             |                                                                                                  |
| **`variationId`**          | <code>string</code>                                                             | Same as `variationId` property of the parent {@link <a href="#adaptypaywall">AdaptyPaywall</a>}. |
| **`vendorProductId`**      | <code>string</code>                                                             | Unique identifier of a product from App Store Connect or Google Play Console                     |
| **`paywallProductIndex`**  | <code>number</code>                                                             |                                                                                                  |
| **`webPurchaseUrl`**       | <code>string</code>                                                             |                                                                                                  |
| **`payloadData`**          | <code>string</code>                                                             |                                                                                                  |
| **`subscription`**         | <code><a href="#adaptysubscriptiondetails">AdaptySubscriptionDetails</a></code> |                                                                                                  |
| **`ios`**                  | <code>{ readonly isFamilyShareable: boolean; }</code>                           |                                                                                                  |


#### AdaptyPrice

| Prop                  | Type                | Description                                                                                                                           |
| --------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **`amount`**          | <code>number</code> | Price as number                                                                                                                       |
| **`currencyCode`**    | <code>string</code> | The currency code of the locale used to format the price of the product. The ISO 4217 (USD, EUR).                                     |
| **`currencySymbol`**  | <code>string</code> | The currency symbol of the locale used to format the price of the product. ($, €).                                                    |
| **`localizedString`** | <code>string</code> | A price’s language is determined by the preferred language set on the device. On Android, the formatted price from Google Play as is. |


#### AdaptySubscriptionDetails

| Prop                              | Type                                                                             | Description                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`subscriptionPeriod`**          | <code><a href="#adaptysubscriptionperiod">AdaptySubscriptionPeriod</a></code>    | The period details for products that are subscriptions. Will be `null` for iOS version below 11.2 and macOS version below 10.14.4. |
| **`localizedSubscriptionPeriod`** | <code>string</code>                                                              | The period’s language is determined by the preferred language set on the device.                                                   |
| **`offer`**                       | <code><a href="#adaptysubscriptionoffer">AdaptySubscriptionOffer</a></code>      | A subscription offer if available for the auto-renewable subscription.                                                             |
| **`ios`**                         | <code>{ subscriptionGroupIdentifier?: string; }</code>                           |                                                                                                                                    |
| **`android`**                     | <code>{ basePlanId: string; renewalType?: 'prepaid' \| 'autorenewable'; }</code> |                                                                                                                                    |


#### AdaptySubscriptionPeriod

An object containing information about a subscription period.

| Prop                | Type                                                    | Description                                                |
| ------------------- | ------------------------------------------------------- | ---------------------------------------------------------- |
| **`numberOfUnits`** | <code>number</code>                                     | A number of period units.                                  |
| **`unit`**          | <code><a href="#productperiod">ProductPeriod</a></code> | A unit of time that a subscription period is specified in. |


#### AdaptySubscriptionOffer

Subscription offer model to products

| Prop             | Type                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| **`identifier`** | <code><a href="#adaptysubscriptionofferid">AdaptySubscriptionOfferId</a></code> |
| **`phases`**     | <code>AdaptyDiscountPhase[]</code>                                              |
| **`android`**    | <code>{ offerTags?: string[]; }</code>                                          |


#### AdaptyDiscountPhase

Discount model to products

| Prop                              | Type                                                                          | Description                                                        |
| --------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **`localizedNumberOfPeriods`**    | <code>string</code>                                                           | A formatted number of periods of a discount for a user’s locale.   |
| **`localizedSubscriptionPeriod`** | <code>string</code>                                                           | A formatted subscription period of a discount for a user’s locale. |
| **`numberOfPeriods`**             | <code>number</code>                                                           | A number of periods this product discount is available.            |
| **`price`**                       | <code><a href="#adaptyprice">AdaptyPrice</a></code>                           | Discount price of a product in a local currency.                   |
| **`subscriptionPeriod`**          | <code><a href="#adaptysubscriptionperiod">AdaptySubscriptionPeriod</a></code> | An information about period for a product discount.                |
| **`paymentMode`**                 | <code><a href="#offertype">OfferType</a></code>                               | A payment mode for this product discount.                          |


#### AdaptyOnboarding

| Prop                       | Type                                                                        | Description                                                                          |
| -------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **`placement`**            | <code><a href="#adaptyplacement">AdaptyPlacement</a></code>                 |                                                                                      |
| **`hasViewConfiguration`** | <code>boolean</code>                                                        | If `true`, it is possible to fetch the view object and use it with AdaptyUI library. |
| **`name`**                 | <code>string</code>                                                         | A paywall name.                                                                      |
| **`remoteConfig`**         | <code><a href="#adaptyremoteconfig">AdaptyRemoteConfig</a></code>           | A remote config configured in Adapty Dashboard for this paywall.                     |
| **`variationId`**          | <code>string</code>                                                         | An identifier of a variation, used to attribute purchases to this paywall.           |
| **`id`**                   | <code>string</code>                                                         |                                                                                      |
| **`version`**              | <code>number</code>                                                         |                                                                                      |
| **`payloadData`**          | <code>string</code>                                                         |                                                                                      |
| **`onboardingBuilder`**    | <code><a href="#adaptyonboardingbuilder">AdaptyOnboardingBuilder</a></code> |                                                                                      |


#### AdaptyOnboardingBuilder

| Prop       | Type                |
| ---------- | ------------------- |
| **`url`**  | <code>string</code> |
| **`lang`** | <code>string</code> |


#### AdaptyProfile

Interface representing a user profile in Adapty,
including details about the user's subscriptions and consumable products.

| Prop                   | Type                                                                                                          | Description                                                                                                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`accessLevels`**     | <code><a href="#record">Record</a>&lt;string, <a href="#adaptyaccesslevel">AdaptyAccessLevel</a>&gt;</code>   | Object that maps access level identifiers (configured by you in Adapty Dashboard) to the corresponding access level details. The value can be `null` if the user does not have any access levels. |
| **`customAttributes`** | <code><a href="#record">Record</a>&lt;string, any&gt;</code>                                                  | Object representing custom attributes set for the user using the {@link Adapty.updateProfile} method.                                                                                             |
| **`customerUserId`**   | <code>string</code>                                                                                           | The identifier for a user in your system.                                                                                                                                                         |
| **`nonSubscriptions`** | <code><a href="#record">Record</a>&lt;string, AdaptyNonSubscription[]&gt;</code>                              | Object that maps product ids from the store to an array of information about the user's non-subscription purchases. The value can be `null` if the user does not have any purchases.              |
| **`profileId`**        | <code>string</code>                                                                                           | The identifier for a user in Adapty.                                                                                                                                                              |
| **`subscriptions`**    | <code><a href="#record">Record</a>&lt;string, <a href="#adaptysubscription">AdaptySubscription</a>&gt;</code> | Object that maps product ids from a store to information about the user's subscriptions. The value can be `null` if the user does not have any subscriptions.                                     |


#### AdaptyAccessLevel

Interface representing access level details of a user.

| Prop                              | Type                                                              | Description                                                                      |
| --------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **`activatedAt`**                 | <code><a href="#date">Date</a></code>                             | The date and time when the access level was activated.                           |
| **`activeIntroductoryOfferType`** | <code><a href="#offertype">OfferType</a></code>                   | Type of active introductory offer, if any.                                       |
| **`activePromotionalOfferId`**    | <code>string</code>                                               | Identifier of the active promotional offer, if any.                              |
| **`activePromotionalOfferType`**  | <code><a href="#offertype">OfferType</a></code>                   | Type of the active promotional offer, if any.                                    |
| **`billingIssueDetectedAt`**      | <code><a href="#date">Date</a></code>                             | The date and time when a billing issue was detected.                             |
| **`cancellationReason`**          | <code><a href="#cancellationreason">CancellationReason</a></code> | The reason for the cancellation of the subscription.                             |
| **`expiresAt`**                   | <code><a href="#date">Date</a></code>                             | The expiration date of the access level, if applicable.                          |
| **`id`**                          | <code>string</code>                                               | Unique identifier of the access level configured by you in Adapty Dashboard.     |
| **`isActive`**                    | <code>boolean</code>                                              | Flag indicating whether the access level is currently active.                    |
| **`isInGracePeriod`**             | <code>boolean</code>                                              | Flag indicating whether this auto-renewable subscription is in the grace period. |
| **`isLifetime`**                  | <code>boolean</code>                                              | Flag indicating whether this access level is active for a lifetime.              |
| **`isRefund`**                    | <code>boolean</code>                                              | Flag indicating whether this purchase was refunded.                              |
| **`renewedAt`**                   | <code><a href="#date">Date</a></code>                             | The date and time when the access level was renewed.                             |
| **`startsAt`**                    | <code><a href="#date">Date</a></code>                             | The start date of this access level.                                             |
| **`store`**                       | <code><a href="#vendorstore">VendorStore</a></code>               | The store where the purchase that unlocked this access level was made.           |
| **`unsubscribedAt`**              | <code><a href="#date">Date</a></code>                             | The date and time when the auto-renewable subscription was cancelled.            |
| **`vendorProductId`**             | <code>string</code>                                               | The identifier of the product in the store that unlocked this access level.      |
| **`willRenew`**                   | <code>boolean</code>                                              | Flag indicating whether this auto-renewable subscription is set to renew.        |
| **`android`**                     | <code>{ offerId?: string; }</code>                                |                                                                                  |


#### Date

Enables basic storage and retrieval of dates and times.

| Method                 | Signature                                                                                                    | Description                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **toString**           | () =&gt; string                                                                                              | Returns a string representation of a date. The format of the string depends on the locale.                                              |
| **toDateString**       | () =&gt; string                                                                                              | Returns a date as a string value.                                                                                                       |
| **toTimeString**       | () =&gt; string                                                                                              | Returns a time as a string value.                                                                                                       |
| **toLocaleString**     | () =&gt; string                                                                                              | Returns a value as a string value appropriate to the host environment's current locale.                                                 |
| **toLocaleDateString** | () =&gt; string                                                                                              | Returns a date as a string value appropriate to the host environment's current locale.                                                  |
| **toLocaleTimeString** | () =&gt; string                                                                                              | Returns a time as a string value appropriate to the host environment's current locale.                                                  |
| **valueOf**            | () =&gt; number                                                                                              | Returns the stored time value in milliseconds since midnight, January 1, 1970 UTC.                                                      |
| **getTime**            | () =&gt; number                                                                                              | Gets the time value in milliseconds.                                                                                                    |
| **getFullYear**        | () =&gt; number                                                                                              | Gets the year, using local time.                                                                                                        |
| **getUTCFullYear**     | () =&gt; number                                                                                              | Gets the year using Universal Coordinated Time (UTC).                                                                                   |
| **getMonth**           | () =&gt; number                                                                                              | Gets the month, using local time.                                                                                                       |
| **getUTCMonth**        | () =&gt; number                                                                                              | Gets the month of a <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                             |
| **getDate**            | () =&gt; number                                                                                              | Gets the day-of-the-month, using local time.                                                                                            |
| **getUTCDate**         | () =&gt; number                                                                                              | Gets the day-of-the-month, using Universal Coordinated Time (UTC).                                                                      |
| **getDay**             | () =&gt; number                                                                                              | Gets the day of the week, using local time.                                                                                             |
| **getUTCDay**          | () =&gt; number                                                                                              | Gets the day of the week using Universal Coordinated Time (UTC).                                                                        |
| **getHours**           | () =&gt; number                                                                                              | Gets the hours in a date, using local time.                                                                                             |
| **getUTCHours**        | () =&gt; number                                                                                              | Gets the hours value in a <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                       |
| **getMinutes**         | () =&gt; number                                                                                              | Gets the minutes of a <a href="#date">Date</a> object, using local time.                                                                |
| **getUTCMinutes**      | () =&gt; number                                                                                              | Gets the minutes of a <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                           |
| **getSeconds**         | () =&gt; number                                                                                              | Gets the seconds of a <a href="#date">Date</a> object, using local time.                                                                |
| **getUTCSeconds**      | () =&gt; number                                                                                              | Gets the seconds of a <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                           |
| **getMilliseconds**    | () =&gt; number                                                                                              | Gets the milliseconds of a <a href="#date">Date</a>, using local time.                                                                  |
| **getUTCMilliseconds** | () =&gt; number                                                                                              | Gets the milliseconds of a <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                      |
| **getTimezoneOffset**  | () =&gt; number                                                                                              | Gets the difference in minutes between the time on the local computer and Universal Coordinated Time (UTC).                             |
| **setTime**            | (time: number) =&gt; number                                                                                  | Sets the date and time value in the <a href="#date">Date</a> object.                                                                    |
| **setMilliseconds**    | (ms: number) =&gt; number                                                                                    | Sets the milliseconds value in the <a href="#date">Date</a> object using local time.                                                    |
| **setUTCMilliseconds** | (ms: number) =&gt; number                                                                                    | Sets the milliseconds value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                              |
| **setSeconds**         | (sec: number, ms?: number \| undefined) =&gt; number                                                         | Sets the seconds value in the <a href="#date">Date</a> object using local time.                                                         |
| **setUTCSeconds**      | (sec: number, ms?: number \| undefined) =&gt; number                                                         | Sets the seconds value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                   |
| **setMinutes**         | (min: number, sec?: number \| undefined, ms?: number \| undefined) =&gt; number                              | Sets the minutes value in the <a href="#date">Date</a> object using local time.                                                         |
| **setUTCMinutes**      | (min: number, sec?: number \| undefined, ms?: number \| undefined) =&gt; number                              | Sets the minutes value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                   |
| **setHours**           | (hours: number, min?: number \| undefined, sec?: number \| undefined, ms?: number \| undefined) =&gt; number | Sets the hour value in the <a href="#date">Date</a> object using local time.                                                            |
| **setUTCHours**        | (hours: number, min?: number \| undefined, sec?: number \| undefined, ms?: number \| undefined) =&gt; number | Sets the hours value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                     |
| **setDate**            | (date: number) =&gt; number                                                                                  | Sets the numeric day-of-the-month value of the <a href="#date">Date</a> object using local time.                                        |
| **setUTCDate**         | (date: number) =&gt; number                                                                                  | Sets the numeric day of the month in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                        |
| **setMonth**           | (month: number, date?: number \| undefined) =&gt; number                                                     | Sets the month value in the <a href="#date">Date</a> object using local time.                                                           |
| **setUTCMonth**        | (month: number, date?: number \| undefined) =&gt; number                                                     | Sets the month value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                     |
| **setFullYear**        | (year: number, month?: number \| undefined, date?: number \| undefined) =&gt; number                         | Sets the year of the <a href="#date">Date</a> object using local time.                                                                  |
| **setUTCFullYear**     | (year: number, month?: number \| undefined, date?: number \| undefined) =&gt; number                         | Sets the year value in the <a href="#date">Date</a> object using Universal Coordinated Time (UTC).                                      |
| **toUTCString**        | () =&gt; string                                                                                              | Returns a date converted to a string using Universal Coordinated Time (UTC).                                                            |
| **toISOString**        | () =&gt; string                                                                                              | Returns a date as a string value in ISO format.                                                                                         |
| **toJSON**             | (key?: any) =&gt; string                                                                                     | Used by the JSON.stringify method to enable the transformation of an object's data for JavaScript Object Notation (JSON) serialization. |


#### AdaptyNonSubscription

Interface representing a consumable or non-subscription purchase made by the user.

| Prop                      | Type                                                | Description                                                                                                                                             |
| ------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`isConsumable`**        | <code>boolean</code>                                | Flag indicating whether the product is consumable.                                                                                                      |
| **`isRefund`**            | <code>boolean</code>                                | Flag indicating whether the purchase was refunded.                                                                                                      |
| **`isSandbox`**           | <code>boolean</code>                                | Flag indicating whether the product was purchased in a sandbox environment.                                                                             |
| **`purchasedAt`**         | <code><a href="#date">Date</a></code>               | The date and time when the purchase was made.                                                                                                           |
| **`vendorProductId`**     | <code>string</code>                                 | The identifier of the product in the store that was purchased.                                                                                          |
| **`vendorTransactionId`** | <code>string</code>                                 | The identifier of the product in the store that was purchased.                                                                                          |
| **`store`**               | <code><a href="#vendorstore">VendorStore</a></code> | The store where the purchase was made.                                                                                                                  |
| **`purchaseId`**          | <code>string</code>                                 | An identifier of the purchase in Adapty. You can use it to ensure that you've already processed this purchase (for example tracking one time products). |


#### AdaptySubscription

Interface representing details about a user's subscription.

| Prop                              | Type                                                              | Description                                                                                                                                                                               |
| --------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`activatedAt`**                 | <code><a href="#date">Date</a></code>                             | The date and time when the subscription was activated.                                                                                                                                    |
| **`activeIntroductoryOfferType`** | <code><a href="#offertype">OfferType</a></code>                   | Type of active introductory offer, if any.                                                                                                                                                |
| **`activePromotionalOfferId`**    | <code>string</code>                                               | Identifier of the active promotional offer, if any.                                                                                                                                       |
| **`activePromotionalOfferType`**  | <code><a href="#offertype">OfferType</a></code>                   | Type of the active promotional offer, if any.                                                                                                                                             |
| **`billingIssueDetectedAt`**      | <code><a href="#date">Date</a></code>                             | The date and time when a billing issue was detected.                                                                                                                                      |
| **`cancellationReason`**          | <code><a href="#cancellationreason">CancellationReason</a></code> | The reason for the cancellation of the subscription.                                                                                                                                      |
| **`expiresAt`**                   | <code><a href="#date">Date</a></code>                             | The expiration date of the subscription, if applicable.                                                                                                                                   |
| **`isActive`**                    | <code>boolean</code>                                              | Flag indicating whether the subscription is currently active.                                                                                                                             |
| **`isInGracePeriod`**             | <code>boolean</code>                                              | Flag indicating whether the subscription is in the grace period.                                                                                                                          |
| **`isLifetime`**                  | <code>boolean</code>                                              | Flag indicating whether the subscription is set for a lifetime.                                                                                                                           |
| **`isRefund`**                    | <code>boolean</code>                                              | Flag indicating whether the subscription was refunded.                                                                                                                                    |
| **`isSandbox`**                   | <code>boolean</code>                                              | Flag indicating whether the subscription was purchased in a sandbox environment.                                                                                                          |
| **`renewedAt`**                   | <code><a href="#date">Date</a></code>                             | The date and time when the subscription was renewed.                                                                                                                                      |
| **`startsAt`**                    | <code><a href="#date">Date</a></code>                             | The date and time when the subscription starts.                                                                                                                                           |
| **`store`**                       | <code><a href="#vendorstore">VendorStore</a></code>               | The store where the subscription was made.                                                                                                                                                |
| **`unsubscribedAt`**              | <code><a href="#date">Date</a></code>                             | The date and time when the subscription was cancelled.                                                                                                                                    |
| **`vendorProductId`**             | <code>string</code>                                               | The identifier of the product in the store that was subscribed to.                                                                                                                        |
| **`vendorTransactionId`**         | <code>string</code>                                               | The identifier of the product in the store that was subscribed to.                                                                                                                        |
| **`vendorOriginalTransactionId`** | <code>string</code>                                               | An original transaction id of the purchase in a store that unlocked this subscription. For auto-renewable subscription, this will be an id of the first transaction in this subscription. |
| **`willRenew`**                   | <code>boolean</code>                                              | Flag indicating whether the subscription is set to auto-renew.                                                                                                                            |


#### MakePurchaseParamsInput

| Prop          | Type                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| **`android`** | <code><a href="#adaptyandroidsubscriptionupdateparameters">AdaptyAndroidSubscriptionUpdateParameters</a></code> |


#### AdaptyAndroidSubscriptionUpdateParameters

| Prop                        | Type                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **`oldSubVendorProductId`** | <code>string</code>                                                                                                       |
| **`prorationMode`**         | <code><a href="#adaptyandroidsubscriptionupdatereplacementmode">AdaptyAndroidSubscriptionUpdateReplacementMode</a></code> |
| **`isOfferPersonalized`**   | <code>boolean</code>                                                                                                      |


#### AdaptyProfileParameters

| Prop                                | Type                                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------------------- |
| **`analyticsDisabled`**             | <code>boolean</code>                                                                    |
| **`codableCustomAttributes`**       | <code>{ [key: string]: any; }</code>                                                    |
| **`appTrackingTransparencyStatus`** | <code><a href="#apptrackingtransparencystatus">AppTrackingTransparencyStatus</a></code> |
| **`firstName`**                     | <code>string</code>                                                                     |
| **`lastName`**                      | <code>string</code>                                                                     |
| **`gender`**                        | <code><a href="#gender">Gender</a></code>                                               |
| **`birthday`**                      | <code>string</code>                                                                     |
| **`email`**                         | <code>string</code>                                                                     |
| **`phoneNumber`**                   | <code>string</code>                                                                     |


#### AdaptyInstallationStatus

Status of the installation details retrieval.

| Prop          | Type                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| **`status`**  | <code>'not_available' \| 'not_determined' \| 'determined'</code>                                     |
| **`details`** | <code><a href="#adaptyinstallationdetails">AdaptyInstallationDetails</a></code> (only when status is 'determined') |


#### AdaptyInstallationDetails

Information about the app installation.

| Prop                    | Type                             | Description                                                 |
| ----------------------- | -------------------------------- | ----------------------------------------------------------- |
| **`installId`**         | <code>string</code>              | A unique identifier for this installation                   |
| **`installTime`**       | <code><a href="#date">Date</a></code>          | The date and time when the app was installed              |
| **`appLaunchCount`**    | <code>number</code>              | The total number of times the app has been launched       |
| **`payload`**           | <code>string</code>              | Custom payload data associated with the installation      |


#### LoggerConfig

Configuration for JS logger sinks.

| Prop              | Type                                      | Description                            |
| ----------------- | ----------------------------------------- | -------------------------------------- |
| **`sinks`**       | <code>LogSink[]</code>                    | Array of log sinks to handle events   |
| **`defaultMeta`** | <code>Record&lt;string, unknown&gt;</code> | Default metadata to include in logs   |


#### AdaptyUiMediaCache

Configuration for AdaptyUI media cache.

| Prop                              | Type                | Description                                  |
| --------------------------------- | ------------------- | -------------------------------------------- |
| **`memoryStorageTotalCostLimit`** | <code>number</code> | Total cost limit for memory storage         |
| **`memoryStorageCountLimit`**     | <code>number</code> | Count limit for memory storage              |
| **`diskStorageSizeLimit`**        | <code>number</code> | Size limit for disk storage                 |


#### EventPayloadMap

Mapping between event names and their payload types.

| Event Name                         | Payload Type                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------- |
| **`onLatestProfileLoad`**          | <code>{ profile: <a href="#adaptyprofile">AdaptyProfile</a>; }</code>                 |
| **`onInstallationDetailsSuccess`** | <code>{ details: <a href="#adaptyinstallationdetails">AdaptyInstallationDetails</a>; }</code> |
| **`onInstallationDetailsFail`**    | <code>{ error: AdaptyError; }</code>                                                  |


#### PluginListenerHandle

| Prop         | Type                                      |
| ------------ | ----------------------------------------- |
| **`remove`** | <code>() =&gt; Promise&lt;void&gt;</code> |


### Type Aliases


#### ActivateParamsInput

Describes optional parameters for the activate method.

| Prop                            | Type                                         | Description                                                                                       |
| ------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **`observerMode`**              | <code>boolean</code>                         | Turn it on if you handle purchases and subscription status yourself and use Adapty for sending subscription events and analytics. Default: false |
| **`customerUserId`**            | <code>string</code>                          | User identifier in your system. If none of the parameters are passed, the SDK will generate an ID and use it for a current device. |
| **`logLevel`**                  | <code><a href="#loglevel">LogLevel</a></code> | Log level for the SDK. Logging is performed on a native side.                                   |
| **`serverCluster`**             | <code>'default' \| 'eu' \| 'cn'</code>       | Server cluster                                                                                   |
| **`backendBaseUrl`**            | <code>string</code>                          | Backend base URL                                                                                 |
| **`backendFallbackBaseUrl`**    | <code>string</code>                          | Backend fallback base URL                                                                        |
| **`backendConfigsBaseUrl`**     | <code>string</code>                          | Backend configs base URL                                                                         |
| **`backendUABaseUrl`**          | <code>string</code>                          | Backend UA base URL                                                                              |
| **`backendProxyHost`**          | <code>string</code>                          | Backend proxy host                                                                               |
| **`backendProxyPort`**          | <code>number</code>                          | Backend proxy port                                                                               |
| **`activateUi`**                | <code>boolean</code>                         | Activate UI                                                                                      |
| **`mediaCache`**                | <code><a href="#adaptyuimediacache">AdaptyUiMediaCache</a></code>              | Media cache configuration                                                                        |
| **`ipAddressCollectionDisabled`** | <code>boolean</code>                       | Disables IP address collection. Default: false                                                  |
| **`ios`**                       | <code>{ idfaCollectionDisabled?: boolean; }</code> | iOS-specific options. idfaCollectionDisabled: Disables IDFA collection. Default: false |
| **`android`**                   | <code>{ adIdCollectionDisabled?: boolean; }</code> | Android-specific options. adIdCollectionDisabled: Disables Google AdvertisingID collection. Default: false |


#### Record

Construct a type with a set of properties K of type T

<code>{
 [P in K]: T;
 }</code>


#### GetPlacementParamsInput

Parameters for getting placements with additional timeout option.

| Prop               | Type                                                                                                                       | Description                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **`...`**          | <code><a href="#getplacementfordefaultaudienceparamsinput">GetPlacementForDefaultAudienceParamsInput</a></code>         | All properties from GetPlacementForDefaultAudienceParamsInput                                     |
| **`loadTimeoutMs`** | <code>number</code>                                                                                                       | Timeout in milliseconds. If reached, cached data or local fallback will be returned             |


#### GetPlacementForDefaultAudienceParamsInput

Parameters for getting placements for default audience with fetch policy options.

**Option 1: Standard fetch policy**
| Prop             | Type                                                                                                   | Description                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **`fetchPolicy`** | <code><a href="#exclude">Exclude</a>&lt;<a href="#fetchpolicy">FetchPolicy</a>, 'return_cache_data_if_not_expired_else_load'&gt;</code> | Fetch policy. By default tries to load from server, returns cached data on failure |

**Option 2: Cache with expiration**
| Prop             | Type                                                                                                   | Description                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **`fetchPolicy`** | <code>'return_cache_data_if_not_expired_else_load'</code>                                             | Fetch policy for cached data with expiration                                                      |
| **`maxAgeSeconds`** | <code>number</code>                                                                                 | Max time (in seconds) the cache is valid for the specified fetch policy                          |


#### Exclude

<a href="#exclude">Exclude</a> from T those types that are assignable to U

<code>T extends U ? never : T</code>


#### FetchPolicy

<code>(typeof <a href="#fetchpolicy">FetchPolicy</a>)[keyof typeof FetchPolicy]</code>


#### Extract

<a href="#extract">Extract</a> from T those types that are assignable to U

<code>T extends U ? T : never</code>


#### ProductPeriod

<code>(typeof <a href="#productperiod">ProductPeriod</a>)[keyof typeof ProductPeriod]</code>


#### AdaptySubscriptionOfferId

Identifier for subscription offers.

| Type                     | Properties                                                      | Description                                          |
| ------------------------ | --------------------------------------------------------------- | ---------------------------------------------------- |
| **Introductory**         | <code>{ id?: string; type: 'introductory'; }</code>           | Introductory offer, id is optional                  |
| **Promotional/Win-back** | <code>{ id: string; type: 'promotional' \| 'win_back'; }</code> | Promotional or win-back offer, id is required       |


#### OfferType

<code>(typeof <a href="#offertype">OfferType</a>)[keyof typeof OfferType]</code>


#### CancellationReason

<code>(typeof <a href="#cancellationreason">CancellationReason</a>)[keyof typeof CancellationReason]</code>


#### VendorStore

<code>(typeof <a href="#vendorstore">VendorStore</a>)[keyof typeof VendorStore]</code>


#### AdaptyPurchaseResult

Result of a purchase operation.

| Type                     | Properties                                                         | Description                                          |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------- |
| **Pending/Cancelled**    | <code>{ type: 'pending' \| 'user_cancelled'; }</code>            | Purchase is pending or was cancelled by the user    |
| **Success**              | <code>{ type: 'success'; profile: <a href="#adaptyprofile">AdaptyProfile</a>; }</code> | Purchase was successful, includes updated profile   |


#### AdaptyAndroidSubscriptionUpdateReplacementMode

<code>(typeof <a href="#adaptyandroidsubscriptionupdatereplacementmode">AdaptyAndroidSubscriptionUpdateReplacementMode</a>)[keyof typeof AdaptyAndroidSubscriptionUpdateReplacementMode]</code>


#### FileLocation

Configuration for file locations on different platforms.

| Prop          | Type                                                                                    | Description                                                    |
| ------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **`ios`**     | <code>{ fileName: string; }</code>                                                     | iOS file location. fileName: Name of the file in iOS bundle   |
| **`android`** | <code>{ relativeAssetPath: string; } \| { rawResName: string; }</code>                 | Android file location. Either relative asset path or raw resource name |


#### LogLevel

Log levels for the SDK

<code>(typeof <a href="#loglevel">LogLevel</a>)[keyof typeof LogLevel]</code>


#### RefundPreference

<code>(typeof <a href="#refundpreference">RefundPreference</a>)[keyof typeof RefundPreference]</code>


#### Partial

Make all properties in T optional

<code>{
 [P in keyof T]?: T[P];
 }</code>


#### AppTrackingTransparencyStatus

<code>(typeof <a href="#apptrackingtransparencystatus">AppTrackingTransparencyStatus</a>)[keyof typeof AppTrackingTransparencyStatus]</code>


#### Gender

<code>(typeof <a href="#gender">Gender</a>)[keyof typeof Gender]</code>

</docgen-api>
