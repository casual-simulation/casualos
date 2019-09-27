import { ContextGroup3D } from './ContextGroup3D';
import { WorkspaceMesh } from './WorkspaceMesh';
import { GridChecker } from './grid/GridChecker';
import { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import {
    Bot,
    getContextPosition,
    TagUpdatedEvent,
    BotCalculationContext,
    isContext,
    getContextVisualizeMode,
    isMinimized,
    getContextRotation,
} from '@casual-simulation/aux-common';
import { Object3D } from 'three';
import { Simulation3D } from './Simulation3D';

/**
 * Defines a class that represents a builder group.
 * That is, a context group that is specific to the AUX Builder.
 */
export class BuilderGroup3D extends ContextGroup3D {
    /**
     * The workspace that this context contains.
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
        decoratorFactory: AuxBot3DDecoratorFactory
    ) {
        super(simulation3D, bot, 'builder', decoratorFactory);
    }

    protected async _updateThis(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        await this._updateWorkspace(bot, updates, calc);
        await super._updateThis(bot, updates, calc);
    }

    /**
     * Updates this builder's workspace.
     * @param bot
     * @param updates
     * @param calc
     */
    private async _updateWorkspace(
        bot: Bot,
        updates: TagUpdatedEvent[],
        calc: BotCalculationContext
    ) {
        if (isContext(calc, bot)) {
            if (!this.surface) {
                this.surface = new WorkspaceMesh(this.domain);
                this.surface.gridGhecker = this._checker;
                this.add(this.surface);
            }

            const pos = getContextPosition(calc, this.bot);
            this.position.set(pos.x, pos.z, pos.y);

            const rot = getContextRotation(calc, this.bot);
            this.rotation.set(rot.x, rot.y, rot.z);

            this.updateMatrixWorld(true);

            await this.surface.update(calc, bot, this.getFiles());
            const mode = getContextVisualizeMode(calc, this.bot);
            this.display.visible =
                (mode === 'surface' || mode === true) &&
                !isMinimized(calc, this.bot);
        }
    }
}
