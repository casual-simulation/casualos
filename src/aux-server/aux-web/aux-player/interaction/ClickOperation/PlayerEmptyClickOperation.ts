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
import type { InputMethod, InputModality } from '../../../shared/scene/Input';
import {
    getModalityButtonId,
    getModalityFinger,
    getModalityHand,
    getModalityKey,
    Input,
} from '../../../shared/scene/Input';
import type { Ray } from '@casual-simulation/three';
import { appManager } from '../../../shared/AppManager';
import type { PlayerInteractionManager } from '../PlayerInteractionManager';
import type { Simulation3D } from '../../../shared/scene/Simulation3D';
import { PlayerSimulation3D } from '../../scene/PlayerSimulation3D';
import { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import { Physics } from '../../../shared/scene/Physics';
import type { PlayerGame } from '../../scene/PlayerGame';
import { BaseEmptyClickOperation } from '../../../shared/interaction/ClickOperation/BaseEmptyClickOperation';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import {
    ON_GRID_CLICK_ACTION_NAME,
    ON_GRID_DOWN_ACTION_NAME,
    ON_GRID_UP_ACTION_NAME,
    onGridClickArg,
} from '@casual-simulation/aux-common';
import { objectForwardRay } from '../../../shared/scene/SceneUtils';
import type { Simulation } from '@casual-simulation/aux-vm';
import type { Grid3D } from '../../../shared/scene/Grid3D';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export class PlayerEmptyClickOperation extends BaseEmptyClickOperation {
    protected _game: PlayerGame;
    protected _interaction: PlayerInteractionManager;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: PlayerGame,
        interaction: PlayerInteractionManager,
        inputMethod: InputMethod,
        inputModality: InputModality
    ) {
        super(game, interaction, inputMethod, inputModality);
        this._game = game;
        this._interaction = interaction;
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    protected _performClick(calc: BotCalculationContext): void {
        this._sendOnGridClickEvent(calc);
    }

    protected _performUp(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_UP_ACTION_NAME, null, arg);
        });
    }

    protected _performDown(calc: BotCalculationContext): void {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_DOWN_ACTION_NAME, null, arg);
        });
    }

    private _sendOnGridClickEvent(calc: BotCalculationContext) {
        this._sendGridEvent(calc, (simulation, arg) => {
            simulation.helper.action(ON_GRID_CLICK_ACTION_NAME, null, arg);
        });
    }

    private _sendGridEvent(
        calc: BotCalculationContext,
        sendAction: (simulation: Simulation, arg: any) => void
    ) {
        const simulation3Ds = this._game.getSimulations();

        const sendGridAction = (
            inputDimension: string,
            inputRay: Ray,
            grid: Grid3D,
            sim: Simulation3D
        ) => {
            if (!inputRay || !grid || !inputDimension || !sim) {
                return;
            }

            // Get grid tile that intersects with input ray.
            const gridTile = grid.getTileFromRay(inputRay, true);

            let position: any = {
                x: Infinity,
                Y: Infinity,
            };
            if (gridTile) {
                position = {
                    x: gridTile.tileCoordinate.x,
                    y: gridTile.tileCoordinate.y,
                };
            }

            sendAction(
                sim.simulation,
                onGridClickArg(
                    position,
                    inputDimension,
                    getModalityKey(this._inputModality),
                    getModalityHand(this._inputModality),
                    getModalityFinger(this._inputModality),
                    getModalityButtonId(this._inputModality)
                )
            );
        };

        // If we're in VR, then send the empty click to the PlayerPageSimulation
        if (this._controller) {
            const sim3D = simulation3Ds.find(
                (sim) => sim instanceof PlayerPageSimulation3D
            ) as PlayerPageSimulation3D;
            if (sim3D) {
                const inputDimension = sim3D.dimension;
                const inputRay = objectForwardRay(this._controller.ray);
                const grid = sim3D.grid3D;
                const sim = sim3D;
                sendGridAction(inputDimension, inputRay, grid, sim);
            }
        } else {
            // Otherwise, calculate the simulation based on the viewport the mouse is over
            const pagePos = this._game.getInput().getMousePagePos();
            const viewports = this._game.getViewports();

            for (let sim3D of simulation3Ds) {
                const rig = sim3D.getMainCameraRig();

                if (
                    Input.pagePositionOnViewport(
                        pagePos,
                        rig.viewport,
                        viewports
                    )
                ) {
                    if (sim3D instanceof PlayerSimulation3D) {
                        const inputRay = Physics.screenPosToRay(
                            Input.screenPositionForViewport(
                                pagePos,
                                rig.viewport
                            ),
                            rig.mainCamera
                        );

                        const inputDimension = sim3D.dimension;
                        const grid = sim3D.grid3D;

                        sendGridAction(inputDimension, inputRay, grid, sim3D);
                    } else {
                        console.warn(
                            '[PlayerEmptyClickOperation] Unable to find grid for simulation',
                            sim3D
                        );
                    }
                }
            }
        }
    }
}
