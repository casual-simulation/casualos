export interface SubscriptionConfiguration {
    /**
     * The information that should be used for subscriptions.
     */
    subscriptions: {
        /**
         * The ID of the subscription.
         * Only used for the API.
         */
        id: string;

        /**
         * The ID of the product that needs to be purchased for the subscription.
         */
        product: string;

        /**
         * The list of features that should be shown for this subscription tier.
         */
        featureList: string[];

        /**
         * The list of products that are eligible for this subscription tier.
         */
        eligibleProducts: string[];

        /**
         * Whether this subscription should be the default.
         */
        defaultSubscription?: boolean;

        /**
         * Whether the subscription should be offered for purchase.
         * Defaults to true.
         */
        purchasable?: boolean;

        /**
         * The tier that the subscription represents.
         * Defaults to "beta".
         */
        tier?: string;
    }[];

    /**
     * The configuration that should be passed to https://stripe.com/docs/api/checkout/sessions when creating a checkout session.
     */
    checkoutConfig?: any;

    /**
     * The configuration that should be passed to https://stripe.com/docs/api/customer_portal when creating a portal session.
     */
    portalConfig?: any;

    /**
     * The webhook secret that should be used for validating webhooks.
     */
    webhookSecret: string;

    /**
     * The URL that the user should be sent to upon successfully purchasing a subscription.
     */
    successUrl: string;

    /**
     * The URL that the user should be sent to upon cancelling a subscription purchase.
     */
    cancelUrl: string;

    /**
     * The URL that the user should be returned to after managing their subscriptions.
     */
    returnUrl: string;
}
