import { File, Object, Workspace } from '@yeti-cgi/aux-common'
import { ArgEvent } from '@yeti-cgi/aux-common/Events';

// Assets
import GameView from "../aux-projector/GameView/GameView";
import { WorkspaceMesh } from "./WorkspaceMesh";
import { FileMesh } from "./FileMesh";
import { UserMesh } from "./UserMesh";

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
    public mesh: WorkspaceMesh | FileMesh | UserMesh;

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
     * Updates the file and does anything that needs to be run on a per-frame basis.
     */
    public frameUpdate() {
        this.mesh.frameUpdate();
    }

    /**
     * Call dispose allow this object to clean itself up when being removed.
     */
    public dispose(): void {
        this.mesh.dispose();
        this.mesh.parent.remove(this.mesh);
    }

    private _createFile(file: Object): FileMesh | UserMesh {
        if (file.tags._user) {
            return new UserMesh(this._gameView);
        } else {
            return new FileMesh(this._gameView);
        }
    }

    private _createWorkSurface(data: Workspace) {
        let mesh = new WorkspaceMesh();
        mesh.gridGhecker = this._gameView.gridChecker;
        return mesh;
    }
}