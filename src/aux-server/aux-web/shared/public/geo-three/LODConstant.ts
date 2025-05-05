import {
    type Camera,
    type Object3D,
    type WebGLRenderer
} from 'three';
import type { MapPlaneNode, LODControl, MapView } from 'geo-three';
// import { MapView } from 'aux-web/shared/scene/map/MapView';

/**
 * LOD control that maintains a constant level of detail.
 * This allows setting a specific LOD level regardless of camera position or other factors.
 */
export class LODConstant implements LODControl {
    private _view: MapView | null = null;
    private _targetLevel: number;
    private _initialized: boolean = false;
    private _needsSimplification: boolean = false;
    private readonly _maxLevel: number = 5;

    constructor(targetLevel: number = 1) {
        this._targetLevel = Math.min(targetLevel, this._maxLevel);
    }
    
    public setTargetLevel(level: number): void {
        const cappedLevel = Math.min(level, this._maxLevel);
    
        if (cappedLevel < this._targetLevel){
            this._needsSimplification = true;
        }
        this._targetLevel = cappedLevel;
    
        if (this._initialized && this._view) {
            this.applyLODLevel();
        }
    }

    private applyLODLevel(): void {
        if (!this._view) {
            return;
        }

        if (this._needsSimplification) {
            this.simplifyToLevel(this._targetLevel);
            this._needsSimplification = false;
        }

        this._view.children.forEach(child => {
            const node = child as unknown as MapPlaneNode;
            this.subdivideToLevel(node, 0, this._targetLevel);
        });
    }

    private simplifyToLevel(targetLevel: number): void {
        if (!this._view) {
            return;
        }

        let continueSimplifying = true;
        let iterations = 0;
        const maxIterations = 10; // Prevent infinite loops

        while (continueSimplifying && iterations < maxIterations) {
            iterations++;
            continueSimplifying = false;

            const nodesToCheck: {node: MapPlaneNode, level: number}[] = [];
            
            this._view.children.forEach(child => {
                this.collectNodes(child as unknown as MapPlaneNode, 0, nodesToCheck);
            });

            const parentsToSimplify = new Set<MapPlaneNode>();
            
            for (const {node, level} of nodesToCheck) {
                if (level > targetLevel && node.parentNode) {
                    parentsToSimplify.add(node.parentNode);
                }
            }

            if (parentsToSimplify.size > 0) {
                continueSimplifying = true;
                for (const parent of parentsToSimplify) {
                    try {
                        parent.simplify();
                    } catch (error) {
                        console.warn(`Could not simplify node:`, error);
                    }
                }
            }
        }
        
        if (iterations >= maxIterations) {
            console.warn('Maximum simplification iterations reached. Some nodes may not be simplified.');
        }
    }
    private collectNodes(node: MapPlaneNode, level: number, result: {node: MapPlaneNode, level: number}[]): void {
        result.push({node, level});
        
        node.children.forEach(child => {
            this.collectNodes(child as unknown as MapPlaneNode, level + 1, result);
        });
    }

    private subdivideToLevel(node: MapPlaneNode, currentLevel: number, targetLevel: number): void {
        if (currentLevel < targetLevel) {
            if (node.children.length === 0) {
                try {
                    node.subdivide();
                } catch (error) {
                    console.warn(`Could not subdivide node at level ${currentLevel}:`, error);
                    return;
                }
            }
            
            node.children.forEach(child => {
                this.subdivideToLevel(child as unknown as MapPlaneNode, currentLevel + 1, targetLevel);
            });
        }
    }
    
    public updateLOD(view: Object3D, camera: Camera, renderer: WebGLRenderer, scene: Object3D): void {
        this._view = view as MapView;
        
        if (!this._initialized) {
            this._initialized = true;
            this.applyLODLevel();
        }

        if (Math.random() < 0.05) {
            this.applyLODLevel();
        }
    }
}