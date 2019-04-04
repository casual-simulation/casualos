import {
    Object3D,
    Vector3,
    Camera,
    PerspectiveCamera,
    CameraHelper,
} from "three";
import { Text3D } from "../Text3D";
import { FileCalculationContext, AuxObject } from '@yeti-cgi/aux-common'
import { setLayer, disposeMaterial } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";


/**
 * The amount of time that a user needs to be inactive for
 * in order to hide their file.
 */
export const DEFAULT_USER_INACTIVE_TIME = 1000 * 60;

/**
 * Defines a class that represents a mesh for an "user" file.
 */
export class UserMeshDecorator extends AuxFile3DDecorator {

    /**
     * The aux file 3d that this decorator is for.
     */
    file3D: AuxFile3D;

    /**
     * The object that acts as the visual representation of the file.
     */
    cameraHelper: CameraHelper;

    /**
     * The camera that this mesh is displaying.
     */
    camera: Camera;

    /**
     * The container for the meshes.
     */
    container: Object3D;

    /**
     * The label for the file.
     */
    label: Text3D;


    constructor(file3D: AuxFile3D) {
        super(file3D);

        this.container = new Object3D();
        this.camera = new PerspectiveCamera(60, 1, 0.1, 0.5);
        this.cameraHelper = new CameraHelper(this.camera);
        this.cameraHelper.updateMatrixWorld(true);

        // Setup label
        this.label = new Text3D();
        this.label.setText(this.file3D.file.tags._user);
        setLayer(this.label, LayersHelper.Layer_UIWorld);
        this.label.setScale(Text3D.defaultScale * 2);
        this.label.setWorldPosition(new Vector3(0,0,0));
        this.label.setRotation(0, 180, 0);
        this.label.position.add(new Vector3(1.55, 0.25, 0)); // This is hardcoded. To lazy to figure out that math.
        
        this.cameraHelper.add(this.label);
        
        this.container.add(this.cameraHelper);
        this.file3D.display.add(this.camera);
        this.file3D.add(this.container);
    }

    fileUpdated(calc: FileCalculationContext): void {
        this._updateCameraMatrix();
        this.cameraHelper.update();
    }

    frameUpdate(calc: FileCalculationContext) {
        let file = <AuxObject>this.file3D.file;

        // visible if not destroyed, and was active in the last minute
        this.container.visible = (!file.tags._destroyed && this._isActive());
    }

    dispose() {
        this.file3D.remove(this.container);
        this.file3D.display.remove(this.camera);

        this.cameraHelper.geometry.dispose();
        disposeMaterial(this.cameraHelper.material);

        this.camera = null;
        this.cameraHelper = null;
        this.container = null;
    }

    private _isActive(): boolean {
        const lastActiveTime = this.file3D.file.tags[`${this.file3D.context}._lastActiveTime`];
        if (lastActiveTime) {
            const milisecondsFromNow = Date.now() - lastActiveTime;
            return milisecondsFromNow < DEFAULT_USER_INACTIVE_TIME;
        } else {
            return false;
        }
    }


    private _updateCameraMatrix(): void {
        // We must call this function so that child objects get their positions updated too.
        // Three render function does this automatically but there are functions in here that depend
        // on accurate positioning of child objects.
        this.camera.updateMatrixWorld(false);
    }
}