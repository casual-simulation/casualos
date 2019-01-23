import { Ray, Vector3, Vector2, Intersection, Mesh, Group } from "three";
import { vg } from "von-grid";
import { File, Workspace } from 'common/Files';
import { Physics } from './Physics';
import { WorkspaceMesh } from "./WorkspaceMesh";
import { FileMesh } from "./FileMesh";
  
  
  
  /**
   * Defines an interface that groups Three.js related information
   * with the object/workspace data that they represent.
   */
  export interface File3D {
    /**
     * The 3D mesh that represents the file.
     */
    mesh: FileMesh | WorkspaceMesh;
  
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
   * Defines an interface for a mouse drag event.
   * Can indicate whether the mouse is being dragged or clicked
   * in addition to whether the mouse is currently being pressed.
   */
  export interface MouseDrag {
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
    raycast: Physics.RaycastResult;
  }
  
  /**
   * Defines an interface that represents the action of showing/hiding a context menu.
   */
  export interface ContextMenuEvent {
    /**
     * Position on the page that the context menu should be placed.
     */
    pagePos: Vector2;
    
    /**
     * The actions that the context menu should show.
     */
    actions: ContextMenuAction[];
  }
  
  /**
   * Defines an interface that represents a single action in a context menu.
   */
  export interface ContextMenuAction {
    /**
     * The label for the action.
     */
    label: string;
  
    /**
     * The function that should be trigered when the action is selected.
     */
    onClick: () => void;
  }