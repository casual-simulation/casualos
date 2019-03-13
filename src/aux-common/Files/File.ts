
export type PartialFile = Partial<File>;

export type AuxDomain = 'builder' | 'player';

export type Object = File;
export type Workspace = File;

export interface File {
    id: string;
    tags: {
        _selection?: string;
        _destroyed?: any;
        _user?: string;
        _userContext?: string;
        _mode?: UserMode;
        
        _editingFile?: string;
        _lastActiveTime?: number;
        _lastEditedBy?: string;
        _sceneBackgroundColor?: string;

        ['aux.color']?: unknown;
        ['aux.movable']?: unknown;
        ['aux.stackable']?: unknown;
        ['aux.stroke.color']?: unknown;
        ['aux.stroke.width']?: unknown;
        ['aux.line.to']?: unknown;
        ['aux.line.color']?: unknown;
        ['aux.label']?: unknown;
        ['aux.label.color']?: unknown;
        ['aux.label.size']?: unknown;
        ['aux.label.size.mode']?: 'auto' | null;

        // Builder related tags
        ['aux.builder.context']?: string | string[];
        ['aux.builder.context.x']?: number;
        ['aux.builder.context.y']?: number;
        ['aux.builder.context.z']?: number;
        ['aux.builder.context.rotation.x']?: number;
        ['aux.builder.context.rotation.y']?: number;
        ['aux.builder.context.rotation.z']?: number;
        ['aux.builder.context.scale']?: number;
        ['aux.builder.context.grid']?: {
            [key: string]: WorkspaceHex;
        } | null,
        ['aux.builder.context.grid.scale']?: number;
        ['aux.builder.context.defaultHeight']?: number;
        ['aux.builder.context.color']?: string;
        ['aux.builder.context.size']?: number;
        ['aux.builder.context.minimized']?: boolean | null;

        [key: string]: any;
    }
};

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
 * The default user mode.
 */
export const DEFAULT_USER_MODE: UserMode = 'files';

/**
 * The default height for workspaces.
 */
export const DEFAULT_WORKSPACE_HEIGHT = .1;

/**
 * The default scale for workspaces.
 */
export const DEFAULT_WORKSPACE_SCALE = 2;

/**
 * The default scale for mini workspaces.
 */
export const DEFAULT_MINI_WORKSPACE_SCALE = DEFAULT_WORKSPACE_SCALE  / 3;

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
export const DEFAULT_WORKSPACE_COLOR = "#999999";

/**
 * The default color for scene background.
 */
export const DEFAULT_SCENE_BACKGROUND_COLOR = "#CCE6FF";