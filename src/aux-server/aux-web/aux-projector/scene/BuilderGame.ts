import { Game } from '../../shared/scene/Game';
import { DEFAULT_WORKSPACE_HEIGHT_INCREMENT } from '@casual-simulation/aux-common';
import { BuilderSimulation3D } from './BuilderSimulation3D';
import { GridChecker } from '../../shared/scene/grid/GridChecker';
import { appManager } from '../../shared/AppManager';
import { Color, Texture, GridHelper } from 'three';
import { Viewport } from '../../shared/scene/Viewport';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import BuilderGameView from '../BuilderGameView/BuilderGameView';
import TrashCan from '../TrashCan/TrashCan';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../interaction/BuilderInteractionManager';
import { flatMap } from 'lodash';

export class BuilderGame extends Game {
    gameView: BuilderGameView;
    simulation3D: BuilderSimulation3D = null;
    filesMode: boolean;
    workspacesMode: boolean;

    private gridMesh: GridHelper;

    constructor(gameView: BuilderGameView) {
        super(gameView);
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
            <HTMLElement>this.gameView.$refs.fileQueue,
            this.gameView.$refs.trashCan
                ? (<TrashCan>this.gameView.$refs.trashCan).$el
                : null,
        ].filter(el => el);
    }
    findFilesById(id: string): AuxFile3D[] {
        return flatMap(this.simulation3D.contexts, c =>
            c.getFiles().filter(f => f.file.id === id)
        );
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

        this.simulation3D = new BuilderSimulation3D(
            this,
            appManager.simulationManager.primary
        );

        this.mainScene.add(this.simulation3D);

        this.simulation3D.init();
        this.simulation3D.onFileAdded.addListener(obj =>
            this.onFileAdded.invoke(obj)
        );
        this.simulation3D.onFileRemoved.addListener(obj =>
            this.onFileRemoved.invoke(obj)
        );
        this.simulation3D.onFileUpdated.addListener(obj =>
            this.onFileUpdated.invoke(obj)
        );
    }

    protected renderCore(): void {
        super.renderCore();
        //
        // [Main scene]
        //

        // Render the main scene with the main camera.
        this.renderer.clear();
        this.renderer.render(this.mainScene, this.mainCameraRig.mainCamera);

        // Set the background color to null when rendering with the ui world camera.
        this.mainScene.background = null;

        // Render the main scene with the ui world camera.
        this.renderer.clearDepth(); // Clear depth buffer so that ui world appears above objects that were just rendererd.
        this.renderer.render(this.mainScene, this.mainCameraRig.uiWorldCamera);

        this.mainSceneBackgroundUpdate();
    }

    protected setupScenes() {
        super.setupScenes();

        // Main scene grid plane.
        this.gridMesh = new GridHelper(1000, 300, 0xbbbbbb, 0xbbbbbb);
        this.gridMesh.visible = false;
        this.mainScene.add(this.gridMesh);
    }
}
