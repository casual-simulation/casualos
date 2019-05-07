import {
    WebGLRenderer,
    Plane,
    PerspectiveCamera,
    Scene,
    Camera,
    OrthographicCamera,
} from 'three';
import { Time } from './scene/Time';
import { Input } from './scene/Input';
import { InputVR } from './scene/InputVR';
import { ArgEvent } from '@casual-simulation/aux-common/Events';
import { AuxFile } from '@casual-simulation/aux-common/aux-format';
import { ContextGroup3D } from './scene/ContextGroup3D';
import { AuxFile3DFinder } from './AuxFile3DFinder';
import Vue from 'vue';
import { HtmlMixer } from 'threex-htmlmixer';
import { Simulation3D } from './scene/Simulation3D';
import { GridChecker } from './scene/grid/GridChecker';
import { AuxFile3DDecoratorFactory } from './scene/decorators/AuxFile3DDecoratorFactory';

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
    onCameraTypeChanged: ArgEvent<PerspectiveCamera | OrthographicCamera>;

    xrCapable: boolean;
    xrDisplay: any;
    xrSession: any;
    vrDisplay: VRDisplay;
    vrCapable: boolean;

    getTime(): Time;
    getInput(): Input;
    getInputVR(): InputVR;
    getScene(): Scene;
    getRenderer(): WebGLRenderer;
    getGroundPlane(): Plane;
    getMainCamera(): PerspectiveCamera | OrthographicCamera;
    getHtmlMixerContext(): HtmlMixer.Context;
    getDecoratorFactory(): AuxFile3DDecoratorFactory;
    getGridChecker(): GridChecker;

    /**
     * Gets the list of simulations that this game view contains.
     */
    getSimulations(): Simulation3D[];

    /**
     * Gets the list of contexts that this game view contains.
     */
    getContexts(): ContextGroup3D[];

    /**
     * Gets the HTML elements that the interaction manager should be able to handle events for.
     */
    getUIHtmlElements(): HTMLElement[];

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
     * Tweens the user's camera to view the given file.
     * @param fileId The ID of the file to view.
     * @param zoomValue The zoom value to use.
     */
    tweenCameraToFile(fileId: string, zoomValue: number): void;
}
