import {
    type Camera,
    type Object3D,
    type WebGLRenderer
} from 'three';
import type { MapView, MapPlaneNode, LODControl } from 'geo-three';

/**
 * LOD control with manual keyboard input for testing.
 * Key 'A' subdivides the current node
 * Key 'B' simplifies the current node's parent
 * Key 'N' cycles to the next sibling node
 * Key 'P' navigates to a parent node
 * Key 'C' navigates to the first child node
 */
export class LODDebugger implements LODControl {
    private _selectedNode: MapPlaneNode | null = null;
    private _view: MapView | null = null;

    constructor() {
        window.addEventListener('keyup', this.handleKeyUp.bind(this));
    }

    /**
     * Handle keyup events for manual LOD control.
     */
    private handleKeyUp(event: KeyboardEvent): void {
        if (!this._view) {
            console.log('View not initialized');
            return;
        }

        if (!this._selectedNode && this._view.children[0]) {
            this.selectNode(this._view.children[0] as unknown as MapPlaneNode);
        }

        if (!this._selectedNode) {
            console.log('No node selected');
            return;
        }

        const currentNode = this._selectedNode;

        switch (event.key) {
            case 'a':
            case 'A':
                //to subdivide
                console.log('BEFORE - Selected node:',
                    'level:', currentNode.level,
                    'x:', currentNode.x,
                    'y:', currentNode.y,
                    'hasChildren:', currentNode.children.length > 0,
                    'node:', currentNode);

                try {
                    currentNode.subdivide();
                    console.log('Subdivision called');

                    console.log('AFTER - Selected node:',
                        'level:', currentNode.level,
                        'x:', currentNode.x,
                        'y:', currentNode.y,
                        'hasChildren:', currentNode.children.length > 0,
                        'children:', currentNode.children);

                    if (currentNode.children.length > 0) {
                        this.selectNode(currentNode.children[0] as unknown as MapPlaneNode);
                    }
                } catch (error) {
                    console.error('Error during subdivision:', error);
                }
                break;

            case 'b':
            case 'B':
                //to simplify
                if (currentNode.parentNode) {
                    console.log('BEFORE - Parent node:',
                        'level:', currentNode.parentNode.level,
                        'x:', currentNode.parentNode.x,
                        'y:', currentNode.parentNode.y,
                        'hasChildren:', currentNode.parentNode.children.length > 0);

                    try {
                        currentNode.parentNode.simplify();
                        console.log('Simplification called');

                        this.selectNode(currentNode.parentNode);

                        console.log('AFTER - Current node:',
                            'level:', this._selectedNode.level,
                            'x:', this._selectedNode.x,
                            'y:', this._selectedNode.y,
                            'hasChildren:', this._selectedNode.children.length > 0);
                    } catch (error) {
                        console.error('Error during simplification:', error);
                    }
                } else {
                    console.log('Selected node has no parent');
                }
                break;

            case 'n':
            case 'N':
                // Cycle to next sibling
                if (currentNode.parentNode && currentNode.parentNode.children.length > 1) {
                    const siblings = currentNode.parentNode.children;
                    const currentIndex = siblings.indexOf(currentNode as unknown as Object3D);
                    const nextIndex = (currentIndex + 1) % siblings.length;
                    this.selectNode(siblings[nextIndex] as unknown as MapPlaneNode);
                    console.log('Selected next sibling node');
                } else {
                    console.log('No siblings available');
                }
                break;

            case 'p':
            case 'P':
                // Navigate to parent
                if (currentNode.parentNode) {
                    this.selectNode(currentNode.parentNode);
                    console.log('Selected parent node');
                } else {
                    console.log('No parent available');
                }
                break;

            case 'c':
            case 'C':
                // Navigate to first child
                if (currentNode.children.length > 0) {
                    this.selectNode(currentNode.children[0] as unknown as MapPlaneNode);
                    console.log('Selected first child node');
                } else {
                    console.log('No children available');
                }
                break;
        }
    }

    /**
     * Select a node
     */
    private selectNode(node: MapPlaneNode): void {
        // Set new selection
        this._selectedNode = node;

        console.log('Selected node:',
            'level:', node.level,
            'x:', node.x,
            'y:', node.y,
            'hasChildren:', node.children.length > 0);
    }

    public updateLOD(view: MapView, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void {
        // Store a reference to the view
        this._view = view;

        // Select the root node if no node is selected
        if (!this._selectedNode && view.children[0]) {
            this.selectNode(view.children[0] as unknown as MapPlaneNode);
        }

        // Debug information for the current frame
        if (this._selectedNode) {
            // Only log occasionally to avoid console spam
            if (Math.random() < 0.01) {
                console.log('Current state:',
                    'level:', this._selectedNode.level,
                    'x:', this._selectedNode.x,
                    'y:', this._selectedNode.y,
                    'hasChildren:', this._selectedNode.children.length > 0);
            }
        }
    }
}