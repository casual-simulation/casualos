import {
    type Camera,
    type Object3D,
    type WebGLRenderer
} from 'three';
import type { MapView, MapPlaneNode, LODControl } from 'geo-three';

/**
 * LOD control that maintains a constant level of detail.
 * This allows setting a specific LOD level regardless of camera position or other factors.
 */
export class LODConstant implements LODControl {
    private view: MapView | null = null;
    private targetLevel: number;
    private initialized: boolean = false;

    constructor(targetLevel: number = 0) {
        this.targetLevel = targetLevel;
    }
    
    public setTargetLevel(level: number): void {
        this.targetLevel = level;

        if (this.initialized && this.view) {
            this.applyLODLevel();
        }
    }

    private applyLODLevel(): void {
        if (!this.view) {
            return;
        }

        this.view.children.forEach(child => {
            const node = child as unknown as MapPlaneNode;
            this.processNode(node, 0);
        });
    }
    
    private processNode(node: MapPlaneNode, currentLevel: number): void {
        if (currentLevel < this.targetLevel) {
            if (node.children.length === 0) {
                try {
                    node.subdivide();
                } catch (error) {
                    console.warn(`Could not subdivide node at level ${currentLevel}:`, error);
                    return;
                }
            }

            node.children.forEach(child => {
                this.processNode(child as unknown as MapPlaneNode, currentLevel + 1);
            });
        } 
        else if (currentLevel > this.targetLevel) {
            if (node.parentNode && (currentLevel - 1) >= this.targetLevel) {
                try {
                    node.parentNode.simplify();
                } catch (error) {
                    console.warn(`Could not simplify node at level ${currentLevel}:`, error);
                }
            }
        }
    }
    
    public updateLOD(view: MapView, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void {
        this.view = view;

        if (!this.initialized) {
            this.initialized = true;
            this.applyLODLevel();
        }

        if (Math.random() < 0.05) {
            this.applyLODLevel();
        }
    }
}