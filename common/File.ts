
export type File = Object | Workspace;

export interface Object {
    type: 'object';
    id: string;
    workspace: string;
    position: {
        x: number;
        y: number;
        z: number;
    } | null;

    tags: {
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
}