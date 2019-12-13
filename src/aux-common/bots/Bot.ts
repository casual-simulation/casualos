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
     * The space the bot lives in.
     */
    space?: BotSpace;

    /**
     * The set of tags that the bot contains.
     */
    tags: BotTags;
}

/**
 * The possible bot types.
 *
 * - "shared" means that the bot is a normal bot.
 * - "local" means that the bot is stored in the local storage partition.
 * - "tempLocal" means that the bot is stored in the temporary partition.
 */
export type BotSpace = 'shared' | 'local' | 'tempLocal';

/**
 * Defines an interface for a bot in a script/formula.
 *
 * The difference between this and Bot is that the tags
 * are calculated values and raw is the original tag values.
 *
 * i.e. tags will evaluate formulas while raw will return the formula scripts themselves.
 */
export interface ScriptBot {
    id: string;
    space?: BotSpace;

    tags: ScriptTags;
    raw: BotTags;
    changes: BotTags;
}

export interface ScriptTags extends PrecalculatedTags {
    toJSON(): any;
}

export interface BotTags {
    // Global bot tags
    ['auxChannelColor']?: string;
    ['auxChannelUserPlayerColor']?: unknown;
    ['auxChannelUserBuilderColor']?: unknown;
    ['auxInventoryHeight']?: unknown;
    ['auxVersion']?: unknown;

    // Normal bot tags
    ['auxColor']?: unknown;
    ['auxDraggable']?: unknown;
    ['auxDraggableMode']?: BotDragMode;
    ['auxPositioningMode']?: unknown;
    ['auxDestroyable']?: unknown;
    ['auxEditable']?: unknown;
    ['auxStrokeColor']?: unknown;
    ['auxStrokeWidth']?: unknown;
    ['auxScale']?: number;
    ['auxScaleX']?: number;
    ['auxScaleY']?: number;
    ['auxScaleZ']?: number;
    ['auxLineTo']?: unknown;
    ['auxLineWidth']?: number;
    ['auxLineStyle']?: unknown;
    ['auxLineColor']?: unknown;
    ['auxLabel']?: unknown;
    ['auxLabelColor']?: unknown;
    ['auxLabelSize']?: unknown;
    ['auxLabelSizeMode']?: 'auto' | null;
    ['auxLabelAnchor']?: BotLabelAnchor | null | string;
    ['auxListening']?: unknown;
    ['auxShape']?: BotShape;
    ['auxImage']?: string;
    ['auxIframe']?: string;
    ['auxIframeX']?: number;
    ['auxIframeY']?: number;
    ['auxIframeZ']?: number;
    ['auxIframeSizeX']?: number;
    ['auxIframeSizeY']?: number;
    ['auxIframeRotationX']?: number;
    ['auxIframeRotationY']?: number;
    ['auxIframeRotationZ']?: number;
    ['auxIframeElementWidth']?: number;
    ['auxIframeScale']?: number;
    ['auxChannel']?: string;
    ['auxCreator']?: string;
    ['auxProgressBar']?: unknown;
    ['auxProgressBarColor']?: unknown;
    ['auxProgressBarBackgroundColor']?: unknown;
    ['auxProgressBarAnchor']?: unknown;

    // User tags
    ['_auxSelection']?: string;
    ['_auxUser']?: string;
    ['auxUserActive']?: boolean;
    ['_auxUserContext']?: string;
    ['_auxUserChannel']?: string;
    ['_auxUserInventoryContext']?: string;
    ['_auxUserMenuContext']?: string;
    ['_auxUserChannelsContext']?: string;
    ['_auxEditingBot']?: string;
    ['_auxSelectionMode']?: SelectionMode;

    // Admin channel bot-channel tags
    ['auxChannelConnectedSessions']?: number;

    // Admin channel tags
    ['auxConnectedSessions']?: number;

    // Admin channel task tags
    ['auxRunningTasks']?: boolean;
    ['auxFinishedTasks']?: boolean;
    ['auxTaskOutput']?: unknown;
    ['auxTaskError']?: unknown;
    ['auxTaskTime']?: unknown;
    ['auxTaskShell']?: string;
    ['auxTaskBackup']?: boolean;
    ['auxTaskBackupType']?: BackupType;
    ['auxTaskBackupUrl']?: string;

    // Context related tags
    ['auxContext']?: string | number | boolean;
    ['auxContextColor']?: string;
    ['auxContextLocked']?: unknown;
    ['auxContextGridScale']?: number;
    ['auxContextVisualize']?: ContextVisualizeMode;
    ['auxContextX']?: number;
    ['auxContextY']?: number;
    ['auxContextZ']?: number;
    ['auxContextRotationX']?: number;
    ['auxContextRotationY']?: number;
    ['auxContextRotationZ']?: number;
    ['auxContextSurfaceScale']?: number;
    ['auxContextSurfaceSize']?: number;
    ['auxContextSurfaceMinimized']?: boolean | null;
    ['auxContextSurfaceDefaultHeight']?: number;
    ['auxContextSurfaceMovable']?: unknown;
    ['auxContextPlayerRotationX']?: number;
    ['auxContextPlayerRotationY']?: number;
    ['auxContextPlayerZoom']?: number;
    ['auxContextDevicesVisible']?: boolean | null;
    ['auxContextInventoryColor']?: string;
    ['auxContextInventoryHeight']?: unknown;
    ['auxContextInventoryPannable']?: boolean;
    [`auxContextInventoryPannableMinX`]?: number | null;
    [`auxContextInventoryPannableMaxX`]?: number | null;
    [`auxContextInventoryPannableMinY`]?: number | null;
    [`auxContextInventoryPannableMaxY`]?: number | null;
    ['auxContextInventoryResizable']?: boolean;
    ['auxContextInventoryRotatable']?: boolean;
    ['auxContextInventoryZoomable']?: boolean;
    ['auxContextInventoryVisible']?: unknown;
    ['auxContextPannable']?: number | null;
    [`auxContextPannableMinX`]?: number | null;
    [`auxContextPannableMaxX`]?: number | null;
    [`auxContextPannableMinY`]?: number | null;
    [`auxContextPannableMaxY`]?: number | null;
    ['auxContextZoomable']?: number | null;
    [`auxContextZoomableMin`]?: number | null;
    [`auxContextZoomableMax`]?: number | null;
    ['auxContextRotatable']?: number | null;

    // Stripe tags
    ['stripePublishableKey']?: string;
    ['stripeSecretKey']?: string;
    ['stripeCharges']?: boolean;
    ['stripeSuccessfulCharges']?: boolean;
    ['stripeFailedCharges']?: boolean;
    ['stripeCharge']?: string;
    ['stripeChargeReceiptUrl']?: string;
    ['stripeChargeReceiptNumber']?: string;
    ['stripeChargeDescription']?: string;
    ['stripeOutcomeNetworkStatus']?: string;
    ['stripeOutcomeReason']?: string;
    ['stripeOutcomeRiskLevel']?: string;
    ['stripeOutcomeRiskScore']?: number;
    ['stripeOutcomeRule']?: string | string[];
    ['stripeOutcomeSellerMessage']?: string;
    ['stripeOutcomeType']?: string;
    ['stripeErrors']?: boolean;
    ['stripeError']?: string;
    ['stripeErrorType']?: string;

    [key: string]: any;
}

/**
 * Defines an interface for the state that an AUX bot can contain.
 */
export interface BotsState {
    [id: string]: Bot;
}

/**
 * Defines an interface for a partial bot state.
 */
export interface PartialBotsState {
    [id: string]: PartialBot;
}

/**
 * Defines an interface for a set of bots that have precalculated formulas.
 */
export interface PrecalculatedBotsState {
    [id: string]: PrecalculatedBot;
}

/**
 * Defines an interface for a partial set of bots that have precalculated formulas.
 */
export interface PartialPrecalculatedBotsState {
    [id: string]: Partial<PrecalculatedBot>;
}

/**
 * Defines an interface for a hex in a workspace.
 */
export interface WorkspaceHex {
    height: number;
}

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
 * "pickupOnly" means that the bot should be able to be dragged across contexts but not within a context.
 * "moveOnly" means that the bot should be able to be dragged within a context but not across contexts.
 */
export type BotDragMode = 'all' | 'none' | 'moveOnly' | 'pickupOnly';

/**
 * Defines the possible positioning modes that a bot can have.
 *
 * "stack" means the bot is able to stack with other bots.
 * "absolute" means the bot will ignore other bots.
 */
export type BotPositioningMode = 'stack' | 'absolute';

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
 * The ID of the cookie configuration bot.
 */
export const COOKIE_BOT_ID = 'cookie';

/**
 * THe partition ID for cookie bots.
 */
export const COOKIE_BOT_PARTITION_ID = 'local';

/**
 * The partition ID for temporary bots.
 */
export const TEMPORARY_BOT_PARTITION_ID = 'tempLocal';

/**
 * The context ID that all users should be placed in.
 */
export const USERS_CONTEXT = 'aux-users';

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
    '_auxSelection',
    '_auxUser',
    'auxUserActive',
    '_auxUserContext',
    '_auxUserChannel',
    '_auxUserInventoryContext',
    '_auxUserMenuContext',
    '_auxUserChannelsContext',
    '_auxEditingBot',
    '_auxSelectionMode',
    'auxConnectedSessions',
    'auxInventoryHeight',
    'auxContextInventoryColor',
    'auxContextInventoryHeight',
    'auxContextInventoryVisible',
    'auxContextInventoryPannable',
    `auxContextInventoryPannableMinX`,
    `auxContextInventoryPannableMaxX`,
    `auxContextInventoryPannableMinY`,
    `auxContextInventoryPannableMaxY`,

    'auxContextInventoryResizable',
    'auxContextInventoryRotatable',
    'auxContextInventoryZoomable',

    'auxContextPannable',

    `auxContextPannableMinX`,
    `auxContextPannableMaxX`,

    `auxContextPannableMinY`,
    `auxContextPannableMaxY`,

    'auxContextZoomable',

    `auxContextZoomableMin`,
    `auxContextZoomableMax`,

    'auxContextRotatable',
    'auxChannelColor',
    'auxChannelUserPlayerColor',
    'auxChannelUserBuilderColor',

    'auxColor',
    'auxCreator',
    'auxDraggable',
    'auxDraggableMode',
    'auxPositioningMode',
    'auxDestroyable',
    'auxEditable',
    'auxStrokeColor',
    'auxStrokeWidth',
    'auxLineTo',
    'auxLineStyle',
    'auxLineWidth',
    'auxLineColor',
    'auxLabel',
    'auxLabelColor',
    'auxLabelSize',
    'auxLabelSizeMode',
    'auxLabelAnchor',
    'auxListening',
    'auxScale',
    'auxScaleX',
    'auxScaleY',
    'auxScaleZ',
    'auxImage',
    'auxShape',
    'auxProgressBar',
    'auxProgressBarColor',
    'auxProgressBarBackgroundColor',
    'auxProgressBarAnchor',
    'auxChannel',
    'auxChannelConnectedSessions',
    'auxIframe',
    'auxIframeX',
    'auxIframeY',
    'auxIframeZ',
    'auxIframeSizeX',
    'auxIframeSizeY',
    'auxIframeRotationX',
    'auxIframeRotationY',
    'auxIframeRotationZ',
    'auxIframeElementWidth',
    'auxIframeScale',
    'auxContext',
    'auxContextColor',
    'auxContextLocked',
    'auxContextGridScale',
    'auxContextX',
    'auxContextY',
    'auxContextZ',
    'auxContextSurfaceDefaultHeight',
    'auxContextRotationX',
    'auxContextRotationY',
    'auxContextRotationZ',
    'auxContextSurfaceScale',
    'auxContextSurfaceSize',
    'auxContextSurfaceMinimized',
    'auxContextSurfaceMovable',
    'auxContextVisualize',
    'auxContextDevicesVisible',
    `auxContextPlayerZoom`,
    `auxContextPlayerRotationX`,
    `auxContextPlayerRotationY`,
    'auxTaskOutput',
    'auxTaskError',
    'auxTaskTime',
    'auxTaskShell',
    'auxTaskBackup',
    'auxTaskBackupType',
    'auxTaskBackupUrl',

    'stripePublishableKey',
    'stripeSecretKey',
    'stripeCharges',
    'stripeSuccessfulCharges',
    'stripeFailedCharges',
    'stripeCharge',
    'stripeChargeReceiptUrl',
    'stripeChargeReceiptNumber',
    'stripeChargeDescription',
    'stripeOutcomeNetworkStatus',
    'stripeOutcomeReason',
    'stripeOutcomeRiskLevel',
    'stripeOutcomeRiskScore',
    'stripeOutcomeRule',
    'stripeOutcomeSellerMessage',
    'stripeOutcomeType',
    'stripeErrors',
    'stripeError',
    'stripeErrorType',

    'onClick',
    'onAnyBotClicked',
    'onCombine',
    'onCombineEnter',
    'onCombineExit',
    'onMod',
    'onSaveInput',
    'onCloseInput',
    'onCreate',
    'onDestroy',
    'onBotDrop',
    'onAnyBotDrop',
    'onBotDrag',
    'onAnyBotDrag',
    'onTapCode',
    'onQRCodeScanned',
    'onQRCodeScannerClosed',
    'onQRCodeScannerOpened',
    'onBarcodeScanned',
    'onBarcodeScannerClosed',
    'onBarcodeScannerOpened',
    'onPointerEnter',
    'onPointerExit',
    'onPointerDown',
    'onPointerUp',
    'onChannelStreaming',
    'onChannelStreamLost',
    'onChannelSubscribed',
    'onChannelUnsubscribed',
    'onPlayerEnterContext',
    'onKeyDown',
    'onKeyUp',
    'onGridClick',
    'onCheckout',
    'onPaymentSuccessful',
    'onPaymentFailed',
    'onWebhook',
    'onAnyListen',
    'onListen',
    'onChannelAction',
];
