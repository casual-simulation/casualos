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
    },
    size: number;
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
    }
}