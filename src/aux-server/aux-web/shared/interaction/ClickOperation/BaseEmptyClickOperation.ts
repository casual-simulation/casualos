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
import type {
    InputMethod,
    ControllerData,
    InputModality,
    MouseOrTouchInputMethod,
} from '../../../shared/scene/Input';
import type { Vector2, Object3D } from '@casual-simulation/three';
import type { IOperation } from '../../../shared/interaction/IOperation';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import { appManager } from '../../../shared/AppManager';
import type { BaseInteractionManager } from '../BaseInteractionManager';
import type { Game } from '../../../shared/scene/Game';
import {
    VRDragThresholdPassed,
    DragThresholdPassed,
} from './ClickOperationUtils';

/**
 * Empty Click Operation handles clicking of empty space for mouse and touch input with the primary (left/first finger) interaction button.
 */
export abstract class BaseEmptyClickOperation implements IOperation {
    protected _interaction: BaseInteractionManager;
    protected _game: Game;
    protected _finished: boolean;
    protected _sentDownEvent: boolean;
    protected _controller: ControllerData;

    protected _startScreenPos: Vector2;
    protected _startVRControllerPose: Object3D;
    protected _inputModality: InputModality;
    protected _inputMethod: InputMethod;

    get simulation() {
        return appManager.simulationManager.primary;
    }

    constructor(
        game: Game,
        interaction: BaseInteractionManager,
        inputMethod: InputMethod,
        inputModality: InputModality
    ) {
        this._game = game;
        this._interaction = interaction;
        this._controller =
            inputMethod.type === 'controller' ? inputMethod.controller : null;
        this._inputMethod = inputMethod;
        this._inputModality = inputModality;

        if (this._controller) {
            // Store the pose of the vr controller when the click occured.
            this._startVRControllerPose = this._controller.ray.clone();
        } else {
            // Store the screen position of the input when the click occured.
            this._startScreenPos = this._game.getInput().getMouseScreenPos();
        }

        this._interaction.hideContextMenu();
    }

    public update(calc: BotCalculationContext): void {
        if (this._finished) return;

        if (!this._sentDownEvent) {
            this._performDown(calc);
            this._sentDownEvent = true;
        }

        const input = this._game.getInput();
        const buttonHeld: boolean = this._controller
            ? input.getControllerPrimaryButtonHeld(this._controller)
            : input.getMouseButtonHeld(
                  (this._inputMethod as MouseOrTouchInputMethod).buttonId ?? 0
              );

        if (!buttonHeld) {
            let dragThresholdPassed: boolean = this._controller
                ? VRDragThresholdPassed(
                      this._startVRControllerPose,
                      this._controller.ray
                  )
                : DragThresholdPassed(
                      this._startScreenPos,
                      this._game.getInput().getMouseScreenPos(),
                      (this._inputMethod as MouseOrTouchInputMethod).buttonId ??
                          0
                  );

            if (!dragThresholdPassed) {
                this._performClick(calc);
            }

            this._performUp(calc);

            // Button has been released. This click operation is finished.
            this._finished = true;
        }
    }

    public isFinished(): boolean {
        return this._finished;
    }

    public dispose(): void {}

    /**
     * Sends the empty click event. (onGridClick)
     * @param calc
     */
    protected abstract _performClick(calc: BotCalculationContext): void;

    /**
     * Sends the empty up event. (onGridUp)
     * @param calc
     */
    protected abstract _performUp(calc: BotCalculationContext): void;

    /**
     * Sends the empty down event. (onGridDown)
     * @param calc
     */
    protected abstract _performDown(calc: BotCalculationContext): void;
}
