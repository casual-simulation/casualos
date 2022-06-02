import { TagEditOp } from '../aux-format-2';

export type PartialBot = Partial<Bot>;

export type AuxDomain = 'builder' | 'player';

export type Workspace = Bot;

/**
 * Defines a symbol that is used to clear changes on a runtime bot.
 */
export const CLEAR_CHANGES_SYMBOL = Symbol('clear_changes');

/**
 * Defines a symbol that is used to set a tag mask on a runtime bot.
 */
export const SET_TAG_MASK_SYMBOL = Symbol('set_tag_mask');

/**
 * Defines a symbol that is used to get a tag mask on a runtime bot.
 */
export const GET_TAG_MASK_SYMBOL = Symbol('get_tag_mask');

/**
 * Defines a symbol that is used to get all the tag masks on a runtime bot.
 */
export const CLEAR_TAG_MASKS_SYMBOL = Symbol('clear_tag_masks');

/**
 * Defines a symbol that is used to edit a tag.
 */
export const EDIT_TAG_SYMBOL = Symbol('edit_tag');

/**
 * Defines a symbol that is used to edit a  tag mask.
 */
export const EDIT_TAG_MASK_SYMBOL = Symbol('edit_tag_mask');

/**
 * Defines a symbol that is used to get tag masks for a bot.
 */
export const GET_TAG_MASKS_SYMBOL = Symbol('get_tag_masks');

/**
 * Defines an interface for a bot in a script/formula.
 *
 * The difference between this and Bot is that the tags
 * are calculated values and raw is the original tag values.
 *
 * i.e. tags will evaluate formulas while raw will return the formula scripts themselves.
 */
export interface RuntimeBot {
    id: string;
    link: string;
    space?: BotSpace;

    /**
     * The calculated tag values.
     * This lets you get the calculated values from formulas.
     */
    tags: ScriptTags;

    /**
     * The raw tag values. This lets you get the raw script text from formulas.
     */
    raw: BotTags;

    /**
     * The tag masks that have been applied to this bot.
     */
    masks: BotTags;

    /**
     * The tags on the bot that link to other bots.
     */
    links: RuntimeBotLinks;

    /**
     * The variables that the bot contains.
     */
    vars: RuntimeBotVars;

    /**
     * The changes that have been made to the bot.
     */
    changes: BotTags;

    /**
     * The tag mask changes that have been made to the bot.
     */
    maskChanges: BotTagMasks;

    /**
     * The signatures that are on the bot.
     */
    signatures: BotSignatures;

    /**
     * The calculated listener functions.
     * This lets you get the compiled listener functions.
     */
    listeners: CompiledBotListeners;

    /**
     * A function that can clear all the changes from the runtime bot.
     */
    [CLEAR_CHANGES_SYMBOL]: () => void;

    /**
     * A function that can set a tag mask on the bot.
     */
    [SET_TAG_MASK_SYMBOL]: (tag: string, value: any, space?: string) => void;

    /**
     * A function that can be used to get the tag masks for a bot.
     */
    [GET_TAG_MASKS_SYMBOL]: () => BotTagMasks;

    /**
     * A function that can clear the tag masks from the bot.
     * @param space The space that the masks should be cleared from. If not specified then all tag masks in all spaces will be cleared.
     */
    [CLEAR_TAG_MASKS_SYMBOL]: (space?: string) => any;

    /**
     * A function that can manipulate a tag using the given edit operations.
     */
    [EDIT_TAG_SYMBOL]: (tag: string, ops: TagEditOp[]) => any;

    /**
     * A function that can manipulate a tag mask using the given edit operations.
     */
    [EDIT_TAG_MASK_SYMBOL]: (
        tag: string,
        ops: TagEditOp[],
        space: string
    ) => any;

    /**
     * Gets the listener with the given name.
     */
    [listener: string]: CompiledBotListener | any;
}

/**
 * Defines an interface that represents a bot link that was parsed from a tag.
 */
export interface ParsedBotLink {
    /**
     * The tag that the link was parsed from.
     */
    tag: string;

    /**
     * The bot IDs that the link references.
     */
    botIDs: string[];
}

/**
 * Defines an interface that represents the bot links a bot can have.
 */
export interface RuntimeBotLinks {
    [tag: string]: RuntimeBot | RuntimeBot[];
}

/**
 * Defines an interface that represents the variables a bot can have.
 */
export interface RuntimeBotVars {
    [variable: string]: any;
}

/**
 * An interface that maps tag names to compiled listener functions.
 */
export interface CompiledBotListeners {
    [tag: string]: CompiledBotListener;
}

/**
 * The type of a compiled bot listener.
 */
export type CompiledBotListener = (arg?: any) => any;

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

    /**
     * The set of signatures that the bot contains.
     */
    signatures?: BotSignatures;

    /**
     * The set of tag masks that have been applied to the bot.
     */
    masks?: BotTagMasks;
}

/**
 * Defines an interface for a record.
 */
export interface Record {
    /**
     * The address that the record was published at.
     */
    address: string;

    /**
     * The space that the record was published to.
     */
    space: RecordSpace;

    /**
     * The auth ID that published the record.
     */
    authID: string;

    /**
     * The data that was stored in the record.
     */
    data?: any;
    dataURL?: string;
}

/**
 * Defines an interface for an object that represents a reference to a specific record.
 */
export interface RecordReference {
    /**
     * The ID of the user that published the record.
     */
    authID: string;

    /**
     * The space that the record lives in.
     */
    space: RecordSpace;

    /**
     * The address that the record was published to.
     */
    address: string;
}

/**
 * Defines an interface that indicates a bot was updated.
 */
export interface UpdatedBot {
    /**
     * The updated bot.
     */
    bot: Bot;

    /**
     * The tags that were updated on the bot.
     */
    tags: string[];

    /**
     * The signatures that were updated on the bot.
     */
    signatures?: string[];
}

/**
 * The possible bot types.
 *
 * - "shared" means that the bot is a normal bot.
 * - "local" means that the bot is stored in the local storage partition.
 * - "tempLocal" means that the bot is stored in the temporary partition.
 * - "history" means that the bot represents a version of another space.
 * - "admin" means that the bot is shared across all instances.
 * - "tempShared" means that the bot is temporary and shared with other devices.
 * - "remoteTempShared" means that the bot is temporary and shared with this device from a remote device.
 * - "certified" means that the bot is a certificate.
 */
export type BotSpace =
    | 'shared'
    | 'local'
    | 'tempLocal'
    | 'history'
    | 'admin'
    | 'tempShared'
    | 'remoteTempShared'
    | 'certified';

/**
 * The possible spaces that records can be stored in.
 *
 * - "tempGlobal" means that the record is temporary and available to anyone.
 * - "tempRestricted" means that the record is temporary and available to a specific user.
 * - "permanentGlobal" means that the record is permanent and available to anyone.
 * - "permanentRestricted" means that the record is permanent and available to a specific user.
 */
export type RecordSpace =
    | 'tempGlobal'
    | 'tempRestricted'
    | 'permanentGlobal'
    | 'permanentRestricted';

/**
 * The space that records should be published to by default.
 */
export const DEFAULT_RECORD_SPACE: RecordSpace = 'tempRestricted';

/**
 * The possible portal types.
 */
export type PortalType =
    | 'grid'
    | 'miniGrid'
    | 'menu'
    | 'sheet'
    | 'meet'
    | string;

export interface ScriptTags extends PrecalculatedTags {
    toJSON(): any;
}

/**
 * Defines an interface for a map of tag+value hashes to tag names.
 *
 * Each key in the object is the hash of an array with the tag name as the first value
 * and the value as the second value using the getHash() function from the crypto package.
 *
 * This means that you can lookup if a tag/value pair has a hash by simply calculating the hash for it and then checking if the corresponding value
 * in the object is set to true.
 */
export interface BotSignatures {
    [hash: string]: string;
}

/**
 * Defines an interface for a map of tag masks to tag names.
 *
 * Tag masks are special tags that can exist in a different space from the bot they are applied to.
 * This makes it possible to have some local-only data applied to a shared bot for example.
 *
 * The actual data structure is similar to the bot tags structure except that tags are additionally
 * split by the space that they originated from. This makes it possible to identify which space a tag came from and also
 * prevents cross-space conflicts.
 */
export interface BotTagMasks {
    [space: string]: BotTags;
}

export interface BotTags {
    // Normal bot tags
    ['color']?: unknown;
    ['draggable']?: unknown;
    ['draggableMode']?: unknown;
    ['destroyable']?: unknown;
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
    ['orientationMode']?: string;
    ['anchorPoint']?: string;
    ['creator']?: string;
    ['progressBar']?: unknown;
    ['progressBarColor']?: unknown;
    ['progressBarBackgroundColor']?: unknown;
    ['progressBarPosition']?: unknown;
    ['pointable']?: unknown;
    ['focusable']?: unknown;

    // User tags
    ['auxPlayerActive']?: boolean;
    ['gridPortal']?: string | boolean;
    ['sheetPortal']?: string | boolean;
    ['inst']?: string | string[];
    ['miniGridPortal']?: string;
    ['menuPortal']?: string;
    ['leftWristPortal']?: string;
    ['rightWristPortal']?: string;
    ['editingBot']?: string;
    cursorStartIndex?: number;
    cursorEndIndex?: number;
    ['pixelWidth']?: number;
    ['pixelHeight']?: number;

    // Admin channel task tags
    ['auxRunningTasks']?: boolean;
    ['auxFinishedTasks']?: boolean;
    ['taskOutput']?: unknown;
    ['taskError']?: unknown;
    ['taskTime']?: unknown;
    ['taskShell']?: string;
    ['taskBackup']?: boolean;
    ['taskBackupType']?: BackupType;
    ['taskBackupUrl']?: string;

    // Context related tags
    ['portalColor']?: string;
    ['portalLocked']?: unknown;
    ['portalGridScale']?: number;
    ['portalSurfaceScale']?: number;
    ['portalCameraRotationX']?: number;
    ['portalCameraRotationY']?: number;
    ['portalCameraZoom']?: number;
    ['portalPannable']?: number | null;
    [`portalPannableMinX`]?: number | null;
    [`portalPannableMaxX`]?: number | null;
    [`portalPannableMinY`]?: number | null;
    [`portalPannableMaxY`]?: number | null;
    ['portalZoomable']?: number | null;
    [`portalZoomableMin`]?: number | null;
    [`portalZoomableMax`]?: number | null;
    ['portalRotatable']?: number | null;
    ['portalShowFocusPoint']?: boolean | null;
    ['portalDisableCanvasTransparency']?: boolean;
    ['miniPortalHeight']?: unknown;
    ['miniPortalResizable']?: boolean;
    ['wristPortalHeight']?: number;
    ['wristPortalWidth']?: number;

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
    | 'circle'
    | 'sphere'
    | 'sprite'
    | 'mesh'
    | 'iframe'
    | 'frustum'
    | 'helix'
    | 'egg'
    | 'hex'
    | 'cursor'
    | 'portal'
    | 'dimension'
    | 'nothing';

/**
 * Defines the possible forms that a menu bot can appear as.
 */
export type MenuBotForm = 'button' | 'input';

/**
 * Defines the possible hover styles that can be used for a menu bot.
 * Currently only applies to button menu bots.
 */
export type MenuBotHoverStyle = 'auto' | 'hover' | 'none';

/**
 * Defines the possible hover styles that have been resolved from a bot.
 */
export type MenuBotResolvedHoverStyle = 'hover' | 'none';

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
 * Defines the possible label font sizes.
 */
export type BotLabelFontSize = 'auto' | number;

export type BotLabelWordWrap = 'breakWords' | 'breakCharacters' | 'none';

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
    | readonly [number, number, number];

/**
 * Defines the possible meet portal anchor points.
 */
export type MeetPortalAnchorPoint =
    | 'fullscreen'
    | 'top'
    | 'topRight'
    | 'topLeft'
    | 'bottom'
    | 'bottomRight'
    | 'bottomLeft'
    | 'left'
    | 'right'
    | [number | string]
    | [number | string, number | string]
    | [number | string, number | string, number | string]
    | [number | string, number | string, number | string, number | string];

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
 * The possible camera control modes.
 */
export type PortalCameraControlsMode = 'player' | false;

/**
 * The possible camera types.
 */
export type PortalCameraType = 'orthographic' | 'perspective';

/**
 * The possible bot cursors.
 */
export type BotCursorType =
    | 'auto'
    | 'default'
    | 'none'
    | 'context-menu'
    | 'help'
    | 'pointer'
    | 'progress'
    | 'wait'
    | 'cell'
    | 'crosshair'
    | 'text'
    | 'vertical-text'
    | 'alias'
    | 'copy'
    | 'move'
    | 'no-drop'
    | 'not-allowed'
    | 'grab'
    | 'grabbing'
    | 'all-scroll'
    | 'col-resize'
    | 'row-resize'
    | 'n-resize'
    | 'e-resize'
    | 's-resize'
    | 'w-resize'
    | 'ne-resize'
    | 'nw-resize'
    | 'se-resize'
    | 'sw-resize'
    | 'ew-resize'
    | 'ns-resize'
    | 'nesw-resize'
    | 'nwse-resize'
    | 'zoom-in'
    | 'zoom-out'
    | BotCursorLink;

export interface BotCursorLink {
    type: 'link';
    url: string;
    x: number;
    y: number;
}

/**
 * Defines an interface that represents the padding that a bot label should have.
 */
export interface BotLabelPadding {
    /**
     * The horizontal padding that the label should have.
     */
    horizontal: number;

    /**
     * The vertical padding that the label should have.
     */
    vertical: number;
}

/**
 * The default bot cursor.
 */
export const DEFAULT_BOT_CURSOR: BotCursorType = 'auto';

/**
 * The default bot shape.
 */
export const DEFAULT_BOT_SHAPE: BotShape = 'cube';

/**
 * The default menu bot form.
 */
export const DEFAULT_MENU_BOT_FORM: MenuBotForm = 'button';

/**
 * The default menu bot hover style.
 */
export const DEFAULT_MENU_BOT_HOVER_STYLE: MenuBotHoverStyle = 'auto';

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
 * The default portal camera controls mode.
 */
export const DEFAULT_PORTAL_CAMERA_CONTROLS_MODE: PortalCameraControlsMode =
    'player';

/**
 * The default bot label font address.
 */
export const DEFAULT_LABEL_FONT_ADDRESS: BotLabelFontAddress = 'rotobo';

/**
 * The default bot label font address.
 */
export const DEFAULT_LABEL_FONT_SIZE: BotLabelFontSize = 'auto';

/**
 * The default bot label word wrapping mode.
 */
export const DEFAULT_LABEL_WORD_WRAP_MODE: BotLabelWordWrap = 'breakCharacters';

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
 * Whether the miniGridPortal is visible by default.
 */
export const DEFAULT_MINI_PORTAL_VISIBLE = false;

/**
 * Whether the map portal is visible by default.
 */
export const DEFAULT_MAP_PORTAL_VISIBLE = false;

/**
 * The default scale for the map portal grid.
 */
export const DEFAULT_MAP_PORTAL_SCALE = 1;

/**
 * The default grid scale for the map portal.
 */
export const DEFAULT_MAP_PORTAL_GRID_SCALE = 10;

/**
 * The default basemap that should be used for the map portal.
 * See https://developers.arcgis.com/javascript/latest/api-reference/esri-Map.html#basemap
 */
export const DEFAULT_MAP_PORTAL_BASEMAP = 'dark-gray';

/**
 * The default longitude that the map portal should show.
 */
export const DEFAULT_MAP_PORTAL_LONGITUDE = -84.71112905478944;

/**
 * The default latitude that the map portal should show.
 */
export const DEFAULT_MAP_PORTAL_LATITUDE = 43.152972972972975;

/**
 * The default zoom that the map portal should show.
 */
export const DEFAULT_MAP_PORTAL_ZOOM = 7;

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
 * Whether miniGridPortals are resizable by default.
 */
export const DEFAULT_MINI_PORTAL_RESIZABLE = true;

/**
 * The default height for miniGridPortals.
 */
export const DEFAULT_MINI_PORTAL_HEIGHT = 0.2;

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
 * The default anchor point for the meet portal.
 */
export const DEFAULT_MEET_PORTAL_ANCHOR_POINT: MeetPortalAnchorPoint =
    'fullscreen';

/**
 * The default anchor point for the tag portal.
 */
export const DEFAULT_TAG_PORTAL_ANCHOR_POINT: MeetPortalAnchorPoint =
    'fullscreen';

/**
 * The default anchor point for the bot portal.
 */
export const DEFAULT_BOT_PORTAL_ANCHOR_POINT: MeetPortalAnchorPoint =
    'fullscreen';

/**
 * The default anchor point for custom portals.
 */
export const DEFAULT_CUSTOM_PORTAL_ANCHOR_POINT: MeetPortalAnchorPoint = 'top';

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
 * The partition ID for admin bots.
 */
export const ADMIN_PARTITION_ID = 'admin';

/**
 * The partition ID for temporary shared bots.
 */
export const TEMPORARY_SHARED_PARTITION_ID = 'tempShared';

/**
 * The partition ID for bots that are automatically added to the instance.
 */
export const BOOTSTRAP_PARTITION_ID = 'bootstrap';

/**
 * The partition ID for other temp shared bots.
 */
export const REMOTE_TEMPORARY_SHARED_PARTITION_ID = 'remoteTempShared';

/**
 * The space that tag masks get placed in by default.
 */
export const DEFAULT_TAG_MASK_SPACE: BotSpace = 'tempLocal';

/**
 * The list of spaces that tag masks should be prioritized by.
 * Listed in reverse order of where they actually end up applied.
 */
export const TAG_MASK_SPACE_PRIORITIES_REVERSE = [
    'admin',
    'shared',
    'remoteTempShared',
    'tempShared',
    'local',
    'tempLocal',
] as BotSpace[];

/**
 * The list of spaces that tag masks should be prioritized by.
 */
export const TAG_MASK_SPACE_PRIORITIES = [
    'tempLocal',
    'local',
    'tempShared',
    'remoteTempShared',
    'shared',
    'admin',
] as BotSpace[];

/**
 * The name of the branch that contains admin space.
 */
export const ADMIN_BRANCH_NAME = '$admin';

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
 * The name of the event that represents a bot entering over another bot.
 */
export const ANY_DROP_ENTER_ACTION_NAME: string = 'onAnyBotDropEnter';

/**
 * The name of the event that represents a bot exiting from over another bot.
 */
export const ANY_DROP_EXIT_ACTION_NAME: string = 'onAnyBotDropExit';

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
 * The name of the event that represents a bot being dragged.
 */
export const DRAGGING_ACTION_NAME: string = 'onDragging';

/**
 * The name of the event that represents any bot being dragged.
 */
export const DRAGGING_ANY_ACTION_NAME: string = 'onAnyBotDragging';

/**
 * The name of the event that represents a mod entering over a bot.
 */
export const MOD_DROP_ENTER_ACTION_NAME: string = 'onModDropEnter';

/**
 * The name of the event that represents a mod exiting from over a bot.
 */
export const MOD_DROP_EXIT_ACTION_NAME: string = 'onModDropExit';

/**
 * The name of the event that is triggered when a pointer starts hovering a bot.
 */
export const ON_POINTER_ENTER: string = 'onPointerEnter';

/**
 * The name of the event that is triggered when a pointer stops hovering a bot.
 */
export const ON_POINTER_EXIT: string = 'onPointerExit';

/**
 * The name of the event that is triggered when a pointer starts hovering any bot.
 */
export const ON_ANY_POINTER_ENTER: string = 'onAnyBotPointerEnter';

/**
 * The name of the event that is triggered when a pointer stops hovering any bot.
 */
export const ON_ANY_POINTER_EXIT: string = 'onAnyBotPointerExit';

/**
 * The name of the event that is triggered when a pointer starts clicking a bot.
 */
export const ON_POINTER_DOWN: string = 'onPointerDown';

/**
 * The name of the event that is triggered when a pointer stops clicking a bot.
 */
export const ON_POINTER_UP: string = 'onPointerUp';

/**
 * The name of the event that is triggered when a pointer starts hovering any bot.
 */
export const ON_ANY_POINTER_DOWN: string = 'onAnyBotPointerDown';

/**
 * The name of the event that is triggered when a pointer stops hovering any bot.
 */
export const ON_ANY_POINTER_UP: string = 'onAnyBotPointerUp';

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
 * The name of the event that is triggered when the image classifier is closed.
 */
export const ON_IMAGE_CLASSIFIER_CLOSED_ACTION_NAME: string =
    'onImageClassifierClosed';

/**
 * The name of the event that is triggered when the image classifier is opened.
 */
export const ON_IMAGE_CLASSIFIER_OPENED_ACTION_NAME: string =
    'onImageClassifierOpened';

/**
 * The name of the event that is triggered when an image is classified.
 */
export const ON_IMAGE_CLASSIFIED_ACTION_NAME: string = 'onImageClassified';

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
export const ON_ACTION_ACTION_NAME: string = 'onAnyAction';

/**
 * The name of the event that is triggered when a remote whisper is executed.
 */
// TODO: Remove this action
export const ON_REMOTE_WHISPER_ACTION_NAME: string = 'onRemoteWhisper';

/**
 * The name of the event that is triggered when a remote whisper is executed.
 */
export const ON_REMOTE_DATA_ACTION_NAME: string = 'onRemoteData';

/**
 * The name of the event that is triggered when a channel becomes synced.
 */
export const ON_SERVER_STREAMING_ACTION_NAME: string = 'onServerStreaming';

/**
 * The name of the event that is triggered when a channel has become unsynced.
 */
export const ON_SERVER_STREAM_LOST_ACTION_NAME: string = 'onServerStreamLost';

/**
 * The name of the event that is triggered when a inst becomes synced.
 */
export const ON_INST_STREAMING_ACTION_NAME: string = 'onInstStreaming';

/**
 * The name of the event that is triggered when a inst has become unsynced.
 */
export const ON_INST_STREAM_LOST_ACTION_NAME: string = 'onInstStreamLost';

/**
 * The name of the event that is triggered when a channel is loaded.
 */
// TODO: Remove this action
export const ON_SERVER_SUBSCRIBED_ACTION_NAME: string = 'onServerSubscribed';

/**
 * The name of the event that is triggered when a channel is loaded.
 */
export const ON_SERVER_JOINED_ACTION_NAME: string = 'onServerJoined';

/**
 * The name of the event that is triggered when a inst is loaded.
 */
export const ON_INST_JOINED_ACTION_NAME: string = 'onInstJoined';

/**
 * The name of the event that is triggered when a channel is unloaded.
 */
// TODO: Remove this action
export const ON_SERVER_UNSUBSCRIBED_ACTION_NAME: string =
    'onServerUnsubscribed';

/**
 * The name of the event that is triggered when a channel is unloaded.
 */
export const ON_SERVER_LEAVE_ACTION_NAME: string = 'onServerLeave';

/**
 * The name of the event that is triggered when a channel is unloaded.
 */
export const ON_INST_LEAVE_ACTION_NAME: string = 'onInstLeave';

/**
 * The name of the event that is triggered when portal tag is changed on the config bot.
 */
// TODO: Remove this action
export const ON_PLAYER_PORTAL_CHANGED_ACTION_NAME: string =
    'onPlayerPortalChanged';

/**
 * The name of the event that is triggered when portal tag is changed on the config bot.
 */
export const ON_PORTAL_CHANGED_ACTION_NAME: string = 'onPortalChanged';

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
 * The name of the event that is triggered when the text in a menu bot input is submitted.
 */
export const ON_SUBMIT_ACTION_NAME: string = 'onSubmit';

/**
 * The name of the event that is triggered when the text in a menu bot input is updated.
 */
export const ON_INPUT_TYPING_ACTION_NAME: string = 'onInputTyping';

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
 * The name of the event that is triggered when a remote player joins the game.
 */
// TODO: Remove this action
export const ON_REMOTE_PLAYER_SUBSCRIBED_ACTION_NAME: string =
    'onRemotePlayerSubscribed';

/**
 * The name of the event that is triggered when a remote player joins the game.
 */
export const ON_REMOTE_JOINED_ACTION_NAME: string = 'onRemoteJoined';

/**
 * The name of the event that is triggered when a remote player leaves the game.
 */
// TODO: Remove
export const ON_REMOTE_PLAYER_UNSUBSCRIBED_ACTION_NAME: string =
    'onRemotePlayerUnsubscribed';

/**
 * The name of the event that is triggered when a remote player leaves the game.
 */
export const ON_REMOTE_LEAVE_ACTION_NAME: string = 'onRemoteLeave';

/**
 * The name of the event that is triggered when a bot is added to the local simulation.
 */
export const ON_BOT_ADDED_ACTION_NAME = 'onBotAdded';

/**
 * The name of the event that is triggered when any bot is added to the local simulation.
 */
export const ON_ANY_BOTS_ADDED_ACTION_NAME = 'onAnyBotsAdded';

/**
 * The name of the event that is triggered when any bot is removed from the local simulation.
 */
export const ON_ANY_BOTS_REMOVED_ACTION_NAME = 'onAnyBotsRemoved';

/**
 * The name of the event that is triggered when a bot is changed.
 */
export const ON_BOT_CHANGED_ACTION_NAME = 'onBotChanged';

/**
 * The name of the event that is triggered when any bot is changed in the local simulation.
 */
export const ON_ANY_BOTS_CHANGED_ACTION_NAME = 'onAnyBotsChanged';

/**
 * The name of the event that is triggered when a tag is clicked in the sheet.
 */
export const ON_SHEET_TAG_CLICK = 'onSheetTagClick';

/**
 * The name of the event that is triggered when a Bot's ID is clicked in the sheet.
 */
export const ON_SHEET_BOT_ID_CLICK = 'onSheetBotIDClick';

/**
 * The name of the event that is triggered when a Bot is clicked in the sheet.
 */
export const ON_SHEET_BOT_CLICK = 'onSheetBotClick';

/**
 * The name of the event that is triggered when a listen tag encounters an unhandled error.
 */
export const ON_ERROR = 'onError';

/**
 * The name of the event that is triggered when a portal is being configured.
 */
export const ON_APP_SETUP_ACTION_NAME = 'onAppSetup';

/**
 * The tag used to set the space that the tag portal operates in.
 */
export const TAG_PORTAL_SPACE: string = 'tagPortalSpace';

/**
 * The name of the event that is triggered when an audio sample is resolved.
 */
export const ON_AUDIO_SAMPLE: string = 'onAudioChunk';

/**
 * The name of the event that is triggered when audio recording is started.
 */
export const ON_BEGIN_AUDIO_RECORDING: string = 'onBeginAudioRecording';

/**
 * The name of the event that is triggered when audio recording is stopped.
 */
export const ON_END_AUDIO_RECORDING: string = 'onEndAudioRecording';

/**
 * The name of the event that is triggered when VR is entered.
 */
export const ON_ENTER_VR: string = 'onEnterVR';

/**
 * The name of the event that is triggered when VR is exited.
 */
export const ON_EXIT_VR: string = 'onExitVR';

/**
 * The name of the event that is triggered when AR is entered.
 */
export const ON_ENTER_AR: string = 'onEnterAR';

/**
 * The name of the event that is triggered when AR is exited.
 */
export const ON_EXIT_AR: string = 'onExitAR';

/**
 * The name of the event that is triggered when the meet portal is finished loading.
 */
export const ON_MEET_LOADED: string = 'onMeetLoaded';

/**
 * The name of the event that is triggered when the user meet portal is closed.
 */
export const ON_MEET_LEAVE: string = 'onMeetLeave';

/**
 * The name of the event that is triggered when the user has entered a meet.
 */
export const ON_MEET_ENTERED: string = 'onMeetEntered';

/**
 * The name of the event that is triggered when the user has exited a meet.
 */
export const ON_MEET_EXITED: string = 'onMeetExited';

/**
 * The current bot format version for AUX Bots.
 * This number increments whenever there are any changes between AUX versions.
 * As a result, it will allow us to make breaking changes but still upgrade people's bots
 * in the future.
 */
export const AUX_BOT_VERSION: number = 1;

/**
 * The name of the miniGridPortal.
 */
export const MINI_PORTAL: string = 'miniGridPortal';

/**
 * The name of the map portal.
 */
export const MAP_PORTAL: string = 'mapPortal';

/**
 * The name of the mini map portal.
 */
export const MINI_MAP_PORTAL: string = 'miniMapPortal';

/**
 * The name of the meet portal.
 */
export const MEET_PORTAL: string = 'meetPortal';

/**
 * The name of the bot portal.
 */
export const BOT_PORTAL: string = 'botPortal';

/**
 * The name of the tag portal.
 */
export const TAG_PORTAL: string = 'tagPortal';

/**
 * The name of the data portal.
 */
export const DATA_PORTAL: string = 'dataPortal';

/**
 * The name of the sheet portal.
 */
export const SHEET_PORTAL: string = 'sheetPortal';

/**
 * The name of the IDE portal.
 */
export const IDE_PORTAL: string = 'idePortal';

/**
 * The name of the system portal.
 */
export const SYSTEM_PORTAL: string = 'systemPortal';

/**
 * The name of the system tag.
 */
export const SYSTEM_TAG: string = 'system';

/**
 * The name of the tag that is used to determine which tag should be used for the system portal.
 */
export const SYSTEM_TAG_NAME: string = 'systemTagName';

/**
 * The name of the tag that is used to search tags in the system portal.
 */
export const SYSTEM_PORTAL_SEARCH: string = 'systemPortalSearch';

/**
 * The name of the tag used to keep track of the selected bot in the system portal..
 */
export const SYSTEM_PORTAL_BOT: string = 'systemPortalBot';

/**
 * The name of the tag that is selected in the system portal.
 */
export const SYSTEM_PORTAL_TAG: string = 'systemPortalTag';

/**
 * The space of the tag that is selected in the system portal.
 */
export const SYSTEM_PORTAL_TAG_SPACE: string = 'systemPortalTagSpace';

/**
 * The name of the tag that is used to indicate which bot the player is currently editing.
 */
export const EDITING_BOT: string = 'editingBot';

/**
 * The name of the tag that is used to indiciate which tag the player is currently editing.
 */
export const EDITING_TAG: string = 'editingTag';

/**
 * The name of the tag that is used to indiciate which space the tag the player is currently editing is in.
 */
export const EDITING_TAG_SPACE: string = 'editingTagSpace';

/**
 * The name of the IMU portal.
 */
export const IMU_PORTAL: string = 'imuPortal';

/**
 * The prefix for DNA Tags.
 */
export const DNA_TAG_PREFIX: string = '🧬';

/**
 * The prefix for bot links.
 */
export const BOT_LINK_TAG_PREFIX: string = '🔗';

/**
 * The prefix for date tags.
 */
export const DATE_TAG_PREFIX: string = '📅';

/**
 * The prefix for string tags.
 */
export const STRING_TAG_PREFIX: string = '📝';

/*
 * The prefix for number tags.
 */
export const NUMBER_TAG_PREFIX: string = '🔢';

/**
 * The prefix for vector tags.
 */
export const VECTOR_TAG_PREFIX: string = '➡️';

/**
 * The prefix for rotation tags.
 */
export const ROTATION_TAG_PREFIX: string = '🔁';

/**
 * The default script prefixes for custom portals.
 */
export const DEFAULT_CUSTOM_PORTAL_SCRIPT_PREFIXES: string[] = ['📖'];

/**
 * The list of known tag prefixes.
 */
export const KNOWN_TAG_PREFIXES: string[] = [
    '@',
    DNA_TAG_PREFIX,
    BOT_LINK_TAG_PREFIX,
    DATE_TAG_PREFIX,
    STRING_TAG_PREFIX,
    NUMBER_TAG_PREFIX,
    VECTOR_TAG_PREFIX,
    ROTATION_TAG_PREFIX,
];

/**
 * The list of all portal tags.
 */
export const KNOWN_PORTALS: string[] = [
    'gridPortal',
    SHEET_PORTAL,
    IDE_PORTAL,
    IMU_PORTAL,
    SYSTEM_PORTAL,
    MINI_PORTAL,
    'menuPortal',
    'leftWristPortal',
    'rightWristPortal',
    MEET_PORTAL,
    TAG_PORTAL,
    MAP_PORTAL,
    MINI_MAP_PORTAL,
    BOT_PORTAL,
];

/**
 * The list of portal tags that should always be represented in the query string.
 */
export const QUERY_PORTALS: string[] = [
    'gridPortal',
    SHEET_PORTAL,
    IDE_PORTAL,
    MEET_PORTAL,
    TAG_PORTAL,
    TAG_PORTAL_SPACE,
    MAP_PORTAL,
    SYSTEM_PORTAL,
    SYSTEM_TAG_NAME,
    BOT_PORTAL,
];

/**
 * The list of portal tags that should cause a new browser history entry to be added
 * when it is updated.
 */
export const QUERY_FULL_HISTORY_TAGS: Set<string> = new Set([
    'gridPortal',
    SHEET_PORTAL,
    IDE_PORTAL,
    MEET_PORTAL,
    TAG_PORTAL,
    TAG_PORTAL_SPACE,
    MAP_PORTAL,
]);

/**
 * The list of portal tags that should cause a new browser history entry to be added
 * only when the tag itself is added or removed from the query.
 */
export const QUERY_PARTIAL_HISTORY_TAGS: Set<string> = new Set([SYSTEM_PORTAL]);

/*
 * The list of all tags that have existing functionality in casual sim
 */
export const KNOWN_TAGS: string[] = [
    'playerActive',
    'gridPortal',
    SHEET_PORTAL,
    IDE_PORTAL,
    SYSTEM_PORTAL,
    SYSTEM_PORTAL_BOT,
    SYSTEM_PORTAL_TAG,
    SYSTEM_PORTAL_TAG_SPACE,
    SYSTEM_PORTAL_SEARCH,
    SYSTEM_TAG,
    SYSTEM_TAG_NAME,
    'inst',
    MINI_PORTAL,
    'menuPortal',
    MAP_PORTAL,
    MINI_MAP_PORTAL,
    'leftWristPortal',
    'rightWristPortal',

    MEET_PORTAL,
    DATA_PORTAL,
    TAG_PORTAL,
    TAG_PORTAL_SPACE,

    IMU_PORTAL,
    'imuSupported',
    'deviceRotationX',
    'deviceRotationY',
    'deviceRotationZ',
    'deviceRotationW',

    BOT_PORTAL,
    'botPortalStyle',
    'botPortalAnchorPoint',

    'cameraPositionX',
    'cameraPositionY',
    'cameraPositionZ',
    'cameraPositionOffsetX',
    'cameraPositionOffsetY',
    'cameraPositionOffsetZ',

    'cameraRotationX',
    'cameraRotationY',
    'cameraRotationZ',
    'cameraRotationOffsetX',
    'cameraRotationOffsetY',
    'cameraRotationOffsetZ',
    'cameraRotationOffsetW',

    'cameraFocusX',
    'cameraFocusY',
    'cameraFocusZ',

    'cameraZoom',
    'cameraZoomOffset',

    'pixelWidth',
    'pixelHeight',
    'pixelRatio',
    'defaultPixelRatio',
    'pageTitle',
    'pointerPixelX',
    'pointerPixelY',

    'mousePointerPositionX',
    'mousePointerPositionY',
    'mousePointerPositionZ',
    'rightPointerPositionX',
    'rightPointerPositionY',
    'rightPointerPositionZ',
    'leftPointerPositionX',
    'leftPointerPositionY',
    'leftPointerPositionZ',

    'mousePointerRotationX',
    'mousePointerRotationY',
    'mousePointerRotationZ',
    'rightPointerRotationX',
    'rightPointerRotationY',
    'rightPointerRotationZ',
    'leftPointerRotationX',
    'leftPointerRotationY',
    'leftPointerRotationZ',

    'mousePointerPortal',
    'rightPointerPortal',
    'leftPointerPortal',

    'mousePointer_left',
    'mousePointer_right',
    'mousePointer_middle',
    'leftPointer_primary',
    'leftPointer_squeeze',
    'rightPointer_primary',
    'rightPointer_squeeze',
    'forceSignedScripts',

    EDITING_BOT,
    EDITING_TAG,
    EDITING_TAG_SPACE,
    'cursorStartIndex',
    'cursorEndIndex',

    'portalColor',
    'portalCursor',
    'portalCursorHotspotX',
    'portalCursorHotspotY',
    'portalBackgroundAddress',
    'portalLocked',
    'portalPannable',
    `portalPannableMinX`,
    `portalPannableMaxX`,
    `portalPannableMinY`,
    `portalPannableMaxY`,
    'portalZoomable',
    `portalZoomableMin`,
    `portalZoomableMax`,
    'portalRotatable',
    'portalGridScale',
    'portalSurfaceScale',
    `portalCameraZoom`,
    `portalCameraRotationX`,
    `portalCameraRotationY`,
    'portalCameraControls',
    'portalShowFocusPoint',
    'portalDisableCanvasTransparency',
    'portalCameraType',
    'miniPortalHeight',
    'miniPortalWidth',
    'miniPortalResizable',
    'wristPortalHeight',
    'wristPortalWidth',
    'meetPortalAnchorPoint',
    'meetPortalVisible',
    'meetPortalStyle',
    'meetPortalPrejoinEnabled',
    'meetPortalStartWithVideoMuted',
    'meetPortalStartWithAudioMuted',
    'meetPortalRequireDisplayName',
    'meetPortalJWT',
    'mapPortalBasemap',

    'tagPortalAnchorPoint',
    'tagPortalStyle',
    'tagPortalShowButton',
    'tagPortalButtonIcon',
    'tagPortalButtonHint',
    'sheetPortalShowButton',
    'sheetPortalButtonIcon',
    'sheetPortalButtonHint',
    'sheetPortalAllowedTags',
    'sheetPortalAddedTags',
    'portalShowButton',
    'portalButtonIcon',
    'portalButtonHint',
    'menuPortalStyle',

    'color',
    'creator',
    'cursor',
    'cursorHotspotX',
    'cursorHotspotY',
    'draggable',
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
    'labelFontSize',
    'labelSize',
    'labelSizeMode',
    'labelOpacity',
    'labelPadding',
    'labelPaddingX',
    'labelPaddingY',
    'labelPosition',
    'labelAlignment',
    'labelWordWrapMode',
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
    'formAnimationAddress',
    'orientationMode',
    'anchorPoint',
    'gltfVersion',
    'progressBar',
    'progressBarColor',
    'progressBarBackgroundColor',
    'progressBarPosition',
    'maxLODThreshold',
    'minLODThreshold',
    'pointable',
    'focusable',
    'transformer',
    'menuItemStyle',
    'menuItemLabelStyle',
    'menuItemHoverMode',
    'menuItemText',
    'menuItemShowSubmitWhenEmpty',

    'taskOutput',
    'taskError',
    'taskTime',
    'taskShell',
    'taskBackup',
    'taskBackupType',
    'taskBackupUrl',

    'error',
    'errorName',
    'errorMessage',
    'errorStack',
    'errorBot',
    'errorTag',

    'avatarAddress',
    'name',

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
    ANY_DROP_ENTER_ACTION_NAME,
    ANY_DROP_EXIT_ACTION_NAME,
    DROP_ACTION_NAME,
    DROP_ANY_ACTION_NAME,
    DRAG_ACTION_NAME,
    DRAG_ANY_ACTION_NAME,
    DRAGGING_ACTION_NAME,
    DRAGGING_ANY_ACTION_NAME,
    'onTapCode',
    'onQRCodeScanned',
    'onQRCodeScannerClosed',
    'onQRCodeScannerOpened',
    ON_BARCODE_SCANNED_ACTION_NAME,
    ON_BARCODE_SCANNER_CLOSED_ACTION_NAME,
    ON_BARCODE_SCANNER_OPENED_ACTION_NAME,

    ON_IMAGE_CLASSIFIER_CLOSED_ACTION_NAME,
    ON_IMAGE_CLASSIFIER_OPENED_ACTION_NAME,
    ON_IMAGE_CLASSIFIED_ACTION_NAME,

    ON_POINTER_ENTER,
    ON_POINTER_EXIT,
    ON_ANY_POINTER_ENTER,
    ON_ANY_POINTER_EXIT,
    ON_POINTER_DOWN,
    ON_POINTER_UP,
    ON_ANY_POINTER_DOWN,
    ON_ANY_POINTER_UP,
    ON_INST_STREAMING_ACTION_NAME,
    ON_INST_STREAM_LOST_ACTION_NAME,

    ON_INST_JOINED_ACTION_NAME,
    ON_INST_LEAVE_ACTION_NAME,

    ON_PORTAL_CHANGED_ACTION_NAME,
    ON_APP_SETUP_ACTION_NAME,
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
    ON_REMOTE_DATA_ACTION_NAME,
    ON_ACTION_ACTION_NAME,
    ON_RUN_ACTION_NAME,
    ON_CHAT_TYPING_ACTION_NAME,
    ON_CHAT_ACTION_NAME,
    ON_SUBMIT_ACTION_NAME,
    ON_INPUT_TYPING_ACTION_NAME,
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

    ON_REMOTE_JOINED_ACTION_NAME,
    ON_REMOTE_LEAVE_ACTION_NAME,

    ON_BOT_ADDED_ACTION_NAME,
    ON_ANY_BOTS_ADDED_ACTION_NAME,
    ON_ANY_BOTS_REMOVED_ACTION_NAME,

    ON_BOT_CHANGED_ACTION_NAME,
    ON_ANY_BOTS_CHANGED_ACTION_NAME,

    ON_SHEET_TAG_CLICK,
    ON_SHEET_BOT_ID_CLICK,
    ON_SHEET_BOT_CLICK,

    ON_BEGIN_AUDIO_RECORDING,
    ON_AUDIO_SAMPLE,
    ON_END_AUDIO_RECORDING,
    ON_ENTER_VR,
    ON_EXIT_VR,
    ON_ENTER_AR,
    ON_EXIT_AR,
    ON_MEET_LOADED,
    ON_MEET_LEAVE,
    ON_MEET_ENTERED,
    ON_MEET_EXITED,
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

export function onDraggingArg(
    bot: Bot,
    to: BotDropToDestination,
    from: BotDropDestination
) {
    return {
        bot,
        to,
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
        bot: dragBot,
        to,
        from,
    };
}

export function onServerStreamingArg(server: string) {
    return {
        server,
        inst: server,
    };
}

export function onServerStreamLostArg(server: string) {
    return {
        server,
        inst: server,
    };
}

export function onServerSubscribedArg(server: string) {
    return {
        server,
        inst: server,
    };
}

export function onServerUnsubscribedArg(server: string) {
    return {
        server,
        inst: server,
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

export function onPointerEnterExitArg(bot: Bot, dimension: string) {
    return {
        bot,
        dimension,
    };
}

export function onPointerUpDownArg(bot: Bot, dimension: string) {
    return {
        bot,
        dimension,
    };
}

export function onSubmitArg(text: string) {
    return {
        text,
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
