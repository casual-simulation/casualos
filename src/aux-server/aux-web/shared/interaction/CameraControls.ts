import {
    PerspectiveCamera,
    Vector3,
    Spherical,
    Vector2,
    Quaternion,
    Matrix4,
    MathUtils as ThreeMath,
    OrthographicCamera,
    Plane,
    Camera,
    Color,
    Euler,
    Matrix3,
} from '@casual-simulation/three';
import { InputType, MouseButtonId, Input } from '../../shared/scene/Input';
import { lerp } from '@casual-simulation/aux-common';
import { Viewport } from '../scene/Viewport';
import { Game } from '../scene/Game';
import {
    cameraForwardRay,
    objectForwardRay,
    objectWorldDirectionRay,
    objectWorldForwardRay,
} from '../scene/SceneUtils';
import { Physics } from '../scene/Physics';

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
    public minPolarAngle: number = ThreeMath.degToRad(0); // radians
    public maxPolarAngle: number = ThreeMath.degToRad(90 - 32); // radians

    // How far you can orbit horizontally, upper and lower limits.
    // If set, must be a sub-interval of the interval [ - Math.PI, Math.PI ].
    public minAzimuthAngle: number = -Infinity; // radians
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

    // How far you can pan left and right
    public minPanX: number = null;
    public maxPanX: number = null;

    // How far you can pan up and down
    public minPanY: number = null;
    public maxPanY: number = null;

    // Set to true to automatically rotate around the target
    // If auto-rotate is enabled, you must call controls.update() in your animation loop
    public autoRotate: boolean = false;
    public autoRotateSpeed: number = 2.0; // 30 seconds per round when fps is 60

    // Set to false to disable use of the keys
    public enableKeys: boolean = true;

    public zoomOffset: number = 0;

    // for reset
    public target0: Vector3;
    public position0: Vector3;
    public zoom0: number;

    // Offset to apply to the camera this frame.
    // Automatically reset once it has been applied to the camera.
    public cameraFrameOffset: Vector3 = new Vector3();

    // The viewport we are applying control inside of for this camera.
    public viewport: Viewport;

    /**
     * Wether or not these controls update while in AR mode.
     */
    public updateInARMode: boolean;

    private _camera: PerspectiveCamera | OrthographicCamera;
    private _game: Game;
    private _enabled = true;

    private state: STATE;

    private EPS = 0.000001;

    // current position in spherical coordinates
    private spherical = new Spherical();
    private sphericalDelta = new Spherical();

    private scale = 1;
    private panOffset = new Vector3();
    private zoomChanged = false;

    private mouseRotateStart = new Vector2();
    private mouseRotateEnd = new Vector2();
    private mouseRotateDelta = new Vector2();

    private _setRot: boolean = false;
    setRotValues: Vector2;
    tweenNum = 1;

    private touchRotateStart: TouchRotate = {
        finger0: new Vector2(),
        finger1: new Vector2(),
    };

    // The midpoint between the two fingers when the rotate gesture
    // is started.
    private originMidpoint: Vector3;

    private touchRotateEnd: TouchRotate = {
        finger0: new Vector2(),
        finger1: new Vector2(),
    };

    private touchRotateDelta: TouchRotate = {
        finger0: new Vector2(),
        finger1: new Vector2(),
    };

    private panStart = new Vector2();
    private panEnd = new Vector2();
    private panDelta = new Vector2();

    private dollyStart = new Vector2();
    private dollyEnd = new Vector2();
    private dollyDelta = new Vector2();
    private dollyBegin = new Vector2();

    private sphereRadiusSetter: number = 10;
    private zoomSetValue: number = 10;
    private zoomSetValueOrtho: number = 10;
    private zooming: boolean = false;
    private groundPlane = new Plane(new Vector3(0, 1, 0));

    currentDistX: number = 0;
    currentDistY: number = 0;

    get enabled() {
        return this._enabled;
    }

    set enabled(value: boolean) {
        if (this._enabled !== value) {
            this._enabled = value;
        }
    }

    get panValue() {
        return this.panOffset;
    }

    get currentZoom() {
        if (this._camera instanceof PerspectiveCamera) {
            return this.scale;
        } else {
            return this._camera.zoom;
        }
    }

    constructor(
        camera: PerspectiveCamera | OrthographicCamera,
        game: Game,
        viewport: Viewport
    ) {
        this._camera = camera;
        this._game = game;

        if (!!viewport) {
            this.viewport = viewport;
        }

        this.state = STATE.NONE;
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
        return ((2 * Math.PI) / 60 / 60) * this.autoRotateSpeed;
    }

    public getZoomScale() {
        return Math.pow(0.95, this.zoomSpeed);
    }

    public isEmptyState(): Boolean {
        return this.state === STATE.NONE;
    }

    public rotateLeft(angle: number) {
        this.sphericalDelta.theta -= angle;
    }

    public rotateUp(angle: number) {
        this.sphericalDelta.phi -= angle;
    }

    public panLeft(distance: number, objectMatrix: Matrix4) {
        let initialDist = distance;

        if (
            this.minPanX != null &&
            initialDist < 0 &&
            this.currentDistX + initialDist < this.minPanX
        ) {
            if (this.minPanX < this.currentDistX) {
                distance = this.minPanX - this.currentDistX;
            } else {
                return;
            }
        }

        if (
            this.maxPanX != null &&
            initialDist > 0 &&
            this.currentDistX + initialDist > this.maxPanX
        ) {
            if (this.maxPanX > this.currentDistX) {
                distance = this.maxPanX - this.currentDistX;
            } else {
                return;
            }
        }

        // Get X axis direction for the object
        let xDirection = new Vector3();
        xDirection.setFromMatrixColumn(objectMatrix, 0);
        xDirection.multiplyScalar(-distance);

        const delta = calculatePlaneDelta(
            this._camera,
            this.groundPlane,
            xDirection
        );

        this.currentDistX += distance;

        this.panOffset.add(delta);
    }

    public panUp(distance: number, objectMatrix: Matrix4) {
        let initialDist = distance;

        if (
            this.minPanY != null &&
            initialDist > 0 &&
            this.currentDistY + initialDist > this.minPanY
        ) {
            if (this.minPanX > this.currentDistY) {
                distance = this.minPanY - this.currentDistY;
            } else {
                return;
            }
        }

        if (
            this.maxPanY != null &&
            initialDist < 0 &&
            this.currentDistY + initialDist < this.maxPanY
        ) {
            if (this.maxPanY < this.currentDistY) {
                distance = this.maxPanY - this.currentDistY;
            } else {
                return;
            }
        }

        // Get Y axis direction for the object
        let yDirection = new Vector3();
        if (this.screenSpacePanning === true) {
            yDirection.setFromMatrixColumn(objectMatrix, 1);
        } else {
            yDirection.setFromMatrixColumn(objectMatrix, 0);
            yDirection.crossVectors(this._camera.up, yDirection);
        }

        yDirection.multiplyScalar(distance);

        const delta = calculatePlaneDelta(
            this._camera,
            this.groundPlane,
            yDirection
        );

        this.currentDistY += distance;

        this.panOffset.add(delta);
    }

    public pan(deltaX: number, deltaY: number) {
        let offset = new Vector3();

        if (this._camera instanceof PerspectiveCamera) {
            // perspective
            let position = this._camera.position;
            offset.copy(position).sub(this.target);
            let targetDistance = offset.length();

            // half of the fov is center to top of screen
            targetDistance *= Math.tan(
                ((this._camera.fov / 2) * Math.PI) / 180.0
            );

            const element = this._game.gameView.gameView;

            // we use only clientHeight here so aspect ratio does not distort speed
            this.panLeft(
                (2 * deltaX * targetDistance) / element.clientHeight,
                this._camera.matrix
            );
            this.panUp(
                (2 * deltaY * targetDistance) / element.clientHeight,
                this._camera.matrix
            );
        } else {
            this.panLeft(
                (deltaX * (this._camera.right - this._camera.left)) /
                    this._camera.zoom /
                    this.viewport.width,
                this._camera.matrix
            );
            this.panUp(
                (deltaY * (this._camera.top - this._camera.bottom)) /
                    this._camera.zoom /
                    this.viewport.height,
                this._camera.matrix
            );
        }
    }

    public setPan(deltaY: number) {
        if (this._camera instanceof PerspectiveCamera) return;

        const distance: number =
            (deltaY * (this._camera.top - this._camera.bottom)) /
            this._camera.zoom /
            this.viewport.height;

        if (isNaN(distance)) {
            return;
        }

        let v = new Vector3();
        if (this.screenSpacePanning === true) {
            v.setFromMatrixColumn(this._camera.matrix, 1);
        } else {
            v.setFromMatrixColumn(this._camera.matrix, 0);
            v.crossVectors(this._camera.up, v);
        }

        v.multiplyScalar(distance);

        this.target.add(v);
        this.panOffset.set(0, 0, 0);
    }

    public clampZoom(zoom: number): number {
        if (this.viewport.name != 'inventory') {
            return Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
        } else {
            return Math.max(0.01, Math.min(191, zoom));
        }
    }

    public dollyIn(dollyScale: number, pan: boolean = true) {
        if (this._camera instanceof PerspectiveCamera) {
            this.scale /= dollyScale;
        } else {
            const currentZoom = this._camera.zoom;
            this._camera.zoom = this.clampZoom(this._camera.zoom * dollyScale);

            if (pan) {
                this._dollyPan(currentZoom);
            }

            this._camera.updateProjectionMatrix();
            this.zoomChanged = true;
        }
    }

    public dollyInAmount(dollyAmount: number, pan: boolean = true) {
        if (this._camera instanceof PerspectiveCamera) {
            // targetScale = scale * dollyScale;
            // tagetScale = scale + offset;
            // scale * dollyScale = scale + offset
            // dollyScale = (1 + offset/scale)
            return this.dollyIn(1 + dollyAmount / this.scale, pan);
        } else {
            // targetScale = scale * dollyScale;
            // tagetScale = scale + offset;
            // scale * dollyScale = scale + offset
            // dollyScale = (1 + offset/scale)
            return this.dollyIn(1 + dollyAmount / this._camera.zoom, pan);
        }
    }

    public dollyOutAmount(dollyAmount: number, pan: boolean = true) {
        if (this._camera instanceof PerspectiveCamera) {
            // targetScale = scale / dollyScale;
            // tagetScale = scale + offset;
            // (scale / dollyScale) = scale + offset
            // 1/dollyScale = scale/scale + offset/scale
            // dollyScale = 1 / (1 + offset/scale)
            return this.dollyOut(1 / (1 + dollyAmount / this.scale), pan);
        } else {
            // targetScale = scale / dollyScale;
            // tagetScale = scale + offset;
            // (scale / dollyScale) = scale + offset
            // 1/dollyScale = scale/scale + offset/scale
            // dollyScale = 1 / (1 + offset/scale)
            return this.dollyOut(
                1 / (1 + dollyAmount / this._camera.zoom),
                pan
            );
        }
    }

    public dollySet(dollyScale: number, instant?: boolean) {
        if (this._camera instanceof PerspectiveCamera) {
            if (dollyScale < 1) dollyScale = 1;
            this.zoomSetValue = 80 / dollyScale;
            if (instant) {
                this.tweenNum = 0.99;
            } else {
                this.tweenNum = 0;
            }
            this.zooming = true;
        } else {
            this.zoomSetValueOrtho = Math.max(
                this.minZoom,
                Math.min(this.maxZoom, dollyScale)
            );
            if (instant) {
                this.tweenNum = 0.99;
            } else {
                this.tweenNum = 0;
            }
            this.zooming = true;
        }
    }

    public dollyOut(dollyScale: number, pan: boolean = true) {
        if (this._camera instanceof PerspectiveCamera) {
            this.scale *= dollyScale;
        } else {
            const currentZoom = this._camera.zoom;
            this._camera.zoom = this.clampZoom(this._camera.zoom / dollyScale);

            if (pan) {
                this._dollyPan(currentZoom);
            }

            this._camera.updateProjectionMatrix();
            this.zoomChanged = true;
        }
    }

    private _dollyPan(currentZoom: number) {
        const element = this._game.gameView.gameView;
        const centerX = element.clientWidth / 2;
        const centerY = element.clientHeight / 2;
        const offsetX = this.dollyBegin.x - centerX;
        const offsetY = this.dollyBegin.y - centerY;
        const currentX = offsetX * currentZoom;
        const currentY = offsetY * currentZoom;
        const nextX = offsetX * this._camera.zoom;
        const nextY = offsetY * this._camera.zoom;

        const deltaX = currentX - nextX;
        const deltaY = currentY - nextY;

        const normalizedDeltaX = deltaX / currentZoom;
        const normalizedDeltaY = deltaY / currentZoom;

        this.pan(normalizedDeltaX, normalizedDeltaY);
    }

    public saveCameraState() {
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
        this.updateStates();
        if (!this._enabled) return;
        if (this._game.xrSession && !this.updateInARMode) return;
        this.updateInput();
        this.updateCamera();
    }

    public dispose() {}

    private updateStates() {
        const input = this._game.getInput();

        if (this.viewport && this.state === STATE.NONE) {
            // Check to make sure we are over the viewport before allowing input to begin.
            if (!input.isMouseOnViewport(this.viewport)) {
                return;
            }
        }

        if (this.isOverViewport(input)) {
            if (input.currentInputType === InputType.Mouse) {
                this.updateMouseState(input);
            } else if (input.currentInputType === InputType.Touch) {
                this.updateTouchState(input);
            }
        }
    }

    private isOverViewport(input: Input) {
        return input.isMouseButtonDownOnElement(this._game.gameView.gameView);
    }

    private updateInput() {
        const input = this._game.getInput();

        if (this.viewport && this.state === STATE.NONE) {
            // Check to make sure we are over the viewport before allowing input to begin.
            if (!input.isMouseOnViewport(this.viewport)) {
                return;
            }
        }

        if (this.isOverViewport(input)) {
            if (input.currentInputType === InputType.Mouse) {
                this.updateMouseMovement(input);
            } else if (input.currentInputType === InputType.Touch) {
                this.updateTouchMovement(input);
            }
        }
    }

    private updateTouchMovement(input: Input) {
        //
        // Pan/Dolly/Rotate [Move]
        //
        if (input.getTouchCount() === 1) {
            if (
                input.getTouchHeld(0) &&
                this.enablePan &&
                this.state === STATE.PAN
            ) {
                // Pan move.
                this.panEnd.copy(input.getTouchClientPos(0));
                this.panDelta
                    .subVectors(this.panEnd, this.panStart)
                    .multiplyScalar(this.panSpeed);
                this.pan(this.panDelta.x, this.panDelta.y);
                this.panStart.copy(this.panEnd);
            }
        } else if (input.getTouchCount() === 2) {
            if (this.enableZoom && this.state === STATE.TOUCH_ROTATE_ZOOM) {
                // Dolly move.
                const pagePosA = input.getTouchPagePos(0);
                const pagePosB = input.getTouchPagePos(1);
                const distance = pagePosA.distanceTo(pagePosB);
                this.dollyEnd.set(0, distance);
                this.dollyDelta.set(
                    0,
                    Math.pow(
                        this.dollyEnd.y / this.dollyStart.y,
                        this.zoomSpeed
                    )
                );
                this.dollyIn(this.dollyDelta.y);
                this.dollyStart.copy(this.dollyEnd);
            }
            if (this.enableRotate && this.state === STATE.TOUCH_ROTATE_ZOOM) {
                // Rotate move.
                this.touchRotateEnd.finger0 = input.getTouchPagePos(0);
                this.touchRotateEnd.finger1 = input.getTouchPagePos(1);
                // Rotate X (two finger lazy susan turning).
                let startDir = new Vector2()
                    .subVectors(
                        this.touchRotateStart.finger0,
                        this.touchRotateStart.finger1
                    )
                    .normalize();
                let endDir = new Vector2()
                    .subVectors(
                        this.touchRotateEnd.finger0,
                        this.touchRotateEnd.finger1
                    )
                    .normalize();
                let xAngle =
                    startDir.dot(endDir) /
                    Math.sqrt(startDir.lengthSq() * endDir.lengthSq());
                xAngle *= this.rotateSpeed;
                xAngle = Math.acos(ThreeMath.clamp(xAngle, -1, 1));
                let cross = startDir.x * endDir.y - startDir.y * endDir.x;
                if (cross >= 0) xAngle = -xAngle;
                this.rotateLeft(xAngle);

                // Rotate Y (vertical delta of midpoint between fingers).
                let startMidpoint = new Vector2(
                    (this.touchRotateStart.finger0.x +
                        this.touchRotateStart.finger1.x) /
                        2,
                    (this.touchRotateStart.finger0.y +
                        this.touchRotateStart.finger1.y) /
                        2
                );
                let endMidpoint = new Vector2(
                    (this.touchRotateEnd.finger0.x +
                        this.touchRotateEnd.finger1.x) /
                        2,
                    (this.touchRotateEnd.finger0.y +
                        this.touchRotateEnd.finger1.y) /
                        2
                );
                let midpointDelta = new Vector2()
                    .subVectors(endMidpoint, startMidpoint)
                    .multiplyScalar(this.rotateSpeed);

                let yAngle =
                    (2 * Math.PI * midpointDelta.y) /
                    this._game.gameView.gameView.clientHeight;
                this.rotateUp(yAngle);
                // Set rotate start positions to the current end positions for the next frame.
                this.touchRotateStart.finger0.copy(this.touchRotateEnd.finger0);
                this.touchRotateStart.finger1.copy(this.touchRotateEnd.finger1);
            }
        }
    }

    private updateTouchState(input: Input) {
        //
        // Pan/Dolly/Rotate [Start]
        //
        if (input.getTouchCount() === 1) {
            if (input.getTouchDown(0) && this.enablePan) {
                this.zooming = false;
                this._setRot = false;
                // Pan start.
                this.panStart.copy(input.getTouchClientPos(0));
                this.state = STATE.PAN;
            }
        } else if (input.getTouchCount() === 2) {
            if (input.getTouchDown(1)) {
                this.zooming = false;
                this._setRot = false;
                if (this.enableZoom) {
                    // Dolly start.
                    const pagePosA = input.getTouchPagePos(0);
                    const pagePosB = input.getTouchPagePos(1);
                    const distance = pagePosA.distanceTo(pagePosB);
                    this.dollyStart.set(0, distance);
                    this.dollyBegin.set(
                        (pagePosA.x + pagePosB.x) / 2,
                        (pagePosA.y + pagePosB.y) / 2
                    );
                    this.dollyBegin = Input.offsetPosition(
                        this.dollyBegin,
                        this._game.gameView.gameView
                    );
                    this.state = STATE.TOUCH_ROTATE_ZOOM;
                }
                if (this.enableRotate) {
                    // Rotate start.
                    this.touchRotateStart.finger0 = input.getTouchPagePos(0);
                    this.touchRotateStart.finger1 = input.getTouchPagePos(1);

                    const finger0 = input.getTouchScreenPos(0);
                    const finger1 = input.getTouchScreenPos(1);

                    const originFinger0Ray = Physics.rayAtScreenPos(
                        finger0,
                        this._camera
                    );
                    const originFinger1Ray = Physics.rayAtScreenPos(
                        finger1,
                        this._camera
                    );
                    const originFinger0Point = Physics.pointOnPlane(
                        originFinger0Ray,
                        new Plane(new Vector3(0, 1, 0))
                    );
                    const originFinger1Point = Physics.pointOnPlane(
                        originFinger1Ray,
                        new Plane(new Vector3(0, 1, 0))
                    );

                    this.originMidpoint = new Vector3(
                        (originFinger0Point.x + originFinger1Point.x) / 2,
                        (originFinger0Point.y + originFinger1Point.y) / 2,
                        (originFinger0Point.z + originFinger1Point.z) / 2
                    );

                    this.state = STATE.TOUCH_ROTATE_ZOOM;
                }
            } else if (input.getTouchUp(0) || input.getTouchUp(1)) {
                this.zooming = false;
                this._setRot = false;
                // Releasing one of the two fingers.
                // Get ready to starting panning with the currently pressed finger.
                let panFingerIndex = input.getTouchUp(0) ? 1 : 0;
                this.panStart.copy(input.getTouchClientPos(panFingerIndex));
                this.state = STATE.PAN;
            }
        }

        //
        // Pan/Dolly/Rotate [End]
        //
        if (input.getTouchCount() === 0) {
            this.state = STATE.NONE;
        }
    }

    private updateMouseMovement(input: Input) {
        //
        // Pan/Dolly/Rotate [Move]
        //
        if (
            input.getMouseButtonHeld(MouseButtonId.Left) &&
            this.enablePan &&
            this.state === STATE.PAN
        ) {
            // Pan move.
            this.panEnd.copy(input.getMouseClientPos());
            this.panDelta
                .subVectors(this.panEnd, this.panStart)
                .multiplyScalar(this.panSpeed);
            this.pan(this.panDelta.x, this.panDelta.y);
            this.panStart.copy(this.panEnd);
        } else if (
            input.getMouseButtonHeld(MouseButtonId.Middle) &&
            this.enableZoom &&
            this.state === STATE.DOLLY
        ) {
            // Dolly move.
            this.dollyEnd.copy(input.getMouseClientPos());
            this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
            if (this.dollyDelta.y > 0) this.dollyIn(this.getZoomScale());
            else if (this.dollyDelta.y < 0) this.dollyOut(this.getZoomScale());
            this.dollyStart.copy(this.dollyEnd);
        } else if (
            input.getWheelMoved() &&
            this.enableZoom &&
            this.state === STATE.PINCH_DOLLY
        ) {
            // Pinch dolly move.
            let wheelData = input.getWheelData();
            let zoomScale =
                Math.pow(0.98, Math.abs(wheelData.delta.y)) * this.zoomSpeed;

            // Clamp all zooms to at most halve (zoom * 0.55) the current zoom value
            zoomScale = Math.min(1, Math.max(0.55, zoomScale));

            if (!wheelData.ctrl) {
                // If CTRL is not held for the event,
                // then we know that this is not a pinch-to-zoom situation
                // and the values should be clamped to ones that will have a less darastic change.
                zoomScale = Math.max(0.9, zoomScale);
            }
            this.dollyStart.copy(input.getMouseClientPos());
            this.dollyBegin.copy(this.dollyStart);
            this.dollyBegin = Input.offsetPosition(
                this.dollyBegin,
                this._game.gameView.gameView
            );
            if (wheelData.delta.y > 0) this.dollyIn(zoomScale);
            else if (wheelData.delta.y < 0) this.dollyOut(zoomScale);
        } else if (
            input.getMouseButtonHeld(MouseButtonId.Right) &&
            this.enableRotate &&
            this.state === STATE.ROTATE
        ) {
            // Rotate move.
            this.mouseRotateEnd.copy(input.getMouseClientPos());
            this.mouseRotateDelta
                .subVectors(this.mouseRotateEnd, this.mouseRotateStart)
                .multiplyScalar(this.rotateSpeed);
            const xAngle =
                (2 * Math.PI * this.mouseRotateDelta.x) /
                this._game.gameView.gameView.clientHeight;
            const yAngle =
                (2 * Math.PI * this.mouseRotateDelta.y) /
                this._game.gameView.gameView.clientHeight;
            this.rotateLeft(xAngle);
            this.rotateUp(yAngle);
            this.mouseRotateStart.copy(this.mouseRotateEnd);
        }
    }

    private updateMouseState(input: Input) {
        //
        // Pan/Dolly/Rotate [Start]
        //

        if (input.getMouseButtonDown(MouseButtonId.Left) && this.enablePan) {
            this.zooming = false;
            this._setRot = false;
            // Pan start.
            this.panStart.copy(input.getMouseClientPos());
            this.state = STATE.PAN;
        } else if (
            input.getMouseButtonDown(MouseButtonId.Middle) &&
            this.enableZoom
        ) {
            this.zooming = false;
            this._setRot = false;
            // Dolly start.
            this.dollyStart.copy(input.getMouseClientPos());
            this.dollyBegin.copy(this.dollyStart);
            this.dollyBegin = Input.offsetPosition(
                this.dollyBegin,
                this._game.gameView.gameView
            );
            this.state = STATE.DOLLY;
        } else if (input.getWheelMoved() && this.enableZoom) {
            this.zooming = false;
            this._setRot = false;
            // Pinch dolly start.
            this.state = STATE.PINCH_DOLLY;
        } else if (
            input.getMouseButtonDown(MouseButtonId.Right) &&
            this.enableRotate
        ) {
            this.zooming = false;
            this._setRot = false;
            // Rotate start.
            this.mouseRotateStart.copy(input.getMouseClientPos());
            this.state = STATE.ROTATE;
        }

        //
        // Pan/Dolly/Rotate [End]
        //
        if (
            input.getMouseButtonUp(MouseButtonId.Left) ||
            input.getMouseButtonUp(MouseButtonId.Middle) ||
            input.getMouseButtonUp(MouseButtonId.Right) ||
            (!input.getWheelMoved() && this.state === STATE.PINCH_DOLLY)
        ) {
            this.state = STATE.NONE;
        }
    }

    public getRotation(): { x: number; y: number } {
        const x = this.spherical.phi;
        const y = this.spherical.theta;

        return { x, y };
    }

    public setRotation(rotation: { x: number; y: number }) {
        let phi = rotation.x;
        let theta = rotation.y;

        // clamp theta and phi to exiting limits
        theta = Math.max(
            this.minAzimuthAngle,
            Math.min(this.maxAzimuthAngle, theta)
        );

        phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, phi));

        // Prevent phi from being exactly 0.
        // This is because the lookAt function in three.js
        // has issues when the look direction matches the world up direction.
        this.spherical.phi = phi === 0 ? Number.EPSILON : phi;
        this.spherical.theta = theta;
        this._setRot = true;
    }

    private updateCamera() {
        if (this._camera instanceof OrthographicCamera) {
            if (this.zooming && this._camera.zoom != this.zoomSetValueOrtho) {
                this._camera.zoom = lerp(
                    this._camera.zoom,
                    this.zoomSetValueOrtho,
                    this.tweenNum
                );

                if (this.tweenNum >= 1) {
                    this.zooming = false;
                }

                this._camera.updateProjectionMatrix();
                this.zoomChanged = true;
            }
        }

        let offset = new Vector3();

        // so camera.up is the orbit axis
        let quat = new Quaternion().setFromUnitVectors(
            this._camera.up,
            new Vector3(0, 1, 0)
        );
        let quatInverse = quat.clone().invert();

        let lastPosition = new Vector3();
        let lastQuaternion = new Quaternion();
        let position = this._camera.position;

        let lookTarget = this.target;
        let rotationTarget = this.target;

        // Rotate the target position around the touch origin midpoint
        // before applying the spherical rotation to the camera
        if (this.state === STATE.TOUCH_ROTATE_ZOOM && this.originMidpoint) {
            rotationTarget = this.originMidpoint;

            lookTarget.sub(this.originMidpoint);
            const s = new Spherical().setFromVector3(lookTarget);

            s.theta += this.sphericalDelta.theta;
            s.theta = Math.max(
                this.minAzimuthAngle,
                Math.min(this.maxAzimuthAngle, s.theta)
            );
            s.makeSafe();

            lookTarget.setFromSpherical(s);

            lookTarget.add(this.originMidpoint);
        }

        offset.copy(position).sub(rotationTarget);

        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion(quat);

        if (!this._setRot) {
            // angle from z-axis around y-axis
            this.spherical.setFromVector3(offset);

            if (this.autoRotate && this.state === STATE.NONE) {
                this.rotateLeft(this.getAutoRotationAngle());
            }

            this.spherical.theta += this.sphericalDelta.theta;
            this.spherical.phi += this.sphericalDelta.phi;

            // restrict theta to be between desired limits
            this.spherical.theta = Math.max(
                this.minAzimuthAngle,
                Math.min(this.maxAzimuthAngle, this.spherical.theta)
            );

            // restrict phi to be between desired limits
            this.spherical.phi = Math.max(
                this.minPolarAngle,
                Math.min(this.maxPolarAngle, this.spherical.phi)
            );

            this.spherical.makeSafe();

            if (this._camera instanceof PerspectiveCamera) {
                if (
                    this.zooming &&
                    this.spherical.radius != this.zoomSetValue
                ) {
                    this.sphereRadiusSetter = lerp(
                        this.spherical.radius,
                        this.zoomSetValue,
                        0.1
                    );

                    if (this.tweenNum >= 1) {
                        this.zooming = false;
                    }

                    this.spherical.radius = this.sphereRadiusSetter;
                } else {
                    this.zooming = false;
                    this.spherical.radius = this.sphereRadiusSetter;
                }
            }

            this.spherical.radius *= this.scale;

            if (this._camera instanceof PerspectiveCamera) {
                this.sphereRadiusSetter = this.spherical.radius;
            }

            // restrict radius to be between desired limits
            this.spherical.radius = Math.max(
                this.minDistance,
                Math.min(this.maxDistance, this.spherical.radius)
            );

            // move target to panned location
            this.target.add(this.panOffset);
            this.target.add(this.cameraFrameOffset);
            if (this.cameraFrameOffset.length() > 0) {
                this.currentDistX = this.target.x;
                this.currentDistY = this.target.y;
            }
        }
        this._setRot = false;

        if (this.tweenNum < 1) {
            this.tweenNum += 0.02;
        }

        offset.setFromSpherical(this.spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion(quatInverse);

        position.copy(rotationTarget).add(offset);

        if (this._camera.parent) {
            this._camera.parent.localToWorld(rotationTarget);
        }

        this._camera.lookAt(lookTarget);

        if (this.enableDamping === true) {
            this.sphericalDelta.theta *= 1 - this.dampingFactor;
            this.sphericalDelta.phi *= 1 - this.dampingFactor;
            this.panOffset.multiplyScalar(1 - this.dampingFactor);
        } else {
            this.sphericalDelta.set(0, 0, 0);
            this.panOffset.set(0, 0, 0);
        }
        this.cameraFrameOffset.set(0, 0, 0);

        this.scale = 1;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (
            this.zoomChanged ||
            lastPosition.distanceToSquared(this._camera.position) > this.EPS ||
            8 * (1 - lastQuaternion.dot(this._camera.quaternion)) > this.EPS
        ) {
            // this.dispatchEvent( this.changeEvent );

            lastPosition.copy(this._camera.position);
            lastQuaternion.copy(this._camera.quaternion);
            this.zoomChanged = false;
        }

        this._camera.updateMatrixWorld(true);
    }
}

enum STATE {
    NONE = -1,
    ROTATE = 0,
    DOLLY = 1,
    PINCH_DOLLY = 2,
    PAN = 3,
    TOUCH_ROTATE_ZOOM = 4,
}

interface TouchRotate {
    finger0: Vector2;
    finger1: Vector2;
}

/**
 * Projects the given delta onto a plane from the perspective of the given camera
 * and returns a new delta that is attached to the plane.
 * This is useful when you have an offset that is in camera coordinates but you want the Y axis to be attached to the plane.
 *
 * Note that this function only works properly orthographic cameras although it could be
 * improved to work with perspective cameras.
 *
 * @param camera The camera.
 * @param plane The plane that the delta should be projected on.
 * @param worldDelta The delta that should be projected.
 */
function calculatePlaneDelta(
    camera: Camera,
    plane: Plane,
    worldDelta: Vector3
): Vector3 {
    const cameraForward = cameraForwardRay(camera);
    const nextCameraForward = cameraForward.clone();
    cameraForward.origin.add(worldDelta);

    const originalPlanePoint = new Vector3();
    const nextPlanePoint = new Vector3();
    cameraForward.intersectPlane(plane, originalPlanePoint);
    nextCameraForward.intersectPlane(plane, nextPlanePoint);
    originalPlanePoint.sub(nextPlanePoint);

    return originalPlanePoint;
}
