
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

export interface Workspace {
    type: 'workspace';
    id: string;
    position: {
        x: number;
        y: number;
        z: number;
    };
    size: number;
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
    }
}