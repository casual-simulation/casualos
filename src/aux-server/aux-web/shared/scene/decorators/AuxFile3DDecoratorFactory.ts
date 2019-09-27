import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { hasValue } from '@casual-simulation/aux-common';
import { ScaleDecorator } from './ScaleDecorator';
import { ContextPositionDecorator } from './ContextPositionDecorator';
import { FileShapeDecorator } from './FileShapeDecorator';
import { ProgressBarDecorator } from './ProgressBarDecorator';
import { LabelDecorator } from './LabelDecorator';
import { UserMeshDecorator } from './UserMeshDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { LineToDecorator } from './LineToDecorator';
import { WordBubbleDecorator } from './WordBubbleDecorator';
import { appManager } from '../../../shared/AppManager';
import { UserControlsDecorator } from './UserControlsDecorator';
import { TextureDecorator } from './TextureDecorator';
import { IFramePlaneDecorator } from './IFramePlaneDecorator';
import { UpdateMaxtrixDecorator } from './UpdateMatrixDecorator';
import { Simulation3D } from '../Simulation3D';
import { Game } from '../Game';

export class AuxFile3DDecoratorFactory {
    public game: Game;
    public simulation: Simulation3D;

    constructor(game?: Game, simulation?: Simulation3D) {
        this.game = game;
        this.simulation = simulation;
    }

    loadDecorators(file3d: AuxFile3D): AuxFile3DDecorator[] {
        let decorators: AuxFile3DDecorator[] = [];
        const isUser = !!file3d.bot && hasValue(file3d.bot.tags['aux._user']);
        const isLocalUser = isUser && file3d.bot.id === appManager.user.id;

        if (isUser) {
            if (isLocalUser) {
                // Local user gets controls for changing their user position in contexts.
                decorators.push(new UserControlsDecorator(file3d, this.game));
            } else {
                // Remote user gets mesh to visualize where it is in contexts.
                decorators.push(new UserMeshDecorator(file3d));
            }
        } else {
            let fileShapeDecorator = new FileShapeDecorator(file3d);
            let textureDecorator = new TextureDecorator(
                file3d,
                fileShapeDecorator
            );

            let progressBarDecorator = new ProgressBarDecorator(
                file3d,
                fileShapeDecorator
            );

            decorators.push(
                fileShapeDecorator,
                textureDecorator,
                progressBarDecorator
            );
        }

        decorators.push(
            new ScaleDecorator(file3d),
            new ContextPositionDecorator(file3d, { lerp: isUser })
        );

        if (!!this.game) {
            let labelDecorator = new LabelDecorator(file3d, this.game);
            let wordBubbleDecorator = new WordBubbleDecorator(
                file3d,
                labelDecorator
            );

            decorators.push(
                new UpdateMaxtrixDecorator(file3d),
                labelDecorator,
                wordBubbleDecorator,
                new LineToDecorator(file3d, this.simulation),
                new IFramePlaneDecorator(file3d, this.game)
            );
        }

        return decorators;
    }
}
