import { ArgEvent } from '../../common/Events';
import { Vector2 } from 'three';
import { time } from './Time';
import { some } from 'lodash';

export class Input {
    public contextMenuEnabled: boolean = true;

    // Events
    public onPointerDown = new ArgEvent<PointerEvent>();
    public onPointerUp = new ArgEvent<PointerEvent>();
    public onContextMenu = new ArgEvent<MouseEvent>();

    private _element: HTMLElement;
    private _initialized: boolean = false;
    private _pointerDownFrame: number = -1;
    private _pointerDownEvent: PointerEvent;
    private _pointerUpFrame: number = -1;
    private _pointerUpEvent: PointerEvent;
    private _pointerHeld: boolean = false;
    private _pointerScreenPos: Vector2 = new Vector2(0, 0);
    private _contextMenuFrame: number = -1;
    private _contextMenuEvent: MouseEvent;

    private _pointerDownHandler: any;
    private _pointerUpHandler: any;
    private _pointerMoveHandler: any;
    private _contextMenuHandler: any;

    /**
     * Returns true the frame that the pointer was pressed down.
     */
    public getPointerDown(): boolean { return this._validThisFrame(this._pointerDownFrame); }

    /**
     * Return the last pointer down event.
     */
    public getPointerDownEvent(): PointerEvent { return this._pointerDownEvent; }

    /**
     * Returns true the frame that the pointer was released.
     */
    public getPointerUp(): boolean { return this._validThisFrame(this._pointerUpFrame); }

    /**
     * Return the last pointer up event.
     */
    public getPointerUpEvent(): PointerEvent { return this._pointerUpEvent; }

    /**
     * Retruns true every frame the pointer is held down.
     */
    public getPointerHeld(): boolean { return this._pointerHeld; } 

    /**
     * Return the last known screen position of the pointer.
     */
    public getPointerScreenPos(): Vector2 { return this._pointerScreenPos; }

    /**
     * Returns true the frame that the context menu is invoked.
     */
    public getContextMenu() { return this._validThisFrame(this._contextMenuFrame); }

    /**
     * Return the last context menu event.
     */
    public getContextMenuEvent(): MouseEvent { return this._contextMenuEvent; }
    
    /**
     * Calculates the Three.js screen position of the mouse from the given mouse event.
     * Unlike viewport positions, Three.js screen positions go from -1 to +1.
     * @param event The mouse event to get the viewport position out of.
     * @param view The HTML element that we want the position to be relative to.
     */
    public static screenPosition(event: MouseEvent, view: HTMLElement) {
        const globalPos = new Vector2(event.pageX, event.pageY);
        const viewRect = view.getBoundingClientRect();
        const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        return new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
    }

    /**
     * Measures the distance between the two mouse events in pixels.
     * @param first The first mouse event.
     * @param second The second mouse event.
     */
    public static mouseDistance(first: MouseEvent, second: MouseEvent) {
      const pos1 = new Vector2(first.pageX, first.pageY);
      const pos2 = new Vector2(second.pageX, second.pageY);
      return pos1.distanceTo(pos2);
    }

    /**
     * Determines if the mouse is directly over the given HTML element.
     * @param event The event to test.
     * @param element The HTML element to test against.
     */
    public static eventIsDirectlyOverElement(event: MouseEvent, element:HTMLElement): boolean {
      const mouseOver = document.elementFromPoint(event.clientX, event.clientY);
      return mouseOver === element;
    }

    /**
     * Determines if the mouse is over the given element.
     * @param event The event to test.
     * @param element The HTML element to test against.
     */
    public static eventIsOverElement(event: MouseEvent, element:HTMLElement): boolean {
      const elements = document.elementsFromPoint(event.clientX, event.clientY);
      return some(elements, e => e === element);
    }

    public init(element:HTMLElement) {
        if (this._initialized) return;

        console.log("[Input] initialize");
        this._initialized = true;
        this._element = element;

        this._pointerDownHandler = this._handlePointerDown.bind(this);
        this._pointerUpHandler = this._handlePointerUp.bind(this);
        this._pointerMoveHandler = this._handlePointerMove.bind(this);
        this._contextMenuHandler = this._handleContextMenu.bind(this);
        
        this._element.addEventListener('pointerdown', this._pointerDownHandler);
        this._element.addEventListener('pointerup', this._pointerUpHandler);
        this._element.addEventListener('pointermove', this._pointerMoveHandler);
        this._element.addEventListener('contextmenu', this._contextMenuHandler);

        requestAnimationFrame(() => this._update());
    }

    public terminate() {
        if (!this._initialized) return;

        console.log("[Input] terminate");
        this._initialized = false;

        // Reset state of all pointer values.
        this._pointerDownFrame = -1;
        this._pointerUpFrame = -1;
        this._pointerHeld = false;
        this._pointerScreenPos = new Vector2(0, 0);
        this._contextMenuFrame = -1;
        
        // Reset last events.
        this._contextMenuEvent = null;
        this._pointerUpEvent = null;
        this._pointerDownEvent = null;

        this._element.removeEventListener('pointerdown', this._pointerDownHandler);
        this._element.removeEventListener('pointermove', this._pointerMoveHandler);
        this._element.removeEventListener('pointerup', this._pointerUpHandler);
        this._element.removeEventListener('contextmenu', this._contextMenuHandler);

        this._pointerDownHandler = null;
        this._pointerUpHandler = null;
        this._pointerMoveHandler = null;
        this._contextMenuHandler = null;

        this._element = null;
    }

    private _update() {
        if (!this._initialized) return;

        // console.log("input update frame: " + time.frameCount);

        requestAnimationFrame(() => this._update());
    }

    private _validThisFrame(frame: number): boolean {
        const curFrame = time.frameCount - 1;

        if (curFrame >= 0) {
            return frame === curFrame;
        }

        return false;
    }

    private _handlePointerDown(event:PointerEvent) {
        if (!event.isPrimary)
            return;

        this._pointerDownFrame = time.frameCount;
        this._pointerDownEvent = event;
        this._pointerHeld = true;
        this.onPointerDown.invoke(event);
    }

    private _handlePointerUp(event:PointerEvent) {
        if (!event.isPrimary) return;

        this._pointerUpFrame = time.frameCount;
        this._pointerUpEvent = event;
        this._pointerHeld = false;
        this.onPointerUp.invoke(event);
    }

    private _handlePointerMove(event:PointerEvent) {
        if (!event.isPrimary) return; 

        // Calculates the Three.js screen position of the pointer from the given pointer event.
        // Unlike viewport positions, Three.js screen positions go from -1 to +1.
        const globalPos = new Vector2(event.pageX, event.pageY);
        const viewRect = this._element.getBoundingClientRect();
        const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        this._pointerScreenPos = new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
    }

    private _handleContextMenu(event: MouseEvent) {
        if (!this.contextMenuEnabled) return;

        // console.log("[Input] on context menu");
        this._contextMenuFrame = time.frameCount;
        this._contextMenuEvent = event;
        this.onContextMenu.invoke(event);
    }
}

/**
 * Instance of input class.
 */
export const input = new Input();