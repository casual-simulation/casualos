import { 
    Math as ThreeMath,
    Mesh, 
    Object3D, 
    DoubleSide,
    Color,
    TextureLoader,
    Texture,
    SceneUtils,
    Vector3,
    Box3,
    RawShaderMaterial,
    LinearFilter,
    ArrowHelper,
    Sphere,
    Ray} from "three";

import GameView from "../GameView/GameView";
import { File3D } from "./File3D";
import { FileMesh } from "./FileMesh";

export class Arrow3D {

    public static DefaultColor: Color = new Color(255,255,255);
    public static DefaultHeadWidth = 0.15;
    public static DefaultHeadLength = 0.3;

    /**
     * Three JS helper that draws arrows.
     */
    private _arrowHelper: ArrowHelper;
    
    /**
     * The file that this arrow is coming from.
     */
    private _sourceFile: File3D;

    /**
     * The file that this arrow is pointing towards.
     */
    private _targetFile: File3D;

    private _gameView: GameView;
    private _parent: Object3D;

    public get sourceFile() { return this._sourceFile; }
    public get targetFile() { return this._targetFile; }

    constructor(gameView: GameView, parent: Object3D, sourceFile: File3D, targetFile: File3D) {
        this._gameView = gameView;
        this._parent = parent;
        this._sourceFile = sourceFile;
        this._targetFile = targetFile;

        this._handleTargetUpdated = this._handleTargetUpdated.bind(this);

        this._targetFile.onUpdated.addListener(this._handleTargetUpdated);

        // Create the arrow mesh.
        var sourceSphere = (<FileMesh>this._sourceFile.mesh).boundingSphere;
        var origin = this.sourceFile.mesh.worldToLocal(sourceSphere.center);
        var dir = this._calcDirectionToTarget();
        this._arrowHelper = new ArrowHelper(dir.normalize(), origin, dir.length(), Arrow3D.DefaultColor.getHex());
        this._parent.add(this._arrowHelper);
    }

    public setColor(color?: Color) {
        if (!this._arrowHelper) return;

        if (color) {
            this._arrowHelper.setColor(color);
        } else {
            this._arrowHelper.setColor(Arrow3D.DefaultColor);
        }
    }

    public setLength(length: number) {
        if (!this._arrowHelper) return;
        this._arrowHelper.setLength(length, Arrow3D.DefaultHeadLength, Arrow3D.DefaultHeadWidth);
    }

    public update() {
        if (!this._arrowHelper) return;
        
        // Update arrow direction and length.
        var dir = this._calcDirectionToTarget();
        this._arrowHelper.setDirection(dir);
        this._arrowHelper.setLength(dir.length(), Arrow3D.DefaultHeadLength, Arrow3D.DefaultHeadWidth);
    }

    public dispose() {
        this._parent.remove(this._arrowHelper);
        this._arrowHelper = null;
        this._parent = null;

        this._targetFile.onUpdated.removeListener(this._handleTargetUpdated);

        this._sourceFile = null;
        this._targetFile = null;
    }

    private _calcDirectionToTarget(): Vector3 {

        var sourceSphere = (<FileMesh>this._sourceFile.mesh).boundingSphere;
        var targetSphere = (<FileMesh>this._targetFile.mesh).boundingSphere;
        var dir = new Vector3().copy(targetSphere.center).sub(sourceSphere.center);

        // Decrease length of direction vector so that it only goes 
        // as far as the hull of the target bounding sphere.
        dir.setLength(dir.length() - targetSphere.radius);
        
        return dir;
    }

    private _handleTargetUpdated (file: File3D): void {
        this.update();
    }
}