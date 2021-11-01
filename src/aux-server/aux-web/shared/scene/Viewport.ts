import { Vector2 } from '@casual-simulation/three';
import { Subject, Observable, SubscriptionLike } from 'rxjs';

export class Viewport {
    /**
     * Optional name to give this viewport for identification.
     */
    name: string = null;

    /**
     * The layer that this viewport is assigned to.
     * Layer values are used by systems like Input to sort Viewports for hit detection.
     */
    layer: number = 0;

    private _origin: Vector2 = new Vector2(0, 0);
    private _size: Vector2 = new Vector2(0, 0);
    private _scale: Vector2 = new Vector2(1, 1);
    private _parent: Viewport = null;
    private _rootElement: HTMLElement = null;
    private _onUpdated: Subject<Viewport> = new Subject<Viewport>();
    private _parentSub: SubscriptionLike;
    private _targetElement: HTMLElement = null;

    get targetElement() {
        return this._targetElement;
    }

    /**
     * Sets the element that the viewport is representing.
     * Null if the viewport doesn't represent a specific element or if it represents the root element.
     * Useful for specifying a passthrough target for viewports.
     */
    set targetElement(element: HTMLElement) {
        this._targetElement = element;
    }

    get x(): number {
        return this._origin.x;
    }

    get y(): number {
        return this._origin.y;
    }

    get width(): number {
        return this._size.x;
    }

    get height(): number {
        return this._size.y;
    }

    /**
     * Event that gets fired when the viewport is updated.
     */
    get onUpdated(): Observable<Viewport> {
        return this._onUpdated;
    }

    /**
     * Create a new viewport with which to render through.
     * @param name - Optional name to give the viewport for identification.
     * @param parent - The parent viewport or html element of this viewport. If no parent, the viewport will inherit the size of the window.
     */
    constructor(name?: string, parent?: Viewport, rootElement?: HTMLElement) {
        this._onParentViewportUpdated =
            this._onParentViewportUpdated.bind(this);

        if (name) {
            this.name = name;
        }

        this.setParent(parent);
        this.setRootElement(rootElement);
        this.updateViewport();
    }

    /**
     * The parent viewport or html element of this viewport.
     */
    getParent(): Viewport | null {
        if (this._parent) {
            return this._parent;
        }
        return null;
    }

    /**
     * The parent viewport or html element of this viewport. If no parent, the viewport will inherit the size of the window.
     */
    setParent(parent?: Viewport) {
        if (this._parentSub) {
            this._parentSub.unsubscribe();
            this._parentSub = null;
        }

        if (parent) {
            this._parent = parent;
        }

        if (this._parent && this._parent instanceof Viewport) {
            this._parentSub = this._parent.onUpdated.subscribe(
                this._onParentViewportUpdated
            );
        }

        this.updateViewport();
    }

    getRootElement(): HTMLElement {
        if (!this._parent) {
            return this._rootElement;
        } else {
            return this._parent.getRootElement();
        }
    }

    setRootElement(newRootElement: HTMLElement) {
        if (!this._parent) {
            if (this._rootElement) {
                if (newRootElement) {
                    // Replacing existing root element.
                    this._rootElement = newRootElement;
                }
            } else {
                if (newRootElement) {
                    // Setting root element.
                    this._rootElement = newRootElement;
                } else {
                    console.error(
                        'Viewport with no parent should provided a valid root html element.',
                        this
                    );
                }
            }
        } else {
            this._parent.setRootElement(newRootElement);
        }
    }

    /**
     * The lower left origin of the viewport (in pixels).
     */
    getOrigin(): Vector2 {
        return this._origin.clone();
    }

    /**
     * The lower left origin of the viewport (in pixels).
     */
    setOrigin(x?: number, y?: number) {
        let changed = false;
        if (x != null && x != undefined && this._origin.x !== x) {
            this._origin.x = x;
            changed = true;
        }
        if (y != null && y != undefined && this._origin.y !== y) {
            this._origin.y = y;
            changed = true;
        }

        if (changed) {
            this.updateViewport();
        }
    }

    /**
     * The width and height of the viewport (in pixels).
     */
    getSize(): Vector2 {
        return this._size.clone();
    }

    /**
     * The width and height of the viewport (in pixels).
     */
    setSize(x?: number, y?: number) {
        let changed = false;
        if (x != null && x != undefined && this._size.x !== x) {
            this._size.x = x;
            changed = true;
        }
        if (y != null && y != undefined && this._size.y !== y) {
            this._size.y = y;
            changed = true;
        }

        if (changed) {
            this.updateViewport();
        }
    }

    /**
     * The scale of the viewport in relation to its parent.
     */
    getScale(): Vector2 {
        return this._scale.clone();
    }

    /**
     * The scale of the viewport in relation to its parent.
     */
    setScale(x?: number, y?: number) {
        let changed = false;
        if (x != null && x != undefined && this._scale.x !== x) {
            this._scale.x = x;
            changed = true;
        }
        if (y != null && y != undefined && this._scale.y !== y) {
            this._scale.y = y;
            changed = true;
        }

        if (changed) {
            this.updateViewport();
        }
    }

    /**
     * Updates the viewports size.
     */
    updateViewport(): void {
        if (this._parent instanceof Viewport) {
            // Inherit size.
            this._size = this._parent._size.clone();
        }

        // Scale the size.
        this._size.x *= this._scale.x;
        this._size.y *= this._scale.y;

        this._onUpdated.next(this);
    }

    private _onParentViewportUpdated(viewport: Viewport): void {
        this.updateViewport();
    }
}
