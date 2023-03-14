# Aux Auth

A project that is able to provide a basic Login system for CasualOS.

### Building and Deploying

To build, simply run `npm run build`.

To deploy this project to AWS Lambda, follow these steps:

1. Setup a CodeBuild pipeline that points to [`.aws/auth.buildspec.yml`](../../.aws/auth.buildspec.yml).
2. Specify the following environment variables:

    - `STACK_NAME` - The name of the CloudFormation stack that should be created/used.
    - `S3_BUCKET` - The S3 bucket that the static HTML/CSS/JS should be deployed to. The CodeBuild pipeline needs to have write access to the specified bucket.
    - `LAMBDA_S3_BUCKET` - The S3 bucket that the the Lambda scripts should be packaged and deployed to. The CodeBuild pipeline needs to have write access to the specified bucket.
    - `CLOUDFRONT_DISTRIBUTION` - The Distribution ID on CloudFront that should be invalidated. This CloudFront Distribution should point to `S3_BUCKET`.
    - `AUTH_API_ENDPOINT` - The HTTPS Origin that the auth site should try to access. This should be the endpoint of the API Gateway that the lambda functions are behind. (Defaults to `https://api.casualos.me`)
    - `ALLOWED_CHILD_ORIGINS` - The HTTP Origins that the auth site can be loaded from. Used to limit the websites that can interface with the Auth Site via iframe. (Defaults to `http://localhost:3000 https://casualos.com https://static.casualos.com https://alpha.casualos.com https://stable.casualos.com`)
    - `ALLOWED_ORIGINS` - The list of HTTP origins that are allowed to make API requests to the internal auth APIs. Should be aspace-separated list of HTTP(S) origins. This should include the domains that the auth site is hosted from but nothing else. (Always includes `http://localhost:3002`, `https://casualos.me`, `https://ab1.link`)
    - `ALLOWED_API_ORIGINS` - The HTTP Origins that the Records API can be used from. Used to limit the websites that can publish data to records. Should be a space-separated list of HTTP(S) origins. (Always includes `http://localhost:3000 http://localhost:3002 http://player.localhost:3000 https://casualos.com https://casualos.me https://ab1.link https://publicos.com https://alpha.casualos.com https://static.casualos.com https://stable.casualos.com`)
    - `MAGIC_API_KEY` - The publishable API Key that should be used to access the [Magic](https://magic.link) API.
    - `MAGIC_SECRET_KEY` - The Secret Key that should be used to access the [Magic](https://magic.link) API.
    - `REDIS_PORT` - The port of the redis instance that should be used to save temporary records.
    - `REDIS_HOST` - The host of the redis instance.
    - `REDIS_USE_TLS` - Whether TLS should be used to connect to redis.
    - `REDIS_PASSWORD` - The password that should be used to connect to redis.
    - `REDIS_RECORDS_NAMESPACE` - The key prefix that records should be stored under in redis.
    - `TEXT_IT_API_KEY` - The API Key that should be used to access [TextIt](https://textit.com/).
    - `TEXT_IT_FLOW_ID` - The ID of the Flow that should be triggered by the login process.
    - `ENABLE_SMS_AUTHENTICATION` - Whether SMS authentication is should be enabled for logins.
    - `LIVEKIT_API_KEY` - The API Key that should be used to authorize access to the Livekit endpoint.
    - `LIVEKIT_SECRET_KEY` - The Secret Key that should be used to authorize access to the Livekit endpoint.
    - `LIVEKIT_ENDPOINT` - The WebSocket endpoint that the Livekit server(s) are available at.
    - `STRIPE_SECRET_KEY` - The secret key that should be used for [Stripe](https://stripe.com/) integration. If not included, then Stripe integration will be disabled and all subscription features made available to all users.
    - `STRIPE_PUBLISABLE_KEY` - The publisable key that should be used for Stripe integration. If not included, then Stripe integration will be disabled and all subscription features made available to all users.
    - `SUBSCRIPTION_CONFIG` - The configuration that should be used for the subscription features. Should be JSON with the following formation:

        ```ts
        let config: {
            /**
             * The list of subscriptions that should be offered to the user.
             */
            subscriptions: {
                /**
                 * The ID of the subscription.
                 * This can be any arbitrary string, and is simply used to ensure that the Records system has
                 * a consistent reference to a subscription's information.
                 */
                id: string;

                /**
                 * The ID of the Stripe Product that will be purchased by the user when they select this subscription.
                 */
                product: string;

                /**
                 * The list of Stripe Product IDs that represent a subscription to this subscription.
                 * If the user is subscribed to one of these products, then the user will be counted as
                 * having an active subscription to this subscription.
                 */
                eligibleProducts: string[];

                /**
                 * The list of features that should be shown to the user when displaying this subscription for purchase.
                 */
                featureList: string[];

                /**
                 * Whether this subscription is the preferred subscription for the user to purchase.
                 */
                defaultSubscription: boolean;

                /**
                 * Whether the subscription should be offered for purchase.
                 * Defaults to true.
                 */
                purchasable?: boolean;

                /**
                 * The tier that the subscription represents.
                 * Defaults to "beta".
                 */
                tier?: 'beta';
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
             * The Stripe Webhook Secret (see https://stripe.com/docs/webhooks/signatures) that should be used to
             * validate Stripe webhook events.
             */
            webhookSecret: string;

            /**
             * The URL that user should be redirected to after successfully purchasing a subscription.
             * Usually, this is the home page.
             */
            successUrl: string;

            /**
             * The URL that user should be redirected to after cancelling a subscription purchase.
             * Usually, this is the home page.
             */
            cancelUrl: string;

            /**
             * The URL that the user should be returned to when exiting the Stripe customer portal.
             */
            returnUrl: string;
        };
        ```

3. Run a build.
4. After the build, go to CloudFormation and find the stack update.
    - Review the changes to ensure that they are correct and then execute the stack update.
