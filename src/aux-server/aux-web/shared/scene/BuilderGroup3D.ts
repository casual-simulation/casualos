/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { DimensionGroup3D } from './DimensionGroup3D';
import { WorkspaceMesh } from './WorkspaceMesh';
import type { GridChecker } from './grid/GridChecker';
import type { AuxBot3DDecoratorFactory } from './decorators/AuxBot3DDecoratorFactory';
import type { Bot, BotCalculationContext } from '@casual-simulation/aux-common';
import {
    getDimensionPosition,
    isDimension,
    getDimensionVisualizeMode,
    isMinimized,
    getDimensionRotation,
} from '@casual-simulation/aux-common';
import type { Object3D } from '@casual-simulation/three';
import type { Simulation3D } from './Simulation3D';

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
