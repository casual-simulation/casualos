export type PartialFile = Partial<File>;

export type AuxDomain = 'builder' | 'player';

export type Object = File;
export type Workspace = File;

/**
 * Defines an interface for a file that is precalculated.
 */
export interface PrecalculatedFile extends File {
    /**
     * Flag indicating that the file is precalculated.
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
 * Defines an interface for a file.
 */
export interface File {
    /**
     * The ID of the file.
     */
    id: string;

    /**
     * The set of tags that the file contains.
     */
    tags: FileTags;
}

export interface FileTags {
    // Global file tags
    ['aux.scene.color']?: string;
    ['aux.context.inventory.color']?: string;
    ['aux.inventory.height']?: unknown;
    ['aux.context.inventory.visible']?: unknown;
    ['aux.scene.user.player.color']?: unknown;
    ['aux.scene.user.builder.color']?: unknown;
    ['aux.whitelist']?: unknown;
    ['aux.blacklist']?: unknown;
    ['aux.designers']?: unknown;
    ['aux.version']?: unknown;

    // Normal file tags
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
    ['aux.label.anchor']?: FileLabelAnchor | null | string;
    ['aux.listening']?: unknown;
    ['aux.input']?: string;
    ['aux.input.target']?: string;
    ['aux.input.placeholder']?: string;
    ['aux.shape']?: FileShape;
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

    // User tags
    ['aux._selection']?: string;
    ['aux._user']?: string;
    ['aux._userContext']?: string;
    ['aux._userInventoryContext']?: string;
    ['aux._userMenuContext']?: string;
    ['aux._userSimulationsContext']?: string;
    ['aux._mode']?: UserMode;
    ['aux._editingFile']?: string;
    ['aux._lastEditedBy']?: string;
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

    // Admin channel file-channel tags
    ['aux.channel.locked']?: boolean;
    ['aux.channel.connectedDevices']?: number;
    ['aux.channel.maxDevicesAllowed']?: number;

    // Admin channel tags
    ['aux.connectedDevices']?: number;
    ['aux.maxDevicesAllowed']?: number;

    // Context related tags
    ['aux.context']?: string;
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

    [key: string]: any;
}

/**
 * Defines an interface for the state that an AUX file can contain.
 */
export interface FilesState {
    [id: string]: File;
}

/**
 * Defines an interface for a set of files that have precalculated formulas.
 */
export interface PrecalculatedFilesState {
    [id: string]: PrecalculatedFile;
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
export type UserMode = 'files' | 'worksurfaces';

/**
 * Defines the possible selection modes a user can be in.
 */
export type SelectionMode = 'single' | 'multi';

/**
 * Defines the possible shapes that a file can appear as.
 */
export type FileShape = 'cube' | 'sphere' | 'sprite';

/**
 * Defines the possible drag modes that a file can have.
 *
 * "all" means that the file is able to be dragged freely inside and across contexts.
 * "none" means that the file is not able to be dragged at all.
 * "clone" means that the file should be cloned whenever dragged.
 * "pickup" means that the file should be able to be dragged across contexts but not within a context.
 * "drag" means that the file should be able to be dragged within a context but not across contexts.
 * "mods" means that the file should be cloned as a diff when dragged.
 */
export type FileDragMode = 'all' | 'none' | 'clone' | 'pickup' | 'drag' | 'mod';

/**
 * Defines the possible anchor positions for a label.
 */
export type FileLabelAnchor =
    | 'top'
    | 'front'
    | 'back'
    | 'left'
    | 'right'
    | 'floating';

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
export const DEFAULT_USER_MODE: UserMode = 'files';

/**
 * The default selection mode.
 */
export const DEFAULT_SELECTION_MODE: SelectionMode = 'single';

/**
 * The default file shape.
 */
export const DEFAULT_FILE_SHAPE: FileShape = 'cube';

/**
 * The default file label anchor.
 */
export const DEFAULT_LABEL_ANCHOR: FileLabelAnchor = 'top';

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
 * in order to hide their file.
 */
export const DEFAULT_USER_INACTIVE_TIME = 1000 * 60;

/**
 * The amount of time that a user needs to be inactive for
 * in order to delete their file.
 */
export const DEFAULT_USER_DELETION_TIME = 1000 * 60 * 60;

/**
 * The ID of the global configuration file.
 */
export const GLOBALS_FILE_ID = 'config';

/**
 * The current file format version for AUX Files.
 * This number increments whenever there are any changes between AUX versions.
 * As a result, it will allow us to make breaking changes but still upgrade people's files
 * in the future.
 */
export const AUX_FILE_VERSION: number = 1;

/*
 * The list of all tags that have existing functionality in casual sim
 */
export const KNOWN_TAGS: string[] = [
    'aux._selection',
    'aux._destroyed',
    'aux._user',
    'aux._userContext',
    'aux._userInventoryContext',
    'aux._userMenuContext',
    'aux._userSimulationsContext',
    'aux._mode',
    'aux._editingFile',
    'aux._selectionMode',
    'aux._lastEditedBy',
    'aux.account.username',
    'aux.account.locked',
    'aux.connectedDevices',
    'aux.maxDevicesAllowed',
    'aux.token',
    'aux.token.username',
    'aux.token.locked',
    'aux.inventory.color',
    'aux.context.inventory.color',
    'aux.inventory.height',
    'aux.context.inventory.visible',
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
    'aux.input',
    'aux.input.target',
    'aux.input.placeholder',
    'aux.image',
    'aux.shape',
    'aux.progressBar',
    'aux.progressBar.color',
    'aux.progressBar.backgroundColor',
    'aux.progressBar.anchor',
    'aux.channel',
    'aux.channel.locked',
    'aux.channel.connectedDevices',
    'aux.channel.maxDevicesAllowed',
    'aux.whitelist',
    'aux.blacklist',
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
    'aux.context.surface.grid',
    'aux.context.x',
    'aux.context.y',
    'aux.context.z',
    'aux.context.rotation.x',
    'aux.context.rotation.y',
    'aux.context.rotation.z',
    'aux.context.surface.scale',
    'aux.context.surface.defaultHeight',
    'aux.context.surface.size',
    'aux.context.surface.minimized',
    'aux.context.surface.movable',
    'aux.context.visualize',
    'onClick()',
    'onCombine()',
    'onMerge()',
    'onSaveInput()',
    'onCloseInput()',
    'onCreate()',
    'onDestroy()',
    'onDropInContext()',
    'onDragOutOfContext()',
    'onDropAnyInContext()',
    'onDragAnyOutOfContext()',
    'onDropInInventory()',
    'onDragOutOfInventory()',
    'onDropAnyInInventory()',
    'onDragAnyOutOfInventory()',
    'onTapCode()',
    'onQRCodeScanned()',
    'onQRCodeScannerClosed()',
    'onQRCodeScannerOpened()',
    'onPointerEnter()',
    'onPointerExit()',
    'onConnected()',
    'onDisconnected()',
    'onPlayerContextEnter()',
    'onKeyDown()',
    'onKeyUp()',
    'onGridClick()',
];
