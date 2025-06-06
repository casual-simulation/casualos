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
import { BaseBotClickOperation } from '../../../shared/interaction/ClickOperation/BaseBotClickOperation';
import type { AuxBot3D } from '../../../shared/scene/AuxBot3D';
import type { Intersection, Vector2 } from '@casual-simulation/three';
import type { PlayerInteractionManager } from '../PlayerInteractionManager';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import {
    getBotPosition,
    objectsAtDimensionGridPosition,
    CLICK_ACTION_NAME,
    ANY_CLICK_ACTION_NAME,
    onClickArg,
    onAnyClickArg,
    VECTOR_TAG_PREFIX,
} from '@casual-simulation/aux-common';
import type { BaseBotDragOperation } from '../../../shared/interaction/DragOperation/BaseBotDragOperation';
import { PlayerBotDragOperation } from '../DragOperation/PlayerBotDragOperation';
import { dropWhile } from 'lodash';
import type { PlayerPageSimulation3D } from '../../scene/PlayerPageSimulation3D';
import type { MiniSimulation3D } from '../../scene/MiniSimulation3D';
import type { Simulation3D } from '../../../shared/scene/Simulation3D';
import type { PlayerGame } from '../../scene/PlayerGame';
import type { InputMethod, InputModality } from '../../../shared/scene/Input';
import {
    getModalityHand,
    getModalityFinger,
    getModalityButtonId,
} from '../../../shared/scene/Input';
import type { MapSimulation3D } from '../../scene/MapSimulation3D';
import type { Block } from 'three-mesh-ui';

export class PlayerBotClickOperation extends BaseBotClickOperation {
    // This overrides the base class.
    protected _interaction: PlayerInteractionManager;
    private _block: Block | null;

    protected _face: string;

    constructor(
        simulation3D: Simulation3D,
        interaction: PlayerInteractionManager,
        bot: AuxBot3D,
        faceValue: string,
        inputMethod: InputMethod,
        inputModality: InputModality,
        hit: Intersection,
        block: Block | null
    ) {
        super(
            simulation3D,
            interaction,
            bot.bot,
            bot,
            inputMethod,
            inputModality,
            hit
        );

        this._face = faceValue;
        this._block = block;
    }

    protected _performClick(calc: BotCalculationContext): void {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;

        const uv = !!this._hit?.uv
            ? `${VECTOR_TAG_PREFIX}${this._hit.uv.x},${this._hit.uv.y}`
            : null;

        this.simulation.helper.action(
            CLICK_ACTION_NAME,
            [this._bot],
            onClickArg(
                this._face,
                bot3D.dimension,
                uv,
                this._inputModality.type,
                getModalityHand(this._inputModality),
                getModalityFinger(this._inputModality),
                getModalityButtonId(this._inputModality)
            )
        );

        this.simulation.helper.action(
            ANY_CLICK_ACTION_NAME,
            null,
            onAnyClickArg(
                this._face,
                bot3D.dimension,
                this._bot,
                uv,
                this._inputModality.type,
                getModalityHand(this._inputModality),
                getModalityFinger(this._inputModality),
                getModalityButtonId(this._inputModality)
            )
        );

        if (this._block) {
            this._sendKeyEvent(this._block);
        }
    }

    protected _createDragOperation(
        calc: BotCalculationContext,
        fromCoord?: Vector2
    ): BaseBotDragOperation {
        const bot3D: AuxBot3D = <AuxBot3D>this._bot3D;
        const dimension = bot3D.dimension;
        const position = getBotPosition(calc, bot3D.bot, dimension);
        if (position) {
            const objects = objectsAtDimensionGridPosition(
                calc,
                dimension,
                position
            );
            if (objects.length === 0) {
                console.log('Found no objects at', position);
                console.log(bot3D.bot);
                console.log(dimension);
                return null;
            }
            const bot = this._bot;
            const draggedObjects = dropWhile(objects, (o) => o.id !== bot.id);
            const {
                playerSimulation3D,
                miniSimulation3D,
                mapSimulation3D,
                miniMapSimulation3D,
            } = this._getSimulationsForDragOp();

            return new PlayerBotDragOperation(
                playerSimulation3D,
                miniSimulation3D,
                mapSimulation3D,
                miniMapSimulation3D,
                this._interaction,
                draggedObjects,
                bot3D.dimension,
                this._inputMethod,
                this._inputModality,
                fromCoord,
                undefined,
                this._face,
                this._hit
            );
        }

        return null;
    }

    private _getSimulationsForDragOp() {
        const game = <PlayerGame>this.game;
        const sim = this._simulation3D.simulation;
        let playerSimulation3D: PlayerPageSimulation3D =
            game.findPlayerSimulation3D(sim);
        let miniSimulation3D: MiniSimulation3D = game.findMiniSimulation3D(sim);
        let mapSimulation3D: MapSimulation3D = game.findMapSimulation3D(sim);
        let miniMapSimulation3D: MapSimulation3D =
            game.findMiniMapSimulation3D(sim);

        return {
            playerSimulation3D,
            miniSimulation3D,
            mapSimulation3D,
            miniMapSimulation3D,
        };
    }

    private _sendKeyEvent(block: Block) {
        if (block.type === 'Key') {
            let key = block as any;
            let keyboard = key.keyboard;
            let keyName: string;

            if (key.info.command) {
                switch (key.info.command) {
                    case 'switch':
                        keyboard.setNextPanel();
                        break;
                    case 'switch-set':
                        keyboard.setNextCharset();
                        break;
                    case 'enter':
                        keyName = 'Enter';
                        break;
                    case 'space':
                        keyName = ' ';
                        break;
                    case 'backspace':
                        keyName = 'Backspace';
                        break;
                    case 'shift':
                        keyName = 'Shift';
                        keyboard.toggleCase();
                        break;
                }
            } else {
                keyName = key.info.input;
            }

            if (keyName) {
                this.simulation.helper.action('onKeyClick', [this._bot], {
                    key: keyName,
                });
            }
        }
    }
}
