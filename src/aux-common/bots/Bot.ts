export type PartialBot = Partial<Bot>;

export type AuxDomain = 'builder' | 'player';

export type Object = Bot;
export type Workspace = Bot;

/**
 * Defines an interface for a bot that is precalculated.
 */
export interface PrecalculatedBot extends Bot {
    /**
     * Flag indicating that the bot is precalculated.
     */
    precalculated: true;

    /**
     * The precalculated tags.
     */
    values: PrecalculatedTags;
}

/**
 * Defines an interface for an object that holds a set of tags that have been precalculated.
 */
export interface PrecalculatedTags {
    [key: string]: any;
}

/**
 * Defines an interface for a bot.
 */
export interface Bot {
    /**
     * The ID of the bot.
     */
    id: string;

    /**
     * The set of tags that the bot contains.
     */
    tags: BotTags;
}

export interface BotTags {
    // Global bot tags
    ['aux.scene.color']?: string;
    ['aux.context.inventory.color']?: string;
    ['aux.context.inventory.height']?: unknown;
    ['aux.context.inventory.pannable']?: boolean;
    ['aux.context.inventory.resizable']?: boolean;
    ['aux.context.inventory.rotatable']?: boolean;
    ['aux.context.inventory.zoomable']?: boolean;
    ['aux.context.inventory.visible']?: unknown;
    ['aux.scene.user.player.color']?: unknown;
    ['aux.scene.user.builder.color']?: unknown;
    ['aux.whitelist']?: unknown;
    ['aux.blacklist']?: unknown;
    ['aux.designers']?: unknown;
    ['aux.version']?: unknown;

    // Normal bot tags
    ['aux.color']?: unknown;
    ['aux.movable']?: unknown;
    ['aux.mergeable']?: unknown;
    ['aux.stackable']?: unknown;
    ['aux.destroyable']?: unknown;
    ['aux.editable']?: unknown;
    ['aux.stroke.color']?: unknown;
    ['aux.stroke.width']?: unknown;
    ['aux.line.to']?: unknown;
    ['aux.line.width']?: number;
    ['aux.line.style']?: unknown;
    ['aux.line.color']?: unknown;
    ['aux.label']?: unknown;
    ['aux.label.color']?: unknown;
    ['aux.label.size']?: unknown;
    ['aux.label.size.mode']?: 'auto' | null;
    ['aux.label.anchor']?: BotLabelAnchor | null | string;
    ['aux.listening']?: unknown;
    ['aux.shape']?: BotShape;
    ['aux.image']?: string;
    ['aux.iframe']?: string;
    ['aux.iframe.x']?: number;
    ['aux.iframe.y']?: number;
    ['aux.iframe.z']?: number;
    ['aux.iframe.size.x']?: number;
    ['aux.iframe.size.y']?: number;
    ['aux.iframe.rotation.x']?: number;
    ['aux.iframe.rotation.y']?: number;
    ['aux.iframe.rotation.z']?: number;
    ['aux.iframe.element.width']?: number;
    ['aux.iframe.scale']?: number;
    ['aux.channel']?: string;
    ['aux.mod']?: unknown;
    ['aux.mod.mergeTags']?: unknown;
    ['aux.creator']?: string;
    ['aux.progressBar']?: unknown;
    ['aux.progressBar.color']?: unknown;
    ['aux.progressBar.backgroundColor']?: unknown;
    ['aux.progressBar.anchor']?: unknown;

    // User tags
    ['aux._selection']?: string;
    ['aux._user']?: string;
    ['aux.user.active']?: boolean;
    ['aux._userContext']?: string;
    ['aux._userChannel']?: string;
    ['aux._userInventoryContext']?: string;
    ['aux._userMenuContext']?: string;
    ['aux._userSimulationsContext']?: string;
    ['aux._mode']?: UserMode;
    ['aux._editingBot']?: string;
    ['aux._selectionMode']?: SelectionMode;

    // Admin channel user tags
    ['aux.account.username']?: string;
    ['aux.account.roles']?: string[];
    ['aux.account.locked']?: boolean;
    ['aux.roles']?: string[];

    // Admin channel token tags
    ['aux.token.username']?: string;
    ['aux.token']?: string;
    ['aux.token.locked']?: boolean;

    // Admin channel bot-channel tags
    ['aux.channel.locked']?: boolean;
    ['aux.channel.connectedSessions']?: number;
    ['aux.channel.maxSessionsAllowed']?: number;

    // Admin channel tags
    ['aux.connectedSessions']?: number;
    ['aux.maxSessionsAllowed']?: number;

    // Admin channel task tags
    ['aux.runningTasks']?: boolean;
    ['aux.finishedTasks']?: boolean;
    ['aux.task.output']?: unknown;
    ['aux.task.error']?: unknown;
    ['aux.task.time']?: unknown;
    ['aux.task.shell']?: string;
    ['aux.task.backup']?: boolean;
    ['aux.task.backup.type']?: BackupType;
    ['aux.task.backup.url']?: string;

    // Context related tags
    ['aux.context']?: string | number | boolean;
    ['aux.context.color']?: string;
    ['aux.context.locked']?: unknown;
    ['aux.context.grid.scale']?: number;
    ['aux.context.visualize']?: ContextVisualizeMode;
    ['aux.context.x']?: number;
    ['aux.context.y']?: number;
    ['aux.context.z']?: number;
    ['aux.context.surface.scale']?: number;
    ['aux.context.surface.defaultHeight']?: number;
    ['aux.context.surface.size']?: number;
    ['aux.context.surface.minimized']?: boolean | null;
    ['aux.context.surface.movable']?: unknown;
    ['aux.context.player.rotation.x']?: number;
    ['aux.context.player.rotation.y']?: number;
    ['aux.context.player.zoom']?: number;
    ['aux.context.devices.visible']?: boolean | null;
    ['aux.context.pannable']?: number | null;
    ['aux.context.zoomable']?: number | null;
    ['aux.context.rotatable']?: number | null;

    // Stripe tags
    ['stripe.publishableKey']?: string;
    ['stripe.secretKey']?: string;
    ['stripe.charges']?: boolean;
    ['stripe.successfulCharges']?: boolean;
    ['stripe.failedCharges']?: boolean;
    ['stripe.charge']?: string;
    ['stripe.charge.receipt.url']?: string;
    ['stripe.charge.receipt.number']?: string;
    ['stripe.charge.description']?: string;
    ['stripe.outcome.networkStatus']?: string;
    ['stripe.outcome.reason']?: string;
    ['stripe.outcome.riskLevel']?: string;
    ['stripe.outcome.riskScore']?: number;
    ['stripe.outcome.rule']?: string | string[];
    ['stripe.outcome.sellerMessage']?: string;
    ['stripe.outcome.type']?: string;
    ['stripe.errors']?: boolean;
    ['stripe.error']?: string;
    ['stripe.error.type']?: string;

    [key: string]: any;
}

/**
 * Defines an interface for the state that an AUX bot can contain.
 */
export interface BotsState {
    [id: string]: Bot;
}

/**
 * Defines an interface for a set of bots that have precalculated formulas.
 */
export interface PrecalculatedBotsState {
    [id: string]: PrecalculatedBot;
}

/**
 * Defines an interface for a hex in a workspace.
 */
export interface WorkspaceHex {
    height: number;
}

/**
 * Defines the possible modes a user can be in.
 */
export type UserMode = 'bots' | 'worksurfaces';

/**
 * Defines the possible selection modes a user can be in.
 */
export type SelectionMode = 'single' | 'multi';

/**
 * Defines the possible shapes that a bot can appear as.
 */
export type BotShape = 'cube' | 'sphere' | 'sprite';

/**
 * Defines the possible drag modes that a bot can have.
 *
 * "all" means that the bot is able to be dragged freely inside and across contexts.
 * "none" means that the bot is not able to be dragged at all.
 * "clone" means that the bot should be cloned whenever dragged.
 * "pickup" means that the bot should be able to be dragged across contexts but not within a context.
 * "drag" means that the bot should be able to be dragged within a context but not across contexts.
 * "mods" means that the bot should be cloned as a diff when dragged.
 */
export type BotDragMode = 'all' | 'none' | 'clone' | 'pickup' | 'drag' | 'mod';

/**
 * Defines the possible anchor positions for a label.
 */
export type BotLabelAnchor =
    | 'top'
    | 'front'
    | 'back'
    | 'left'
    | 'right'
    | 'floating';

/**
 * Defines the possible backup types.
 */
export type BackupType = 'github' | 'download';

/**
 * Defines the possible context visualize modes.
 *
 * true means that the context is visible.
 * false means the context is not visible.
 * "surface" means the context is visible and renders a worksurface.
 */
export type ContextVisualizeMode = true | false | 'surface';

/**
 * The default user mode.
 */
export const DEFAULT_USER_MODE: UserMode = 'bots';

/**
 * The default selection mode.
 */
export const DEFAULT_SELECTION_MODE: SelectionMode = 'single';

/**
 * The default bot shape.
 */
export const DEFAULT_BOT_SHAPE: BotShape = 'cube';

/**
 * The default bot label anchor.
 */
export const DEFAULT_LABEL_ANCHOR: BotLabelAnchor = 'top';

/**
 * The default height for workspaces.
 */
export const DEFAULT_WORKSPACE_HEIGHT = 0.1;

/**
 * The default size for workspaces.
 */
export const DEFAULT_WORKSPACE_SIZE = 1;

/**
 * The default scale for workspaces.
 */
export const DEFAULT_WORKSPACE_SCALE = 2;

/**
 * The default scale for mini workspaces.
 */
export const DEFAULT_MINI_WORKSPACE_SCALE = DEFAULT_WORKSPACE_SCALE / 3;

/**
 * The default grid scale for workspaces.
 */
export const DEFAULT_WORKSPACE_GRID_SCALE = 0.2;

/**
 * The amount that a hex's height is allowed to change by in a single increment.
 */
export const DEFAULT_WORKSPACE_HEIGHT_INCREMENT = 0.1;

/**
 * The minimum height that hexes in a workspace can be.
 */
export const DEFAULT_WORKSPACE_MIN_HEIGHT = 0.1;

/**
 * The default color for workspaces.
 */
export const DEFAULT_WORKSPACE_COLOR = '#999999';

/**
 * The default color for scene background.
 */
export const DEFAULT_SCENE_BACKGROUND_COLOR = '#263238';

/**
 * The default color for users in AUX Builder.
 */
export const DEFAULT_BUILDER_USER_COLOR = '#00D000';

/**
 * The default color for users in AUX Player.
 */
export const DEFAULT_PLAYER_USER_COLOR = '#DDDD00';

/**
 * The amount of time that a user needs to be inactive for
 * in order to hide their bot.
 */
export const DEFAULT_USER_INACTIVE_TIME = 1000 * 60;

/**
 * The amount of time that a user needs to be inactive for
 * in order to delete their bot.
 */
export const DEFAULT_USER_DELETION_TIME = 1000 * 60 * 60;

/**
 * The ID of the global configuration bot.
 */
export const GLOBALS_BOT_ID = 'config';

/**
 * The ID of the device configuration bot.
 */
export const DEVICE_BOT_ID = 'device';

/**
 * The ID of the local configuration bot.
 */
export const LOCAL_BOT_ID = 'local';

/**
 * The current bot format version for AUX Bots.
 * This number increments whenever there are any changes between AUX versions.
 * As a result, it will allow us to make breaking changes but still upgrade people's bots
 * in the future.
 */
export const AUX_BOT_VERSION: number = 1;

/*
 * The list of all tags that have existing functionality in casual sim
 */
export const KNOWN_TAGS: string[] = [
    'aux._selection',
    'aux._destroyed',
    'aux._user',
    'aux.user.active',
    'aux._userContext',
    'aux._userChannel',
    'aux._userInventoryContext',
    'aux._userMenuContext',
    'aux._userSimulationsContext',
    'aux._mode',
    'aux._editingBot',
    'aux._selectionMode',
    'aux.account.username',
    'aux.account.locked',
    'aux.connectedSessions',
    'aux.maxSessionsAllowed',
    'aux.token',
    'aux.token.username',
    'aux.token.locked',
    'aux.inventory.color',
    'aux.context.inventory.color',
    'aux.context.inventory.height',
    'aux.context.inventory.visible',
    'aux.context.inventory.pannable',
    'aux.context.inventory.resizable',
    'aux.context.inventory.rotatable',
    'aux.context.inventory.zoomable',
    'aux.context.pannable',
    'aux.context.zoomable',
    'aux.context.rotatable',
    'aux.scene.color',
    'aux.scene.user.player.color',
    'aux.scene.user.builder.color',
    'aux.color',
    'aux.creator',
    'aux.movable',
    'aux.movable.mod.tags',
    'aux.stackable',
    'aux.mergeable',
    'aux.destroyable',
    'aux.editable',
    'aux.stroke.color',
    'aux.stroke.width',
    'aux.line.to',
    'aux.line.style',
    'aux.line.width',
    'aux.line.color',
    'aux.label',
    'aux.label.color',
    'aux.label.size',
    'aux.label.size.mode',
    'aux.label.anchor',
    'aux.listening',
    'aux.scale',
    'aux.scale.x',
    'aux.scale.y',
    'aux.scale.z',
    'aux.image',
    'aux.shape',
    'aux.progressBar',
    'aux.progressBar.color',
    'aux.progressBar.backgroundColor',
    'aux.progressBar.anchor',
    'aux.channel',
    'aux.channel.locked',
    'aux.channel.connectedSessions',
    'aux.channel.maxSessionsAllowed',
    'aux.whitelist',
    'aux.blacklist',
    'aux.designers',
    'aux.iframe',
    'aux.iframe.x',
    'aux.iframe.y',
    'aux.iframe.z',
    'aux.iframe.size.x',
    'aux.iframe.size.y',
    'aux.iframe.rotation.x',
    'aux.iframe.rotation.y',
    'aux.iframe.rotation.z',
    'aux.iframe.element.width',
    'aux.iframe.scale',
    'aux.context',
    'aux.context.color',
    'aux.context.locked',
    'aux.context.grid.scale',
    'aux.context.x',
    'aux.context.y',
    'aux.context.z',
    'aux.context.rotation.x',
    'aux.context.rotation.y',
    'aux.context.rotation.z',
    'aux.context.surface.scale',
    'aux.context.surface.size',
    'aux.context.surface.minimized',
    'aux.context.surface.movable',
    'aux.context.visualize',
    'aux.context.devices.visible',
    `aux.context.player.zoom`,
    `aux.context.player.rotation.x`,
    `aux.context.player.rotation.y`,
    'aux.task.output',
    'aux.task.error',
    'aux.task.time',
    'aux.task.shell',
    'aux.task.backup',
    'aux.task.backup.type',
    'aux.task.backup.url',

    'stripe.publishableKey',
    'stripe.secretKey',
    'stripe.charges',
    'stripe.successfulCharges',
    'stripe.failedCharges',
    'stripe.charge',
    'stripe.charge.receipt.url',
    'stripe.charge.receipt.number',
    'stripe.charge.description',
    'stripe.outcome.networkStatus',
    'stripe.outcome.reason',
    'stripe.outcome.riskLevel',
    'stripe.outcome.riskScore',
    'stripe.outcome.rule',
    'stripe.outcome.sellerMessage',
    'stripe.outcome.type',
    'stripe.errors',
    'stripe.error',
    'stripe.error.type',

    'onClick()',
    'onAnyBotClicked()',
    'onCombine(#tag:"value")',
    'onCombineEnter()',
    'onCombineExit()',
    'onMod()',
    'onSaveInput()',
    'onCloseInput()',
    'onCreate()',
    'onDestroy()',
    'onBotDrop()',
    'onAnyBotDrop()',
    'onBotDrag()',
    'onAnyBotDrag()',
    'onTapCode()',
    'onQRCodeScanned()',
    'onQRCodeScannerClosed()',
    'onQRCodeScannerOpened()',
    'onBarcodeScanned()',
    'onBarcodeScannerClosed()',
    'onBarcodeScannerOpened()',
    'onPointerEnter()',
    'onPointerExit()',
    'onPointerDown()',
    'onPointerUp()',
    'onChannelStreaming()',
    'onChannelStreamLost()',
    'onChannelSubscribed()',
    'onChannelUnsubscribed()',
    'onPlayerEnterContext()',
    'onKeyDown()',
    'onKeyUp()',
    'onGridClick()',
    'onCheckout()',
    'onPaymentSuccessful()',
    'onPaymentFailed()',
    'onWebhook()',
    'onAnyListen()',
    'onListen()',
    'onAnyAction()',
];
