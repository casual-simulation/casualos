/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { merge } from '@casual-simulation/aux-common';
import type {
    AIChatFeaturesConfiguration,
    AIFeaturesConfiguration,
    AIHumeFeaturesConfiguration,
    AIImageFeaturesConfiguration,
    AIOpenAIFeaturesConfiguration,
    AISkyboxFeaturesConfiguration,
    AISloydFeaturesConfiguration,
    APISubscription,
    DataFeaturesConfiguration,
    EventFeaturesConfiguration,
    FeaturesConfiguration,
    FileFeaturesConfiguration,
    InstsFeaturesConfiguration,
    NotificationFeaturesConfiguration,
    PackageFeaturesConfiguration,
    PublicInstsConfiguration,
    RecordFeaturesConfiguration,
    StudioComIdFeaturesConfiguration,
    StudioLoomFeaturesConfiguration,
    SubscriptionConfiguration,
    TiersConfiguration,
    WebhooksFeaturesConfiguration,
} from './SubscriptionConfiguration';
import { allowAllFeatures, denyAllFeatures } from './SubscriptionConfiguration';

export class FeaturesBuilder {
    private _features: FeaturesConfiguration = denyAllFeatures();

    constructor() {}

    withAllDefaultFeatures(): this {
        this._features = merge(this._features, allowAllFeatures());
        return this;
    }

    withRecords(features?: RecordFeaturesConfiguration): this {
        this._features.records = features ?? {
            allowed: true,
        };
        return this;
    }

    withData(features?: DataFeaturesConfiguration): this {
        this._features.data = features ?? {
            allowed: true,
        };
        return this;
    }

    withDataMaxItems(maxItems: number): this {
        this._features.data.maxItems = maxItems;
        return this;
    }

    withDataMaxReadsPerPeriod(maxReadsPerPeriod: number): this {
        this._features.data.maxReadsPerPeriod = maxReadsPerPeriod;
        return this;
    }

    withDataMaxWritesPerPeriod(maxWritesPerPeriod: number): this {
        this._features.data.maxWritesPerPeriod = maxWritesPerPeriod;
        return this;
    }

    withDataMaxItemSizeInBytes(maxItemSizeInBytes: number): this {
        this._features.data.maxItemSizeInBytes = maxItemSizeInBytes;
        return this;
    }

    withFiles(features?: FileFeaturesConfiguration): this {
        this._features.files = features ?? {
            allowed: true,
        };
        return this;
    }

    withMaxFiles(maxFiles: number): this {
        this._features.files.maxFiles = maxFiles;
        return this;
    }

    withMaxBytesPerFile(maxBytesPerFile: number): this {
        this._features.files.maxBytesPerFile = maxBytesPerFile;
        return this;
    }

    withFilesMaxBytesTotal(maxBytesTotal: number): this {
        this._features.files.maxBytesTotal = maxBytesTotal;
        return this;
    }

    withEvents(features?: EventFeaturesConfiguration): this {
        this._features.events = features ?? {
            allowed: true,
        };
        return this;
    }

    withInsts(features?: InstsFeaturesConfiguration): this {
        this._features.insts = features ?? {
            allowed: true,
        };
        return this;
    }

    withMaxInsts(maxInsts: number): this {
        this._features.insts.maxInsts = maxInsts;
        return this;
    }

    withMaxBytesPerInst(maxBytesPerInst: number): this {
        this._features.insts.maxBytesPerInst = maxBytesPerInst;
        return this;
    }

    withMaxActiveConnectionsPerInst(maxActiveConnectionsPerInst: number): this {
        this._features.insts.maxActiveConnectionsPerInst =
            maxActiveConnectionsPerInst;
        return this;
    }

    withAI(features?: AIFeaturesConfiguration): this {
        this._features.ai = features ?? {
            chat: {
                allowed: true,
            },
            images: {
                allowed: true,
            },
            skyboxes: {
                allowed: true,
            },
            hume: {
                allowed: true,
            },
            sloyd: {
                allowed: true,
            },
        };
        return this;
    }

    withAIChat(features?: AIChatFeaturesConfiguration): this {
        this._features.ai.chat = features ?? {
            allowed: true,
        };
        return this;
    }

    withAIImages(features?: AIImageFeaturesConfiguration): this {
        this._features.ai.images = features ?? {
            allowed: true,
        };
        return this;
    }

    withAISkyboxes(features?: AISkyboxFeaturesConfiguration): this {
        this._features.ai.skyboxes = features ?? {
            allowed: true,
        };
        return this;
    }

    withAIHume(features?: AIHumeFeaturesConfiguration): this {
        this._features.ai.hume = features ?? {
            allowed: true,
        };
        return this;
    }

    withAISloyd(features?: AISloydFeaturesConfiguration): this {
        this._features.ai.sloyd = features ?? {
            allowed: true,
        };
        return this;
    }

    withAIOpenAI(features?: AIOpenAIFeaturesConfiguration): this {
        this._features.ai.openai = features ?? {
            realtime: {
                allowed: true,
            },
        };
        return this;
    }

    withComId(features?: StudioComIdFeaturesConfiguration): this {
        this._features.comId = features ?? {
            allowed: true,
        };
        return this;
    }

    withLoom(features?: StudioLoomFeaturesConfiguration): this {
        this._features.loom = features ?? {
            allowed: true,
        };
        return this;
    }

    withWebhooks(features?: WebhooksFeaturesConfiguration): this {
        this._features.webhooks = features ?? {
            allowed: true,
        };
        return this;
    }

    withWebhooksMaxItems(maxItems: number): this {
        this._features.webhooks.maxItems = maxItems;
        return this;
    }

    withWebhooksMaxRunsPerPeriod(maxRuns: number): this {
        this._features.webhooks.maxRunsPerPeriod = maxRuns;
        return this;
    }

    withWebhookMaxRunsPerHour(maxRuns: number): this {
        this._features.webhooks.maxRunsPerHour = maxRuns;
        return this;
    }

    withNotifications(features?: NotificationFeaturesConfiguration): this {
        this._features.notifications = features ?? {
            allowed: true,
        };
        return this;
    }

    withNotificationsMaxItems(maxItems: number): this {
        this._features.notifications.maxItems = maxItems;
        return this;
    }

    withNotificationsMaxSubscribersPerItem(maxSubscribers: number): this {
        this._features.notifications.maxSubscribersPerItem = maxSubscribers;
        return this;
    }

    withNotificationsMaxSentNotificationsPerPeriod(max: number): this {
        this._features.notifications.maxSentNotificationsPerPeriod = max;
        return this;
    }

    withNotificationsMaxSentPushNotificationsPerPeriod(max: number): this {
        this._features.notifications.maxSentPushNotificationsPerPeriod = max;
        return this;
    }

    withPackages(features?: PackageFeaturesConfiguration): this {
        this._features.packages = features ?? {
            allowed: true,
        };
        return this;
    }

    withPackagesMaxItems(maxItems: number): this {
        this._features.packages.maxItems = maxItems;
        return this;
    }

    withPackagesMaxVersions(maxVersions: number): this {
        this._features.packages.maxPackageVersions = maxVersions;
        return this;
    }

    withPackagesMaxVersionSizeInBytes(maxSize: number): this {
        this._features.packages.maxPackageVersionSizeInBytes = maxSize;
        return this;
    }

    withPackagesMaxBytesTotal(maxBytes: number): this {
        this._features.packages.maxPackageBytesTotal = maxBytes;
        return this;
    }

    get features() {
        return this._features;
    }
}

export class SubscriptionBuilder extends FeaturesBuilder {
    private _sub: APISubscription;

    get subscription() {
        return this._sub;
    }

    constructor(id: string) {
        super();
        this._sub = {
            id,
            featureList: [],
        };
    }

    isStudioOnly(studioOnly: boolean): this {
        this._sub.studioOnly = studioOnly;
        return this;
    }

    isUserOnly(userOnly: boolean): this {
        this._sub.userOnly = userOnly;
        return this;
    }

    isDefaultSubscription(defaultSubscription: boolean): this {
        this._sub.defaultSubscription = defaultSubscription;
        return this;
    }

    isPurchasable(purchasable: boolean): this {
        this._sub.purchasable = purchasable;
        return this;
    }

    withName(name: string): this {
        this._sub.name = name;
        return this;
    }

    withTier(tier: string): this {
        this._sub.tier = tier;
        return this;
    }

    withProduct(product: string): this {
        this._sub.product = product;
        return this;
    }

    withEligibleProducts(products: string[]): this {
        this._sub.eligibleProducts = products;
        return this;
    }

    withDescription(description: string): this {
        this._sub.description = description;
        return this;
    }

    withFeaturesList(list: string[]): this {
        this._sub.featureList = list;
        return this;
    }
}

export class SubscriptionConfigBuilder {
    private _config: SubscriptionConfiguration;

    get config() {
        return this._config;
    }

    constructor(config?: SubscriptionConfiguration) {
        this._config = config ?? {
            subscriptions: [],
            checkoutConfig: {},
            portalConfig: {},
            webhookSecret: '',
            successUrl: '',
            cancelUrl: '',
            returnUrl: '',
            tiers: {},
            defaultFeatures: {
                user: allowAllFeatures(),
                studio: allowAllFeatures(),
            },
        };
    }

    withUserDefaultFeatures(
        build: (features: FeaturesBuilder) => FeaturesBuilder
    ): this {
        this._config.defaultFeatures.user = build(
            new FeaturesBuilder()
        ).features;
        return this;
    }

    withStudioDefaultFeatures(
        build: (features: FeaturesBuilder) => FeaturesBuilder
    ): this {
        this._config.defaultFeatures.studio = build(
            new FeaturesBuilder()
        ).features;
        return this;
    }

    withPublicInsts(features?: PublicInstsConfiguration): this {
        this._config.defaultFeatures.publicInsts = features ?? {
            allowed: true,
        };
        return this;
    }

    withWebhookSecret(secret: string): this {
        this._config.webhookSecret = secret;
        return this;
    }

    withSuccessUrl(url: string): this {
        this._config.successUrl = url;
        return this;
    }

    withCancelUrl(url: string): this {
        this._config.cancelUrl = url;
        return this;
    }

    withReturnUrl(url: string): this {
        this._config.returnUrl = url;
        return this;
    }

    withCheckoutConfig(config: any): this {
        this._config.checkoutConfig = config;
        return this;
    }

    withPortalConfig(config: any): this {
        this._config.portalConfig = config;
        return this;
    }

    withSubscriptions(subs: APISubscription[]): this {
        this._config.subscriptions = subs;
        return this;
    }

    withTiers(tiers: TiersConfiguration): this {
        this._config.tiers = tiers;
        return this;
    }

    addSubscription(
        id: string,
        build: (sub: SubscriptionBuilder) => SubscriptionBuilder
    ): this {
        const tier = build(new SubscriptionBuilder(id));

        this._config.subscriptions.push(tier.subscription);
        if (tier.features && tier.subscription.tier) {
            this._config.tiers[tier.subscription.tier] = {
                features: tier.features,
            };
        }

        return this;
    }
}

/**
 * Gets a FeaturesBuilder that can be used to build a features configuration.
 */
export function featuresBuilder(): FeaturesBuilder {
    return new FeaturesBuilder();
}

/**
 * Gets a SubscriptionBuilder that can be used to build a API subscription with its features.
 * @param id The ID of the subscription.
 */
export function apiSubscriptionBuilder(id: string): SubscriptionBuilder {
    return new SubscriptionBuilder(id);
}

/**
 * Gets a SubscriptionConfigBuilder that can be used to build asubscription configuration.
 */
export function subscriptionConfigBuilder(): SubscriptionConfigBuilder {
    const config = new SubscriptionConfigBuilder({
        subscriptions: [],
        checkoutConfig: {},
        portalConfig: {},
        webhookSecret: '',
        successUrl: '',
        cancelUrl: '',
        returnUrl: '',
        tiers: {},
        defaultFeatures: {
            user: allowAllFeatures(),
            studio: allowAllFeatures(),
        },
    });

    return config;
}

/**
 * Constructs a subscription configuration using the given build function.
 * Returns the resulting configuration.
 * @param build The function that will build the configuration using the given builder.
 */
export function buildSubscriptionConfig(
    build: (builder: SubscriptionConfigBuilder) => SubscriptionConfigBuilder
): SubscriptionConfiguration {
    return build(subscriptionConfigBuilder()).config;
}
