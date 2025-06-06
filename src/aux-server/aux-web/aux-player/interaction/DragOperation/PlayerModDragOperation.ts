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
import { Physics } from '../../../shared/scene/Physics';
import type { Bot, BotTags } from '@casual-simulation/aux-common/bots';
import { getDropBotFromGridPosition } from '@casual-simulation/aux-common/bots';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import { getBotPosition } from '@casual-simulation/aux-common';
import { BaseModDragOperation } from '../../../shared/interaction/DragOperation/BaseModDragOperation';
import type { Ray } from '@casual-simulation/three';
import { Vector2 } from '@casual-simulation/three';
import type { PlayerInteractionManager } from '../PlayerInteractionManager';
import type { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import type { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import type { PlayerGame } from '../../scene/PlayerGame';
import type { InputMethod } from '../../../shared/scene/Input';
import { Input } from '../../../shared/scene/Input';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';
import type { GridTile } from '../../../shared/scene/Grid3D';
import { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import type { SnapBotsInterface } from '../../../shared/interaction/DragOperation/SnapInterface';

/**
 * Mod drag operation handles dragging mods
 */
export class PlayerModDragOperation extends BaseModDragOperation {
    public static readonly FreeDragDistance: number = 6;

    protected _interaction: PlayerInteractionManager;
    protected _simulation3D: PlayerPageSimulation3D;
    protected _miniSimulation3D: MiniSimulation3D;

    // Determines if the bot is in the miniGridPortal currently
    protected _inMiniPortal: boolean;

    // Determines if the bot was in the miniGridPortal at the beginning of the drag operation
    protected _originallyInMiniPortal: boolean;

    protected _originalContext: string;

    protected _sentDropEnter: boolean;
    protected _dropEnterBot: Bot;

    protected get game(): PlayerGame {
        return <PlayerGame>this._simulation3D.game;
    }

    /**
     * Create a new drag rules.
     */
    constructor(
        simulation3D: PlayerPageSimulation3D,
        miniSimulation3D: MiniSimulation3D,
        interaction: PlayerInteractionManager,
        mod: BotTags,
        inputMethod: InputMethod,
        snapInterface?: SnapBotsInterface
    ) {
        super(
            simulation3D,
            interaction,
            mod,
            inputMethod,
            undefined,
            snapInterface
        );
        this._miniSimulation3D = miniSimulation3D;
    }

    _onDrag(calc: BotCalculationContext) {
        // TODO: This needs a refactor to share more code with
        //       PlayerBotDragOperation.

        this._updateCurrentViewport();

        // Get input ray for grid ray cast.
        let inputRay: Ray = this._getInputRay();

        // Get grid tile from correct simulation grid.
        const grid3D = this._inMiniPortal
            ? this._miniSimulation3D.grid3D
            : this._simulation3D.grid3D;
        const gridTile = grid3D.getTileFromRay(inputRay, true);

        if (!gridTile) {
            return;
        }

        const viewport = (
            this._inMiniPortal
                ? this._miniSimulation3D.getMainCameraRig()
                : this._simulation3D.getMainCameraRig()
        ).viewport;
        const { gameObject, hit } =
            this._interaction.findHoveredGameObjectFromRay(
                inputRay,
                (obj) => obj.pointable,
                viewport
            );
        if (gameObject instanceof AuxBot3D) {
            const nextContext = gameObject.dimension;

            this._updateCurrentDimension(nextContext);

            // Drag on the grid
            const botPosition = getBotPosition(
                calc,
                gameObject.bot,
                nextContext
            );
            const coord = (this._toCoord = new Vector2(
                botPosition.x,
                botPosition.y
            ));
            this._other = gameObject.bot;

            // Bots are always mergable
            // if they want to prevent merging then
            // they have to override onModDrop.
            this._merge = true;
            this._sendDropEnterExitEvents(this._merge ? this._other : null);
            this._updateModPosition(calc, coord);
        } else {
            this._dragOnGrid(calc, gridTile);
        }
    }

    private _dragOnGrid(calc: BotCalculationContext, gridTile: GridTile) {
        const nextDimensionGroup = this._calculateNextDimensionGroup(gridTile);
        this.dimensionGroup = nextDimensionGroup;
        const nextContext = [...this.dimensionGroup.dimensions.values()][0];
        this._updateCurrentDimension(nextContext);
        this._toCoord = gridTile.tileCoordinate;
        const result = getDropBotFromGridPosition(
            calc,
            this._dimension,
            gridTile.tileCoordinate,
            this._mod
        );
        this._other = result.other;
        this._merge = true;
        this._sendDropEnterExitEvents(this._merge ? this._other : null);
        this._updateModPosition(calc, gridTile.tileCoordinate);
    }

    private _updateCurrentDimension(nextContext: string) {
        if (nextContext !== this._dimension) {
            this._previousDimension = this._dimension;
            this._dimension = nextContext;
            this._inMiniPortal =
                nextContext === this._miniSimulation3D.miniDimension;
        }
    }

    private _calculateNextDimensionGroup(tile: GridTile) {
        const dimension =
            this._simulation3D.getDimensionGroupForGrid(tile.grid) ||
            this._miniSimulation3D.getDimensionGroupForGrid(tile.grid);
        return dimension;
    }

    private _getInputRay() {
        let inputRay: Ray;
        if (this._controller) {
            inputRay = objectForwardRay(this._controller.ray);
        } else {
            // Get input ray from correct camera based on which dimension we are in.
            const pagePos = this.game.getInput().getMousePagePos();
            const miniViewport = this.game.getMiniPortalViewport();
            if (this._inMiniPortal) {
                inputRay = Physics.screenPosToRay(
                    Input.screenPositionForViewport(pagePos, miniViewport),
                    this._miniSimulation3D.getMainCameraRig().mainCamera
                );
            } else {
                inputRay = Physics.screenPosToRay(
                    this.game.getInput().getMouseScreenPos(),
                    this._simulation3D.getMainCameraRig().mainCamera
                );
            }
        }
        return inputRay;
    }

    private _updateCurrentViewport() {
        if (!this._controller) {
            // Test to see if we are hovering over the mini simulation view.
            const pagePos = this.game.getInput().getMousePagePos();
            const miniViewport = this.game.getMiniPortalViewport();
            this._inMiniPortal = Input.pagePositionOnViewport(
                pagePos,
                miniViewport
            );
        } else {
            this._inMiniPortal = false;
        }
    }
}
