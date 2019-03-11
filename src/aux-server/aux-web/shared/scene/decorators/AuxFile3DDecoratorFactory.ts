import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { IGameView } from "aux-web/shared/IGameView";
import { File } from "@yeti-cgi/aux-common";
import { ScaleDecorator } from "./ScaleDecorator";
import { ContextPositionDecorator } from "./ContextPositionDecorator";
import { MeshCubeDecorator } from "./MeshCubeDecorator";
import { LabelDecorator } from "./LabelDecorator";
import { UserMeshDecorator } from "./UserMeshDecorator";
import { AuxFile3D } from "../AuxFile3D";

export class AuxFile3DDecoratorFactory { 

    public gameView: IGameView;

    constructor(gameView?: IGameView) {
        this.gameView = gameView;
    }

    loadDecorators(file3d: AuxFile3D): AuxFile3DDecorator[] {
        let decorators: AuxFile3DDecorator[] = [];

        decorators.push(
            new ScaleDecorator(),
            new ContextPositionDecorator(),
            new LabelDecorator(file3d)
        );

        let regex = /^_user/;
        let isUser = regex.test(file3d.context);
        
        if (isUser) {
            if (!!file3d.file && !!this.gameView) {
                decorators.push(new UserMeshDecorator(this.gameView.mainCamera));
            }
        } else {
            decorators.push(new MeshCubeDecorator());
        }

        
        return decorators;
    }
}