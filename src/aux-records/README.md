# @casual-simulation/aux-records

A comprehensive backend server framework for CasualOS, providing a complete HTTP and WebSocket API layer for authentication, data storage, AI services, subscriptions, and real-time collaboration features.

## Overview

This package contains the `RecordsServer` class and supporting controllers that implement the complete backend infrastructure for CasualOS applications. It provides a production-ready server implementation with authentication, authorization, rate limiting, real-time synchronization, AI integration, payment processing, and more.

## Main Export: RecordsServer

### `RecordsServer`

A full-featured HTTP and WebSocket server that orchestrates multiple specialized controllers to provide a complete backend API for CasualOS applications.

**Core Capabilities:**

### Authentication & Authorization

-   **User Authentication**: Email, SMS, OAuth (OpenID Connect), and WebAuthn support
-   **Session Management**: Create, list, replace, and revoke user sessions
-   **Privo Integration**: Age-gated authentication for COPPA compliance
-   **Role-Based Access**: Support for user roles (superUser, moderator, system)
-   **Policy System**: Fine-grained permissions and resource-level access control

### Data Management

-   **Records System**: Multi-tenant data storage with owner/studio isolation
-   **Record Keys**: Public/private access keys with subjectfull/subjectless policies
-   **Events**: Publish/subscribe event system with count tracking
-   **Files**: Binary file upload/download with presigned URLs
-   **Data Storage**: Key-value data storage with markers and permissions

### Real-Time Collaboration

-   **WebSocket Support**: Full-duplex real-time communication
-   **Branch Synchronization**: Multi-user collaboration with CRDT-like updates
-   **Inst System**: Instance management for shared workspaces
-   **Time Sync**: Client-server time synchronization
-   **Action Broadcasting**: Real-time action distribution to connected clients

### AI & Machine Learning

-   **AI Chat**: Multi-model chat interface (OpenAI, Anthropic, Google)
-   **Image Generation**: AI-powered image creation (OpenAI DALL-E, Stability AI)
-   **Skybox Generation**: 360° skybox generation (Blockade Labs)
-   **3D Model Generation**: AI-driven 3D model creation (Sloyd)
-   **Hume AI**: Emotion AI integration with access token management
-   **OpenAI Realtime**: Real-time audio/video AI capabilities

### Subscriptions & Payments

-   **Stripe Integration**: Full payment processing via Stripe
-   **Subscription Management**: Create, modify, cancel subscriptions
-   **Usage Tracking**: Monitor subscription limits and features
-   **Webhook Handling**: Process Stripe webhooks for payment events
-   **Customer Portal**: Redirect to Stripe's customer management UI

### Studio & comID System

-   **Studios**: Multi-tenant workspaces with member management
-   **comID**: Custom domain support for branded experiences
-   **Member Roles**: Admin and member role assignments
-   **Configuration**: Studio-specific settings (logos, player config, Loom, Hume)
-   **Custom Domains**: Associate custom domains with studios for white-labeling

### Additional Features

-   **Rate Limiting**: Configurable rate limits for API and WebSocket endpoints
-   **Livekit Integration**: Video conferencing with room tokens
-   **Loom Integration**: Video recording capabilities
-   **Moderation**: Content moderation and reporting
-   **Notifications**: Push notifications via web push
-   **Search**: Full-text search across records
-   **Packages**: Package publishing and versioning system
-   **Database**: SQL database access for advanced queries
-   **Webhooks**: HTTP webhook support for external integrations
-   **Contracts**: Smart contract-like functionality

### HTTP API Structure

The server exposes both procedure-based and traditional REST endpoints:

**Procedure-Based API:**

```typescript
// Procedures with HTTP bindings
POST /api/v3/callProcedure
{
    "procedure": "requestLogin",
    "input": { "address": "user@example.com" }
}
```

**REST Endpoints:**

-   `/` - Player index page
-   `/api/v2/login`, `/api/v2/logout` - Authentication
-   `/api/v2/records/*` - Record management
-   `/api/v2/studios/*` - Studio operations
-   `/api/v2/ai/*` - AI services
-   `/api/v2/subscriptions/*` - Subscription management
-   `/api/v2/websocket` - WebSocket upgrade endpoint
-   And many more...

### WebSocket Protocol

The server implements a custom WebSocket protocol for real-time features:

**Event Types:**

-   `login` - Authenticate WebSocket connection
-   `repo/watch_branch` - Subscribe to branch updates
-   `repo/add_updates` - Send updates to a branch
-   `repo/send_action` - Broadcast actions to collaborators
-   `repo/time_sync` - Synchronize time with server
-   `repo/request_missing_permission` - Request elevated permissions

### Usage Example

```typescript
import { RecordsServer } from '@casual-simulation/aux-records';
import {
    AuthController,
    RecordsController,
    // ... other controllers
} from '@casual-simulation/aux-records';

// Create server instance
const server = new RecordsServer({
    allowedAccountOrigins: new Set(['https://app.example.com']),
    allowedApiOrigins: new Set(['https://api.example.com']),
    authController: new AuthController(/* ... */),
    recordsController: new RecordsController(/* ... */),
    eventsController: new EventRecordsController(/* ... */),
    dataController: new DataRecordsController(/* ... */),
    filesController: new FileRecordsController(/* ... */),
    subscriptionController: new SubscriptionController(/* ... */),
    aiController: new AIController(/* ... */),
    websocketController: new WebsocketController(/* ... */),
    // ... other controllers
});

// Handle HTTP requests
const response = await server.handleHttpRequest({
    path: '/api/v2/login',
    method: 'POST',
    body: JSON.stringify({
        address: 'user@example.com',
        addressType: 'email',
    }),
    headers: {
        'content-type': 'application/json',
        origin: 'https://app.example.com',
    },
    ipAddress: '192.168.1.1',
    pathParams: {},
    query: {},
});

// Handle WebSocket upgrades
const wsResponse = await server.handleHttpRequest({
    path: '/api/v2/websocket',
    method: 'GET',
    headers: {
        upgrade: 'websocket',
        connection: 'upgrade',
    },
    // ... other websocket upgrade details
});
```

### Exported Controllers

The package exports numerous controller classes that can be composed together:

-   **AuthController** - User authentication and session management
-   **RecordsController** - Record CRUD operations and access control
-   **EventRecordsController** - Event publishing and subscription
-   **DataRecordsController** - Key-value data storage
-   **FileRecordsController** - Binary file management
-   **SubscriptionController** - Payment and subscription handling
-   **PolicyController** - Permission and policy management
-   **AIController** - AI service orchestration
-   **WebsocketController** - Real-time WebSocket communication
-   **ModerationController** - Content moderation
-   **LivekitController** - Video conferencing
-   **LoomController** - Video recording
-   **RateLimitController** - Rate limiting
-   **NotificationRecordsController** - Push notifications
-   **PackageRecordsController** - Package management
-   **SearchRecordsController** - Full-text search
-   **DatabaseRecordsController** - SQL database access
-   **WebhookRecordsController** - Webhook management
-   **ContractRecordsController** - Contract operations
-   **PurchasableItemRecordsController** - In-app purchases

### Configuration Options

The `RecordsServer` constructor accepts comprehensive configuration:

```typescript
interface RecordsServerOptions {
    allowedAccountOrigins: Set<string>;
    allowedApiOrigins: Set<string>;
    authController: AuthController;
    recordsController: RecordsController;
    eventsController: EventRecordsController;
    dataController: DataRecordsController;
    manualDataController: DataRecordsController;
    filesController: FileRecordsController;
    policyController: PolicyController;
    subscriptionController?: SubscriptionController | null;
    rateLimitController?: RateLimitController | null;
    aiController?: AIController | null;
    websocketController?: WebsocketController | null;
    websocketRateLimitController?: RateLimitController | null;
    moderationController?: ModerationController | null;
    loomController?: LoomController | null;
    webhooksController?: WebhookRecordsController | null;
    notificationsController?: NotificationRecordsController | null;
    packagesController?: PackageRecordsController | null;
    packageVersionController?: PackageVersionRecordsController | null;
    searchRecordsController?: SearchRecordsController | null;
    databaseRecordsController?: DatabaseRecordsController | null;
    contractRecordsController?: ContractRecordsController | null;
    purchasableItemsController?: PurchasableItemRecordsController | null;
    viewTemplateRenderer?: ViewTemplateRenderer | null;
}
```

### Security Features

-   **CORS**: Configurable allowed origins for account and API endpoints
-   **Rate Limiting**: Protect against abuse with configurable limits
-   **Session Validation**: Automatic session key validation for protected endpoints
-   **Origin Validation**: Ensure requests come from authorized sources
-   **Permission System**: Fine-grained resource-level permissions
-   **Audit Logging**: Track operations via OpenTelemetry tracing

### OpenTelemetry Integration

The server includes built-in distributed tracing support:

-   HTTP request/response tracing
-   Semantic conventions for HTTP attributes
-   Custom metrics for request counts and durations
-   Integration with OpenTelemetry collectors

## Dependencies

Major dependencies include:

-   **@casual-simulation/aux-common**: Shared types and utilities
-   **@opentelemetry/api**: Distributed tracing support
-   **zod**: Runtime type validation
-   **axios**: HTTP client for external services
-   **stripe**: Payment processing
-   **@anthropic-ai/sdk**: Anthropic AI integration
-   **@google/generative-ai**: Google AI integration
-   **livekit-server-sdk**: Video conferencing
-   And many more specialized libraries

## Installation

```bash
npm install @casual-simulation/aux-records
```

## Use Cases

-   **Multi-Tenant SaaS**: Build collaborative applications with studio/workspace isolation
-   **AI-Powered Apps**: Integrate multiple AI providers with unified interface
-   **Real-Time Collaboration**: Build Google Docs-like collaborative experiences
-   **Monetized Platforms**: Add subscriptions and payment processing
-   **Branded Experiences**: White-label with custom domains and configuration
-   **Educational Platforms**: Age-gated authentication with Privo
-   **Plugin Marketplaces**: Package publishing and versioning system
