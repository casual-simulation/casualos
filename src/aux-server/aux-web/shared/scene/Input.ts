import Vue from 'vue';
import {
    Vector2,
    Vector3,
    Ray,
    Group,
    Object3D,
} from '@casual-simulation/three';
import { find, some } from 'lodash';
import { Viewport } from './Viewport';
import { Game } from './Game';
import { Subscription, Observable, Subject } from 'rxjs';
import { v4 as uuid } from 'uuid';
import {
    XRInputSource,
    XRFrame,
    XRInputSourceEvent,
    XRInputSourcesChangeEvent,
    XRSpace,
    XRSession,
    XRPose,
} from './xr/WebXRTypes';
import { WebXRControllerMesh } from './xr/WebXRControllerMesh';
import { createMotionController, copyPose } from './xr/WebXRHelpers';
import { startWith } from 'rxjs/operators';

export class Input {
    /**
     * Singelton style instance of the Input class.
     */
    public static instance: Input;

    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events, 2: Move events
     */
    public debugLevel: number = 0;

    // Internal pointer data.
    private _mouseData: MouseData;
    private _touchData: TouchData[];
    private _controllerData: ControllerData[];
    private _keyData: Map<string, KeyData>;
    private _touchListenerCounts: Map<EventTarget, number>;
    private _wheelData: WheelData;
    private _targetData: TargetData;
    private _hasFocus: boolean;

    private _xrSession: XRSession;
    private _xrSubscription: Subscription;
    private _xrReferenceSpace: XRSpace;

    private _game: Game;
    private _inputType: InputType = InputType.Undefined;

    // Keep track of the touch data for finger index 0 at all times.
    // This gives better support to the getMouse* functions while using touch.
    private _lastPrimaryTouchData: TouchData;
    private _lastPrimaryControllerData: ControllerData;

    private _controllerAdded = new Subject<ControllerData>();
    private _controllerRemoved = new Subject<ControllerData>();

    /**
     * The events that have occurred during this frame.
     */
    events: Set<Event> = new Set();

    private _htmlElements: () => HTMLElement[];
    private _zoomElements: () => HTMLElement[];

    get time() {
        return this._game.getTime();
    }

    get htmlElements() {
        return this._htmlElements();
    }

    get zoomElements() {
        return this._zoomElements();
    }

    /**
     * @returns 'mouse' or 'touch'
     */
    get currentInputType(): InputType {
        return this._inputType;
    }

    /**
     * Sets the current input type to 'mouse' or 'touch'.
     */
    set currentInputType(inputType: InputType) {
        this._inputType = inputType;
    }

    /**
     * Gets the list of controllers that are currently available.
     */
    get controllers(): ControllerData[] {
        return this._controllerData;
    }

    /**
     * Gets an observable that resolves whenever a controller gets added.
     * On subscription, the observable resolves with every currently connected controller.
     */
    get controllerAdded(): Observable<ControllerData> {
        return this._controllerAdded.pipe(startWith(...this.controllers));
    }

    /**
     * Gets an observable that resolves whenever a controller gets removed.
     */
    get controllerRemoved(): Observable<ControllerData> {
        return this._controllerRemoved;
    }

    /**
     * Gets the controller that is currently set as the primary.
     * Generally, this is the most recently used controller, however if none is available then this is the first controller.
     * Returns null if no controller is available.
     */
    get primaryController(): ControllerData {
        if (this._lastPrimaryControllerData.identifier) {
            return this._lastPrimaryControllerData;
        } else if (this.controllers.length > 0) {
            return this.controllers[0];
        } else {
            return null;
        }
    }

    /**
     * Calculates the "offset" coordinates relative to the given view using the given page position coordinates.
     * @param pagePos The page position of the coordinates that we want converted.
     * @param view The HTML element that we want the position to be relative to.
     */
    public static offsetPosition(pagePos: Vector2, view: HTMLElement) {
        let globalPos = new Vector2(pagePos.x, pagePos.y);
        let viewRect = view.getBoundingClientRect();
        let viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        return viewPos;
    }

    /**
     * Calculates the Three.js screen position of the mouse from the given mouse event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param event The mouse event to get the viewport position out of.
     * @param view The HTML element that we want the position to be relative to.
     */
    public static screenPosition(pagePos: Vector2, view: HTMLElement) {
        let globalPos = new Vector2(pagePos.x, pagePos.y);
        let viewRect = view.getBoundingClientRect();
        let viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        return new Vector2(
            (viewPos.x / viewRect.width) * 2 - 1,
            -(viewPos.y / viewRect.height) * 2 + 1
        );
    }

    /**
     * Calculates the "offset" coordinates relative to the given viewport using the given page position coordinates.
     * @param pagePos The page position of the coordinates that we want converted.
     * @param viewport The viewport that we want the position to be relative to.
     */
    public static offsetPositionForViewport(
        pagePos: Vector2,
        viewport: Viewport
    ): Vector2 {
        const globalPos = new Vector2(pagePos.x, pagePos.y);
        const viewRect = viewport.getRootElement().getBoundingClientRect();
        const left = viewRect.left + viewport.x;
        const top =
            viewRect.height - (viewport.y + viewport.height) + viewRect.top;
        const viewPos = globalPos.sub(new Vector2(left, top));
        return viewPos;
    }

    /**
     * Calculates the page position coordinates using the given "offset" relative to the given viewport.
     * @param viewPos The offset position of the coordinates that we want converted.
     * @param viewport The viewport that we want the position to be relative to.
     */
    public static unoffsetPositionForViewport(
        viewPos: Vector2,
        viewport: Viewport
    ): Vector2 {
        viewPos = viewPos.clone();
        const viewRect = viewport.getRootElement().getBoundingClientRect();
        const left = viewRect.left + viewport.x;
        const top =
            viewRect.height - (viewport.y + viewport.height) + viewRect.top;
        const globalPos = viewPos.add(new Vector2(left, top));
        return globalPos;
    }

    /**
     * Calculate a screen position for the given viewport inside of a screen. The screen position will be normalized and relative to the viewport.
     * Screen position is Three.js style where bottom left corner is (-1, -1) and top right corner is (1, 1).
     * @param fullWidth The full width of the screen (pixels).
     * @param fullHeight The full height of the screen (pixels).
     * @param viewX The x starting point of the viewport (pixel).
     * @param viewY The y start point of the viewport (pixel).
     * @param viewWidth The width of the viewport (pixels).
     * @param viewHeight The height of the viewport (pixels).
     * @param pagePos The current global page position (pixels).
     */
    public static screenPositionForViewport(
        pagePos: Vector2,
        viewport: Viewport
    ): Vector2 {
        const viewPos = Input.offsetPositionForViewport(pagePos, viewport);
        return new Vector2(
            (viewPos.x / viewport.width) * 2 - 1,
            -(viewPos.y / viewport.height) * 2 + 1
        );
    }

    /**
     * Calculate a page position for the given viewport and three.js screen position.
     * Screen position is Three.js style where bottom left corner is (-1, -1) and top right corner is (1, 1).
     * @param screenPosition The screen position.
     * @param viewport The viewport.
     */
    public static pagePositionForViewport(
        screenPosition: Vector2,
        viewport: Viewport
    ): Vector2 {
        const viewPos = new Vector2(
            ((screenPosition.x + 1) / 2) * viewport.width,
            (-(screenPosition.y - 1) / 2) * viewport.height
        );
        return Input.unoffsetPositionForViewport(viewPos, viewport);
    }

    /**
     * Returns wether or not the page position is inside the viewport.
     * If other viewports are given, will check to make sure none of them are overlapping or otherwise occluding.
     * @param pagePos Page position to test
     * @param viewport Viewport to test if page position is on.
     * @param viewports Other viewports to check if they are occluding the given viewport above.
     */
    public static pagePositionOnViewport(
        pagePos: Vector2,
        viewport: Viewport,
        otherViewports?: Viewport[]
    ): boolean {
        let isOnViewport: boolean = false;

        if (!!pagePos && !!viewport) {
            const screenPos = this.screenPositionForViewport(pagePos, viewport);
            if (screenPos.x >= -1 && screenPos.x <= 1) {
                if (screenPos.y >= -1 && screenPos.y <= 1) {
                    isOnViewport = true;
                }
            }
        }

        if (otherViewports && isOnViewport) {
            // Make sure that there are no other view ports that are overlapping this one.
            const viewportsToTest = otherViewports.filter(
                (v) => v.layer >= viewport.layer && v !== viewport
            );

            for (let i = 0; i < viewportsToTest.length; i++) {
                if (Input.pagePositionOnViewport(pagePos, viewportsToTest[i])) {
                    // We are inside a viewport that is equal or higher in layer order.
                    // This overrides our test for the viewport in question.
                    return false;
                }
            }
        }

        return isOnViewport;
    }

    /**
     * Measures the distance between the two mouse events in pixels.
     * @param firstPagePos The first page position.
     * @param secondPagePos The second page position.
     */
    public static mouseDistance(firstPagePos: Vector2, secondPagePos: Vector2) {
        return firstPagePos.distanceTo(secondPagePos);
    }

    /**
     * Determines if the mouse is directly over the given HTML element.
     * @param clientPos The client position to test.
     * @param element The HTML element to test against.
     */
    public static eventIsDirectlyOverElement(
        clientPos: Vector2,
        element: HTMLElement
    ): boolean {
        let mouseOver = document.elementFromPoint(clientPos.x, clientPos.y);
        return mouseOver === element;
    }

    /**
     * Determines if the mouse is over the given element.
     * @param clientPos The client position to test.
     * @param element The HTML element to test against.
     */
    public static eventIsOverElement(
        clientPos: Vector2,
        element: HTMLElement
    ): boolean {
        let elements = document.elementsFromPoint(clientPos.x, clientPos.y);
        return some(elements, (e) => e === element);
    }

    constructor(game: Game) {
        Input.instance = this;
        this._game = game;
        this._htmlElements = () => [
            game.gameView.gameView,
            ...game.getUIHtmlElements(),
        ];

        this._zoomElements = () => [...game.getUIZoomElements()];

        this._mouseData = {
            leftButtonState: new InputState(),
            rightButtonState: new InputState(),
            middleButtonState: new InputState(),
            screenPos: new Vector2(0, 0),
            pagePos: new Vector2(0, 0),
            clientPos: new Vector2(0, 0),
        };
        this._targetData = {
            inputDown: null,
            inputUp: null,
            inputOver: null,
        };
        this._touchData = [];
        this._controllerData = [];
        this._keyData = new Map();
        this._touchListenerCounts = new Map();
        this._wheelData = new WheelData();
        this._lastPrimaryTouchData = {
            fingerIndex: 0,
            identifier: 0,
            clientPos: new Vector2(0, 0),
            pagePos: new Vector2(0, 0),
            screenPos: new Vector2(0, 0),
            state: new InputState(),
        };
        this._lastPrimaryControllerData = {
            identifier: null,
            inputSource: null,
            mesh: null,
            primaryInputState: new InputState(),
            squeezeInputState: new InputState(),
            ray: new Group(),
        };

        this._handleFocus = this._bind(this._handleFocus.bind(this));
        this._handleBlur = this._bind(this._handleBlur.bind(this));
        this._handleMouseDown = this._bind(this._handleMouseDown.bind(this));
        this._handleMouseMove = this._bind(this._handleMouseMove.bind(this));
        this._handleMouseUp = this._bind(this._handleMouseUp.bind(this));
        this._handleMouseLeave = this._bind(this._handleMouseLeave.bind(this));
        this._handleWheel = this._bind(this._handleWheel.bind(this));
        this._handleTouchStart = this._bind(this._handleTouchStart.bind(this));
        this._handleTouchMove = this._bind(this._handleTouchMove.bind(this));
        this._handleTouchEnd = this._bind(this._handleTouchEnd.bind(this));
        this._handleTouchCancel = this._bind(
            this._handleTouchCancel.bind(this)
        );
        this._handleContextMenu = this._bind(
            this._handleContextMenu.bind(this)
        );
        this._handleKeyDown = this._bind(this._handleKeyDown.bind(this));
        this._handleKeyUp = this._bind(this._handleKeyUp.bind(this));
        this._handleInputSourcesUpdated = this._bind(
            this._handleInputSourcesUpdated.bind(this)
        );
        this._handleXRSelectStart = this._bind(
            this._handleXRSelectStart.bind(this)
        );
        this._handleXRSelectEnd = this._bind(
            this._handleXRSelectEnd.bind(this)
        );
        this._handleXRSqueezeStart = this._bind(
            this._handleXRSqueezeStart.bind(this)
        );
        this._handleXRSqueezeEnd = this._bind(
            this._handleXRSqueezeEnd.bind(this)
        );

        this._handlePointerCancel = this._bind(
            this._handlePointerCancel.bind(this)
        );
        this._handlePointerDown = this._bind(
            this._handlePointerDown.bind(this)
        );
        this._handlePointerEnter = this._bind(
            this._handlePointerEnter.bind(this)
        );
        this._handlePointerLeave = this._bind(
            this._handlePointerLeave.bind(this)
        );
        this._handlePointerMove = this._bind(
            this._handlePointerMove.bind(this)
        );
        this._handlePointerUp = this._bind(this._handlePointerUp.bind(this));

        let element = document.getElementById('app');
        element.addEventListener('mousedown', this._handleMouseDown);
        element.addEventListener('mousemove', this._handleMouseMove);
        element.addEventListener('mouseup', this._handleMouseUp);
        element.addEventListener('mouseleave', this._handleMouseLeave);
        element.addEventListener('wheel', this._handleWheel);
        element.addEventListener('touchstart', this._handleTouchStart);
        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('keyup', this._handleKeyUp);
        window.addEventListener('focus', this._handleFocus);
        window.addEventListener('blur', this._handleBlur);
        window.addEventListener('pointercancel', this._handlePointerCancel);
        window.addEventListener('pointerdown', this._handlePointerDown);
        window.addEventListener('pointerenter', this._handlePointerEnter);
        window.addEventListener('pointerleave', this._handlePointerLeave);
        window.addEventListener('pointermove', this._handlePointerMove);
        window.addEventListener('pointerup', this._handlePointerUp);

        // Context menu is only important on the game view
        this._game.gameView.gameView.addEventListener(
            'contextmenu',
            this._handleContextMenu
        );
    }

    public dispose() {
        console.log('[Input] dispose');

        if (Input.instance === this) {
            Input.instance = null;
        }

        let element = document.getElementById('app');
        element.removeEventListener('mousedown', this._handleMouseDown);
        element.removeEventListener('mousemove', this._handleMouseMove);
        element.removeEventListener('mouseup', this._handleMouseUp);
        element.removeEventListener('wheel', this._handleWheel);
        element.removeEventListener('touchstart', this._handleTouchStart);
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('keyup', this._handleKeyUp);
        window.removeEventListener('focus', this._handleFocus);
        window.removeEventListener('blur', this._handleBlur);

        // Context menu is only important on the game view
        this._game.gameView.gameView.removeEventListener(
            'contextmenu',
            this._handleContextMenu
        );

        if (this._xrSubscription) {
            this._xrSubscription.unsubscribe();
            this._xrSubscription = null;
        }

        this._game = null;
    }

    /**
     * Determines if the mouse down event happened directly over the given element.
     * @param element The element to test.
     */
    public isMouseButtonDownOnElement(element: HTMLElement): boolean {
        const downElement = this._targetData.inputDown;
        return Input.isElementContainedByOrEqual(downElement, element);
    }

    /**
     * Determines if the mouse down event happened directly over any of the given elements.
     * @param elements The elements to test.
     */
    public isMouseButtonDownOnAnyElements(elements: HTMLElement[]): boolean {
        const downElement = this._targetData.inputDown;
        const matchingElement = elements.find((e) =>
            Input.isElementContainedByOrEqual(downElement, e)
        );
        return !!matchingElement;
    }

    /**
     * Determines if the mouse is on the given viewport. Will check children to make sure that they are not instead being detected.
     * @param viewport The viewport to test on.
     */
    public isMouseOnViewport(viewport: Viewport): boolean {
        const pagePos = this.getMousePagePos();
        const otherViewports = this._game.getViewports();
        return Input.pagePositionOnViewport(pagePos, viewport, otherViewports);
    }

    /**
     * Determines if the mouse is currently focusing the given html element.
     * @param element The element to test.
     */
    public isMouseFocusingOnElement(element: HTMLElement): boolean {
        const overElement = this._targetData.inputOver;
        return Input.isElementContainedByOrEqual(overElement, element);
    }

    /**
     * Determines if the mouse is currently focusing any of the given html elements.
     * @param elements The elements to test.
     */
    public isMouseFocusingOnAnyElements(elements: HTMLElement[]): boolean {
        const overElement = this._targetData.inputOver;
        const matchingElement = elements.find((e) =>
            Input.isElementContainedByOrEqual(overElement, e)
        );
        return !!matchingElement;
    }

    /**
     * Gets the closest vue component accociated with this HTML element.
     * @param element The html element.
     * @param The vue class that the element needs to match.
     */
    public static getVueParent(element: HTMLElement, vueClass?: any): Vue {
        const e = <any>element;
        if (!e) {
            return null;
        }
        if (e.__vue__) {
            let vue = <Vue>e.__vue__;
            if (!vueClass || vue instanceof vueClass) {
                return vue;
            }
        }
        return Input.getVueParent(element.parentElement);
    }

    /**
     * Determines if the given event is for any of the the given elements and should
     * therefore be intercepted.
     * @param event The event.
     * @param elements The elements.
     */
    public static isEventForAnyElement(
        event: MouseEvent | TouchEvent,
        elements: HTMLElement[]
    ): boolean {
        let el: Element;
        if (event instanceof MouseEvent) {
            el = document.elementFromPoint(event.clientX, event.clientY);
        } else {
            el = document.elementFromPoint(
                event.changedTouches[0].clientX,
                event.changedTouches[0].clientY
            );
        }

        const matchingElement = elements.find((e) =>
            Input.isElementContainedByOrEqual(el, e)
        );
        return !!matchingElement;
    }

    /**
     * Determines if the given HTML element is contained by the given container element.
     * @param element The HTML element.
     * @param container The container.
     */
    public static isElementContainedByOrEqual(
        element: Element,
        container: HTMLElement
    ): boolean {
        if (element === container) {
            return true;
        } else {
            if (!element) {
                return false;
            } else {
                return this.isElementContainedByOrEqual(
                    element.parentElement,
                    container
                );
            }
        }
    }

    /**
     * Returns true the frame that the button was pressed down.
     * If on mobile device and requresing Left Button, will return for the first finger touching the screen.
     */
    public getMouseButtonDown(buttonId: MouseButtonId): boolean {
        const state = this.getButtonInputState(buttonId);
        if (state) {
            return state.isDownOnFrame(this.time.frameCount);
        }

        return false;
    }

    public getTouchDown(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isDownOnFrame(this.time.frameCount);
        }

        return false;
    }

    /**
     * Returns true on the frame that the key was pressed.
     * @param key The key. See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     */
    public getKeyDown(key: string): boolean {
        let keyData = this.getKeyData(key);
        if (keyData) {
            return keyData.state.isDownOnFrame(this.time.frameCount);
        }

        return false;
    }

    /**
     * Returns true the frame that the button was released.
     * If on mobile device and requresing Left Button, will return for the first finger touching the screen.
     */
    public getMouseButtonUp(buttonId: MouseButtonId): boolean {
        const state = this.getButtonInputState(buttonId);
        if (state) {
            return state.isUpOnFrame(this.time.frameCount);
        }

        return false;
    }

    public getTouchUp(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isUpOnFrame(this.time.frameCount);
        }

        return false;
    }

    /**
     * Returns true on the frame that the key was released.
     * @param key The key. See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     */
    public getKeyUp(key: string): boolean {
        let keyData = this.getKeyData(key);
        if (keyData) {
            return keyData.state.isUpOnFrame(this.time.frameCount);
        }

        return false;
    }

    /**
     * Retruns true every frame the button is held down.
     * If on mobile device, will return the held state of the first finger touching the screen.
     */
    public getMouseButtonHeld(buttonId: MouseButtonId): boolean {
        const state = this.getButtonInputState(buttonId);
        if (state) {
            return state.isHeldOnFrame(this.time.frameCount);
        }

        return false;
    }

    public getTouchHeld(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isHeldOnFrame(this.time.frameCount);
        }

        return false;
    }

    /**
     * Returns true every frame that the given key is held down.
     * @param key The key. See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     */
    public getKeyHeld(key: string): boolean {
        let keyData = this.getKeyData(key);
        if (keyData) {
            return keyData.state.isHeldOnFrame(this.time.frameCount);
        }
        return false;
    }

    /**
     * Returns true on the frame that the controller's primary button is pressed.
     * @param controller
     */
    public getControllerPrimaryButtonDown(controller: ControllerData) {
        return controller.primaryInputState.isDownOnFrame(this.time.frameCount);
    }

    /**
     * Returns true on the frame that the controller's primary button is pressed.
     * @param controller
     */
    public getControllerPrimaryButtonUp(controller: ControllerData) {
        return controller.primaryInputState.isUpOnFrame(this.time.frameCount);
    }

    /**
     * Returns true while the controller's primary button is pressed.
     * @param controller
     */
    public getControllerPrimaryButtonHeld(controller: ControllerData) {
        return controller.primaryInputState.isHeldOnFrame(this.time.frameCount);
    }

    /**
     * Returns true while the controller's squeeze button is pressed.
     * @param controller
     */
    public getControllerSqueezeButtonHeld(controller: ControllerData) {
        return controller.squeezeInputState.isHeldOnFrame(this.time.frameCount);
    }

    /**
     * Gets the input state for the given button ID.
     * @param buttonId The ID of the button.
     */
    public getButtonInputState(buttonId: MouseButtonId): InputState {
        if (this._inputType == InputType.Mouse) {
            let buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState;
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                return this._lastPrimaryTouchData.state;
            } else {
                // TODO: Support right button with touch?
            }
        }
        return null;
    }

    /**
     * Return true the frame that wheel movement was detected.
     */
    public getWheelMoved(): boolean {
        return this._wheelData.getFrame(this.time.frameCount) != null;
    }

    /**
     * The wheel data for the current frame.
     */
    public getWheelData(): WheelFrame {
        // Deep clone the internal wheel data.
        let wheelFrame = this._wheelData.getFrame(this.time.frameCount);
        if (wheelFrame) return JSON.parse(JSON.stringify(wheelFrame));
        else return null;
    }

    /**
     * Return the last known screen position of the mouse.
     * If on mobile device, will return the screen position of the first finger touching the screen.
     */
    public getMouseScreenPos(): Vector2 {
        if (this._inputType == InputType.Mouse) {
            return this._mouseData.screenPos;
        } else if (this._inputType == InputType.Touch) {
            return this._lastPrimaryTouchData.screenPos;
        }

        return null;
    }

    /**
     * Return the last known page position of the mouse.
     * If on mobile device, will return the page position of the first finger touching the screen.
     */
    public getMousePagePos(): Vector2 {
        if (this._inputType == InputType.Mouse) {
            return this._mouseData.pagePos;
        } else if (this._inputType == InputType.Touch) {
            return this._lastPrimaryTouchData.pagePos;
        }

        return null;
    }

    /**
     * Return the last known client position of the mouse.
     * If on mobile device, will return the client position of the first finger touching the screen.
     */
    public getMouseClientPos(): Vector2 {
        if (this._inputType == InputType.Mouse) {
            return this._mouseData.clientPos;
        } else if (this._inputType == InputType.Touch) {
            return this._lastPrimaryTouchData.clientPos;
        }

        return null;
    }

    /**
     * Return the screen position of the touch. Will return null if touch not detected.
     * @param fingerIndex The index of the finger (first finger: 0, second finger: 1, ...)
     */
    public getTouchScreenPos(fingerIndex: number): Vector2 {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.screenPos;
        }
        return null;
    }

    /**
     * Return the page position of the touch. Will return null if touch not detected.
     * @param fingerIndex The index of the finger (first finger: 0, second finger: 1, ...)
     */
    public getTouchPagePos(fingerIndex: number): Vector2 {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.pagePos;
        }
        return null;
    }

    /**
     * Return the client position of the touch. Will return null if touch not detected.
     * @param fingerIndex The index of the finger (first finger: 0, second finger: 1, ...)
     */
    public getTouchClientPos(fingerIndex: number): Vector2 {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.clientPos;
        }
        return null;
    }

    /**
     * Return how many touches are currenty active.
     */
    public getTouchCount(): number {
        return this._touchData.length;
    }

    public getMouseData(): MouseData {
        return this._mouseData;
    }

    /**
     * Returns the active touch data.
     */
    public getTouches(): TouchData[] {
        return this._touchData;
    }

    /**
     * Returns the matching TouchData object for the provided finger index.
     */
    public getTouchData(finderIndex: number): TouchData {
        if (this._touchData.length > 0) {
            let touchData = find(this._touchData, (d: TouchData) => {
                return d.fingerIndex === finderIndex;
            });
            if (touchData) {
                return touchData;
            }
        }
        return null;
    }

    /**
     * Returns the matching key data for the provided key value.
     * @param key The key that the data should be found for.
     *            See https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key
     */
    public getKeyData(key: string): KeyData {
        return this._keyData.get(key);
    }

    /**
     * Gets the iterable list of keys that have been used in the application.
     * Useful to check if any keys have been pressed or released.
     */
    public getKeys(): Iterable<KeyData> {
        return this._keyData.values();
    }

    /**
     * Gets the information about what HTML elements are currently being targeted.
     * Note that this only stores information about the last targeted elements.
     * As such, it should only be used to tell whether touch/mouse events
     * should be used or not.
     */
    public getTargetData(): TargetData {
        return this._targetData;
    }

    /**
     * Force all current input states to release (set the up frame to the current frame).
     */
    public forceReleaseInputs(): void {
        const currentFrame = this.time.frameCount;

        // Release currently held mouse buttons.
        if (this._mouseData.leftButtonState.isHeldOnFrame(currentFrame)) {
            this._mouseData.leftButtonState.setUpFrame(currentFrame);
        }
        if (this._mouseData.middleButtonState.isHeldOnFrame(currentFrame)) {
            this._mouseData.middleButtonState.setUpFrame(currentFrame);
        }
        if (this._mouseData.rightButtonState.isHeldOnFrame(currentFrame)) {
            this._mouseData.rightButtonState.setUpFrame(currentFrame);
        }

        // Release currenty held touches.
        for (let i = 0; i < this._touchData.length; i++) {
            let touchData = this._touchData[i];
            if (touchData.state.isHeldOnFrame(currentFrame)) {
                touchData.state.setUpFrame(currentFrame);
            }
        }
    }

    public update(xrFrame?: any) {
        this._cullTouchData();
        this._wheelData.removeOldFrames(this.time.frameCount);
        this._updateControllers(xrFrame);
    }

    public resetEvents() {
        this.events.clear();
    }

    private _updateControllers(xrFrame: XRFrame) {
        for (let controller of this._controllerData) {
            this._updateControllerRay(xrFrame, controller);
            if (controller.mesh) {
                controller.mesh.update(xrFrame, this._xrReferenceSpace);
            }
        }
    }

    public setXRSession(xrSession: any, referenceSpace: any) {
        if (this._xrSubscription) {
            this._xrSubscription.unsubscribe();
        }
        this._inputType = InputType.Controller;
        this._xrSession = xrSession;
        this._xrReferenceSpace = referenceSpace;
        this._xrSession.addEventListener(
            'inputsourceschange',
            this._handleInputSourcesUpdated
        );
        this._xrSession.addEventListener(
            'selectstart',
            this._handleXRSelectStart
        );
        this._xrSession.addEventListener('selectend', this._handleXRSelectEnd);
        this._xrSession.addEventListener(
            'squeezestart',
            this._handleXRSqueezeStart
        );
        this._xrSession.addEventListener(
            'squeezeend',
            this._handleXRSqueezeEnd
        );
        this._xrSession.addEventListener('end', () => {
            if (this._xrSubscription) {
                this._xrSubscription.unsubscribe();
                this._xrSubscription = null;
            }
        });
        this._xrSubscription = new Subscription(() => {
            for (let controller of this._controllerData) {
                this._controllerRemoved.next(controller);
                this._disposeController(controller);
            }
            this._controllerData = [];
            this._xrSession.removeEventListener(
                'inputsourceschange',
                this._handleInputSourcesUpdated
            );
            this._xrSession.removeEventListener(
                'selectstart',
                this._handleXRSelectStart
            );
            this._xrSession.removeEventListener(
                'selectend',
                this._handleXRSelectEnd
            );
            this._xrSession.removeEventListener(
                'squeezestart',
                this._handleXRSqueezeStart
            );
            this._xrSession.removeEventListener(
                'squeezeend',
                this._handleXRSqueezeEnd
            );
        });
    }

    /**
     * Loop through all current touch data and remove any that are no longer needed.
     * Unlike the mouse, touch pointers are unique everytime they are pressed down on the screen.
     * Remove any touch pointers that are passed their 'up' input state. No need to keep them around.
     */
    private _cullTouchData(): void {
        let touchRemoved: boolean = false;

        this._touchData = this._touchData.filter((t: TouchData) => {
            let upFrame = t.state.getUpFrame();

            // Up frame must have been set.
            if (upFrame !== -1) {
                // Current frame must be higher than the touch's up frame.
                if (this.time.frameCount > upFrame) {
                    if (this.debugLevel >= 1) {
                        console.log(
                            'removing touch finger: ' +
                                t.fingerIndex +
                                '. frame: ' +
                                this.time.frameCount
                        );
                    }

                    touchRemoved = true;
                    return false;
                }
            }

            return true;
        });

        if (touchRemoved && this._touchData.length > 0) {
            // Normalize the finger index range of the remaining touch data.
            this._touchData = this._touchData.sort(
                (a: TouchData, b: TouchData) => {
                    return a.fingerIndex - b.fingerIndex;
                }
            );

            for (let i = 0; i < this._touchData.length; i++) {
                this._touchData[i].fingerIndex = i;
            }
        }
    }

    private _copyToPrimaryTouchData(data: TouchData) {
        this._lastPrimaryTouchData.fingerIndex = data.fingerIndex;
        this._lastPrimaryTouchData.identifier = data.identifier;
        this._lastPrimaryTouchData.clientPos = data.clientPos.clone();
        this._lastPrimaryTouchData.pagePos = data.pagePos.clone();
        this._lastPrimaryTouchData.screenPos = data.screenPos.clone();
        this._lastPrimaryTouchData.state = data.state.clone();
    }

    private _copyToPrimaryControllerData(data: ControllerData) {
        this._lastPrimaryControllerData.identifier = data.identifier;
        this._lastPrimaryControllerData.inputSource = data.inputSource;
        this._lastPrimaryControllerData.primaryInputState = data.primaryInputState.clone();
        this._lastPrimaryControllerData.ray.copy(data.ray, false);
        this._lastPrimaryControllerData.mesh = data.mesh;
    }

    /**
     * Returns the matching MouseButtonData object for the provided mouse button number.
     */
    private _getMouseButtonState(button: MouseButtonId): InputState {
        if (button == MouseButtonId.Left)
            return this._mouseData.leftButtonState;
        if (button == MouseButtonId.Right)
            return this._mouseData.rightButtonState;
        if (button == MouseButtonId.Middle)
            return this._mouseData.middleButtonState;

        console.warn('unsupported mouse button number: ' + button);
        return null;
    }

    /**
     * Returns the matching MouseButtonData objects for the given mouse buttons number.
     * See https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
     * @param buttons The number that represents the buttons that are held down.
     */
    private _getMouseButtonStates(buttons: number): InputState[] {
        let states = [] as InputState[];
        if ((buttons & 1) === 1) {
            states.push(this._getMouseButtonState(MouseButtonId.Left));
        }
        if ((buttons & 2) === 2) {
            states.push(this._getMouseButtonState(MouseButtonId.Right));
        }
        if ((buttons & 4) === 4) {
            states.push(this._getMouseButtonState(MouseButtonId.Middle));
        }
        return states;
    }

    /**
     * Calculates the Three.js screen position of the pointer from the given pointer event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param pageX
     * @param pageY
     */
    private _calculateScreenPos(pageX: number, pageY: number): Vector2 {
        return Input.screenPosition(
            new Vector2(pageX, pageY),
            this._game.gameView.gameView
        );
    }

    private _handleFocus(event: FocusEvent) {
        this._hasFocus = true;
        if (this.debugLevel >= 1) {
            console.log(
                'focus gained. fireInputOnFrame: ' + this.time.frameCount
            );
        }
    }

    private _handleBlur(event: FocusEvent) {
        this._hasFocus = false;
        if (this.debugLevel >= 1) {
            console.log(
                'focus lost. fireInputOnFrame: ' + this.time.frameCount
            );
        }

        // Reset all the keyboard keys
        for (let key of this._keyData.values()) {
            if (key.state.isHeldOnFrame(this.time.frameCount)) {
                key.state.setUpFrame(this.time.frameCount);
            }
        }
    }

    private _handleMouseDown(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            buttonState.setDownFrame(this.time.frameCount);

            if (this.debugLevel >= 1) {
                console.log(
                    'mouse button ' +
                        event.button +
                        ' down. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }

            this._targetData.inputDown = <HTMLElement>event.target;
            this._mouseData.clientPos = new Vector2(
                event.clientX,
                event.clientY
            );
            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(
                event.pageX,
                event.pageY
            );
        }
    }

    private _handleMouseUp(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            buttonState.setUpFrame(this.time.frameCount);

            if (this.debugLevel >= 1) {
                console.log(
                    'mouse button ' +
                        event.button +
                        ' up. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }

            this._targetData.inputUp = <HTMLElement>event.target;
            this._mouseData.clientPos = new Vector2(event.clientX, event.pageY);
            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(
                event.pageX,
                event.pageY
            );
        }
    }

    private _handleMouseLeave(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        // Clear all the button states when the mouse leaves the window
        let buttonStates: InputState[] = [
            this._mouseData.leftButtonState,
            this._mouseData.rightButtonState,
            this._mouseData.middleButtonState,
        ];
        for (let buttonState of buttonStates) {
            buttonState.setUpFrame(this.time.frameCount);
        }
        if (this.debugLevel >= 1) {
            console.log(
                'mouse button ' +
                    event.button +
                    ' leave. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }

        this._targetData.inputUp = <HTMLElement>event.target;
        this._mouseData.clientPos = new Vector2(event.clientX, event.pageY);
        this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
        this._mouseData.screenPos = this._calculateScreenPos(
            event.pageX,
            event.pageY
        );
    }

    private _handleMouseMove(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        // Resend the mouse down events if the button is actually down
        // but is not recorded as such.
        const buttonStates: InputState[] = this._getMouseButtonStates(
            event.buttons
        );
        let hadButtonDown = false;
        for (let state of buttonStates) {
            let down = state.getDownFrame();
            let up = state.getUpFrame();

            if (up > down || down === -1) {
                state.setDownFrame(this.time.frameCount);
                hadButtonDown = true;
            }
        }
        if (hadButtonDown) {
            if (this.debugLevel >= 1) {
                console.log(
                    'mouse buttons ' +
                        event.buttons +
                        ' already down. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }
        }

        this._mouseData.clientPos = new Vector2(event.clientX, event.clientY);
        this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
        this._mouseData.screenPos = this._calculateScreenPos(
            event.pageX,
            event.pageY
        );
        this._targetData.inputOver = <HTMLElement>event.target;

        if (this.debugLevel >= 2) {
            console.log('mouse move:');
            console.log(
                '  screenPos: ' + JSON.stringify(this._mouseData.screenPos)
            );
            console.log(
                '  pagePos: ' + JSON.stringify(this._mouseData.pagePos)
            );
            console.log(
                '  clientPos: ' + JSON.stringify(this._mouseData.clientPos)
            );
            console.log('  button: ' + JSON.stringify(event.button));
        }
    }

    private _getKeyState(key: string) {
        return this._keyData.get(key);
    }

    private _handleKeyUp(event: KeyboardEvent) {
        let keyState = this._getKeyState(event.key);
        if (keyState) {
            keyState.state.setUpFrame(this.time.frameCount);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'key ' +
                    event.key +
                    ' up. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }
    }

    private _handleKeyDown(event: KeyboardEvent) {
        let keyData = this._getKeyState(event.key);
        if (!keyData) {
            keyData = {
                key: event.key,
                state: new InputState(),
            };
            this._keyData.set(keyData.key, keyData);
        }

        if (!event.repeat) {
            keyData.state.setDownFrame(this.time.frameCount);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'key ' +
                    event.key +
                    ' down. fireInputOnFrame: ' +
                    this.time.frameCount +
                    '. repeating: ' +
                    event.repeat
            );
        }
    }

    private _handleWheel(event: WheelEvent) {
        if (
            this.isMouseFocusingOnElement(this._game.gameView.gameView) ||
            Input.isEventForAnyElement(event, this.zoomElements)
        ) {
            event.preventDefault();
        }

        let wheelFrame: WheelFrame = {
            moveFrame: this.time.frameCount,
            delta: new Vector3(event.deltaX, event.deltaY, event.deltaZ),
            ctrl: event.ctrlKey,
        };

        this._wheelData.addFrame(wheelFrame);

        if (this.debugLevel >= 2) {
            if (wheelFrame.ctrl) {
                console.log(
                    `wheel w/ ctrl fireOnFrame: ${wheelFrame.moveFrame}, delta: (${wheelFrame.delta.x}, ${wheelFrame.delta.y}, ${wheelFrame.delta.z})`
                );
            } else {
                console.log(
                    `wheel fireOnFrame: ${wheelFrame.moveFrame}, delta: (${wheelFrame.delta.x}, ${wheelFrame.delta.y}, ${wheelFrame.delta.z})`
                );
            }
        }
    }

    private _handleTouchStart(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        // Ignore all touches on elements that are not in the HTML elements list
        if (!Input.isEventForAnyElement(event, this.htmlElements)) {
            return;
        }

        const count = this._touchListenerCounts.get(event.target) || 0;
        if (count === 0) {
            event.target.addEventListener('touchmove', this._handleTouchMove);
            event.target.addEventListener('touchend', this._handleTouchEnd);
            event.target.addEventListener(
                'touchcancel',
                this._handleTouchCancel
            );
            this._touchListenerCounts.set(
                event.target,
                event.changedTouches.length
            );

            if (this.debugLevel >= 1) {
                console.log('adding touch listeners for ', event.target);
            }
        } else if (count >= 0) {
            this._touchListenerCounts.set(
                event.target,
                count + event.changedTouches.length
            );
            if (this.debugLevel >= 1) {
                console.log(count + 1, ' touch events left for', event.target);
            }
        }

        event.preventDefault();

        // For the touchstart event, it is a list of the touch points that became active with the current event.
        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            let touch = changed.item(i);

            // Create new touch data.
            let data: TouchData = {
                identifier: touch.identifier,
                fingerIndex: this.getTouchCount(),
                state: new InputState(),
                clientPos: new Vector2(touch.clientX, touch.clientY),
                pagePos: new Vector2(touch.pageX, touch.pageY),
                screenPos: this._calculateScreenPos(touch.pageX, touch.pageY),
            };

            // Set the down frame on the new touch data.
            data.state.setDownFrame(this.time.frameCount);

            if (data.fingerIndex === 0) {
                this._copyToPrimaryTouchData(data);
            }

            if (this.debugLevel >= 1) {
                console.log(
                    'touch finger ' +
                        data.identifier +
                        ' ' +
                        data.fingerIndex +
                        ' start. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }

            this._targetData.inputDown = this._targetData.inputOver = <
                HTMLElement
            >touch.target;
            this._touchData.push(data);
        }
    }

    private _handleTouchMove(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        event.stopImmediatePropagation();
        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        // For the touchmove event, it is a list of the touch points that have changed since the last event.
        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            let touch = changed.item(i);

            let existingTouch = find(this._touchData, (d) => {
                return d.identifier === touch.identifier;
            });
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(
                touch.pageX,
                touch.pageY
            );
            // Must use elementFromPoint because touch event target never changes after initial contact.
            this._targetData.inputOver = <HTMLElement>(
                document.elementFromPoint(touch.clientX, touch.clientY)
            );

            if (existingTouch.fingerIndex === 0) {
                this._copyToPrimaryTouchData(existingTouch);
            }

            if (this.debugLevel >= 2) {
                console.log('touch move:');
                console.log('  identifier: ' + existingTouch.identifier);
                console.log('  fingerIndex: ' + existingTouch.fingerIndex);
                console.log(
                    '  screenPos: ' + JSON.stringify(existingTouch.screenPos)
                );
                console.log(
                    '  pagePos: ' + JSON.stringify(existingTouch.pagePos)
                );
                console.log(
                    '  clientPos: ' + JSON.stringify(existingTouch.clientPos)
                );
            }
        }
    }

    private _handleTouchEnd(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        event.stopImmediatePropagation();

        const count = this._touchListenerCounts.get(event.target) || 0;
        if (count <= event.changedTouches.length) {
            event.target.removeEventListener(
                'touchmove',
                this._handleTouchMove
            );
            event.target.removeEventListener('touchend', this._handleTouchEnd);
            event.target.removeEventListener(
                'touchcancel',
                this._handleTouchCancel
            );
            this._touchListenerCounts.set(event.target, 0);

            if (this.debugLevel >= 1) {
                console.log(
                    `removing ${count} (${event.changedTouches.length}) touch listeners for `,
                    event.target
                );
            }
        } else if (count > 0) {
            this._touchListenerCounts.set(
                event.target,
                count - event.changedTouches.length
            );
            if (this.debugLevel >= 1) {
                console.log(
                    count - event.changedTouches.length,
                    ' touch events left for',
                    event.target
                );
            }
        }

        if (Input.isEventForAnyElement(event, this.htmlElements)) {
            event.preventDefault();
        }

        // For the touchend event, it is a list of the touch points that have been removed from the surface.
        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            let touch = changed.item(i);

            // Must use elementFromPoint because touch event target never changes after initial contact.
            this._targetData.inputUp = this._targetData.inputOver = <
                HTMLElement
            >document.elementFromPoint(touch.clientX, touch.clientY);

            let existingTouch = find(this._touchData, (d) => {
                return d.identifier === touch.identifier;
            });
            existingTouch.state.setUpFrame(this.time.frameCount);
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(
                touch.pageX,
                touch.pageY
            );

            if (existingTouch.fingerIndex === 0) {
                this._copyToPrimaryTouchData(existingTouch);
            }

            if (this.debugLevel >= 1) {
                console.log(
                    'touch finger ' +
                        existingTouch.identifier +
                        ' ' +
                        existingTouch.fingerIndex +
                        ' end. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }
        }
    }

    private _handleTouchCancel(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        event.stopImmediatePropagation();

        const count = this._touchListenerCounts.get(event.target) || 0;
        if (count <= event.changedTouches.length) {
            event.target.removeEventListener(
                'touchmove',
                this._handleTouchMove
            );
            event.target.removeEventListener('touchend', this._handleTouchEnd);
            event.target.removeEventListener(
                'touchcancel',
                this._handleTouchCancel
            );
            this._touchListenerCounts.set(event.target, 0);

            if (this.debugLevel >= 1) {
                console.log('removing touch listeners for ', event.target);
            }
        } else if (count > 0) {
            this._touchListenerCounts.set(
                event.target,
                count - event.changedTouches.length
            );
            if (this.debugLevel >= 1) {
                console.log(count - 1, ' touch events left for', event.target);
            }
        }

        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            // Handle a canceled touche the same as a touch end.
            let touch = changed.item(i);

            let existingTouch = find(this._touchData, (d) => {
                return d.identifier === touch.identifier;
            });
            existingTouch.state.setUpFrame(this.time.frameCount);
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(
                touch.pageX,
                touch.pageY
            );

            if (existingTouch.fingerIndex === 0) {
                this._copyToPrimaryTouchData(existingTouch);
            }

            if (this.debugLevel >= 1) {
                console.log(
                    'touch finger ' +
                        existingTouch.fingerIndex +
                        ' canceled. fireInputOnFrame: ' +
                        this.time.frameCount
                );
            }
        }
    }

    // Empty because pointer events are not currently used to track input
    // states. Instead, they are used to pass through events to other components.
    private _handlePointerCancel(event: TouchEvent) {}

    private _handlePointerDown(event: TouchEvent) {}

    private _handlePointerEnter(event: TouchEvent) {}

    private _handlePointerLeave(event: PointerEvent) {}

    private _handlePointerMove(event: PointerEvent) {}

    private _handlePointerUp(event: PointerEvent) {}

    private _handleInputSourcesUpdated(event: XRInputSourcesChangeEvent) {
        for (let source of event.added) {
            let controller = this._controllerData.find(
                (c) => c.inputSource === source
            );
            if (!controller) {
                controller = {
                    primaryInputState: new InputState(),
                    squeezeInputState: new InputState(),
                    mesh: new WebXRControllerMesh(source),
                    ray: new Group(),
                    inputSource: source,
                    identifier: uuid(),
                };
                this._controllerData.push(controller);
                this._setupControllerMesh(controller);
                this._controllerAdded.next(controller);
            }
        }
        for (let source of event.removed) {
            const index = this._controllerData.findIndex(
                (c) => c.inputSource === source
            );
            if (index >= 0) {
                const removed = this._controllerData.splice(index, 1);
                for (let r of removed) {
                    this._controllerRemoved.next(r);
                    this._disposeController(r);
                }
            }
        }
    }

    private async _setupControllerMesh(controller: ControllerData) {
        let mesh: WebXRControllerMesh = controller.mesh;
        this._game.getMainCameraRig().cameraParent.add(mesh.group);
        const motionController = await createMotionController(
            controller.inputSource
        );
        await mesh.init(motionController);
    }

    private _handleXRSelect(event: XRInputSourceEvent) {}

    private _handleXRSelectStart(event: XRInputSourceEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Controller;
        if (this._inputType != InputType.Controller) return;
        const controller = this._controllerData.find(
            (c) => c.inputSource === event.inputSource
        );
        if (!controller) {
            return;
        }
        this._updateControllerRay(event.frame, controller);
        controller.primaryInputState.setDownFrame(this.time.frameCount);

        if (this._lastPrimaryControllerData.primaryInputState.isUp()) {
            this._copyToPrimaryControllerData(controller);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'XR select ' +
                    controller.identifier +
                    ' start. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }
    }

    private _handleXRSelectEnd(event: XRInputSourceEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Controller;
        if (this._inputType != InputType.Controller) return;
        const controller = this._controllerData.find(
            (c) => c.inputSource === event.inputSource
        );
        if (!controller) {
            return;
        }
        this._updateControllerRay(event.frame, controller);
        controller.primaryInputState.setUpFrame(this.time.frameCount);

        if (
            controller.inputSource ===
            this._lastPrimaryControllerData.inputSource
        ) {
            this._copyToPrimaryControllerData(controller);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'XR select ' +
                    controller.identifier +
                    ' end. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }
    }

    private _handleXRSqueezeStart(event: XRInputSourceEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Controller;
        if (this._inputType != InputType.Controller) return;
        const controller = this._controllerData.find(
            (c) => c.inputSource === event.inputSource
        );
        if (!controller) {
            return;
        }
        this._updateControllerRay(event.frame, controller);
        controller.squeezeInputState.setDownFrame(this.time.frameCount);

        if (this._lastPrimaryControllerData.primaryInputState.isUp()) {
            this._copyToPrimaryControllerData(controller);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'XR squeeze ' +
                    controller.identifier +
                    ' start. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }
    }

    private _handleXRSqueezeEnd(event: XRInputSourceEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Controller;
        if (this._inputType != InputType.Controller) return;
        const controller = this._controllerData.find(
            (c) => c.inputSource === event.inputSource
        );
        if (!controller) {
            return;
        }
        this._updateControllerRay(event.frame, controller);
        controller.squeezeInputState.setUpFrame(this.time.frameCount);

        if (
            controller.inputSource ===
            this._lastPrimaryControllerData.inputSource
        ) {
            this._copyToPrimaryControllerData(controller);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'XR squeeze ' +
                    controller.identifier +
                    ' end. fireInputOnFrame: ' +
                    this.time.frameCount
            );
        }
    }

    private _updateControllerRay(frame: XRFrame, controller: ControllerData) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Controller;
        if (this._inputType != InputType.Controller) return;
        const pose = frame.getPose(
            controller.inputSource.targetRaySpace,
            this._xrReferenceSpace
        );
        copyPose(pose, controller.ray);
        if (controller.mesh.group.parent) {
            const worldMatrix = controller.mesh.group.parent.matrixWorld;
            const obj = controller.ray;
            obj.matrix.premultiply(worldMatrix);
            obj.matrix.decompose(obj.position, <any>obj.rotation, obj.scale);
            obj.updateMatrixWorld();
        }
    }

    private _disposeController(controller: ControllerData) {
        if (controller.mesh) {
            if (controller.mesh.group.parent) {
                controller.mesh.group.parent.remove(controller.mesh.group);
            }
            controller.mesh.unsubscribe();
        }
    }

    private _handleContextMenu(event: MouseEvent) {
        // Prevent context menu from triggering.
        event.preventDefault();
        event.stopPropagation();
    }

    private _bind(func: Function): any {
        return (event: any) => {
            if (this.events.has(event) || event.__ignoreForInput) {
                return;
            }
            this.events.add(event);
            return func(event);
        };
    }
}

export enum InputType {
    Undefined = 'undefined',
    Mouse = 'mouse',
    Touch = 'touch',
    Controller = 'controller',
}

export enum MouseButtonId {
    Left = 0,
    Middle = 1,
    Right = 2,
}

export class InputState {
    /**
     * The frame this input was down.
     */
    private _downFrame: number = -1;

    /**
     * The frame this input was up.
     */
    private _upFrame: number = -1;

    getDownFrame(): number {
        return this._downFrame;
    }

    setDownFrame(frame: number) {
        this._downFrame = frame;
    }

    getUpFrame(): number {
        return this._upFrame;
    }

    setUpFrame(frame: number) {
        this._upFrame = frame;
    }

    isUp() {
        return this._upFrame >= this._downFrame;
    }

    /**
     * Is the input down on the requested frame. Will only return true on the exact frame.
     * @see isHeldOnFrame() for true result for every frame the input is down.
     * @param frame The frame to compare against.
     */
    isDownOnFrame(frame: number): boolean {
        return frame === this._downFrame;
    }

    /**
     * Is the input held on the requested frame. Will return for every frame the input is held down.
     * @param frame The frame to compare against.
     */
    isHeldOnFrame(frame: number): boolean {
        // Down frame must have been set.
        if (this._downFrame !== -1) {
            // Down frame must be more recent than the up frame.
            if (this._downFrame > this._upFrame) {
                // Frame must be same or higher than down frame.
                if (frame >= this._downFrame) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Is the input up on the requested frame. Will only return true on the exact frame.
     * @param frame The frame to compare against.
     */
    isUpOnFrame(frame: number): boolean {
        return frame === this._upFrame;
    }

    /**
     * Returns a new InputState with the same values as this one.
     */
    clone(): InputState {
        let clone = new InputState();
        clone._downFrame = this._downFrame;
        clone._upFrame = this._upFrame;

        return clone;
    }
}

interface WheelFrame {
    /**
     * The frame that the wheel moved on.
     */
    moveFrame: number;

    /**
     * Wheel delta in a Vector3 format. (x, y, z)
     */
    delta: Vector3;

    /**
     * Is the wheel being invoked with ctrl?
     * @see https://developer.mozilla.org/en-US/docs/Web/Events/wheel
     * WheelEvent has a standardized hack that allows trackpad two finger pinching to be detected as WheelEvent + ctrl key.
     * This boolean indicates whether the ctrl key was detected with the WheelEvent.
     */
    ctrl: boolean;
}

/**
 * Data about the HTML element that was targeted by a click.
 */
export interface TargetData {
    inputDown: HTMLElement;
    inputUp: HTMLElement;
    inputOver: HTMLElement;
}

interface TouchData {
    /**
     * The unique identifier for the touch.
     */
    identifier: number;

    /**
     * The index of the finger for the touch.
     */
    fingerIndex: number;

    /**
     * State of the touch input.
     */
    state: InputState;

    /**
     * Screen position of the touch.
     */
    screenPos: Vector2;

    /**
     * Page position of the touch.
     */
    pagePos: Vector2;

    /**
     * Client position of touch.
     */
    clientPos: Vector2;
}

interface MouseData {
    /**
     * State of the left mouse button.
     */
    leftButtonState: InputState;

    /**
     * State of the right mouse button.
     */
    rightButtonState: InputState;

    /**
     * State of the middle mouse button.
     */
    middleButtonState: InputState;

    /**
     * Screen position of the mouse.
     */
    screenPos: Vector2;

    /**
     * Page position of the mouse.
     */
    pagePos: Vector2;

    /**
     * Client position of mouse.
     */
    clientPos: Vector2;
}

/**
 * Interface for data about a key.
 */
interface KeyData {
    /**
     * The key that the data is for.
     */
    key: string;

    /**
     * The state of the key.
     */
    state: InputState;
}

/**
 * Interface for data about a controller.
 */
export interface ControllerData {
    /**
     * The state that the controller's primary input is in.
     */
    primaryInputState: InputState;

    /**
     * The state that the controller's "squeeze" button is in.
     */
    squeezeInputState: InputState;

    /**
     * The object representing the controller mesh.
     */
    mesh: WebXRControllerMesh;

    /**
     * The ray that the controller is pointing at.
     */
    ray: Group;

    /**
     * The input source that the controller represents.
     */
    inputSource: XRInputSource;

    /**
     * The identifier for the controller.
     */
    identifier: string;
}

export const MOUSE_INPUT_METHOD_IDENTIFIER =
    '03df96e8-ebc5-4fce-bf9d-9e77038f9839';

export type InputMethod = ControllerInputMethod | MouseOrTouchInputMethod;

export interface ControllerInputMethod {
    type: 'controller';
    identifier: string;
    controller: ControllerData;
}

export interface MouseOrTouchInputMethod {
    type: 'mouse_or_touch';
    identifier: string;
}

class WheelData {
    private _wheelFrames: WheelFrame[] = [];

    /**
     * Add the WheelFrame to the WheelData frame array.
     * @param wheelFrame
     */
    addFrame(wheelFrame: WheelFrame): void {
        this._wheelFrames.push(wheelFrame);
    }

    /**
     * Returns the WheelFrame for the specified frame number.
     * @param frame The frame number to retrieve.
     */
    getFrame(frame: number): WheelFrame {
        let wheelFrame = find(this._wheelFrames, (f: WheelFrame) => {
            return f.moveFrame === frame;
        });
        if (wheelFrame) return wheelFrame;
        else return null;
    }

    /**
     * Remove all WheelFrame objects that are older than the specified current frame.
     * @param curFrame The current frame number.
     */
    removeOldFrames(curFrame: number): void {
        if (this._wheelFrames.length === 0) return;
        // console.log('removeOldFrames wheelFrameCount: ' + this._wheelFrames.length + ', curFrame: ' + curFrame);
        this._wheelFrames = this._wheelFrames.filter((f: WheelFrame) => {
            return f.moveFrame >= curFrame;
        });
        // console.log('removeOldFrames after filter wheelFrameCount: ' + this._wheelFrames.length);
    }
}
