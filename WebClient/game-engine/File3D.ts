import {
    Math as ThreeMath,
    Mesh,
    Group,
    BoxBufferGeometry,
    MeshStandardMaterial,
    LineBasicMaterial,
    Object3D,
    TextureLoader,
    DoubleSide,
    MeshBasicMaterial,
    Color
} from "three";

import { File, Object, Workspace } from '../../common/Files'
import { Text3D } from './Text3D';

// Assets
import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import GameView from "WebClient/GameView/GameView";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { FileMesh } from "./FileMesh";
import { ArgEvent } from '../../common/Events';

/**
 * Defines an object that groups Three.js related information
 * with the object/workspace data that they represent.
 */
export class File3D {

    /**
     * The file (workspace or object) that this object represents.
     */
    public file: File;

    /**
     * The 3D mesh that represents the file.
     */
    public mesh: WorkspaceMesh | FileMesh;

    /**
     * The GameView that manages this file3d.
     */
    private _gameView: GameView;

    /**
     * Event that is fired when this file is updated.
     */
    public onUpdated: ArgEvent<File3D> = new ArgEvent<File3D>();

    /**
     * Defines an object that groups Three.js related information
     * with the object/workspace data that they represent.
     * @param gameView The game view that manages this file3d.
     * @param file The file that this file3d represents.
     */
    constructor(gameView: GameView, file: File) {
        this.file = file;
        this._gameView = gameView;

        if (file.type === 'object') {
            this.mesh = this._createFile(file);
        } else {
            this.mesh = this._createWorkSurface(file);
        }

        this.mesh.name = `${file.type}_${file.id}`;

        // Add this file3d's mesh to scene so that it and all its childre get rendered.
        this._gameView.scene.add(this.mesh);
    }


    /**
     * Update the file that this file3d represents.
     * @param file The file data that this file3d represents.
     */
    public async updateFile(file: File) {
        this.file = file;
        await this.mesh.update(this.file);
        this.onUpdated.invoke(this);
    }

    /**
     * Call dispose allow this object to clean itself up when being removed.
     */
    public dispose(): void {
        this._gameView.scene.remove(this.mesh);
    }

    private _createFile(file: File): FileMesh {
        return new FileMesh(this._gameView);
    }

    private _createWorkSurface(data: Workspace) {
        let mesh = new WorkspaceMesh();
        mesh.gridGhecker = this._gameView.gridChecker;
        return mesh;
    }
}