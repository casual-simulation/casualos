import { Physics } from '../../../shared/scene/Physics';
import {
    Bot,
    PartialBot,
    botAdded,
    BotAction,
} from '@casual-simulation/aux-common/bots';
import {
    createBot,
    BotCalculationContext,
    CREATE_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { merge } from '@casual-simulation/aux-common/utils';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import { BaseBuilderBotDragOperation } from './BaseBuilderBotDragOperation';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';

/**
 * New Bot Drag Operation handles dragging of new bots from the bot queue.
 */
export class BuilderNewBotDragOperation extends BaseBuilderBotDragOperation {
    public static readonly FreeDragDistance: number = 6;

    private _botAdded: boolean;
    private _initialDragMesh: AuxBot3D;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        duplicatedBot: Bot,
        originalBot: Bot,
        vrController: VRController3D | null
    ) {
        super(simulation3D, interaction, [duplicatedBot], null, vrController);
    }

    protected _updateBot(bot: Bot, data: PartialBot): BotAction {
        if (!this._botAdded) {
            if (this._initialDragMesh) {
                this._releaseDragMesh(this._initialDragMesh);
                this._initialDragMesh = null;
            }

            // Add the duplicated bot.
            this._bot = merge(this._bot, data || {});
            this._bot = createBot(undefined, this._bot.tags);
            this._bots = [this._bot];
            this._botAdded = true;

            return botAdded(this._bot);
        } else {
            return super._updateBot(this._bot, data);
        }
    }

    protected _onDragReleased(calc: BotCalculationContext): void {
        if (this._initialDragMesh) {
            this._releaseDragMesh(this._initialDragMesh);
            this._initialDragMesh = null;
        } else if (this._isOnWorkspace) {
            this.simulation.helper.action(CREATE_ACTION_NAME, this._bots);
        }

        super._onDragReleased(calc);
    }

    protected _dragBotsFree(calc: BotCalculationContext): void {
        if (!this._botAdded) {
            // New bot has not been added yet, drag a dummy mesh to drag around until it gets added to a workspace.
            if (!this._initialDragMesh) {
                this._initialDragMesh = this._createDragMesh(calc, this._bot);
            }

            const mouseDir = Physics.screenPosToRay(
                this.game.getInput().getMouseScreenPos(),
                this.game.getMainCameraRig().mainCamera
            );
            let worldPos = Physics.pointOnRay(
                mouseDir,
                BuilderNewBotDragOperation.FreeDragDistance
            );
            this._initialDragMesh.position.copy(worldPos);
            this._initialDragMesh.updateMatrixWorld(true);
        } else {
            // New bot has been added, just do the base bot drag operation.
            super._dragBotsFree(calc);
        }
    }

    private _releaseDragMesh(mesh: AuxBot3D): void {
        if (mesh) {
            mesh.dispose();
            this.game.getScene().remove(mesh);
        }
    }
}
