import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { IGameView } from "../../../shared/IGameView";
import { File, file } from "@yeti-cgi/aux-common";
import { ScaleDecorator } from "./ScaleDecorator";
import { ContextPositionDecorator } from "./ContextPositionDecorator";
import { MeshCubeDecorator } from "./MeshCubeDecorator";
import { LabelDecorator } from "./LabelDecorator";
import { UserMeshDecorator } from "./UserMeshDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { LineToDecorator } from "./LineToDecorator";
import { WordBubbleDecorator } from "./WordBubbleDecorator";

export class AuxFile3DDecoratorFactory { 

    public gameView: IGameView;

    constructor(gameView?: IGameView) {
        this.gameView = gameView;
    }

    loadDecorators(file3d: AuxFile3D): AuxFile3DDecorator[] {
        let decorators: AuxFile3DDecorator[] = [];

        let regex = /^_user/;
        let isUser = regex.test(file3d.context);
        
        if (isUser) {
            if (!!file3d.file && !!this.gameView) {
                decorators.push(
                    new UserMeshDecorator(file3d, this.gameView.mainCamera)
                );
            }
        } else {
            decorators.push(
                new MeshCubeDecorator(file3d)
            );
        }

        decorators.push(
            new ScaleDecorator(file3d),
            new ContextPositionDecorator(file3d)
        );

        if (!!this.gameView) {

            let labelDecorator = new LabelDecorator(file3d, this.gameView.mainCamera); 
            let wordBubbleDecorator = new WordBubbleDecorator(file3d, labelDecorator);

            decorators.push(
                labelDecorator,
                wordBubbleDecorator,
                new LineToDecorator(file3d, this.gameView)
            );
        }

        return decorators;
    }
}