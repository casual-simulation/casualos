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
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type {
    BotCalculationContext,
    BotLOD,
    ShoutAction,
} from '@casual-simulation/aux-common';
import {
    botHasLOD,
    DEFAULT_BOT_LOD,
    calculateNumericalTagValue,
    DEFAULT_BOT_LOD_MIN_THRESHOLD,
    DEFAULT_BOT_LOD_MAX_THRESHOLD,
    calculateBotLOD,
    onLODArg,
    ON_MAX_LOD_ENTER_ACTION_NAME,
    ON_MIN_LOD_ENTER_ACTION_NAME,
    ON_MIN_LOD_EXIT_ACTION_NAME,
    ON_ANY_MIN_LOD_EXIT_ACTION_NAME,
    ON_MAX_LOD_EXIT_ACTION_NAME,
    ON_ANY_MAX_LOD_EXIT_ACTION_NAME,
    ON_ANY_MIN_LOD_ENTER_ACTION_NAME,
    ON_ANY_MAX_LOD_ENTER_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { percentOfScreen } from '../SceneUtils';
import type { Camera } from '@casual-simulation/three';
import type { Simulation } from '@casual-simulation/aux-vm';

export class BotLODDecorator extends AuxBot3DDecoratorBase {
    private _currentLOD: BotLOD = DEFAULT_BOT_LOD;
    private _minThreshold: number;
    private _maxThreshold: number;
    private _camera: Camera;
    private _simulation: Simulation;

    constructor(bot3D: AuxBot3D) {
        super(bot3D);
        if (this.bot3D.dimensionGroup) {
            this._simulation =
                this.bot3D.dimensionGroup.simulation3D.simulation;
        }
    }

    frameUpdate?(calc: BotCalculationContext): void;

    botUpdated(calc: BotCalculationContext): void {
        this._updateCamera();
        if (!this._camera) {
            return;
        }
        const hasLOD = botHasLOD(calc, this.bot3D.bot);
        this._minThreshold = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxMinLODThreshold',
            DEFAULT_BOT_LOD_MIN_THRESHOLD
        );
        this._maxThreshold = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxMaxLODThreshold',
            DEFAULT_BOT_LOD_MAX_THRESHOLD
        );

        if (hasLOD && !this.frameUpdate) {
            this.frameUpdate = this._frameUpdate;
            this.bot3D.updateFrameUpdateList();
        } else if (!hasLOD && this.frameUpdate) {
            this.frameUpdate = null;
            this.bot3D.updateFrameUpdateList();
        }

        this._updateLOD(calc);
    }

    dispose(): void {}

    private _frameUpdate(calc: BotCalculationContext): void {
        this._updateCamera();
        if (!this._camera) {
            return;
        }
        this._updateLOD(calc);
    }

    private _updateCamera() {
        if (this.bot3D.dimensionGroup) {
            this._camera =
                this.bot3D.dimensionGroup.simulation3D.getMainCameraRig().mainCamera;
        }
    }

    private _updateLOD(calc: BotCalculationContext) {
        const percent = percentOfScreen(
            this._camera,
            this.bot3D.unitBoundingSphere
        );
        const nextLOD = calculateBotLOD(
            percent,
            this._minThreshold,
            this._maxThreshold
        );

        if (this._currentLOD !== nextLOD) {
            this._sendLODEvents(nextLOD);
        }

        this._currentLOD = nextLOD;
    }

    private _sendLODEvents(nextLOD: string) {
        const arg = onLODArg(this.bot3D.bot, this.bot3D.dimension);
        let actions = [] as ShoutAction[];
        if (this._currentLOD === 'min') {
            // send min exit event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MIN_LOD_EXIT_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MIN_LOD_EXIT_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        } else if (this._currentLOD === 'max') {
            // send max exit event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MAX_LOD_EXIT_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MAX_LOD_EXIT_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        }
        if (nextLOD === 'min') {
            // send min enter event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MIN_LOD_ENTER_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MIN_LOD_ENTER_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        } else if (nextLOD === 'max') {
            // send max enter event
            // send min enter event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MAX_LOD_ENTER_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MAX_LOD_ENTER_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        }
        if (actions.length > 0) {
            this._simulation.helper.transaction(...actions);
        }
    }
}
