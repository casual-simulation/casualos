import { Object3D, Mesh, BoxBufferGeometry, MeshStandardMaterial, Color } from "three";
import { Object } from 'common/Files';
import GameView from "WebClient/GameView/GameView";

export class FileMesh extends Object3D {

    private _gameView: GameView;

    file: Object;
    cube: Mesh;

    constructor(gameView: GameView) {
        super();
        this._gameView = gameView;
    }

    private _createCube(size: number): Mesh {
        var geometry = new BoxBufferGeometry(size, size, size);
        var material = new MeshStandardMaterial({
            color: 0x00ff00,
            metalness: .1,
            roughness: 0.6
        });
        const cube = new Mesh(geometry, material);
        cube.castShadow = true;
        cube.receiveShadow = false;
        return cube;
    }

    update(file: Object) {
        if (!this.file) {
            this.cube = this._createCube(0.2);
            this.add(this.cube);
        }
        this.file = file;

        // visible if not destroyed, has a position, and not hidden
        this.visible = (!file.tags._destroyed && !!file.tags._position && !file.tags._hidden);
        const workspace = this._gameView.getFile(file.tags._workspace);
        if (workspace) {
            this.parent = workspace.mesh;
        } else {
            this.parent = null;
        }

        if (file.tags.color) {
            const mesh = <Mesh>this.cube;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = this._getColor(file.tags.color);
        } else {
            const mesh = <Mesh>this.cube;
            const material = <MeshStandardMaterial>mesh.material;
            material.color = new Color(0x00FF00);
        }

        if (file.tags._position) {
            this.position.set(
                file.tags._position.x + 0,
                file.tags._position.y + 0.095,
                file.tags._position.z + 0);
        } else {
            // Default position
            this.position.set(0, 1, 0);
        }
    }

    private _getColor(color: string): Color {
        return new Color(color);
    }
}