import { AuxBot3DDecorator } from '../AuxBot3DDecorator';
import { hasValue } from '@casual-simulation/aux-common';
import { ScaleDecorator } from './ScaleDecorator';
import { DimensionPositionDecorator } from './DimensionPositionDecorator';
import { BotShapeDecorator } from './BotShapeDecorator';
import { ProgressBarDecorator } from './ProgressBarDecorator';
import { LabelDecorator } from './LabelDecorator';
import { UserMeshDecorator } from './UserMeshDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { LineToDecorator } from './LineToDecorator';
import { WordBubbleDecorator } from './WordBubbleDecorator';
import { appManager } from '../../../shared/AppManager';
import { UserControlsDecorator } from './UserControlsDecorator';
import { TextureDecorator } from './TextureDecorator';
import { UpdateMaxtrixDecorator } from './UpdateMatrixDecorator';
import { Simulation3D } from '../Simulation3D';
import { Game } from '../Game';
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

        let botShapeDecorator = new BotShapeDecorator(bot3d, this.game);
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
