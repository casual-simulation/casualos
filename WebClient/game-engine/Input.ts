import { ArgEvent } from '../../common/Events';
import { Vector2 } from 'three';
import { time } from './Time';
import { find, findIndex, keys, some } from 'lodash';

export class Input {
    /**
     * Debug level for Input class.
     * 0: Disabled, 1: Down/Up events, 2: Move events
     */
    public debugLevel: number = 2;

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
            leftButton: { button: MouseButtonId.Left, lastStateChangeFrame: -1, state: InputState.Idle },
            rightButton: { button: MouseButtonId.Right, lastStateChangeFrame: -1, state: InputState.Idle },
            middleButton: { button: MouseButtonId.Middle, lastStateChangeFrame: -1, state: InputState.Idle },
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
        this._contextMenuHandler = this._handleContextMenu.bind(this);
        
        this._element.addEventListener('mousedown', this._mouseDownHandler);
        this._element.addEventListener('mousemove', this._mouseMoveHandler);
        this._element.addEventListener('mouseup', this._mouseUpHandler);
        this._element.addEventListener('touchstart', this._touchStartHandler);
        this._element.addEventListener('touchmove', this._touchMoveHandler);
        this._element.addEventListener('touchend', this._touchEndHandler);
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
        this._element.removeEventListener('contextmenu', this._contextMenuHandler);

        this._mouseDownHandler = null;
        this._mouseMoveHandler = null;
        this._mouseUpHandler = null;
        this._touchStartHandler = null;
        this._touchMoveHandler = null;
        this._touchEndHandler = null;

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
     */
    public getMouseButtonDown(buttonId: MouseButtonId): boolean { 
        if (this._inputType == InputType.Mouse) {
            const buttonData = this._getMouseButtonData(buttonId);
            if (buttonData && buttonData.state === InputState.Down) {
                return this._frameMatches(buttonData.lastStateChangeFrame);
            }
        } else if (this._inputType == InputType.Touch) {
            // var dataIndex = findIndex(this._touchData, (d) => { return d.event.button === button && d.state === InputState.Down } );
            // return dataIndex !== -1 ? this._frameMatches(this._touchData[dataIndex].lastStateChangeFrame) : false;
        }
    }

    /**
     * Returns true the frame that the button was released.
     */
    public getMouseButtonUp(buttonId: MouseButtonId): boolean {
        if (this._inputType == InputType.Mouse) {
            const buttonData = this._getMouseButtonData(buttonId);
            if (buttonData && buttonData.state === InputState.Up) {
                return this._frameMatches(buttonData.lastStateChangeFrame);
            }
        } else if (this._inputType == InputType.Touch) {
            // var dataIndex = findIndex(this._touchData, (d) => { return d.event.button === button && d.state === InputState.Up } );
            // return dataIndex !== -1 ? this._frameMatches(this._touchData[dataIndex].lastStateChangeFrame) : false;
        }
    }

    /**
     * Retruns true every frame the button is held down.
     */
    public getMouseButtonHeld(buttonId: MouseButtonId): boolean { 
        if (this._inputType == InputType.Mouse) {
            const buttonData = this._getMouseButtonData(buttonId);
            if (buttonData && buttonData.state === InputState.Down) {
                return true;
            }
        } else if (this._inputType == InputType.Touch) {
            // var dataIndex = findIndex(this._touchData, (d) => { return d.event.button === button && d.state === InputState.Down } );
            // return dataIndex !== -1;
        }
    }

    /**
     * Return the last known screen position of the mouse.
     */
    public getMouseScreenPos(): Vector2 { 
        return this._mouseData.screenPos;
    }

    /**
     * Return the last known page position of the mouse.
     */
    public getMousePagePos(): Vector2 {
        return this._mouseData.pagePos;
    }

    private _update() {
        if (!this._initialized) return;

        // console.log("input update frame: " + time.frameCount);
        this._cullTouchData();

        requestAnimationFrame(() => this._update());
    }

    /**
     * Loop through all current pointer data and remove any that are no longer needed.
     */
    private _cullTouchData(): void {
        // Unlike the mouse, touch pointers are unique everytime they are pressed down on the screen.
        // Remove any touch pointers that are passed their 'Up' input state. No need to keep them around.
        // for (var i = this._touchData.length - 1; i >= 0; i--) {
        //     if (this._touchData[i].state == InputState.Up) {
        //         if (this._touchData[i].lastStateChangeFrame > time.frameCount) {
        //             console.log('removing touch pointer data id:' + this._touchData[i].id);
        //             this._touchData.splice(i, 1);
        //         }
        //     }
        // }
    }

    private _frameMatches(lastUpdateFrame: number): boolean {
        const curFrame = time.frameCount - 1;
        return (curFrame >= 0) ? (lastUpdateFrame === curFrame) : false;
    }

    /**
     * Returns the matching MouseButtonData object for the provided mouse button number.
     */
    private _getMouseButtonData(button: number): MouseButtonData {
        if (button == MouseButtonId.Left) return this._mouseData.leftButton;
        if (button == MouseButtonId.Right) return this._mouseData.rightButton;
        if (button == MouseButtonId.Middle) return this._mouseData.middleButton;
        
        console.warn("unsupported mouse button number: " + button);
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

        event.cancelBubble = true;
        this._inputType = InputType.Mouse;
        if (this.debugLevel >= 1) {
            console.log("mouse down:");
            console.log("  button: " + event.button);
        }
        
        let buttonData: MouseButtonData = this._getMouseButtonData(event.button);
        if (buttonData) {
            buttonData.lastStateChangeFrame = time.frameCount;
            buttonData.state = InputState.Down;

            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(event.pageX, event.pageY);

            if (this.debugLevel >= 1) console.log("mouse data: " + JSON.stringify(this._mouseData));
        }
    }

    private _handleMouseUp(event:MouseEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Mouse;
        if (this._inputType != InputType.Mouse) return;

        if (this.debugLevel >= 1) {
            console.log("mouse up:");
            console.log("  button: " + event.button);
        }
        
        let buttonData: MouseButtonData = this._getMouseButtonData(event.button);
        if (buttonData) {
            buttonData.lastStateChangeFrame = time.frameCount;
            buttonData.state = InputState.Up;

            this._mouseData.pagePos = new Vector2(event.pageX, event.pageY);
            this._mouseData.screenPos = this._calculateScreenPos(event.pageX, event.pageY);

            if (this.debugLevel >= 1) console.log("mouse data: " + JSON.stringify(this._mouseData));
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

        if (this.debugLevel >= 1) {
            console.log("touch start:");
            console.log("  count: " + event.touches.length);
        }
    }

    private _handleTouchMove(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;

        if (this.debugLevel >= 2) {
            console.log("touch move:");
            console.log("  count: " + event.touches.length);
        }

    }

    private _handleTouchEnd(event: TouchEvent) {
        if (this._inputType == InputType.Undefined) this._inputType = InputType.Touch;
        if (this._inputType != InputType.Touch) return;
        
        if (this.debugLevel >= 1) {
            console.log("touch end:");
            console.log("  count: " + event.touches.length);
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

enum InputState {
    Idle,
    Down,
    Up,
}

interface TouchData {

    /**
     * Current input state of the touch.
     */
    state: InputState;

    /**
     * The last frame that the pointer changed state.
     */
    lastStateChangeFrame: number;

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
     * Data for left mouse button.
     */
    leftButton: MouseButtonData;

    /**
     * Data for right mouse button.
     */
    rightButton: MouseButtonData;

    /**
     * Data for middle mouse button.
     */
    middleButton: MouseButtonData;

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
 * Individual mouse button data.
 */
interface MouseButtonData {
    /**
     * Mouse button this data represents.
     */
    button: MouseButtonId

    /**
     * Current input state of the button.
     */
    state: InputState;

    /**
     * The last frame that the button changed state.
     */
    lastStateChangeFrame: number;
}

/**
 * Instance of input class.
 */
export const input = new Input();