import { ArgEvent } from '../../common/Events';
import { Vector2 } from 'three';
import { time } from './Time';
import { find, findIndex, keys, some } from 'lodash';

export class Input {
    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events, 2: Move events
     */
    public debugLevel: number = 1;

    // Internal pointer data.
    private _mouseData: MouseData;
    private _touchData: TouchData[];

    private _initialized: boolean = false;
    private _element: HTMLElement;
    private _inputType: InputType = InputType.Undefined;

    // Event handler functions.
    private _mouseDownHandler: any;
    private _mouseMoveHandler: any;
    private _mouseUpHandler: any;
    private _touchStartHandler: any;
    private _touchMoveHandler: any;
    private _touchEndHandler: any;
    private _touchCancelHandler: any;
    private _contextMenuHandler: any;
    
    /**
     * Calculates the Three.js screen position of the mouse from the given mouse event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param event The mouse event to get the viewport position out of.
     * @param view The HTML element that we want the position to be relative to.
     */
    public static screenPosition(pagePos: Vector2, view: HTMLElement) {
        const globalPos = new Vector2(pagePos.x, pagePos.y);
        const viewRect = view.getBoundingClientRect();
        const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        return new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
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
    public static eventIsDirectlyOverElement(clientPos: Vector2, element:HTMLElement): boolean {
      const mouseOver = document.elementFromPoint(clientPos.x, clientPos.y);
      return mouseOver === element;
    }

    /**
     * Determines if the mouse is over the given element.
     * @param clientPos The client position to test.
     * @param element The HTML element to test against.
     */
    public static eventIsOverElement(clientPos: Vector2, element:HTMLElement): boolean {
      const elements = document.elementsFromPoint(clientPos.x, clientPos.y);
      return some(elements, e => e === element);
    }

    public init(element:HTMLElement) {
        if (this._initialized) return;

        console.log("[Input] initialize");
        this._initialized = true;
        this._element = element;

        this._mouseData = {
            leftButtonState: new InputState(),
            rightButtonState: new InputState(),
            middleButtonState: new InputState(),
            screenPos: new Vector2(0, 0),
            pagePos: new Vector2(0, 0),
            clientPos: new Vector2(0, 0)
        };
        this._touchData = [];

        this._mouseDownHandler = this._handleMouseDown.bind(this);
        this._mouseMoveHandler = this._handleMouseMove.bind(this);
        this._mouseUpHandler = this._handleMouseUp.bind(this);
        this._touchStartHandler = this._handleTouchStart.bind(this);
        this._touchMoveHandler = this._handleTouchMove.bind(this);
        this._touchEndHandler = this._handleTouchEnd.bind(this);
        this._touchCancelHandler = this._handleTouchCancel.bind(this);
        this._contextMenuHandler = this._handleContextMenu.bind(this);
        
        this._element.addEventListener('mousedown', this._mouseDownHandler);
        this._element.addEventListener('mousemove', this._mouseMoveHandler);
        this._element.addEventListener('mouseup', this._mouseUpHandler);
        this._element.addEventListener('touchstart', this._touchStartHandler);
        this._element.addEventListener('touchmove', this._touchMoveHandler);
        this._element.addEventListener('touchend', this._touchEndHandler);
        this._element.addEventListener('touchcancel', this._touchCancelHandler);
        this._element.addEventListener('contextmenu', this._contextMenuHandler);

        requestAnimationFrame(() => this._update());
    }

    public terminate() {
        if (!this._initialized) return;

        console.log("[Input] terminate");
        this._initialized = false;

        this._element.removeEventListener('mousedown', this._mouseDownHandler);
        this._element.removeEventListener('mousemove', this._mouseMoveHandler);
        this._element.removeEventListener('mouseup', this._mouseUpHandler);
        this._element.removeEventListener('touchstart', this._touchStartHandler);
        this._element.removeEventListener('touchmove', this._touchMoveHandler);
        this._element.removeEventListener('touchend', this._touchEndHandler);
        this._element.removeEventListener('touchcancel', this._touchCancelHandler);
        this._element.removeEventListener('contextmenu', this._contextMenuHandler);

        this._mouseDownHandler = null;
        this._mouseMoveHandler = null;
        this._mouseUpHandler = null;
        this._touchStartHandler = null;
        this._touchMoveHandler = null;
        this._touchEndHandler = null;
        this._touchCancelHandler = null;

        this._element = null;
    }

    /**
     * @returns 'mouse' or 'touch'
     */
    public getCurrentInputType(): InputType {
        return this._inputType;
    }

    /**
     * Returns true the frame that the button was pressed down.
     * If on mobile device and requresing Left Button, will return for the first finger touching the screen.
     */
    public getMouseButtonDown(buttonId: MouseButtonId): boolean {
        if (this._inputType == InputType.Mouse) {
            const buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isDownOnFrame(time.frameCount);
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                const touchData = this._getTouchData(0);
                if (touchData) {
                    return touchData.state.isDownOnFrame(time.frameCount);
                }
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    /**
     * Returns true the frame that the button was released.
     * If on mobile device and requresing Left Button, will return for the first finger touching the screen.
     */
    public getMouseButtonUp(buttonId: MouseButtonId): boolean {
        if (this._inputType == InputType.Mouse) {
            const buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isUpOnFrame(time.frameCount);
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                const touchData = this._getTouchData(0);
                if (touchData) {
                    return touchData.state.isUpOnFrame(time.frameCount);
                }
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    /**
     * Retruns true every frame the button is held down.
     * If on mobile device, will return the held state of the first finger touching the screen.
     */
    public getMouseButtonHeld(buttonId: MouseButtonId): boolean { 
        if (this._inputType == InputType.Mouse) {
            const buttonState = this._getMouseButtonState(buttonId);
            if (buttonState) {
                return buttonState.isHeldOnFrame(time.frameCount);
            }
        } else if (this._inputType == InputType.Touch) {
            if (buttonId == MouseButtonId.Left) {
                const touchData = this._getTouchData(0);
                if (touchData) {
                    return touchData.state.isHeldOnFrame(time.frameCount);
                }
            } else {
                // TODO: Support right button with touch?
            }
        }

        return false;
    }

    /**
     * Return the last known screen position of the mouse.
     * If on mobile device, will return the screen position of the first finger touching the screen.
     */
    public getMouseScreenPos(): Vector2 {
        if (this._inputType == InputType.Mouse) {
            return this._mouseData.screenPos;
        } else if (this._inputType == InputType.Touch) {
            return this.getTouchScreenPos(0);
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
            return this.getTouchPagePos(0);
        }

        return null;
    }

    /**
     * Return the screen position of the touch. Will return null if touch not detected.
     * @param fingerIndex The index of the finger (first finger: 0, second finger: 1, ...)
     */
    public getTouchScreenPos(fingerIndex: number): Vector2 {
        const touchData = this._getTouchData(fingerIndex);
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
        const touchData = this._getTouchData(fingerIndex);
        if (touchData) {
            return touchData.pagePos;
        }
        return null;
    }

    private _update() {
        if (!this._initialized) return;

        // console.log("input update frame: " + time.frameCount);
        this._cullTouchData();

        requestAnimationFrame(() => this._update());
    }

    /**
     * Loop through all current touch data and remove any that are no longer needed.
     * Unlike the mouse, touch pointers are unique everytime they are pressed down on the screen.
     * Remove any touch pointers that are passed their 'up' input state. No need to keep them around.
     */
    private _cullTouchData(): void {
        for (var i = this._touchData.length - 1; i >= 0; i--) {
            const upFrame: number = this._touchData[i].state.getUpFrame();
            
            // Up frame must have been set.
            if (upFrame !== -1) {
                // Current frame must be higher than the touch's up frame.
                if (time.frameCount > upFrame) {            
                    console.log('removing touch: ' + this._touchData[i].fingerIndex + '. frame: ' + time.frameCount);
                    this._touchData.splice(i, 1);
                }
            }
        }
    }

    /**
     * Returns the matching MouseButtonData object for the provided mouse button number.
     */
    private _getMouseButtonState(button: MouseButtonId): InputState {
        if (button == MouseButtonId.Left) return this._mouseData.leftButtonState;
        if (button == MouseButtonId.Right) return this._mouseData.rightButtonState;
        if (button == MouseButtonId.Middle) return this._mouseData.middleButtonState;
        
        console.warn("unsupported mouse button number: " + button);
        return null;
    }

    /**
     * Returns the matching TouchData object for the provided finger index.
     */
    private _getTouchData(finderIndex: number): TouchData {
        if (this._touchData.length > 0) {
            const touchData = find(this._touchData, (d) => { return d.fingerIndex === finderIndex; });
            if (touchData) {
                return touchData;
            }
        }
        return null;
    }

    /**
     * Calculates the Three.js screen position of the pointer from the given pointer event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param pageX
     * @param pageY
     */
    private _calculateScreenPos(pageX: number, pageY: number): Vector2 {
        const globalPos = new Vector2(pageX, pageY);
        const viewRect = this._element.getBoundingClientRect();
        const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        return new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
    }

    private _handleMouseDown(event:MouseEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;
        
        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            let fireOnFrame = time.frameCount + 1;
            buttonState.setDownFrame(fireOnFrame);
        
            if (this.debugLevel >= 1) {
                console.log("mouse button " + event.button + " down. fireInputOnFrame: " + fireOnFrame);
            }

            this._mouseData.clientPos = new Vector2(event.clientX, event.clientY);
            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(event.pageX, event.pageY);
        }
    }

    private _handleMouseUp(event:MouseEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;
        
        let buttonState: InputState = this._getMouseButtonState(event.button);
        if (buttonState) {
            let fireOnFrame = time.frameCount + 1;
            buttonState.setUpFrame(fireOnFrame);
        
            if (this.debugLevel >= 1) {
                console.log("mouse button " + event.button + " up. fireInputOnFrame: " + fireOnFrame);
            }

            this._mouseData.clientPos = new Vector2(event.clientX, event.pageY);
            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(event.pageX, event.pageY);
        }
    }

    private _handleMouseMove(event:MouseEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        this._mouseData.clientPos = new Vector2(event.clientX, event.clientY);
        this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
        this._mouseData.screenPos = this._calculateScreenPos(event.pageX, event.pageY);

        if (this.debugLevel >= 2) {
            console.log("mouse move:");
            console.log("  screenPos: " + JSON.stringify(this._mouseData.screenPos));
            console.log("  pagePos: " + JSON.stringify(this._mouseData.pagePos));
            console.log("  clientPos: " + JSON.stringify(this._mouseData.clientPos));
        }
    }

    private _handleTouchStart(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        // For the touchstart event, it is a list of the touch points that became active with the current event.
        const changed = event.changedTouches;

        for (var i = 0; i < changed.length; i++) {
            const touch = changed.item(i);
            let fireOnFrame = time.frameCount + 1;

            // Create new touch data.
            let data: TouchData = {
                fingerIndex: touch.identifier,
                state: new InputState(),
                clientPos: new Vector2(touch.clientX, touch.clientY),
                pagePos: new Vector2(touch.pageX, touch.pageY),
                screenPos: this._calculateScreenPos(touch.pageX, touch.pageY)
            }

            // Set the down frame on the new touch data.
            data.state.setDownFrame(fireOnFrame);

            if (this.debugLevel >= 1) {
                console.log("touch " + touch.identifier + " start. fireInputOnFrame: " + fireOnFrame);
            }

            var existingTouchIndex = findIndex(this._touchData, (d) => { return d.fingerIndex === touch.identifier; });
            if (existingTouchIndex === -1) this._touchData.push(data);
            else this._touchData[existingTouchIndex] = data;
        }
    }

    private _handleTouchMove(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        // This prevents the browser from doing things like allow the pull down refresh on Chrome.
        event.preventDefault();

        // For the touchmove event, it is a list of the touch points that have changed since the last event.
        const changed = event.changedTouches;

        for (var i = 0; i < changed.length; i++) {
            const touch = changed.item(i);

            var existingTouch = find(this._touchData, (d) => { return d.fingerIndex === touch.identifier; });
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(touch.pageX, touch.pageY);
        
            if (this.debugLevel >= 2) {
                console.log("touch move:");
                console.log("  identifier: " + existingTouch.fingerIndex);
                console.log("  screenPos: " + JSON.stringify(existingTouch.screenPos));
                console.log("  pagePos: " + JSON.stringify(existingTouch.pagePos));
                console.log("  clientPos: " + JSON.stringify(existingTouch.clientPos));
            }
        }
    }

    private _handleTouchEnd(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        // For the touchend event, it is a list of the touch points that have been removed from the surface.
        const changed = event.changedTouches;

        for (var i = 0; i < changed.length; i++) {
            const touch = changed.item(i);
            let fireOnFrame = time.frameCount + 1;

            var existingTouch = find(this._touchData, (d) => { return d.fingerIndex === touch.identifier; });
            existingTouch.state.setUpFrame(fireOnFrame);
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(touch.pageX, touch.pageY);

            if (this.debugLevel >= 1) {
                console.log("touch " + touch.identifier + " end. fireInputOnFrame: " + fireOnFrame);
            }
        }
    }

    private _handleTouchCancel(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        const changed = event.changedTouches;
        
        for (var i = 0; i < changed.length; i++) {
            // Handle a canceled touche the same as a touch end.
            const touch = changed.item(i);
            let fireOnFrame = time.frameCount + 1;

            var existingTouch = find(this._touchData, (d) => { return d.fingerIndex === touch.identifier; });
            existingTouch.state.setUpFrame(fireOnFrame);
            existingTouch.clientPos = new Vector2(touch.clientX, touch.clientY);
            existingTouch.pagePos = new Vector2(touch.pageX, touch.pageY);
            existingTouch.screenPos = this._calculateScreenPos(touch.pageX, touch.pageY);

            if (this.debugLevel >= 1) {
                console.log("touch " + touch.identifier + " canceled. fireInputOnFrame: " + fireOnFrame);
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
    Mouse = "mouse",
    Touch = "touch",
}

export enum MouseButtonId {
    Left = 0,
    Middle = 1,
    Right = 2,
}

class InputState {
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
}

interface TouchData {
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