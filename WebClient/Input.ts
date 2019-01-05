import { Vector3, Vector2, Intersection, Mesh, Group, Raycaster, Camera, Object3D } from "three";
import { vg } from "von-grid";
import {
  SubscriptionLike,
  Observable,
  fromEvent,
  combineLatest,
  merge,
} from 'rxjs';
import {
  filter,
  map,
  tap,
  scan,
} from 'rxjs/operators';
import { some } from 'lodash';

import { File, Workspace } from 'common/Files';

/**
 * Defines a ray.
 */
export interface Ray {
  /**
   * The starting point of the ray.
   */
  origin: Vector3;

  /**
   * The direction that the ray travels in.
   */
  direction: Vector3;
}

/**
 * Defines the result of a raycast.
 */
export interface RaycastTest {
  /**
   * The screen position used to perform this raycast.
   */
  mouse: Vector2;

  /**
   * The list of intersections from the raycast.
   */
  intersects: Intersection[];
}

/**
 * Defines an interface that groups Three.js related information
 * with the object/workspace data that they represent.
 */
export interface File3D {
  /**
   * The 3D mesh that represents the file.
   */
  mesh: Mesh | Group;

  /**
   * The optional surface used for workspaces.
   * Surfaces are simply the special decoration that a workspace displays so that 
   * objects appear to be placed on them. Their only use is for visuals.
   */
  surface: vg.Board | null;

  /**
   * The grid that is used to position objects on top of workspaces.
   * Grids are only visible while the user is dragging an object.
   */
  grid: vg.Board | null;

  /**
   * The file (workspace or object) that this object represents.
   */
  file: File;
}

/**
 * Defines an interface that represents a detected edge in a signal.
 */
export interface DetectedEdge {
  /**
   * Whether the signal is currently active.
   */
  active: boolean;

  /**
   * Did the signal just go from inactive to active?
   */
  started: boolean;

  /**
   * Did the signal just go from active to inactive?
   */
  ended: boolean;

  /**
   * The time that the signal changed from inactive to active.
   */
  startTime: number | null;

  /**
   * The time that the signal changed from active to inactive.
   */
  endTime: number | null;
}

/**
 * Defines an interface for a mouse event wrapper.
 */
export interface EventWrapper {
  /**
   * The mouse event that this event was built from.
   */
  event: MouseEvent;
}

/**
 * Defines an interface for a mouse drag event.
 * Can indicate whether the mouse is being dragged or clicked
 * in addition to whether the mouse is currently being pressed.
 */
export interface MouseDrag extends EventWrapper {
  /**
   * Whether the mouse is currently being pressed.
   */
  isActive: boolean;
  
  /**
   * Did the mouse button start getting held down on this frame?
   */
  justStartedClicking: boolean;

  /**
   * The time that the mouse started dragging.
   */
  startDragTime: number;

  /**
   * Did the mouse button get released on this frame?
   */
  justEndedClicking: boolean;

  /**
   * The time that the mouse stopped dragging.
   */
  endDragTime: number;
  
  /**
   * The mouse event that started the drag events.
   */
  startClickEvent: MouseEvent;  

  /**
   * Does this event represent a mouse click?
   */
  isClicking: boolean;
  
  /**
   * Does this event represent a mouse drag?
   */
  isDragging: boolean;
}

/**
 * Defines an interface that represents a mouse drag/click event that has been mapped to a position.
 */
export interface MouseDragPosition extends MouseDrag {
  /**
   * The ray that can be used to raycast this mouse drag into the world.
   */
  ray: Ray;

  /**
   * The screen position that the mouse is currently over.
   * Goes from -1 to +1 like Three.js requires. To get the viewport position, just divide by 2 and add 0.5.
   */
  screenPos: Vector2;
}

/**
 * Defines an interface that represents a mouse drag/click that has been mapped to a raycast intersection.
 */
export interface DraggedObject extends MouseDragPosition {
  /**
   * The first intersection that occurred.
   */
  hit: Intersection;
}

/**
 * Defines an interface that represents a mouse drag that has been mapped to a workspace.
 */
export interface DragOperation extends DraggedObject {
  /**
   * The workspace that the mouse drag hit.
   */
  workspace: File3D;
}

/**
 * Defines an interface that represents a mouse click that has been mapped to a file.
 */
export interface ClickOperation extends DraggedObject {
  /**
   * The file or workspace that was clicked.
   */
  file: File3D;

  /**
   * The result of the raycast used to find the file.
   */
  raycast: RaycastTest;
}

/**
 * Defines an interface that represents the action of showing/hiding a context menu.
 */
export interface ContextMenuEvent extends EventWrapper {

  /**
   * Whether the context menu should be visible.
   */
  shouldBeVisible: boolean;
}

/**
 * Defines an interface that represents the action of showing/hiding a context menu with respect to a file.
 */
export interface ContextMenuOperation extends ContextMenuEvent {
  /**
   * The file or workspace that was clicked.
   */
  file: File3D;
}

/**
 * An observable that resolves whenever the document 'contextmenu' event triggers.
 */
export const contextMenu = fromEvent<MouseEvent>(document, 'contextmenu');

/**
 * An observable that resolves whenever the document 'mouseup' event triggers.
 */
export const mouseUp = fromEvent<MouseEvent>(document, 'mouseup');

/**
 * An observable that resolves whenever the document 'mousedown' event triggers.
 */
export const mouseDown = fromEvent<MouseEvent>(document, 'mousedown');

/**
 * An observable that resolves whenever the document 'mousemove' event triggers.
 */
export const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');

/**
 * An observable that resolves whenever the left mouse button changes its active state.
 */
export const leftClickActive = buttonActive(0);

/**
 * An observable that resolves whenever the right mouse button changes its active state.
 */
export const rightClickActive = buttonActive(2);

/**
 * An observable that maps the left mouse button into mouse drag events.
 */
export const leftDrag = buttonDrag(leftClickActive);

/**
 * An observable that maps the right mouse button into mouse drag events.
 */
export const rightDrag = buttonDrag(rightClickActive);

/**
 * An observable that maps the context menu events and left/right click events to show/hide events.
 */
export const showHideContextMenu = contextMenuEvents(contextMenu, mouseDown);

/**
 * Filters the given mouse event observable based on whether it matches the given button number.
 * @param observable The observable list of mouse events to filter.
 * @param button The number of the button to match. (0 = left mouse button, 1 = middle mouse button, etc.)
 */
export function isButton(observable: Observable<MouseEvent>, button: number): Observable<MouseEvent> {
  return observable.pipe(
    filter(e => e.button === button)
  );
}

/**
 * Gets a new observable that resolves whenever the given button changes its active state.
 * @param The number of the button to watch. (0 = left mouse button, 1 = middle mouse button, etc.)
 */
export function buttonActive(button: number): Observable<boolean> {
  const clickUp = isButton(mouseUp, button);
  const clickDown = isButton(mouseDown, button);

  const active = combineLatest(
    clickUp,
    clickDown,
    (e1, e2) => e2.timeStamp > e1.timeStamp
  );

  return active;
}

/**
 * Returns an observable that is able to signal
 * when the given observable goes from false to true values (rising edge)
 * and also when it goes from true back to false. (falling edge)
 * @param observable The observable to use.
 */
export function detectEdges(observable: Observable<boolean>): Observable<DetectedEdge> {
  return observable.pipe(
    map(a => ({
      active: a,
      started: false,
      ended: false,
      startTime: null,
      endTime: null
    })),
    scan((prev, curr) => {
      if (!prev.active && curr.active) {
        return {
          active: curr.active,
          started: true,
          ended: false,
          startTime: Date.now(),
          endTime: null
        };
      } else if (prev.active && !curr.active) {
        return {
          active: curr.active,
          started: false,
          ended: true,
          startTime: curr.startTime,
          endTime: Date.now()
        };
      } else {
        return {
          ...curr,
          started: false,
          ended: false
        };
      }
    }, { active: false, started: false, ended: false, startTime: <number>null, endTime: <number>null }),
  );
}

/**
 * Measures the distance between the two mouse events in pixels.
 * @param first The first mouse event.
 * @param second The second mouse event.
 */
export function mouseDistance(first: MouseEvent, second: MouseEvent) {
  const pos1 = new Vector2(first.pageX, first.pageY);
  const pos2 = new Vector2(second.pageX, second.pageY);
  return pos1.distanceTo(pos2);
}

/**
 * Creates an observable that is able to determine whether the mouse is currently clicking or dragging an object in realtime.
 * Works such that when isClicking is true, isDragging is false and vice-versa.
 * @param active An observable that determines whether the target mouse button is active or not.
 */
export function buttonDrag(active: Observable<boolean>): Observable<MouseDrag> {
  active = combineLatest(
    active,
    mouseMove,
    (active) => active
  );
  const dragging = detectEdges(active);
  return combineLatest(
    dragging,
    mouseMove,
    (active, mouse) => ({
      isActive: active.active,
      justStartedClicking: active.started,
      startDragTime: active.startTime,
      justEndedClicking: active.ended,
      endDragTime: active.endTime,
      event: mouse,
      startClickEvent: null
    })
  ).pipe(
    scan((prev, curr) => {
      if (curr.justStartedClicking) {
        return {
          ...curr,
          startClickEvent: curr.event
        }
      } else {
        return {
          ...curr,
          startClickEvent: prev.startClickEvent
        };
      }
    }, {
        isActive: false,
        justStartedClicking: false,
        startDragTime: <number>null,
        justEndedClicking: false,
        endDragTime: <number>null,
        event: null,
        startClickEvent: null
      }),
    map(event => {
      const wasDragging = event.startClickEvent && mouseDistance(event.startClickEvent, event.event) > 10;
      const isDragging = event.isActive && wasDragging;
      const isClicking = !isDragging && !wasDragging && event.justEndedClicking;
      return {
        ...event,
        isDragging,
        isClicking
      }
    })
  );
}

/**
 * Calculates the Three.js screen position of the mouse from the given mouse event.
 * Unlike viewport positions, Three.js screen positions go from -1 to +1.
 * @param event The mouse event to get the viewport position out of.
 * @param view The HTML element that we want the position to be relative to.
 */
export function screenPosition(event: MouseEvent, view: HTMLElement) {
  const globalPos = new Vector2(event.pageX, event.pageY);
  const viewRect = view.getBoundingClientRect();
  const viewPos = globalPos.sub(new Vector2(viewRect.left, viewRect.top));
  return new Vector2((viewPos.x / viewRect.width) * 2 - 1, -(viewPos.y / viewRect.height) * 2 + 1);
}

/**
 * Performs a raycast at the given screen position with the given camera using the given raycaster and against the given objects.
 * @param pos The screen position to raycast from.
 * @param raycaster The raycaster to use.
 * @param objects The objects to raycast against.
 * @param camera The camera to use.
 */
export function raycastAtScreenPos(pos: Vector2, raycaster: Raycaster, objects: Object3D[], camera: Camera): RaycastTest {
  raycaster.setFromCamera(pos, camera);
  const intersects = raycaster.intersectObjects(objects, true);

  return {
    mouse: pos,
    intersects
  };
}

/**
 * Returns the first intersection from the raycast test. If none exist, then null is returned.
 */
export function firstRaycastHit(test: RaycastTest) {
  return test.intersects.length > 0 ? test.intersects[0] : null;
}

/**
 * Calculates a ray from the given screen position and camera.
 * @pos The screen position that the ray should use for its direction vector.
 * @camera The camera that the ray should point from.
 */
export function screenPosToRay(pos: Vector2, camera: Camera) {
  const v3d = new Vector3(pos.x, pos.y, 0.5);

  v3d.unproject(camera);

  v3d.sub(camera.position);
  v3d.normalize();

  return {
    origin: camera.position,
    direction: v3d
  };
}

/**
 * Gets a point that is the given distance along the given ray.
 * @param ray The ray.
 * @param distance The distance along the ray from the origin.
 */
export function pointOnRay(ray: Ray, distance: number): Vector3 {
  let pos = new Vector3(ray.direction.x, ray.direction.y, ray.direction.z);
  pos.multiplyScalar(distance);
  pos.add(ray.origin);

  return pos;
}

/**
 * Calculates the point at which the given ray intersects the given plane.
 * If the ray does not intersect the plane then null is returned.
 * @param ray The ray.
 * @param plane The plane that the ray should test against.
 */
export function pointOnPlane(ray: Ray, plane: Mesh): Vector3 | null {
  const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
  const hits = raycaster.intersectObject(plane, true);
  return hits.length > 0 ? hits[0].point : null;
}

/**
 * Determines if the mouse is directly over the given HTML element.
 * @param event The event to test.
 * @param element The HTML element to test against.
 */
export function eventIsDirectlyOverElement(event: MouseEvent, element: HTMLElement): boolean {
  const mouseOver = document.elementFromPoint(event.clientX, event.clientY);
  return mouseOver === element;
}

/**
 * Determines if the mouse is over the given element.
 * @param event The event to test.
 * @param element The HTML element to test against.
 */
export function eventIsOverElement(event: MouseEvent, element: HTMLElement): boolean {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  return some(elements, e => e === element);
}

/**
 * Disables the right-click context menu within the given element.
 * @param element The element that the context menu request has to be in.
 */
export function disableContextMenuWithin(element: HTMLElement): SubscriptionLike {
  return contextMenu.pipe(
    filter(e => eventIsOverElement(e, element)),
    tap(e => e.preventDefault())
  ).subscribe();
}

function contextMenuEvents(contextMenu: Observable<MouseEvent>, others: Observable<MouseEvent>): Observable<ContextMenuEvent> {
  return merge(
    contextMenu.pipe(map(e => ({ event: e, shouldBeVisible: true }))),
    others.pipe(map(e => ({ event: e, shouldBeVisible: false }))),
  );
}