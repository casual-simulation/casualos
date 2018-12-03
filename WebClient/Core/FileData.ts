export interface FileData {
    id: string;
    workspace: string;
    type: 'file',
    position: {
        x: number;
        y: number;
        z?: number;
    };

    tags: {
        [key: string]: any;
    };
}