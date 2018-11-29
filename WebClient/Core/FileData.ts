import {Vector2} from './Vector2';

export interface FileData {
    id: string;
    workspace: string;
    position: Vector2;

    tags: {
        [key: string]: any;
    };
}