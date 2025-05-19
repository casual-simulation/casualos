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
import type { AuxBot3DDecorator } from '../AuxBot3DDecorator';
import { ScaleDecorator } from './ScaleDecorator';
import { DimensionPositionDecorator } from './DimensionPositionDecorator';
import { BotShapeDecorator } from './BotShapeDecorator';
import { ProgressBarDecorator } from './ProgressBarDecorator';
import { LabelDecorator } from './LabelDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import { LineToDecorator } from './LineToDecorator';
import { WordBubbleDecorator } from './WordBubbleDecorator';
import { TextureDecorator } from './TextureDecorator';
import { UpdateMaxtrixDecorator } from './UpdateMatrixDecorator';
import type { Simulation3D } from '../Simulation3D';
import type { Game } from '../Game';
import { BotLODDecorator } from './BotLODDecorator';
import { TransformerDecorator } from './TransformerDecorator';

export class AuxBot3DDecoratorFactory {
    public game: Game;
    public simulation: Simulation3D;

    constructor(game?: Game, simulation?: Simulation3D) {
        this.game = game;
        this.simulation = simulation;
    }

    loadDecorators(bot3d: AuxBot3D): AuxBot3DDecorator[] {
        let decorators: AuxBot3DDecorator[] = [];

        let botShapeDecorator = new BotShapeDecorator(
            bot3d,
            this.game,
            this.simulation
        );
        let textureDecorator = new TextureDecorator(bot3d, botShapeDecorator);

        let progressBarDecorator = new ProgressBarDecorator(
            bot3d,
            botShapeDecorator
        );

        decorators.push(
            botShapeDecorator,
            textureDecorator,
            progressBarDecorator
        );

        if (!!this.game) {
            decorators.push(new TransformerDecorator(bot3d));
        }

        decorators.push(
            new ScaleDecorator(bot3d),
            new DimensionPositionDecorator(bot3d, this.game, { lerp: false })
        );

        if (!!this.game) {
            let labelDecorator = new LabelDecorator(bot3d, this.game);
            let wordBubbleDecorator = new WordBubbleDecorator(
                bot3d,
                labelDecorator
            );

            decorators.push(
                new UpdateMaxtrixDecorator(bot3d),
                labelDecorator,
                wordBubbleDecorator,
                new LineToDecorator(bot3d, this.simulation),
                new BotLODDecorator(bot3d)
            );
        }

        return decorators;
    }
}
