import { ArgEvent } from '../../common/Events';
import { Vector2 } from 'three';
import { time } from './Time';
import { some } from 'lodash';

export class Input {
    public contextMenuEnabled: boolean = true;

    // Events
    public pointerDownEvent = new ArgEvent<PointerEvent>();
    public pointerUpEvent = new ArgEvent<PointerEvent>();
    public contextMenuEvent = new ArgEvent<MouseEvent>();

    private _element: HTMLElement;
    private _initialized: boolean = false;
    private _pointerDownFrame: number = -1;
    private _pointerUpFrame: number = -1;
    private _pointerHeld: boolean = false;
    private _pointerScreenPos: Vector2 = new Vector2(0, 0);
    private _contextMenu: boolean = false;

    private _pointerDownHandler: any;
    private _pointerUpHandler: any;
    private _pointerMoveHandler: any;
    private _contextMenuHandler: any;

    /**
     * Returns true the frame that the pointer was pressed down.
     */
    public getPointerDown(): boolean { return this._pointerDownFrame === time.frameCount; }

    /**
     * Returns true the frame that the pointer was released.
     */
    public getPointerUp(): boolean { return this._pointerUpFrame === time.frameCount; }

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
    public getContextMenu() { return this._contextMenu; }
    
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

        this._pointerDownHandler = this.onPointerDown.bind(this);
        this._pointerUpHandler = this.onPointerUp.bind(this);
        this._pointerMoveHandler = this.onPointerMove.bind(this);
        this._contextMenuHandler = this.onContextMenu.bind(this);
        
        this._element.addEventListener('pointerdown', this._pointerDownHandler);
        this._element.addEventListener('pointerup', this._pointerUpHandler);
        this._element.addEventListener('pointermove', this._pointerMoveHandler);
        this._element.addEventListener('contextmenu', this._contextMenuHandler);

        requestAnimationFrame(() => this.update());
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
        this._contextMenu = false;

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

    private update() {
        if (!this._initialized) return;

        requestAnimationFrame(() => this.update());
    }

    private onPointerDown(event:PointerEvent) {
        if (!event.isPrimary)
            return;

        this._pointerDownFrame = time.frameCount;
        this._pointerHeld = true;
        this.pointerDownEvent.invoke(event);
    }

    private onPointerUp(event:PointerEvent) {
        if (!event.isPrimary) return;

        this._pointerUpFrame = time.frameCount;
        this._pointerHeld = false;
        this.pointerUpEvent.invoke(event);
    }

    private onPointerMove(event:PointerEvent) {
        if (!event.isPrimary) return; 

        // Calculates the Three.js screen position of the pointer from the given pointer event.
        // Unlike viewport positions, Three.js screen positions go from -1 to +1.
        const globalPos = new Vector2(event.pageX, event.pageY);
        const viewRect = this._element.getBoundingClientRect();
        const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
        this._pointerScreenPos = new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
    }

    private onContextMenu(event: MouseEvent) {
        if (!this.contextMenuEnabled) return;

        // console.log("[Input] on context menu");
        this.contextMenuEvent.invoke(event);
    }
}

/**
 * Instance of input class.
 */
export const input = new Input();