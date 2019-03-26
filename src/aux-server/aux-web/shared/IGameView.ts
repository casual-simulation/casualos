import { WebGLRenderer, Plane, PerspectiveCamera, Scene } from "three";
import { Time } from "./scene/Time";
import { Input } from "./scene/Input";
import { InputVR } from "./scene/InputVR";
import { ArgEvent } from "@yeti-cgi/aux-common/Events";
import { AuxFile } from "@yeti-cgi/aux-common/aux-format";
import { ContextGroup3D } from "./scene/ContextGroup3D";
import { AuxFile3DFinder } from "./AuxFile3DFinder";
import Vue from "vue";

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView extends AuxFile3DFinder, Vue {
    
    readonly uiHtmlElements: HTMLElement[];
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

    onFileAdded: ArgEvent<AuxFile>;
    onFileUpdated: ArgEvent<AuxFile>;
    onFileRemoved: ArgEvent<AuxFile>;
    
    xrCapable: boolean;
    xrDisplay: any;
    xrSession: any;
    vrDisplay: VRDisplay;
    vrCapable: boolean;

    /**
     * Gets the list of contexts that this game view contains.
     */
    getContexts(): ContextGroup3D[];

    /**
     * Sets the visibility of the file grids.
     */
    setGridsVisible(visible: boolean): void;
}