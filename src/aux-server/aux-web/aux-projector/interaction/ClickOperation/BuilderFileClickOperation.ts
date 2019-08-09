import { BuilderFileDragOperation } from '../DragOperation/BuilderFileDragOperation';
import { Intersection } from 'three';
import {
    UserMode,
    File,
    duplicateFile,
    FileCalculationContext,
    getFileIndex,
    getFilePosition,
    objectsAtContextGridPosition,
    isFileMovable,
    getFileConfigContexts,
    isMinimized,
    isContextMovable,
    getFileDragMode,
    tagsOnFile,
} from '@casual-simulation/aux-common';
import { BaseFileClickOperation } from '../../../shared/interaction/ClickOperation/BaseFileClickOperation';
import { BaseFileDragOperation } from '../../../shared/interaction/DragOperation/BaseFileDragOperation';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import BuilderGameView from '../../BuilderGameView/BuilderGameView';
import { dropWhile } from 'lodash';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { BuilderSimulation3D } from '../../scene/BuilderSimulation3D';
import { BuilderNewFileDragOperation } from '../DragOperation/BuilderNewFileDragOperation';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * File Click Operation handles clicking of files for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class BuilderFileClickOperation extends BaseFileClickOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    private _hit: Intersection;

    protected _simulation3D: BuilderSimulation3D;

    constructor(
        simulation: BuilderSimulation3D,
        interaction: BuilderInteractionManager,
        file: AuxFile3D | ContextGroup3D,
        hit: Intersection,
        vrController: VRController3D
    ) {
        super(simulation, interaction, file.file, file, vrController);
        this._hit = hit;
    }

    protected _getWorkspace(): BuilderGroup3D | null {
        return this._file3D instanceof BuilderGroup3D ? this._file3D : null;
    }

    protected _createDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
        const mode = getFileDragMode(calc, this._file);

        if (
            mode === 'clone' ||
            this.game.getInput().getKeyHeld('Meta') ||
            this.game.getInput().getKeyHeld('Ctrl') ||
            this.game.getInput().getKeyHeld('Control')
        ) {
            return this._createCloneDragOperation(calc);
        } else if (mode === 'mod') {
            return this._createDiffDragOperation(calc);
        }

        const workspace = this._getWorkspace();
        if (!workspace) {
            const file3D: AuxFile3D = <AuxFile3D>this._file3D;
            const context = file3D.context;
            const fileWorkspace = this._interaction.findWorkspaceForMesh(
                this._file3D
            );
            const position = getFilePosition(calc, file3D.file, context);
            if (fileWorkspace && position) {
                const objects = objectsAtContextGridPosition(
                    calc,
                    context,
                    position
                );
                if (objects.length === 0) {
                    console.log('Found no objects at', position);
                    console.log(file3D.file);
                    console.log(context);
                }
                const file = this._file;
                const draggedObjects = dropWhile(
                    objects,
                    o => o.id !== file.id
                );
                return new BuilderFileDragOperation(
                    this._simulation3D,
                    this._interaction,
                    this._hit,
                    draggedObjects,
                    <BuilderGroup3D>workspace,
                    file3D.context,
                    this._vrController
                );
            }
        }
        return new BuilderFileDragOperation(
            this._simulation3D,
            this._interaction,
            this._hit,
            [this._file3D.file],
            <BuilderGroup3D>workspace,
            null,
            this._vrController
        );
    }

    protected _createCloneDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
        let duplicatedFile = duplicateFile(calc, <File>this._file);
        return new BuilderNewFileDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._file,
            this._vrController
        );
    }

    protected _createDiffDragOperation(
        calc: FileCalculationContext
    ): BaseFileDragOperation {
        const tags = tagsOnFile(this._file);
        let duplicatedFile = duplicateFile(calc, <File>this._file, {
            tags: {
                'aux.mod': true,
                'aux.mod.mergeTags': tags,
            },
        });
        return new BuilderNewFileDragOperation(
            this._simulation3D,
            this._interaction,
            duplicatedFile,
            this._file,
            this._vrController
        );
    }

    protected _performClick(calc: FileCalculationContext): void {
        const workspace = this._getWorkspace();
        // If we let go of the mouse button without starting a drag operation, this constitues a 'click'.
        if (!workspace) {
            if (this._interaction.isInCorrectMode(this._file3D)) {
                // Select the file we are operating on.
                this._interaction.selectFile(<AuxFile3D>this._file3D);
            }

            // If we're clicking on a workspace show the context menu for it.
        } else if (workspace) {
            if (
                !this._interaction.isInCorrectMode(this._file3D) &&
                this.simulation.recent.selectedRecentFile
            ) {
                // Create file at clicked workspace position.
                let workspaceMesh = workspace.surface;
                let closest = workspaceMesh.closestTileToPoint(this._hit.point);

                if (closest) {
                    const context = this._interaction.firstContextInWorkspace(
                        workspace
                    );
                    let newFile = duplicateFile(
                        calc,
                        this.simulation.recent.selectedRecentFile,
                        {
                            tags: {
                                [context]: true,
                                [`${context}.x`]: closest.tile.gridPosition.x,
                                [`${context}.y`]: closest.tile.gridPosition.y,
                                [`${context}.z`]: closest.tile.localPosition.y,
                                [`${context}.sortOrder`]: 0,
                            },
                        }
                    );

                    this.simulation.helper.createFile(newFile.id, newFile.tags);
                }
            } else {
                this._interaction.showContextMenu(calc);
            }
        }
    }

    protected _canDragFile(calc: FileCalculationContext, file: File): boolean {
        if (this._file3D instanceof ContextGroup3D) {
            let tags = getFileConfigContexts(calc, file);
            return (
                isContextMovable(calc, file) &&
                isMinimized(calc, file) &&
                tags.length > 0
            );
        } else {
            return isFileMovable(calc, file);
        }
        // if (this._interaction.isInCorrectMode(this._file3D)) {
        //     if (this._interaction.isInWorksurfacesMode()) {
        //         let tags = getFileConfigContexts(calc, file);
        //         if (tags.length > 0) {
        //             // Workspaces are always movable.
        //             return true;
        //         }
        //     }
        //     return isFileMovable(calc, file);
        // }
        // return false;
    }
}
