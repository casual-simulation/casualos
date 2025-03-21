import {
    AIConfiguration,
    AIConfigurationImpl,
    AIController,
} from './AIController';
import { AnthropicAIChatInterface } from './AnthropicAIChatInterface';
import { AuthController } from './AuthController';
import { AuthMessenger } from './AuthMessenger';
import { AuthStore } from './AuthStore';
import { BlockadeLabsGenerateSkyboxInterface } from './BlockadeLabsGenerateSkyboxInterface';
import { ConfigurationStore } from './ConfigurationStore';
import {
    DataRecordsController,
    DataRecordsConfiguration,
    DataRecordsConfigurationImpl,
} from './DataRecordsController';
import { DataRecordsStore } from './DataRecordsStore';
import {
    EventRecordsController,
    EventRecordsConfiguration,
    EventRecordsConfigurationImpl,
} from './EventRecordsController';
import { EventRecordsStore } from './EventRecordsStore';
import {
    FileRecordsController,
    FileRecordsConfiguration,
    FileRecordsConfigurationImpl,
} from './FileRecordsController';
import { FileRecordsStore } from './FileRecordsStore';
import { GoogleAIChatInterface } from './GoogleAIChatInterface';
import type { Newable } from 'inversify';
import { Container } from 'inversify';
import { LivekitController } from './LivekitController';
import {
    LoomController,
    LoomControllerOptions,
    LoomControllerOptionsImpl,
} from './LoomController';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { MemoryCache } from './MemoryCache';
import { MemoryModerationJobProvider } from './MemoryModerationJobProvider';
import { MemoryStore, MemoryConfiguration } from './MemoryStore';
import { MetricsStore } from './MetricsStore';
import { ModerationController } from './ModerationController';
import { ModerationJobProvider } from './ModerationJobProvider';
import { ModerationStore } from './ModerationStore';
import {
    MemoryNotificationRecordsStore,
    NotificationRecordsConfiguration,
    NotificationRecordsConfigurationImpl,
    NotificationRecordsController,
    NotificationRecordsStore,
} from './notifications';
import { OpenAIChatInterface } from './OpenAIChatInterface';
import { OpenAIImageInterface } from './OpenAIImageInterface';
import { PolicyController } from './PolicyController';
import { PolicyStore } from './PolicyStore';
import { RateLimitController } from './RateLimitController';
import {
    RecordsController,
    RecordsControllerConfig,
    RecordsControllerConfigImpl,
} from './RecordsController';
import {
    RecordsServer,
    RecordsServerOptions,
    RecordsServerOptionsImpl,
} from './RecordsServer';
import { RecordsStore } from './RecordsStore';
import { SloydInterface } from './SloydInterface';
import { StabilityAIImageInterface } from './StabilityAIImageInterface';
import { SystemNotificationMessenger } from './SystemNotificationMessenger';
import {
    MemoryWebhookRecordsStore,
    WebhookRecordsConfiguration,
    WebhookRecordsConfigurationImpl,
    WebhookRecordsController,
    WebhookRecordsStore,
} from './webhooks';
import {
    InstRecordsStore,
    MemoryTempInstRecordsStore,
    MemoryWebsocketConnectionStore,
    MemoryWebsocketMessenger,
    SplitInstRecordsStore,
    TemporaryInstRecordsStore,
    WebsocketConnectionStore,
    WebsocketController,
    WebsocketMessenger,
} from './websockets';
import { Cache } from './Cache';
import { ConsoleAuthMessenger } from './ConsoleAuthMessenger';
import type { SubscriptionConfiguration } from './SubscriptionConfiguration';
import { RateLimiter } from '@casual-simulation/rate-limit-redis';
import { MemoryRateLimiter } from './MemoryRateLimiter';
import { SubscriptionController } from './SubscriptionController';

export function setupSelfBindings(container: Container) {
    const selfBindings = [
        RecordsServer,

        // Stores
        MemoryStore,

        // Controllers
        RecordsController,
        PolicyController,
        AuthController,
        FileRecordsController,
        DataRecordsController,
        EventRecordsController,
        RateLimitController,
        ModerationController,
        LoomController,
        LivekitController,
        AIController,
        WebsocketController,
        WebhookRecordsController,
        NotificationRecordsController,
        SubscriptionController,

        // Chat interfaces
        OpenAIChatInterface,
        GoogleAIChatInterface,
        AnthropicAIChatInterface,

        // Image interfaces
        OpenAIImageInterface,
        StabilityAIImageInterface,

        // Other interfaces
        SloydInterface,
        BlockadeLabsGenerateSkyboxInterface,
    ];

    for (let binding of selfBindings) {
        container.bind(binding).toSelf().inSingletonScope().whenDefault();
    }

    container
        .bind(DataRecordsController)
        .toDynamicValue((context) => {
            return new DataRecordsController({
                config: context.get(DataRecordsConfiguration),
                store: context.get(DataRecordsStore, { name: 'manual' }),
                metrics: context.get(MetricsStore),
                policies: context.get(PolicyController),
            });
        })
        .inSingletonScope()
        .whenNamed('manual');

    container.bind(MemoryStore).toSelf().inSingletonScope().whenNamed('manual');
}

export function setupConfigBindings(container: Container) {
    const configBindings: [symbol, Newable][] = [
        [RecordsControllerConfig, RecordsControllerConfigImpl],
        [DataRecordsConfiguration, DataRecordsConfigurationImpl],
        [FileRecordsConfiguration, FileRecordsConfigurationImpl],
        [EventRecordsConfiguration, EventRecordsConfigurationImpl],
        [LoomControllerOptions, LoomControllerOptionsImpl],
        [RecordsServerOptions, RecordsServerOptionsImpl],
        [AIConfiguration, AIConfigurationImpl],
        [WebhookRecordsConfiguration, WebhookRecordsConfigurationImpl],
        [
            NotificationRecordsConfiguration,
            NotificationRecordsConfigurationImpl,
        ],
    ];

    for (let [binding, impl] of configBindings) {
        container.bind(binding).to(impl);
    }
}

export function setupMemoryStoreBindings(container: Container) {
    const memoryStoreBindings = [
        AuthStore,
        RecordsStore,
        DataRecordsStore,
        FileRecordsStore,
        EventRecordsStore,
        PolicyStore,
        MetricsStore,
        ConfigurationStore,
        ModerationStore,
        SystemNotificationMessenger,
    ];

    for (let binding of memoryStoreBindings) {
        container.bind(binding).toService(MemoryStore);
    }
}

export function setupDevServices(container: Container) {
    container.bind(AuthMessenger).to(ConsoleAuthMessenger).inSingletonScope();
}

export function setupMemoryServices(container: Container) {
    setupMemoryStoreBindings(container);

    container.bind(MemoryAuthMessenger).toSelf().inSingletonScope();
    container.bind(AuthMessenger).toService(MemoryAuthMessenger);
    container.bind(MemoryModerationJobProvider).toSelf().inSingletonScope();
    container
        .bind(ModerationJobProvider)
        .toService(MemoryModerationJobProvider);
    container.bind(MemoryCache).toSelf().inSingletonScope();
    container.bind(Cache).toService(MemoryCache);
    container.bind(RateLimiter).to(MemoryRateLimiter).inSingletonScope();
    container
        .bind(WebsocketConnectionStore)
        .to(MemoryWebsocketConnectionStore)
        .inSingletonScope();
    container
        .bind(TemporaryInstRecordsStore)
        .to(MemoryTempInstRecordsStore)
        .inSingletonScope();
    container
        .bind(InstRecordsStore)
        .to(SplitInstRecordsStore)
        .inSingletonScope()
        .whenDefault();
    container
        .bind(InstRecordsStore)
        .toDynamicValue((context) => {
            return context.get(MemoryStore);
        })
        .whenNamed('permanent');
    container
        .bind(WebsocketMessenger)
        .to(MemoryWebsocketMessenger)
        .inSingletonScope();
    container
        .bind(WebhookRecordsStore)
        .to(MemoryWebhookRecordsStore)
        .inSingletonScope();
    container
        .bind(NotificationRecordsStore)
        .to(MemoryNotificationRecordsStore)
        .inSingletonScope();
}

export function setupTestContainer(
    subscriptionConfig?: SubscriptionConfiguration
) {
    const container = new Container();

    setupSelfBindings(container);
    setupConfigBindings(container);
    setupMemoryServices(container);

    bindMemoryConfiguration(container, {
        subscriptions: subscriptionConfig,
    });

    return container;
}

export function bindMemoryConfiguration(
    container: Container,
    config: MemoryConfiguration
) {
    container.bind(MemoryConfiguration).toConstantValue(config);
}
