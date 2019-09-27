import { Physics } from '../../../shared/scene/Physics';
import {
    Bot,
    PartialFile,
    botAdded,
    BotAction,
} from '@casual-simulation/aux-common/Files';
import {
    createBot,
    BotCalculationContext,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { merge } from '@casual-simulation/aux-common/utils';
import { AuxFile3D } from '../../../shared/scene/AuxFile3D';
import { BaseBuilderFileDragOperation } from './BaseBuilderFileDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * New Bot Drag Operation handles dragging of new bots from the bot queue.
 */
export class BuilderNewFileDragOperation extends BaseBuilderFileDragOperation {
    public static readonly FreeDragDistance: number = 6;

    private _fileAdded: boolean;
    private _initialDragMesh: AuxFile3D;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        duplicatedFile: Bot,
        originalFile: Bot,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, [duplicatedFile], null, vrController);
    }

    protected _updateFile(bot: Bot, data: PartialFile): BotAction {
        if (!this._fileAdded) {
            if (this._initialDragMesh) {
                this._releaseDragMesh(this._initialDragMesh);
                this._initialDragMesh = null;
            }

            // Add the duplicated bot.
            this._file = merge(this._file, data || {});
            this._file = createBot(undefined, this._file.tags);
            this._files = [this._file];
            this._fileAdded = true;

            return botAdded(this._file);
        } else {
            return super._updateFile(this._file, data);
        }
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        if (this._initialDragMesh) {
            this._releaseDragMesh(this._initialDragMesh);
            this._initialDragMesh = null;
        } else if (this._isOnWorkspace) {
            this.simulation.helper.action(CREATE_ACTION_NAME, this._files);
        }

        super._onDragReleased(calc);
    }

    protected _dragFilesFree(calc: BotCalculationContext): void {
        if (!this._fileAdded) {
            // New bot has not been added yet, drag a dummy mesh to drag around until it gets added to a workspace.
            if (!this._initialDragMesh) {
                this._initialDragMesh = this._createDragMesh(calc, this._file);
            }

            const mouseDir = Physics.screenPosToRay(
                this.game.getInput().getMouseScreenPos(),
                this.game.getMainCameraRig().mainCamera
            );
            let worldPos = Physics.pointOnRay(
                mouseDir,
                BuilderNewFileDragOperation.FreeDragDistance
            );
            this._initialDragMesh.position.copy(worldPos);
            this._initialDragMesh.updateMatrixWorld(true);
        } else {
            // New bot has been added, just do the base bot drag operation.
            super._dragFilesFree(calc);
        }
    }

    private _releaseDragMesh(mesh: AuxFile3D): void {
        if (mesh) {
            mesh.dispose();
            this.game.getScene().remove(mesh);
        }
    }
}
