import Vue from 'vue';
import { Vector2, Vector3 } from 'three';
import { find, some } from 'lodash';
import { IGameView } from '../IGameView';

export class Input {
    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events, 2: Move events
     */
    public debugLevel: number = 0;

    // Internal pointer data.
    private _mouseData: MouseData;
    private _touchData: TouchData[];
    private _keyData: Map<string, KeyData>;
    private _wheelData: WheelData;
    private _targetData: TargetData;

    private _gameView: IGameView;
    private _inputType: InputType = InputType.Undefined;

    // Keep track of the touch data for finger index 0 at all times.
    // This gives better support to the getMouse* functions while using touch.
    private _lastPrimaryTouchData: TouchData;

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
        return some(elements, e => e === element);
    }

    constructor(gameView: IGameView) {
        this._gameView = gameView;

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
        this._keyData = new Map();
        this._wheelData = new WheelData();
        this._lastPrimaryTouchData = {
            fingerIndex: 0,
            identifier: 0,
            clientPos: new Vector2(0, 0),
            pagePos: new Vector2(0, 0),
            screenPos: new Vector2(0, 0),
            state: new InputState(),
        };

        this._handleMouseDown = this._handleMouseDown.bind(this);
        this._handleMouseMove = this._handleMouseMove.bind(this);
        this._handleMouseUp = this._handleMouseUp.bind(this);
        this._handleWheel = this._handleWheel.bind(this);
        this._handleTouchStart = this._handleTouchStart.bind(this);
        this._handleTouchMove = this._handleTouchMove.bind(this);
        this._handleTouchEnd = this._handleTouchEnd.bind(this);
        this._handleTouchCancel = this._handleTouchCancel.bind(this);
        this._handleContextMenu = this._handleContextMenu.bind(this);
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);

        let element = document.getElementById('app');
        element.addEventListener('mousedown', this._handleMouseDown);
        element.addEventListener('mousemove', this._handleMouseMove);
        element.addEventListener('mouseup', this._handleMouseUp);
        element.addEventListener('wheel', this._handleWheel);
        element.addEventListener('touchstart', this._handleTouchStart);
        element.addEventListener('touchmove', this._handleTouchMove);
        element.addEventListener('touchend', this._handleTouchEnd);
        element.addEventListener('touchcancel', this._handleTouchCancel);
        document.addEventListener('keydown', this._handleKeyDown);
        document.addEventListener('keyup', this._handleKeyUp);

        // Context menu is only important on the game view
        this._gameView.gameView.addEventListener(
            'contextmenu',
            this._handleContextMenu
        );
    }

    public dispose() {
        console.log('[Input] dispose');

        let element = document.getElementById('app');
        element.removeEventListener('mousedown', this._handleMouseDown);
        element.removeEventListener('mousemove', this._handleMouseMove);
        element.removeEventListener('mouseup', this._handleMouseUp);
        element.removeEventListener('wheel', this._handleWheel);
        element.removeEventListener('touchstart', this._handleTouchStart);
        element.removeEventListener('touchmove', this._handleTouchMove);
        element.removeEventListener('touchend', this._handleTouchEnd);
        element.removeEventListener('touchcancel', this._handleTouchCancel);
        document.removeEventListener('keydown', this._handleKeyDown);
        document.removeEventListener('keyup', this._handleKeyUp);

        // Context menu is only important on the game view
        this._gameView.gameView.removeEventListener(
            'contextmenu',
            this._handleContextMenu
        );

        this._gameView = null;
    }

    /**
     * Determines if the mouse down event happened directly over the given element.
     * @param element The element to test.
     */
    public isMouseButtonDownOn(element: HTMLElement): boolean {
        const downElement = this._targetData.inputDown;
        return Input.isElementContainedByOrEqual(downElement, element);
    }

    /**
     * Determines if the mouse down event happened directly over any of the given elements.
     * @param elements The elements to test.
     */
    public isMouseButtonDownOnAny(elements: HTMLElement[]): boolean {
        const downElement = this._targetData.inputDown;
        const matchingElement = elements.find(e =>
            Input.isElementContainedByOrEqual(downElement, e)
        );
        return !!matchingElement;
    }

    /**
     * Determines if the mouse is currently focusing the given html element.
     * @param element The element to test.
     */
    public isMouseFocusing(element: HTMLElement): boolean {
        const overElement = this._targetData.inputOver;
        return Input.isElementContainedByOrEqual(overElement, element);
    }

    /**
     * Determines if the mouse is currently focusing any of the given html elements.
     * @param elements The elements to test.
     */
    public isMouseFocusingAny(elements: HTMLElement[]): boolean {
        const overElement = this._targetData.inputOver;
        const matchingElement = elements.find(e =>
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
    public isEventForAnyElement(
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

        const matchingElement = elements.find(e =>
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
        if (this._inputType == InputType.Mouse) {
            let buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isDownOnFrame(
                    this._gameView.getTime().frameCount
                );
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                return this._lastPrimaryTouchData.state.isDownOnFrame(
                    this._gameView.getTime().frameCount
                );
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    public getTouchDown(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isDownOnFrame(
                this._gameView.getTime().frameCount
            );
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
            return keyData.state.isDownOnFrame(
                this._gameView.getTime().frameCount
            );
        }

        return false;
    }

    /**
     * Returns true the frame that the button was released.
     * If on mobile device and requresing Left Button, will return for the first finger touching the screen.
     */
    public getMouseButtonUp(buttonId: MouseButtonId): boolean {
        if (this._inputType == InputType.Mouse) {
            let buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isUpOnFrame(
                    this._gameView.getTime().frameCount
                );
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                return this._lastPrimaryTouchData.state.isUpOnFrame(
                    this._gameView.getTime().frameCount
                );
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    public getTouchUp(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isUpOnFrame(
                this._gameView.getTime().frameCount
            );
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
            return keyData.state.isUpOnFrame(
                this._gameView.getTime().frameCount
            );
        }

        return false;
    }

    /**
     * Retruns true every frame the button is held down.
     * If on mobile device, will return the held state of the first finger touching the screen.
     */
    public getMouseButtonHeld(buttonId: MouseButtonId): boolean {
        if (this._inputType == InputType.Mouse) {
            let buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isHeldOnFrame(
                    this._gameView.getTime().frameCount
                );
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                return this._lastPrimaryTouchData.state.isHeldOnFrame(
                    this._gameView.getTime().frameCount
                );
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    public getTouchHeld(fingerIndex: number): boolean {
        let touchData = this.getTouchData(fingerIndex);
        if (touchData) {
            return touchData.state.isHeldOnFrame(
                this._gameView.getTime().frameCount
            );
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
            return keyData.state.isHeldOnFrame(
                this._gameView.getTime().frameCount
            );
        }
        return false;
    }

    /**
     * Return true the frame that wheel movement was detected.
     */
    public getWheelMoved(): boolean {
        return (
            this._wheelData.getFrame(this._gameView.getTime().frameCount) !=
            null
        );
    }

    /**
     * The wheel data for the current frame.
     */
    public getWheelData(): WheelFrame {
        // Deep clone the internal wheel data.
        let wheelFrame = this._wheelData.getFrame(
            this._gameView.getTime().frameCount
        );
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
     * Gets the information about what HTML elements are currently being targeted.
     * Note that this only stores information about the last targeted elements.
     * As such, it should only be used to tell whether touch/mouse events
     * should be used or not.
     */
    public getTargetData(): TargetData {
        return this._targetData;
    }

    public update() {
        this._cullTouchData();
        this._wheelData.removeOldFrames(this._gameView.getTime().frameCount);
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
                if (this._gameView.getTime().frameCount > upFrame) {
                    if (this.debugLevel >= 1) {
                        console.log(
                            'removing touch finger: ' +
                                t.fingerIndex +
                                '. frame: ' +
                                this._gameView.getTime().frameCount
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
     * Calculates the Three.js screen position of the pointer from the given pointer event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param pageX
     * @param pageY
     */
    private _calculateScreenPos(pageX: number, pageY: number): Vector2 {
        return Input.screenPosition(
            new Vector2(pageX, pageY),
            this._gameView.gameView
        );
    }

    private _handleMouseDown(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
            event.preventDefault();
        }

        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            buttonState.setDownFrame(this._gameView.getTime().frameCount);

            if (this.debugLevel >= 1) {
                console.log(
                    'mouse button ' +
                        event.button +
                        ' down. fireInputOnFrame: ' +
                        this._gameView.getTime().frameCount
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

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
            event.preventDefault();
        }

        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            buttonState.setUpFrame(this._gameView.getTime().frameCount);

            if (this.debugLevel >= 1) {
                console.log(
                    'mouse button ' +
                        event.button +
                        ' up. fireInputOnFrame: ' +
                        this._gameView.getTime().frameCount
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

    private _handleMouseMove(event: MouseEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
            event.preventDefault();
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
        }
    }

    private _getKeyState(key: string) {
        return this._keyData.get(key);
    }

    private _handleKeyUp(event: KeyboardEvent) {
        let keyState = this._getKeyState(event.key);
        if (keyState) {
            keyState.state.setUpFrame(this._gameView.getTime().frameCount);
        }

        if (this.debugLevel >= 1) {
            console.log(
                'key ' +
                    event.key +
                    ' up. fireInputOnFrame: ' +
                    this._gameView.getTime().frameCount
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

        keyData.state.setDownFrame(this._gameView.getTime().frameCount);

        if (this.debugLevel >= 1) {
            console.log(
                'key ' +
                    event.key +
                    ' down. fireInputOnFrame: ' +
                    this._gameView.getTime().frameCount
            );
        }
    }

    private _handleWheel(event: WheelEvent) {
        if (this.isMouseFocusing(this._gameView.gameView)) {
            event.preventDefault();
        }

        let wheelFrame: WheelFrame = {
            moveFrame: this._gameView.getTime().frameCount,
            delta: new Vector3(event.deltaX, event.deltaY, event.deltaZ),
            ctrl: event.ctrlKey,
        };

        this._wheelData.addFrame(wheelFrame);

        if (this.debugLevel >= 2) {
            if (wheelFrame.ctrl) {
                console.log(
                    `wheel w/ ctrl fireOnFrame: ${
                        wheelFrame.moveFrame
                    }, delta: (${wheelFrame.delta.x}, ${wheelFrame.delta.y}, ${
                        wheelFrame.delta.z
                    })`
                );
            } else {
                console.log(
                    `wheel fireOnFrame: ${wheelFrame.moveFrame}, delta: (${
                        wheelFrame.delta.x
                    }, ${wheelFrame.delta.y}, ${wheelFrame.delta.z})`
                );
            }
        }
    }

    private _handleTouchStart(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
            event.preventDefault();
        }

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
            data.state.setDownFrame(this._gameView.getTime().frameCount);

            if (data.fingerIndex === 0) {
                this._copyToPrimaryTouchData(data);
            }

            if (this.debugLevel >= 1) {
                console.log(
                    'touch finger ' +
                        data.fingerIndex +
                        ' start. fireInputOnFrame: ' +
                        this._gameView.getTime().frameCount
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

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
            event.preventDefault();
        }

        // For the touchmove event, it is a list of the touch points that have changed since the last event.
        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            let touch = changed.item(i);

            let existingTouch = find(this._touchData, d => {
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

        if (
            this.isEventForAnyElement(event, [
                this._gameView.gameView,
                ...this._gameView.getUIHtmlElements(),
            ])
        ) {
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

            let existingTouch = find(this._touchData, d => {
                return d.identifier === touch.identifier;
            });
            existingTouch.state.setUpFrame(this._gameView.getTime().frameCount);
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
                        ' end. fireInputOnFrame: ' +
                        this._gameView.getTime().frameCount
                );
            }
        }
    }

    private _handleTouchCancel(event: TouchEvent) {
        if (this._inputType == InputType.Undefined)
            this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        let changed = event.changedTouches;

        for (let i = 0; i < changed.length; i++) {
            // Handle a canceled touche the same as a touch end.
            let touch = changed.item(i);

            let existingTouch = find(this._touchData, d => {
                return d.identifier === touch.identifier;
            });
            existingTouch.state.setUpFrame(this._gameView.getTime().frameCount);
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
                        this._gameView.getTime().frameCount
                );
            }
        }
    }

    private _handleContextMenu(event: MouseEvent) {
        // Prevent context menu from triggering.
        event.preventDefault();
        event.stopPropagation();
    }
}

export enum InputType {
    Undefined = 'undefined',
    Mouse = 'mouse',
    Touch = 'touch',
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
interface TargetData {
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
