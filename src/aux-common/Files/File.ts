export type PartialFile = Partial<File>;

export type AuxDomain = 'builder' | 'player';

export type Object = File;
export type Workspace = File;

export interface File {
    id: string;
    tags: FileTags;
}

export interface FileTags {
    // Global file tags
    ['aux.scene.color']?: string;
    ['aux.whitelist']?: unknown;
    ['aux.blacklist']?: unknown;
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
    ['aux.line.color']?: unknown;
    ['aux.label']?: unknown;
    ['aux.label.color']?: unknown;
    ['aux.label.size']?: unknown;
    ['aux.label.size.mode']?: 'auto' | null;
    ['aux.label.anchor']?: FileLabelAnchor | null | string;
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
    ['aux._creator']?: string;
    ['aux._diff']?: boolean;
    ['aux._diffTags']?: string[];

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

    // Context related tags
    ['aux.context']?: string;
    ['aux.context.color']?: string;
    ['aux.context.locked']?: unknown;
    ['aux.context.grid.scale']?: number;
    ['aux.context.surface.x']?: number;
    ['aux.context.surface.y']?: number;
    ['aux.context.surface.z']?: number;
    ['aux.context.surface.scale']?: number;
    ['aux.context.surface.defaultHeight']?: number;
    ['aux.context.surface.size']?: number;
    ['aux.context.surface.minimized']?: boolean | null;
    ['aux.context.surface.movable']?: unknown;

    [key: string]: any;
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
 */
export type FileDragMode = 'all' | 'none' | 'clone' | 'pickup' | 'drag';

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
 * The current file format version for AUX Files.
 * This number increments whenever there are any changes between AUX versions.
 * As a result, it will allow us to make breaking changes but still upgrade people's files
 * in the future.
 */
export const AUX_FILE_VERSION: number = 1;
