import { DimensionGroup3D } from './DimensionGroup3D';
import { WorkspaceMesh } from './WorkspaceMesh';
import { GridChecker } from './grid/GridChecker';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import {
    Bot,
    getDimensionPosition,
    TagUpdatedEvent,
    BotCalculationContext,
    isDimension,
    getDimensionVisualizeMode,
    isMinimized,
    getDimensionRotation,
} from '@casual-simulation/aux-common';
import { Object3D } from '@casual-simulation/three';
import { Simulation3D } from './Simulation3D';

/**
 * Defines a class that represents a builder group.
 * That is, a dimension group that is specific to the AUX Builder.
 */
export class BuilderGroup3D extends DimensionGroup3D {
    /**
     * The workspace that this dimension contains.
     */
    surface: WorkspaceMesh;

    private _checker: GridChecker;

    /**
     * Sets the grid checker that should be used by this group's workspace.
     * @param gridChecker The grid checker to use.
     */
    setGridChecker(gridChecker: GridChecker) {
        this._checker = gridChecker;
    }

    get groupColliders() {
        if (this.surface) {
            return this.surface.colliders;
        } else {
            return [];
        }
    }

    set groupColliders(value: Object3D[]) {}

    /**
     * Creates a new BuilderGroup3D. That is, a group of contexts that are visualized
     * using a worksurface.
     * @param simulation3D The simulation that this group is in.
     * @param bot The bot that this group represents.
     * @param decoratorFactory The decorator factory that should be used to decorate AuxBot3D objects.
     */
    constructor(
        simulation3D: Simulation3D,
        bot: Bot,
        decoratorFactory: AuxBot3DDecoratorFactory,
        portalTag: string
    ) {
        super(simulation3D, bot, 'builder', decoratorFactory, portalTag);
    }

    protected _updateThis(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ) {
        this._updateWorkspace(bot, tags, calc).then(() => {
            super._updateThis(bot, tags, calc);
        });
    }

    /**
     * Updates this builder's workspace.
     * @param bot
     * @param updates
     * @param calc
     */
    private async _updateWorkspace(
        bot: Bot,
        tags: string[],
        calc: BotCalculationContext
    ) {
        if (isDimension(calc, bot)) {
            if (!this.surface) {
                this.surface = new WorkspaceMesh(this.domain);
                this.surface.gridGhecker = this._checker;
                this.add(this.surface);
            }

            const pos = getDimensionPosition(calc, this.bot);
            this.position.set(pos.x, pos.z, pos.y);

            const rot = getDimensionRotation(calc, this.bot);
            this.rotation.set(rot.x, rot.y, rot.z);

            this.updateMatrixWorld(true);

            await this.surface.update(calc, bot, this.getBots());
            const mode = getDimensionVisualizeMode(calc, this.bot);
            this.display.visible =
                (mode === 'surface' || mode === true) &&
                !isMinimized(calc, this.bot);
        }
    }
}
