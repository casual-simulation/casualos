import { Ray, Vector3, Vector2, Intersection, Mesh, Group } from "three";
import { vg } from "von-grid";
import { File, Workspace } from 'common/Files';
import { Physics } from '../game-engine/Physics';
import { File3D } from "../game-engine/File3D";

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