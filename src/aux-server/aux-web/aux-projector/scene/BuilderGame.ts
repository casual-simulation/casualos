import { Game } from '../../shared/scene/Game';
import { DEFAULT_WORKSPACE_HEIGHT_INCREMENT } from '@casual-simulation/aux-common';
import { BuilderSimulation3D } from './BuilderSimulation3D';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { Color, Texture, GridHelper } from 'three';
import { Viewport } from '../../shared/scene/Viewport';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { AuxBot3D } from '../../shared/scene/AuxBot3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import BuilderGameView from '../BuilderGameView/BuilderGameView';
import TrashCan from '../TrashCan/TrashCan';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';
import { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { AuxBotVisualizer } from '../../shared/scene/AuxBotVisualizer';

export class BuilderGame extends Game {
    gameView: BuilderGameView;
    simulation3D: BuilderSimulation3D = null;
    simulation: BrowserSimulation;
    botsMode: boolean;
    workspacesMode: boolean;

    private gridMesh: GridHelper;

    constructor(simulation: BrowserSimulation, gameView: BuilderGameView) {
        super(gameView);
        this.simulation = simulation;
    }

    getBackground(): Color | Texture {
        return this.simulation3D.backgroundColor;
    }
    getViewports(): Viewport[] {
        return [this.mainViewport];
    }
    getCameraRigs(): CameraRig[] {
        return [this.mainCameraRig];
    }
    getSimulations(): Simulation3D[] {
        return [this.simulation3D];
    }
    getUIHtmlElements(): HTMLElement[] {
        return [
            ...this.gameView.home.getUIHtmlElements(),
            ...this.gameView.buildApp.getUIHtmlElements(),
            <HTMLElement>this.gameView.$refs.botQueue,
            this.gameView.$refs.trashCan
                ? (<TrashCan>this.gameView.$refs.trashCan).$el
                : null,
        ].filter(el => el);
    }
    findBotsById(id: string): AuxBotVisualizer[] {
        return this.simulation3D.bots.filter(f => f.bot.id === id);
    }
    setGridsVisible(visible: boolean): void {
        this.simulation3D.contexts.forEach((c: BuilderGroup3D) => {
            if (c.surface) {
                c.surface.gridsVisible = visible;
            }
        });
    }
    setWorldGridVisible(visible: boolean): void {
        this.gridMesh.visible = visible;
    }
    setupInteraction(): BaseInteractionManager {
        return new BuilderInteractionManager(this);
    }
    addSidebarItem(
        id: string,
        text: string,
        click: () => void,
        icon?: string,
        group?: string
    ): void {
        this.gameView.addSidebarItem(id, text, click, icon, group);
    }
    removeSidebarItem(id: string): void {
        this.gameView.removeSidebarItem(id);
    }
    removeSidebarGroup(group: string): void {
        this.gameView.removeSidebarGroup(group);
    }

    protected async onBeforeSetupComplete() {
        this.gridChecker = new GridChecker(DEFAULT_WORKSPACE_HEIGHT_INCREMENT);

        this.simulation3D = new BuilderSimulation3D(this, this.simulation);

        this.mainScene.add(this.simulation3D);

        this.simulation3D.init();
        this.simulation3D.onBotAdded.addListener(obj =>
            this.onBotAdded.invoke(obj)
        );
        this.simulation3D.onBotRemoved.addListener(obj =>
            this.onBotRemoved.invoke(obj)
        );
        this.simulation3D.onBotUpdated.addListener(obj =>
            this.onBotUpdated.invoke(obj)
        );
    }

    /**
     * Render the current frame for the default browser mode.
     */
    protected renderBrowser() {
        super.renderBrowser();
    }

    /**
     * Render the current frame for XR (AR mode).
     */
    protected renderXR() {
        super.renderXR();
    }

    /**
     * Render the current frame for VR.
     */
    protected renderVR() {
        super.renderVR();
    }

    protected setupScenes() {
        super.setupScenes();

        // Main scene grid plane.
        this.gridMesh = new GridHelper(1000, 300, 0xbbbbbb, 0xbbbbbb);
        this.gridMesh.visible = false;
        this.mainScene.add(this.gridMesh);
    }
}
