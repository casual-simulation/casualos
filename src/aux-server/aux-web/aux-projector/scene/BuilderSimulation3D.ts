import { Simulation3D } from '../../shared/scene/Simulation3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import {
    AuxObject,
    getFileConfigContexts,
    FileCalculationContext,
} from '@casual-simulation/aux-common';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';

export class BuilderSimulation3D extends Simulation3D {
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

    protected _fileUpdatedCore(
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
