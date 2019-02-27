import { WebGLRenderer, Plane, PerspectiveCamera, Scene } from "three";
import { Time } from "./scene/Time";
import { Input } from "./scene/Input";
import { InputVR } from "./scene/InputVR";
import { File3D } from "./scene/File3D";
import { GridChecker } from "./scene/grid/GridChecker";

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView {
    
    readonly fileQueue: HTMLElement;
    readonly gameView: HTMLElement;
    readonly canvas: HTMLCanvasElement;
    readonly time: Time;
    readonly input: Input;
    readonly inputVR: InputVR;
    readonly mainCamera: PerspectiveCamera;
    readonly scene: Scene;
    readonly renderer: WebGLRenderer; 
    readonly dev: boolean;
    readonly filesMode: boolean;
    readonly workspacesMode: boolean
    readonly groundPlane: Plane;
    readonly gridChecker: GridChecker;


    /**
     * Returns the file id that is represented by the specified mesh id.
     * @param meshId The id of the mesh.
     */
    getFileId(meshId: number): string;

    /**
     * Returns the file that matches the specified file id.
     * @param fileId The id of the file.
     */
    getFile(fileId: string): File3D;

    /**
     * Gets all of the files.
     */
    getFiles(): File3D[];

    /**
     * Gets all of the objects.
     */
    getObjects(): File3D[];

    /**
     * Gets all of the workspaces.
     */
    getWorkspaces(): File3D[];
}