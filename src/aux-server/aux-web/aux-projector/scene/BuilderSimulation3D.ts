import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import {
    AuxObject,
    getFileConfigContexts,
    FileCalculationContext,
    Object,
    isContext,
} from '@casual-simulation/aux-common';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { PerspectiveCamera, OrthographicCamera, Object3D, Plane } from 'three';
import { Simulation } from '../../shared/Simulation';
import { IGameView } from '../../shared/vue-components/IGameView';
import { flatMap } from 'lodash';
import GameView from '../GameView/GameView';
import { CameraRig } from '../../shared/scene/CameraRigFactory';

export class BuilderSimulation3D extends Simulation3D {
    recentFiles: Object[] = [];
    selectedRecentFile: Object = null;

    /**
     * Creates a new BuilderSimulation3D object that can be used to render the given simulation.
     * @param gameView The game view.
     * @param simulation The simulation to render.
     */
    constructor(gameView: IGameView, simulation: Simulation) {
        super(gameView, simulation);
    }

    init() {
        super.init();

        this.recentFiles = this.simulation.recent.files;

        this._subs.push(
            this.simulation.recent.onUpdated.subscribe(() => {
                this.recentFiles = this.simulation.recent.files;
                this.selectedRecentFile = this.simulation.recent.selectedRecentFile;
            })
        );
    }

    getMainCameraRig(): CameraRig {
        return this._gameView.getMainCameraRig();
    }

    clearRecentFiles() {
        this.simulation.recent.clear();
    }

    selectRecentFile(file: Object) {
        if (
            !this.simulation.recent.selectedRecentFile ||
            this.simulation.recent.selectedRecentFile.id !== file.id
        ) {
            this.simulation.recent.selectedRecentFile = file;
            this.simulation.selection.clearSelection();
        } else {
            this.simulation.recent.selectedRecentFile = null;
        }
    }

    protected _createContext(
        calc: FileCalculationContext,
        file: AuxObject
    ): ContextGroup3D {
        const context = new BuilderGroup3D(
            this,
            file,
            this._gameView.getDecoratorFactory()
        );
        context.setGridChecker(this._gameView.getGridChecker());
        return context;
    }

    protected _shouldRemoveUpdatedFile(
        calc: FileCalculationContext,
        file: AuxObject,
        initialUpdate: boolean
    ) {
        let shouldRemove = false;
        let configTags = getFileConfigContexts(calc, file);
        if (configTags.length === 0) {
            if (!initialUpdate) {
                if (
                    !file.tags['aux._user'] &&
                    file.tags['aux._lastEditedBy'] ===
                        this.simulation.helper.userFile.id
                ) {
                    if (
                        this.simulation.recent.selectedRecentFile &&
                        file.id === this.simulation.recent.selectedRecentFile.id
                    ) {
                        this.simulation.recent.selectedRecentFile = file;
                    } else {
                        this.simulation.recent.selectedRecentFile = null;
                    }
                    // this.addToRecentFilesList(file);
                }
            }
        } else {
            if (file.tags.size <= 0) {
                shouldRemove = true;
            }
        }

        return {
            shouldRemove,
        };
    }
}
