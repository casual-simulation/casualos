import {
    WebGLRenderer,
    Plane,
    PerspectiveCamera,
    Scene,
    Camera,
    OrthographicCamera,
    Vector3,
    Texture,
    Color,
} from 'three';
import { Time } from '../scene/Time';
import { Input } from '../scene/Input';
import { InputVR } from '../scene/InputVR';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import { ContextGroup3D } from '../scene/ContextGroup3D';
import { AuxFile3DFinder } from '../AuxFile3DFinder';
import Vue from 'vue';
import { HtmlMixer } from '../scene/HtmlMixer';
import { Simulation3D } from '../scene/Simulation3D';
import { GridChecker } from '../scene/grid/GridChecker';
import { AuxFile3DDecoratorFactory } from '../scene/decorators/AuxFile3DDecoratorFactory';
import { CameraRig } from '../scene/CameraRigFactory';
import { Viewport } from '../scene/Viewport';
import { BaseInteractionManager } from '../interaction/BaseInteractionManager';
import { AuxFile3D } from '../scene/AuxFile3D';

/**
 * Interface that described what properties and functions should be available to a GameView class/component implementation.
 * Concept of a GameView is shared across aux-web applications. This interface will ensure shared functionality across these applications.
 */
export interface IGameView extends AuxFile3DFinder, Vue {
    readonly gameView: HTMLElement;
    readonly dev: boolean;
    readonly filesMode: boolean;
    readonly workspacesMode: boolean;

    onFileAdded: ArgEvent<AuxFile>;
    onFileUpdated: ArgEvent<AuxFile>;
    onFileRemoved: ArgEvent<AuxFile>;
    onCameraRigTypeChanged: ArgEvent<CameraRig>;

    xrCapable: boolean;
    xrDisplay: any;
    xrSession: any;
    vrDisplay: VRDisplay;
    vrCapable: boolean;

    getTime(): Time;
    getInput(): Input;
    getInputVR(): InputVR;
    getInteraction(): BaseInteractionManager;
    getScene(): Scene;
    getRenderer(): WebGLRenderer;
    getMainCameraRig(): CameraRig;
    getMainViewport(): Viewport;
    getHtmlMixerContext(): HtmlMixer.Context;
    getDecoratorFactory(): AuxFile3DDecoratorFactory;
    getGridChecker(): GridChecker;
    getBackground(): Color | Texture;

    /**
     * Get all of the current viewports.
     */
    getViewports(): Viewport[];

    /**
     * Get all of the current camera rigs.
     */
    getCameraRigs(): CameraRig[];

    /**
     * Gets the list of simulations that this game view contains.
     */
    getSimulations(): Simulation3D[];

    /**
     * Gets the HTML elements that the interaction manager should be able to handle events for.
     */
    getUIHtmlElements(): HTMLElement[];

    findFilesById(id: string): AuxFile3D[];

    /**
     * Sets the visibility of the file grids.
     */
    setGridsVisible(visible: boolean): void;

    /**
     * Sets the visibility of the world grid.
     * @param visible Whether the grid is visible.
     */
    setWorldGridVisible(visible: boolean): void;

    /**
     * Tweens the camera to view the file.
     * @param cameraRig The camera rig to tween.
     * @param fileId The ID of the file to view.
     * @param zoomValue The zoom value to use.
     */
    tweenCameraToFile(
        cameraRig: CameraRig,
        fileId: string,
        zoomValue?: number
    ): void;

    /**
     * Animates the main camera to the given position.
     * @param cameraRig The camera rig to tween.
     * @param position The position to animate to.
     * @param zoomValue The zoom value to use.
     */
    tweenCameraToPosition(
        cameraRig: CameraRig,
        position: Vector3,
        zoomValue?: number
    ): void;
}
