
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