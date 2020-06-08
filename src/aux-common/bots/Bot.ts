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

export interface UpdatedBot {
    bot: Bot;
    tags: string[];
}

/**
 * The possible bot types.
 *
 * - "shared" means that the bot is a normal bot.
 * - "local" means that the bot is stored in the local storage partition.
 * - "tempLocal" means that the bot is stored in the temporary partition.
 * - "history" means that the bot represents a version of another space.
 * - "error" means that the bot represents an error.
 * - "admin" means that the bot is shared across all stories.
 */
export type BotSpace =
    | 'shared'
    | 'local'
    | 'tempLocal'
    | 'history'
    | 'error'
    | 'admin';

/**
 * The possible portal types.
 */
export type PortalType =
    | 'page'
    | 'inventory'
    | 'menu'
    | 'sheet'
    | 'stories'
    | string;

export interface ScriptTags extends PrecalculatedTags {
    toJSON(): any;
}

export interface BotTags {
    // Global bot tags
    ['auxInventoryHeight']?: unknown;
    ['auxVersion']?: unknown;

    // Normal bot tags
    ['auxColor']?: unknown;
    ['auxDraggable']?: unknown;
    ['auxDraggableMode']?: BotDragMode;
    ['auxPositioningMode']?: unknown;
    ['auxDestroyable']?: unknown;
    ['editable']?: unknown;
    ['strokeColor']?: unknown;
    ['strokeWidth']?: unknown;
    ['scale']?: number;
    ['scaleX']?: number;
    ['scaleY']?: number;
    ['scaleZ']?: number;
    ['scaleMode']?: BotScaleMode | null | string;
    ['lineTo']?: unknown;
    ['lineWidth']?: number;
    ['lineStyle']?: unknown;
    ['lineColor']?: unknown;
    ['label']?: unknown;
    ['labelColor']?: unknown;
    ['labelSize']?: unknown;
    ['labelSizeMode']?: 'auto' | null;
    ['labelPosition']?: BotLabelAnchor | null | string;
    ['labelAlignment']?: BotLabelAlignment | null | string;
    ['labelFontAddress']?: BotLabelFontAddress;
    ['listening']?: unknown;
    ['form']?: BotShape;
    ['formAnimation']?: string;
    ['formAddress']?: string;
    ['auxOrientationMode']?: string;
    ['auxAnchorPoint']?: string;
    ['creator']?: string;
    ['configBot']?: string;
    ['auxProgressBar']?: unknown;
    ['auxProgressBarColor']?: unknown;
    ['auxProgressBarBackgroundColor']?: unknown;
    ['auxProgressBarPosition']?: unknown;
    ['auxPointable']?: unknown;
    ['auxFocusable']?: unknown;

    // User tags
    ['auxPlayerActive']?: boolean;
    ['auxPagePortal']?: string | boolean;
    ['auxSheetPortal']?: string | boolean;
    ['auxStory']?: string | string[];
    ['auxInventoryPortal']?: string;
    ['auxMenuPortal']?: string;
    ['auxLeftWristPortal']?: string;
    ['auxRightWristPortal']?: string;
    ['auxPagePortalConfigBot']?: string;
    ['auxSheetPortalConfigBot']?: string;
    ['auxInventoryPortalConfigBot']?: string;
    ['auxMenuPortalConfigBot']?: string;
    ['auxLeftWristPortalConfigBot']?: string;
    ['auxRightWristPortalConfigBot']?: string;
    ['_auxEditingBot']?: string;

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
    ['auxDimensionConfig']?: string | number | boolean;
    ['auxPortalColor']?: string;
    ['auxPortalLocked']?: unknown;
    ['auxPortalGridScale']?: number;
    ['auxPortalSurfaceScale']?: number;
    ['auxPortalPlayerRotationX']?: number;
    ['auxPortalPlayerRotationY']?: number;
    ['auxPortalPlayerZoom']?: number;
    ['auxPortalPannable']?: number | null;
    [`auxPortalPannableMinX`]?: number | null;
    [`auxPortalPannableMaxX`]?: number | null;
    [`auxPortalPannableMinY`]?: number | null;
    [`auxPortalPannableMaxY`]?: number | null;
    ['auxPortalZoomable']?: number | null;
    [`auxPortalZoomableMin`]?: number | null;
    [`auxPortalZoomableMax`]?: number | null;
    ['auxPortalRotatable']?: number | null;
    ['auxPortalPointerDragMode']?: PortalPointerDragMode;
    ['auxPortalShowFocusPoint']?: boolean | null;
    ['auxPortalDisableCanvasTransparency']?: boolean;
    ['auxInventoryPortalHeight']?: unknown;
    ['auxInventoryPortalResizable']?: boolean;
    ['auxWristPortalHeight']?: number;
    ['auxWristPortalWidth']?: number;

    // Stripe tags
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
 * Defines the possible shapes that a bot can appear as.
 */
export type BotShape =
    | 'cube'
    | 'sphere'
    | 'sprite'
    | 'mesh'
    | 'iframe'
    | 'nothing';

/**
 * Defines the possible subtypes for shapes that a bot can appear as.
 */
export type BotSubShape = 'gltf' | 'src' | 'html' | null;

/**
 * Defines the possible drag modes that a bot can have.
 *
 * "all" means that the bot is able to be dragged freely inside and across contexts.
 * "none" means that the bot is not able to be dragged at all.
 * "pickupOnly" means that the bot should be able to be dragged across contexts but not within a dimension.
 * "moveOnly" means that the bot should be able to be dragged within a dimension but not across contexts.
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
 * Defines the possible scaling modes that a bot's mesh can have.
 *
 * "fit" means that the mesh is scaled to fit inside its bot unit cube.
 * "absolute" means that the mesh is not scaled to fit inside the bot unit cube.
 */
export type BotScaleMode = 'fit' | 'absolute';

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
 * Defines the possible label alignment types.
 */
export type BotLabelAlignment = 'center' | 'left' | 'right';

/**
 * Defines the possible label font addresses.
 */
export type BotLabelFontAddress = 'roboto' | 'noto-sans-kr' | string;

/**
 * Defines the possible bot orientation modes.
 */
export type BotOrientationMode =
    | 'absolute'
    | 'billboard'
    | 'billboardTop'
    | 'billboardFront';

/**
 * Defines the possible bot anchor points.
 */
export type BotAnchorPoint =
    | 'top'
    | 'front'
    | 'back'
    | 'left'
    | 'right'
    | 'bottom'
    | 'center'
    | [number, number, number];

/**
 * Defines the possible portal raycast modes.
 */
export type PortalPointerDragMode = 'grid' | 'world';

/**
 * Defines the possible backup types.
 */
export type BackupType = 'github' | 'download';

/**
 * Defines the possible dimension visualize modes.
 *
 * true means that the dimension is visible.
 * false means the dimension is not visible.
 * "surface" means the dimension is visible and renders a worksurface.
 */
export type DimensionVisualizeMode = true | false | 'surface';

/**
 * The possible LODs for a bot.
 */
export type BotLOD = 'normal' | 'min' | 'max';

/**
 * The default bot shape.
 */
export const DEFAULT_BOT_SHAPE: BotShape = 'cube';

/**
 * The default bot label anchor.
 */
export const DEFAULT_LABEL_ANCHOR: BotLabelAnchor = 'top';

/**
 * The default bot label alignment.
 */
export const DEFAULT_LABEL_ALIGNMENT: BotLabelAlignment = 'center';

/**
 * The default bot scale mode.
 */
export const DEFAULT_SCALE_MODE: BotScaleMode = 'fit';

/**
 * The default bot orientation mode.
 */
export const DEFAULT_ORIENTATION_MODE: BotOrientationMode = 'absolute';

/**
 * The default bot orientation mode.
 */
export const DEFAULT_ANCHOR_POINT: BotAnchorPoint = 'bottom';

/**
 * The default portal raycast mode.
 */
export const DEFAULT_PORTAL_POINTER_DRAG_MODE: PortalPointerDragMode = 'world';

/**
 * The default bot label font address.
 */
export const DEFAULT_LABEL_FONT_ADDRESS: BotLabelFontAddress = 'rotobo';

/**
 * Whether canvas transparency is disabled by default.
 */
export const DEFAULT_PORTAL_DISABLE_CANVAS_TRANSPARENCY: boolean = false;

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
 * Whether the inventory is visible by default.
 */
export const DEFAULT_INVENTORY_VISIBLE = false;

/**
 * Whether portals are pannable by default.
 */
export const DEFAULT_PORTAL_PANNABLE = true;

/**
 * Whether portals are rotatable by default.
 */
export const DEFAULT_PORTAL_ROTATABLE = true;

/**
 * Whether portals are zoomable by default.
 */
export const DEFAULT_PORTAL_ZOOMABLE = true;

/**
 * Whether portals should show their focus point.
 */
export const DEFAULT_PORTAL_SHOW_FOCUS_POINT = false;

/**
 * Whether inventory portals are resizable by default.
 */
export const DEFAULT_INVENTORY_PORTAL_RESIZABLE = true;

/**
 * The default height for inventory portals.
 */
export const DEFAULT_INVENTORY_PORTAL_HEIGHT = 0;

/**
 * The default height for wrist portals.
 */
export const DEFAULT_WRIST_PORTAL_HEIGHT = 6;

/**
 * The default width for wrist portals.
 */
export const DEFAULT_WRIST_PORTAL_WIDTH = 6;

/**
 * The default grid scale for wrist portals.
 */
export const DEFAULT_WRIST_PORTAL_GRID_SCALE = 0.025;

/**
 * The default bot LOD.
 */
export const DEFAULT_BOT_LOD: BotLOD = 'normal';

/**
 * The default minimum LOD threshold.
 */
export const DEFAULT_BOT_LOD_MIN_THRESHOLD = 0.0005;

/**
 * The default maximum LOD threshold.
 */
export const DEFAULT_BOT_LOD_MAX_THRESHOLD = 0.03;

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
 * The partition ID for error bots.
 */
export const ERROR_BOT_PARTITION_ID = 'error';

/**
 * The partition ID for admin bots.
 */
export const ADMIN_PARTITION_ID = 'admin';

/**
 * The name of the branch that contains admin space.
 */
export const ADMIN_BRANCH_NAME = '$admin';

/**
 * The dimension ID that all users should be placed in.
 */
export const USERS_DIMENSION = 'aux-users';

/**
 * The name of the tag used to represent the space that the bot is
 * stored in.
 */
export const BOT_SPACE_TAG = 'space';

/**
 * The name of the event that represents a bot being diffed into another bot.
 */
export const MOD_DROP_ACTION_NAME: string = 'onModDrop';

/**
 * The name of the event that represents a bot being created.
 */
export const CREATE_ACTION_NAME: string = 'onCreate';

/**
 * The name of the event that represents any bot being created.
 */
export const CREATE_ANY_ACTION_NAME: string = 'onAnyCreate';

/**
 * The name of the event that represents a bot being destroyed.
 */
export const DESTROY_ACTION_NAME: string = 'onDestroy';

/**
 * The name of the event that represents a bot being clicked.
 */
export const CLICK_ACTION_NAME: string = 'onClick';

/**
 * The name of the event that represents any bot being clicked.
 */
export const ANY_CLICK_ACTION_NAME: string = 'onAnyBotClicked';

/**
 * The name of the event that represents a bot entering over another bot.
 */
export const DROP_ENTER_ACTION_NAME: string = 'onDropEnter';

/**
 * The name of the event that represents a bot exiting from over another bot.
 */
export const DROP_EXIT_ACTION_NAME: string = 'onDropExit';

/**
 * The name of the event that represents a bot being dropped onto a dimension.
 */
export const DROP_ACTION_NAME: string = 'onDrop';

/**
 * The name of the event that represents any bot being dropped onto a dimension.
 */
export const DROP_ANY_ACTION_NAME: string = 'onAnyBotDrop';

/**
 * The name of the event that represents a bot starting to be dragged.
 */
export const DRAG_ACTION_NAME: string = 'onDrag';

/**
 * The name of the event that represents any bot starting to be dragged.
 */
export const DRAG_ANY_ACTION_NAME: string = 'onAnyBotDrag';

/**
 * The name of the event that represents a mod entering over a bot.
 */
export const MOD_DROP_ENTER_ACTION_NAME: string = 'onModDropEnter';

/**
 * The name of the event that represents a mod exiting from over a bot.
 */
export const MOD_DROP_EXIT_ACTION_NAME: string = 'onModDropExit';

/**
 * The name of the event that is triggered when a QR Code is scanned.
 */
export const ON_QR_CODE_SCANNED_ACTION_NAME: string = 'onQRCodeScanned';

/**
 * The name of the event that is triggered when the QR Code scanner is closed.
 */
export const ON_QR_CODE_SCANNER_CLOSED_ACTION_NAME: string =
    'onQRCodeScannerClosed';

/**
 * The name of the event that is triggered when the QR Code scanner is opened.
 */
export const ON_QR_CODE_SCANNER_OPENED_ACTION_NAME: string =
    'onQRCodeScannerOpened';

/**
 * The name of the event that is triggered when the Barcode scanner is closed.
 */
export const ON_BARCODE_SCANNER_CLOSED_ACTION_NAME: string =
    'onBarcodeScannerClosed';

/**
 * The name of the event that is triggered when the Barcode scanner is opened.
 */
export const ON_BARCODE_SCANNER_OPENED_ACTION_NAME: string =
    'onBarcodeScannerOpened';

/**
 * The name of the event that is triggered when a Barcode is scanned.
 */
export const ON_BARCODE_SCANNED_ACTION_NAME: string = 'onBarcodeScanned';

/**
 * The name of the event that is triggered when the checkout process is completed.
 */
export const ON_CHECKOUT_ACTION_NAME: string = 'onCheckout';

/**
 * The name of the event that is triggered when payment has been approved for the checkout.
 */
export const ON_PAYMENT_SUCCESSFUL_ACTION_NAME: string = 'onPaymentSuccessful';

/**
 * The name of the event that is triggered when payment has been rejected for the checkout.
 */
export const ON_PAYMENT_FAILED_ACTION_NAME: string = 'onPaymentFailed';

/**
 * The name of the event that is triggered when webhooks have been received.
 */
export const ON_WEBHOOK_ACTION_NAME: string = 'onWebhook';

/**
 * The name of the event that is triggered on every bot when a shout has been executed.
 */
export const ON_ANY_SHOUT_ACTION_NAME: string = 'onAnyListen';

/**
 * The name of the event that is triggered when a shout has been executed.
 */
export const ON_SHOUT_ACTION_NAME: string = 'onListen';

/**
 * The name of the event that is triggered before an action is executed.
 */
export const ON_ACTION_ACTION_NAME: string = 'onStoryAction';

/**
 * The name of the event that is triggered when a channel becomes synced.
 */
export const ON_STORY_STREAMING_ACTION_NAME: string = 'onStoryStreaming';

/**
 * The name of the event that is triggered when a channel has become unsynced.
 */
export const ON_STORY_STREAM_LOST_ACTION_NAME: string = 'onStoryStreamLost';

/**
 * The name of the event that is triggered when a channel is loaded.
 */
export const ON_STORY_SUBSCRIBED_ACTION_NAME: string = 'onStorySubscribed';

/**
 * The name of the event that is triggered when a channel is unloaded.
 */
export const ON_STORY_UNSUBSCRIBED_ACTION_NAME: string = 'onStoryUnsubscribed';

/**
 * The name of the event that is triggered when portal tag is changed on the player.
 */
export const ON_PLAYER_PORTAL_CHANGED_ACTION_NAME: string =
    'onPlayerPortalChanged';

/**
 * The name of the event that is triggered when a script is executed.
 */
export const ON_RUN_ACTION_NAME: string = 'onRun';

/**
 * The name of the event that is triggered when the text in the chat bar is updated.
 */
export const ON_CHAT_TYPING_ACTION_NAME: string = 'onChatTyping';

/**
 * The name of the event that is triggered when the text in the chat bar is submitted.
 */
export const ON_CHAT_ACTION_NAME: string = 'onChat';

/**
 * The name of the event that is triggered when text is pasted into aux.
 */
export const ON_PASTE_ACTION_NAME: string = 'onPaste';

/**
 * The name of the event that is triggered when the maximum LOD is entered.
 */
export const ON_MAX_LOD_ENTER_ACTION_NAME: string = 'onMaxLODEnter';

/**
 * The name of the event that is triggered when the minimum LOD is entered.
 */
export const ON_MIN_LOD_ENTER_ACTION_NAME: string = 'onMinLODEnter';

/**
 * The name of the event that is triggered when the maximum LOD is exited.
 */
export const ON_MAX_LOD_EXIT_ACTION_NAME: string = 'onMaxLODExit';

/**
 * The name of the event that is triggered when the minimum LOD is exited.
 */
export const ON_MIN_LOD_EXIT_ACTION_NAME: string = 'onMinLODExit';

/**
 * The name of the event that is triggered when the maximum LOD is entered.
 */
export const ON_ANY_MAX_LOD_ENTER_ACTION_NAME: string = 'onAnyMaxLODEnter';

/**
 * The name of the event that is triggered when the minimum LOD is entered.
 */
export const ON_ANY_MIN_LOD_ENTER_ACTION_NAME: string = 'onAnyMinLODEnter';

/**
 * The name of the event that is triggered when the maximum LOD is exited.
 */
export const ON_ANY_MAX_LOD_EXIT_ACTION_NAME: string = 'onAnyMaxLODExit';

/**
 * The name of the event that is triggered when the minimum LOD is exited.
 */
export const ON_ANY_MIN_LOD_EXIT_ACTION_NAME: string = 'onAnyMinLODExit';

/**
 * The name of the event that is triggered when the grid is clicked.
 */
export const ON_GRID_CLICK_ACTION_NAME: string = 'onGridClick';

/**
 * The name of the event that is triggered when the grid starts getting pressed.
 */
export const ON_GRID_UP_ACTION_NAME: string = 'onGridUp';

/**
 * The name of the event that is triggered when the grid stops getting pressed.
 */
export const ON_GRID_DOWN_ACTION_NAME: string = 'onGridDown';

/**
 * The name of the event that is triggered when a file is uploaded.
 */
export const ON_FILE_UPLOAD_ACTION_NAME: string = 'onFileUpload';

/**
 * The name of the event that is triggerd when a bot gains camera focus.
 */
export const ON_FOCUS_ENTER_ACTION_NAME: string = 'onFocusEnter';

/**
 * The name of the event that is triggerd when a bot loses camera focus.
 */
export const ON_FOCUS_EXIT_ACTION_NAME: string = 'onFocusExit';

/**
 * The name of the event that is triggerd when a bot gains camera focus.
 */
export const ON_ANY_FOCUS_ENTER_ACTION_NAME: string = 'onAnyFocusEnter';

/**
 * The name of the event that is triggerd when a bot loses camera focus.
 */
export const ON_ANY_FOCUS_EXIT_ACTION_NAME: string = 'onAnyFocusExit';

/**
 * The current bot format version for AUX Bots.
 * This number increments whenever there are any changes between AUX versions.
 * As a result, it will allow us to make breaking changes but still upgrade people's bots
 * in the future.
 */
export const AUX_BOT_VERSION: number = 1;

/**
 * The list of all portal tags.
 */
export const KNOWN_PORTALS: string[] = [
    'auxPagePortal',
    'auxSheetPortal',
    'auxInventoryPortal',
    'auxMenuPortal',
    'auxLeftWristPortal',
    'auxRightWristPortal',
];

/**
 * The list of portal tags that should always be represented in the query string.
 */
export const QUERY_PORTALS: string[] = ['auxPagePortal', 'auxSheetPortal'];

/*
 * The list of all tags that have existing functionality in casual sim
 */
export const KNOWN_TAGS: string[] = [
    'playerActive',
    'auxPagePortal',
    'auxSheetPortal',
    'auxStory',
    'auxInventoryPortal',
    'auxMenuPortal',
    'auxLeftWristPortal',
    'auxRightWristPortal',
    'auxPagePortalConfigBot',
    'auxSheetPortalConfigBot',
    'auxInventoryPortalConfigBot',
    'auxMenuPortalConfigBot',
    'auxLeftWristPortalConfigBot',
    'auxRightWristPortalConfigBot',
    '_auxEditingBot',
    'auxConnectedSessions',

    'auxPortalColor',
    'auxPortalLocked',
    'auxPortalPannable',
    `auxPortalPannableMinX`,
    `auxPortalPannableMaxX`,
    `auxPortalPannableMinY`,
    `auxPortalPannableMaxY`,
    'auxPortalZoomable',
    `auxPortalZoomableMin`,
    `auxPortalZoomableMax`,
    'auxPortalRotatable',
    'auxPortalGridScale',
    'auxPortalSurfaceScale',
    `auxPortalPlayerZoom`,
    `auxPortalPlayerRotationX`,
    `auxPortalPlayerRotationY`,
    'auxPortalPointerDragMode',
    'auxPortalShowFocusPoint',
    'auxPortalDisableCanvasTransparency',
    'auxInventoryPortalHeight',
    'auxInventoryPortalResizable',
    'auxWristPortalHeight',
    'auxWristPortalWidth',

    'color',
    'creator',
    'configBot',
    'draggable',
    'draggableMode',
    'positioningMode',
    'destroyable',
    'editable',
    'strokeColor',
    'strokeWidth',
    'lineTo',
    'lineStyle',
    'lineWidth',
    'lineColor',
    'label',
    'labelColor',
    'labelSize',
    'labelSizeMode',
    'labelPosition',
    'labelAlignment',
    'labelFontAddress',
    'listening',
    'scale',
    'scaleX',
    'scaleY',
    'scaleZ',
    'scaleMode',
    'formAddress',
    'formSubtype',
    'form',
    'formAnimation',
    'auxOrientationMode',
    'auxAnchorPoint',
    'auxGLTFVersion',
    'auxProgressBar',
    'auxProgressBarColor',
    'auxProgressBarBackgroundColor',
    'auxProgressBarPosition',
    'auxMaxLODThreshold',
    'auxMinLODThreshold',
    'auxPointable',
    'auxFocusable',

    'auxTaskOutput',
    'auxTaskError',
    'auxTaskTime',
    'auxTaskShell',
    'auxTaskBackup',
    'auxTaskBackupType',
    'auxTaskBackupUrl',

    'auxError',
    'auxErrorName',
    'auxErrorMessage',
    'auxErrorStack',
    'auxErrorBot',
    'auxErrorTag',

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

    CLICK_ACTION_NAME,
    'onAnyBotClicked',
    MOD_DROP_ENTER_ACTION_NAME,
    MOD_DROP_EXIT_ACTION_NAME,
    MOD_DROP_ACTION_NAME,
    'onSaveInput',
    'onCloseInput',
    CREATE_ACTION_NAME,
    CREATE_ANY_ACTION_NAME,
    DESTROY_ACTION_NAME,
    DROP_ENTER_ACTION_NAME,
    DROP_EXIT_ACTION_NAME,
    DROP_ACTION_NAME,
    DROP_ANY_ACTION_NAME,
    DRAG_ACTION_NAME,
    DRAG_ANY_ACTION_NAME,
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
    ON_STORY_STREAMING_ACTION_NAME,
    ON_STORY_STREAM_LOST_ACTION_NAME,
    ON_STORY_SUBSCRIBED_ACTION_NAME,
    ON_STORY_UNSUBSCRIBED_ACTION_NAME,
    ON_PLAYER_PORTAL_CHANGED_ACTION_NAME,
    'onKeyDown',
    'onKeyUp',
    ON_GRID_CLICK_ACTION_NAME,
    ON_GRID_UP_ACTION_NAME,
    ON_GRID_DOWN_ACTION_NAME,
    'onCheckout',
    'onPaymentSuccessful',
    'onPaymentFailed',
    'onWebhook',
    'onAnyListen',
    'onListen',
    ON_ACTION_ACTION_NAME,
    ON_RUN_ACTION_NAME,
    ON_CHAT_TYPING_ACTION_NAME,
    ON_CHAT_ACTION_NAME,
    ON_PASTE_ACTION_NAME,
    ON_MAX_LOD_ENTER_ACTION_NAME,
    ON_MIN_LOD_ENTER_ACTION_NAME,
    ON_MAX_LOD_EXIT_ACTION_NAME,
    ON_MIN_LOD_EXIT_ACTION_NAME,
    ON_ANY_MAX_LOD_ENTER_ACTION_NAME,
    ON_ANY_MIN_LOD_ENTER_ACTION_NAME,
    ON_ANY_MAX_LOD_EXIT_ACTION_NAME,
    ON_ANY_MIN_LOD_EXIT_ACTION_NAME,
    ON_FILE_UPLOAD_ACTION_NAME,

    ON_FOCUS_ENTER_ACTION_NAME,
    ON_FOCUS_EXIT_ACTION_NAME,
    ON_ANY_FOCUS_ENTER_ACTION_NAME,
    ON_ANY_FOCUS_EXIT_ACTION_NAME,
];

export function onClickArg(face: string, dimension: string) {
    return {
        face,
        dimension,
    };
}

export function onAnyClickArg(face: string, dimension: string, bot: Bot) {
    return {
        ...onClickArg(face, dimension),
        bot,
    };
}

export function onDragArg(bot: Bot, from: BotDropDestination, face: string) {
    return {
        face,
        bot,
        from,
    };
}

export function onModDropArg(mod: BotTags, dimension: string) {
    return {
        mod,
        dimension,
    };
}

export function onDropArg(
    dragBot: Bot,
    to: BotDropToDestination,
    from: BotDropDestination
) {
    return {
        dragBot,
        to,
        from,
    };
}

export function onStoryStreamingArg(story: string) {
    return {
        story,
    };
}

export function onStoryStreamLostArg(story: string) {
    return {
        story,
    };
}

export function onStorySubscribedArg(story: string) {
    return {
        story,
    };
}

export function onStoryUnsubscribedArg(story: string) {
    return {
        story,
    };
}

export function onChatTypingArg(message: string) {
    return {
        message,
    };
}

export function onChatArg(message: string) {
    return {
        message,
    };
}

export function onPasteArg(text: string) {
    return {
        text,
    };
}

export function onLODArg(bot: Bot, dimension: string) {
    return {
        bot,
        dimension,
    };
}

export interface BotDropDestination {
    x: number;
    y: number;
    dimension: string;
}

export interface BotDropToDestination extends BotDropDestination {
    bot: Bot;
}
