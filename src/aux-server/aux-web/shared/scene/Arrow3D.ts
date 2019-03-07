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
    Ray,
    Vector2
} from 'three';

import { Object, Workspace } from '@yeti-cgi/aux-common';
import { FileMesh } from './FileMesh';
import { WorkspaceMesh } from './WorkspaceMesh';
import { IGameView } from '../IGameView';
import { AuxFile3D } from './AuxFile3D';
import { ContextGroup3D } from './ContextGroup3D';

export class Arrow3D {

    public static DefaultColor: Color = new Color(1, 1, 1);
    public static DefaultHeadWidth = 0.15;
    public static DefaultHeadLength = 0.3;

    /**
     * Three JS helper that draws arrows.
     */
    private _arrowHelper: ArrowHelper;
    
    /**
     * The file that this arrow is coming from.
     */
    private _sourceFile3d: AuxFile3D;

    /**
     * The file that this arrow is pointing towards.
     */
    private _targetFile3d: AuxFile3D;

    private _gameView: IGameView;

    public get sourceFile3d() { return this._sourceFile3d; }
    public get targetFile3d() { return this._targetFile3d; }

    constructor(gameView: IGameView, sourceFile3d: AuxFile3D, targetFile3d: AuxFile3D) {
        this._gameView = gameView;
        this._sourceFile3d = sourceFile3d;
        this._targetFile3d = targetFile3d;

        // Create the arrow mesh.
        this._arrowHelper = new ArrowHelper(new Vector3(0,0,0), new Vector3(0,0,0), 0, Arrow3D.DefaultColor.getHex());
        this._gameView.scene.add(this._arrowHelper);
        this.update();
    }

    /**
     * Set the origin of the arrow.
     */
    public setOrigin(origin: Vector3, isWorldspace?: boolean) {
        if (isWorldspace) {
            this._arrowHelper.position.copy(this._gameView.scene.worldToLocal(origin.clone()));
        } else {
            this._arrowHelper.position.copy(origin);
        }
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
        
        let sourceFile = <Object>this._sourceFile3d.file;
        let targetFile = <Object>this._targetFile3d.file;
        
        let sourceWorkspace = this._getWorkspace(sourceFile);
        let targetWorkspace = this._getWorkspace(targetFile);

        if (sourceFile.tags._hidden || targetFile.tags._hidden) {

            // Hide arrow if source file or target file is not visible, and do nothing else.
            this._arrowHelper.visible = false;

        }
        else if (sourceWorkspace.file.tags.minimized && targetWorkspace && targetWorkspace.file.tags.minimized) {

            // The workspace of both the source file and target file are minimized. Hide arrow and do nothing else.
            this._arrowHelper.visible = false;

        } else {
        
            this._arrowHelper.visible = true;
    
            // Update arrow origin.
            if (sourceWorkspace.file.tags.minimized) {
                let miniHexSphere = (sourceWorkspace.surface).miniHex.boundingSphere;
                this.setOrigin(miniHexSphere.center, true);
            } else {
                let sourceSphere = (this._sourceFile3d).boundingSphere;
                this.setOrigin(sourceSphere.center, true);
            }
            
            // Update arrow direction and length.
            let targetSphere: Sphere;
    
            // Lets get the bounding sphere of the target.
            // This could be either the sphere of the file itself or the sphere of the minimized workspace the file is on.
            if (targetWorkspace && targetWorkspace.file.tags.minimized) {
                targetSphere = (targetWorkspace.surface).miniHex.boundingSphere;
            } else {
                targetSphere = (this._targetFile3d).boundingSphere;
            }
        
            let targetCenterLocal = this._gameView.scene.worldToLocal(targetSphere.center.clone());
            let dir = targetCenterLocal.clone().sub(this._arrowHelper.position);
    
            // Decrease length of direction vector so that it only goes 
            // as far as the hull of the target bounding sphere.
            dir.setLength(dir.length() - targetSphere.radius);
            
            let length = dir.length();
            this._arrowHelper.setDirection(dir.normalize());
            this._arrowHelper.setLength(length, Arrow3D.DefaultHeadLength, Arrow3D.DefaultHeadWidth);

        }
    }

    public dispose() {
        this._gameView.scene.remove(this._arrowHelper);
        this._arrowHelper = null;

        this._sourceFile3d = null;
        this._targetFile3d = null;
    }

    private _getWorkspace (file: Object): ContextGroup3D { 

        // TODO: Fix
        return null;
        // let workspace3d = this._gameView.getFile(file.tags._workspace);

        // let workspaceFile: Workspace = undefined;
        // if (workspace3d) {
        //     workspaceFile =  <Workspace>workspace3d.file;
        // }

        // return {
        //     workspace3d: workspace3d,
        //     workspaceFile:  workspaceFile
        // }
    }
}