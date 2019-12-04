import { Intersection, Vector3, Vector2 } from 'three';
import { Physics } from '../../../shared/scene/Physics';
import { Bot, BotTags } from '@casual-simulation/aux-common/bots';
import {
    BotCalculationContext,
    isMinimized,
} from '@casual-simulation/aux-common';
import { BuilderGroup3D } from '../../../shared/scene/BuilderGroup3D';
import { BuilderInteractionManager } from '../BuilderInteractionManager';
import { BaseBuilderBotDragOperation } from './BaseBuilderBotDragOperation';
import { Simulation3D } from '../../../shared/scene/Simulation3D';
import { VRController3D } from '../../../shared/scene/vr/VRController3D';
import { BuilderModDragOperation } from './BuilderModDragOperation';

/**
 * Bot Drag Operation handles dragging of bots for mouse and touch input.
 */
export class BuilderBotDragOperation extends BaseBuilderBotDragOperation {
    // This overrides the base class BaseInteractionManager
    protected _interaction: BuilderInteractionManager;

    private _workspace: BuilderGroup3D;
    private _workspaceDelta: Vector3;

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: Simulation3D,
        interaction: BuilderInteractionManager,
        hit: Intersection,
        bots: Bot[],
        workspace: BuilderGroup3D,
        context: string,
        vrController: VRController3D | null,
        fromCoord: Vector2,
        skipOnDragEvents: boolean = false
    ) {
        super(
            simulation3D,
            interaction,
            bots,
            context,
            vrController,
            fromCoord,
            skipOnDragEvents
        );

        this._workspace = workspace;

        if (this._workspace) {
            this.game.setWorldGridVisible(true);

            // calculate the delta needed to be applied to the pointer
            // positions to have the pointer drag around the originally tapped point
            // instead of where the anchor is.
            this._workspaceDelta = new Vector3()
                .copy(this._workspace.position)
                .sub(hit.point);
            this._workspaceDelta.setY(0);
        }
    }

    protected _createBotDragOperation(bot: Bot) {
        if (this._workspace) {
            return null;
        } else if (this._bots.indexOf(bot) >= 0) {
            return null;
        }

        return new BuilderBotDragOperation(
            this._simulation3D,
            this._interaction,
            null,
            [bot],
            null,
            this._context,
            this._vrController,
            this._fromCoord,
            true
        );
    }

    protected _createModDragOperation(mod: BotTags) {
        if (this._workspace) {
            return null;
        }

        return new BuilderModDragOperation(
            this._simulation3D,
            this._interaction,
            mod,
            this._vrController
        );
    }

    protected _disposeCore() {
        if (this._workspace) {
            this.game.setWorldGridVisible(false);
        }
        super._disposeCore();
    }

    protected _onDrag(calc: BotCalculationContext) {
        if (this._workspace) {
            if (isMinimized(calc, this._workspace.bot)) {
                this._onDragWorkspace(calc);
            }
        } else {
            super._onDrag(calc);
        }
    }

    protected _onDragWorkspace(calc: BotCalculationContext) {
        const mouseDir = Physics.screenPosToRay(
            this.game.getInput().getMouseScreenPos(),
            this.game.getMainCameraRig().mainCamera
        );
        const point = Physics.pointOnPlane(mouseDir, Physics.GroundPlane);

        if (point) {
            // move the center of the workspace to the point
            let final = new Vector3().copy(point);

            this.simulation.helper.updateBot(this._workspace.bot, {
                tags: {
                    [`auxContextX`]: final.x,
                    [`auxContextY`]: final.z,
                },
            });
        }
    }
}
