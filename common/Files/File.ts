export type File = Object | Workspace;

export interface Object {
    type: 'object';
    id: string;

    tags: {
        _workspace: string | null;
        _position: {
            x: number;
            y: number;
            z: number;
        } | null;
        _hidden?: boolean;
        _selection?: string;
        _destroyed?: boolean;
        [key: string]: any;
    };
}

/**
 * Defines an interface for a workspace.
 */
export interface Workspace {
    type: 'workspace';
    id: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    grid: {
        [key: string]: WorkspaceHex;
    } | null,
    size: number;
    scale: number | null;
    defaultHeight: number | null;
}

/**
 * Defines an interface for a hex in a workspace.
 */
export interface WorkspaceHex {
    height: number;
}

export interface PartialFile {
    id?: string;
    type?: string;
    size?: number;
    position?: {
        x: number;
        y: number;
        z: number;
    };
    tags?: {
        _workspace?: string;
        _position?: {
            x?: number;
            y?: number;
            z?: number;
        };
        [key: string]: any;
    },
    grid?: {
        [key: string]: WorkspaceHex
    },
    scale?: number;
}

/**
 * The default height for workspaces.
 */
export const DEFAULT_WORKSPACE_HEIGHT = .1;

/**
 * The default scale for workspaces.
 */
export const DEFAULT_WORKSPACE_SCALE = .5;

/**
 * The amount that a hex's height is allowed to change by in a single increment.
 */
export const DEFAULT_WORKSPACE_HEIGHT_INCREMENT = 0.1;

/**
 * The minimum height that hexes in a workspace can be.
 */
export const DEFAULT_WORKSPACE_MIN_HEIGHT = 0.1;