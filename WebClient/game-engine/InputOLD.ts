import { Ray, Vector3, Vector2, Intersection, Mesh, Group, Raycaster, Camera, Object3D } from "three";
import { DetectedEdge, MouseDrag, ContextMenuEvent } from './Interfaces';
import { Physics } from './Physics';
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
import { Input } from "./input";

/**
 * An observable that resolves whenever the document 'mouseup' event triggers.
 */
// export const mouseUp = fromEvent<MouseEvent>(document, 'mouseup');

/**
 * An observable that resolves whenever the document 'mousedown' event triggers.
 */
// export const mouseDown = fromEvent<MouseEvent>(document, 'mousedown');

/**
 * An observable that resolves whenever the document 'mousemove' event triggers.
 */
// export const mouseMove = fromEvent<MouseEvent>(document, 'mousemove');

/**
 * An observable that resolves whenever the left mouse button changes its active state.
 */
// export const leftClickActive = buttonActive(0);

/**
 * An observable that resolves whenever the right mouse button changes its active state.
 */
// export const rightClickActive = buttonActive(2);

/**
 * An observable that maps the left mouse button into mouse drag events.
 */
// export const leftDrag = buttonDrag(leftClickActive);

/**
 * An observable that maps the right mouse button into mouse drag events.
 */
// export const rightDrag = buttonDrag(rightClickActive);

/**
 * Filters the given mouse event observable based on whether it matches the given button number.
 * @param observable The observable list of mouse events to filter.
 * @param button The number of the button to match. (0 = left mouse button, 1 = middle mouse button, etc.)
 */
// export function isButton(observable: Observable<MouseEvent>, button: number): Observable<MouseEvent> {
//   return observable.pipe(
//     filter(e => e.button === button)
//   );
// }

/**
 * Gets a new observable that resolves whenever the given button changes its active state.
 * @param The number of the button to watch. (0 = left mouse button, 1 = middle mouse button, etc.)
 */
// export function buttonActive(button: number): Observable<boolean> {
//   const clickUp = isButton(mouseUp, button);
//   const clickDown = isButton(mouseDown, button);

//   const active = combineLatest(
//     clickUp,
//     clickDown,
//     (e1, e2) => e2.timeStamp > e1.timeStamp
//   );

//   return active;
// }

/**
 * Returns an observable that is able to signal
 * when the given observable goes from false to true values (rising edge)
 * and also when it goes from true back to false. (falling edge)
 * @param observable The observable to use.
 */
// export function detectEdges(observable: Observable<boolean>): Observable<DetectedEdge> {
//   return observable.pipe(
//     map(a => ({
//       active: a,
//       started: false,
//       ended: false,
//       startTime: null,
//       endTime: null
//     })),
//     scan((prev, curr) => {
//       if (!prev.active && curr.active) {
//         return {
//           active: curr.active,
//           started: true,
//           ended: false,
//           startTime: Date.now(),
//           endTime: null
//         };
//       } else if (prev.active && !curr.active) {
//         return {
//           active: curr.active,
//           started: false,
//           ended: true,
//           startTime: curr.startTime,
//           endTime: Date.now()
//         };
//       } else {
//         return {
//           ...curr,
//           started: false,
//           ended: false
//         };
//       }
//     }, { active: false, started: false, ended: false, startTime: <number>null, endTime: <number>null }),
//   );
// }

/**
 * Creates an observable that is able to determine whether the mouse is currently clicking or dragging an object in realtime.
 * Works such that when isClicking is true, isDragging is false and vice-versa.
 * @param active An observable that determines whether the target mouse button is active or not.
 */
// export function buttonDrag(active: Observable<boolean>): Observable<MouseDrag> {
//   active = combineLatest(
//     active,
//     mouseMove,
//     (active) => active
//   );
//   const dragging = detectEdges(active);
//   return combineLatest(
//     dragging,
//     mouseMove,
//     (active, mouse) => ({
//       isActive: active.active,
//       justStartedClicking: active.started,
//       startDragTime: active.startTime,
//       justEndedClicking: active.ended,
//       endDragTime: active.endTime,
//       event: mouse,
//       startClickEvent: null
//     })
//   ).pipe(
//     scan((prev, curr) => {
//       if (curr.justStartedClicking) {
//         return {
//           ...curr,
//           startClickEvent: curr.event
//         }
//       } else {
//         return {
//           ...curr,
//           startClickEvent: prev.startClickEvent
//         };
//       }
//     }, {
//         isActive: false,
//         justStartedClicking: false,
//         startDragTime: <number>null,
//         justEndedClicking: false,
//         endDragTime: <number>null,
//         event: null,
//         startClickEvent: null
//       }),
//     map(event => {
//       const wasDragging = event.startClickEvent && Input.mouseDistance(event.startClickEvent, event.event) > 10;
//       const isDragging = (event.isActive || event.justEndedClicking) && wasDragging;
//       const isClicking = !isDragging && !wasDragging && event.justEndedClicking;
//       return {
//         ...event,
//         isDragging,
//         isClicking
//       }
//     })
//   );
// }
// }