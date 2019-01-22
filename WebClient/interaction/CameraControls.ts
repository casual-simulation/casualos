import { IOperation } from "./IOperation";
import { PerspectiveCamera, Vector3, Spherical, Vector2, Quaternion, Matrix4 } from "three";
import GameView from "../GameView/GameView";
import { InteractionManager } from "./InteractionManager";
import { InputType, MouseButtonId } from "../game-engine/input";


export class CameraControls {

    // "target" sets the location of focus, where the object orbits around
    public target: Vector3 = new Vector3();

    // How far you can dolly in and out ( PerspectiveCamera only )
    public minDistance: number = 0;
    public maxDistance: number = Infinity;

    // How far you can zoom in and out ( OrthographicCamera only )
    public minZoom: number = 0;
    public maxZoom: number = Infinity;

    // How far you can orbit vertically, upper and lower limits.
    // Range is 0 to Math.PI radians.
    public minPolarAngle: number = 0; // radians
    public maxPolarAngle: number = Math.PI; // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    public minAzimuthAngle: number = - Infinity; // radians
    public maxAzimuthAngle: number = Infinity; // radians

    // Set to true to enable damping (inertia)
    // If damping is enabled, you must call controls.update() in your animation loop
    public enableDamping: boolean = false;
    public dampingFactor: number = 0.25;

    // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
    // Set to false to disable zooming
    public enableZoom: boolean = true;
    public zoomSpeed: number = 1.0;

    // Set to false to disable rotating
    public enableRotate: boolean = true;
    public rotateSpeed: number = 1.0;

    // Set to false to disable panning
    public enablePan: boolean = true;
    public panSpeed: number = 1.0;
    public screenSpacePanning: boolean = false; // if true, pan in screen-space
    public keyPanSpeed: number = 7.0;	// pixels moved per arrow key push

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    public autoRotate: boolean = false;
    public autoRotateSpeed: number = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    public enableKeys: boolean = true;

    // for reset
    public target0: Vector3;
    public position0: Vector3;
    public zoom0: number;

    private _camera: PerspectiveCamera;
    private _gameView: GameView;
    private _enabled = true;

    private state: STATE;

    private EPS = 0.000001;

    // current position in spherical coordinates
    private spherical = new Spherical();
    private sphericalDelta = new Spherical();

    private scale = 1;
    private panOffset = new Vector3();
    private zoomChanged = false;

    private rotateStart = new Vector2();
    private rotateEnd = new Vector2();
    private rotateDelta = new Vector2();

    private panStart = new Vector2();
    private panEnd = new Vector2();
    private panDelta = new Vector2();

    private dollyStart = new Vector2();
    private dollyEnd = new Vector2();
    private dollyDelta = new Vector2();

    get enabled() {
        return this._enabled 
    }

    set enabled(value: boolean) {

        if (this._enabled !== value) {

            this._enabled = value;

            if (this._enabled) {

                this.reset();

            } else {

                this.saveState();

            }

        }
    }


    constructor(camera: PerspectiveCamera, gameView: GameView) {
        this._camera = camera;
        this._gameView = gameView;

        this.target0 = this.target.clone();
        this.position0 = this._camera.position.clone();
        this.zoom0 = this._camera.zoom;
    }

    public getPolarAngle() {
        return this.spherical.phi;
    }

    public getAzimuthalAngle() {
        return this.spherical.theta;
    }

    public getAutoRotationAngle() {
        return 2 * Math.PI / 60 / 60 * this.autoRotateSpeed;
    }

    public getZoomScale() {
        return Math.pow(0.95, this.zoomSpeed);
    }

    public rotateLeft(angle: number) {
        this.sphericalDelta.theta -= angle;
    }

    public rotateUp(angle: number) {
        this.sphericalDelta.phi -= angle;
    }

    public panLeft(distance: number, objectMatrix: Matrix4) {

        var v = new Vector3();
        v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
        v.multiplyScalar(- distance);

        this.panOffset.add(v);

    }

    public panUp(distance: number, objectMatrix: Matrix4) {

        var v = new Vector3();
        if (this.screenSpacePanning === true) {

            v.setFromMatrixColumn(objectMatrix, 1);

        } else {

            v.setFromMatrixColumn(objectMatrix, 0);
            v.crossVectors(this._camera.up, v);

        }

        v.multiplyScalar(distance);

        this.panOffset.add(v);

    }

    public pan(deltaX: number, deltaY: number) {

        var offset = new Vector3();
        var element = this._gameView.gameView;

        // perspective
        var position = this._camera.position;
        offset.copy(position).sub(this.target);
        var targetDistance = offset.length();

        // half of the fov is center to top of screen
        targetDistance *= Math.tan((this._camera.fov / 2) * Math.PI / 180.0);

        // we use only clientHeight here so aspect ratio does not distort speed
        this.panLeft(2 * deltaX * targetDistance / element.clientHeight, this._camera.matrix);
        this.panUp(2 * deltaY * targetDistance / element.clientHeight, this._camera.matrix);

    }

    public dollyIn(dollyScale: number) {
        this.scale /= dollyScale;
    }

    public dollyOut(dollyScale: number) {
        this.scale *= dollyScale;
    }

    public saveState() {

        this.target0.copy(this.target);
        this.position0.copy(this._camera.position);
        this.zoom0 = this._camera.zoom;

    }

    public reset() {

        this.target.copy(this.target0);
        this._camera.position.copy(this.position0);
        this._camera.zoom = this.zoom0;

        this._camera.updateProjectionMatrix();

        this.state = STATE.NONE;

        this.update();
    }

    public update() {

        this.updateInput();
        this.updateCamera();

    }

    public dispose() {

    }

    private updateInput() {

        const input = this._gameView.input;

        if (input.currentInputType === InputType.Mouse) {

            //
            // Pan/Dolly/Rotate [Start]
            //
            if (input.getMouseButtonDown(MouseButtonId.Left) && this.enablePan && this.enabled) {

                // Pan start.
                this.panStart.copy(input.getMouseClientPos());
                this.state = STATE.PAN;

            } else if (input.getMouseButtonDown(MouseButtonId.Middle) && this.enableZoom && this.enabled) {

                // Dolly start.
                this.dollyStart.copy(input.getMouseClientPos());
                this.state = STATE.DOLLY;

            } else if (input.getMouseButtonDown(MouseButtonId.Right) && this.enableRotate && this.enabled) {

                // Rotate start.
                this.rotateStart.copy(input.getMouseClientPos());
                this.state = STATE.ROTATE;

            }

            //
            // Pan/Dolly/Rotate [Move]
            //
            if (input.getMouseButtonHeld(MouseButtonId.Left) && this.enablePan && this.enabled) {

                // Pan move.
                this.panEnd.copy(input.getMouseClientPos());
                this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
                this.pan(this.panDelta.x, this.panDelta.y);
                this.panStart.copy(this.panEnd);

            } else if (input.getMouseButtonHeld(MouseButtonId.Middle) && this.enableZoom && this.enabled) {

                // Dolly move.
                this.dollyEnd.copy(input.getMouseClientPos());
                this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);

                if (this.dollyDelta.y > 0) this.dollyIn(this.getZoomScale());
                else if (this.dollyDelta.y < 0) this.dollyOut(this.getZoomScale());

                this.dollyStart.copy(this.dollyEnd);

            } else if (input.getMouseButtonHeld(MouseButtonId.Right) && this.enableRotate && this.enabled) {

                // Rotate move.
                this.rotateEnd.copy(input.getMouseClientPos());
                this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
                this.rotateLeft(2 * Math.PI * this.rotateDelta.x / this._gameView.gameView.clientHeight); // yes, height.
                // this.rotateUp(2 * Math.PI * this.rotateDelta.y / this._gameView.gameView.clientHeight);
                this.rotateStart.copy(this.rotateEnd);

            }

            //
            // Pan/Dolly/Rotate [End]
            //
            if (input.getMouseButtonUp(MouseButtonId.Left) ||
                input.getMouseButtonUp(MouseButtonId.Middle) ||
                input.getMouseButtonUp(MouseButtonId.Right)) {

                this.state = STATE.NONE;

            }


        } else if (input.currentInputType === InputType.Touch) {


        }
    }

    private updateCamera() {

        var offset = new Vector3();

        // so camera.up is the orbit axis
        var quat = new Quaternion().setFromUnitVectors(this._camera.up, new Vector3(0, 1, 0));
        var quatInverse = quat.clone().inverse();

        var lastPosition = new Vector3();
        var lastQuaternion = new Quaternion();
        var position = this._camera.position;

        offset.copy(position).sub(this.target);

        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion(quat);

        // angle from z-axis around y-axis
        this.spherical.setFromVector3(offset);

        if (this.autoRotate && this.state === STATE.NONE) {

            this.rotateLeft(this.getAutoRotationAngle());

        }

        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;

        // restrict theta to be between desired limits
        this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));

        // restrict phi to be between desired limits
        this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));

        this.spherical.makeSafe();


        this.spherical.radius *= this.scale;

        // restrict radius to be between desired limits
        this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

        // move target to panned location
        this.target.add(this.panOffset);

        offset.setFromSpherical(this.spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion(quatInverse);

        position.copy(this.target).add(offset);

        this._camera.lookAt(this.target);

        if (this.enableDamping === true) {

            this.sphericalDelta.theta *= (1 - this.dampingFactor);
            this.sphericalDelta.phi *= (1 - this.dampingFactor);
            this.panOffset.multiplyScalar(1 - this.dampingFactor);

        } else {

            this.sphericalDelta.set(0, 0, 0);
            this.panOffset.set(0, 0, 0);

        }

        this.scale = 1;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (this.zoomChanged ||
            lastPosition.distanceToSquared(this._camera.position) > this.EPS ||
            8 * (1 - lastQuaternion.dot(this._camera.quaternion)) > this.EPS) {

            // this.dispatchEvent( this.changeEvent );

            lastPosition.copy(this._camera.position);
            lastQuaternion.copy(this._camera.quaternion);
            this.zoomChanged = false;
        }

    }
}


enum STATE {
    NONE = -1,
    ROTATE = 0,
    DOLLY = 1,
    PAN = 2,
    TOUCH_ROTATE = 3,
    TOUCH_DOLLY_PAN = 4
}