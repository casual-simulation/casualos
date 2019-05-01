import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { IGameView } from '../../../shared/IGameView';
import { File, file, hasValue } from '@casual-simulation/aux-common';
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
import { OutlineDecorator } from './OutlineDecorator';
import { TextureDecorator } from './TextureDecorator';

export class AuxFile3DDecoratorFactory {
    public gameView: IGameView;

    constructor(gameView?: IGameView) {
        this.gameView = gameView;
    }

    loadDecorators(file3d: AuxFile3D): AuxFile3DDecorator[] {
        let decorators: AuxFile3DDecorator[] = [];
        const isUser = !!file3d.file && hasValue(file3d.file.tags['aux._user']);
        const isLocalUser = isUser && file3d.file.id === appManager.user.id;

        if (isUser) {
            if (isLocalUser) {
                // Local user gets controls for changing their user position in contexts.
                decorators.push(
                    new UserControlsDecorator(file3d, this.gameView)
                );
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

            let progressBarDecorator = new ProgressBarDecorator(file3d);

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

        if (!!this.gameView) {
            let labelDecorator = new LabelDecorator(file3d, this.gameView);
            let wordBubbleDecorator = new WordBubbleDecorator(
                file3d,
                labelDecorator
            );

            decorators.push(
                labelDecorator,
                wordBubbleDecorator,
                new LineToDecorator(file3d, this.gameView)
            );
        }

        return decorators;
    }
}
