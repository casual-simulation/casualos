import { Vector2 } from '@casual-simulation/three';

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
