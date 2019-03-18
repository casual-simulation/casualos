import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { ContextMenuEvent, ContextMenuAction } from '../../shared/interaction/ContextMenuEvent';
import { 
    File, 
    Workspace, 
    DEFAULT_WORKSPACE_HEIGHT_INCREMENT, 
    DEFAULT_WORKSPACE_MIN_HEIGHT, 
    DEFAULT_USER_MODE, 
    UserMode, 
    DEFAULT_WORKSPACE_HEIGHT, 
    objectsAtWorkspace,
    isMinimized,
    FileCalculationContext,
    getContextMinimized,
    getContextGrid,
    getContextSize,
    getContextScale,
    getContextDefaultHeight,
    getContextColor
} from '@yeti-cgi/aux-common';
import { BuilderFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderFileClickOperation';
import { Physics } from '../../shared/scene/Physics';
import { flatMap, minBy, keys } from 'lodash';
import { Axial, realPosToGridPos, gridDistance, keyToPos, posToKey } from '../../shared/scene/hex';
import { Input } from '../../shared/scene/Input';
import { ColorPickerEvent } from '../../aux-projector/interaction/ColorPickerEvent';
import { EventBus } from '../../shared/EventBus';
import { appManager } from '../../shared/AppManager';
import { IOperation } from '../../shared/interaction/IOperation';
import { BuilderEmptyClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderEmptyClickOperation';
import { BuilderNewFileClickOperation } from '../../aux-projector/interaction/ClickOperation/BuilderNewFileClickOperation';
import { AuxFile3D } from '../../shared/scene/AuxFile3D';
import { ContextGroup3D } from '../../shared/scene/ContextGroup3D';
import { BuilderGroup3D } from '../../shared/scene/BuilderGroup3D';
import { BaseInteractionManager } from '../../shared/interaction/BaseInteractionManager';
import GameView from '../GameView/GameView';
import { GameObject } from '../../shared/scene/GameObject';

export class BuilderInteractionManager extends BaseInteractionManager {

    // This overrides the base class IGameView
    protected _gameView: GameView;

    private _surfaceColliders: Object3D[];
    private _surfaceObjectsDirty: boolean;

    mode: UserMode = DEFAULT_USER_MODE;

    constructor(gameView: GameView) {
        super(gameView)
        this._surfaceObjectsDirty = true;
    }

    createGameObjectClickOperation(gameObject: GameObject, hit: Intersection): IOperation {
        if (gameObject instanceof AuxFile3D || gameObject instanceof ContextGroup3D) {
            let fileClickOp = new BuilderFileClickOperation(this.mode, this._gameView, this, gameObject, hit);
            return fileClickOp;
        } else {
            return null;
        }
    }

    createEmptyClickOperation(): IOperation {
        let emptyClickOp = new BuilderEmptyClickOperation(this._gameView, this);
        return emptyClickOp;
    }

    createHtmlElementClickOperation(element: HTMLElement): IOperation {
        const vueElement: any = Input.getVueParent(element);
        if (vueElement.file) {
            const file = <File>vueElement.file;
            let newFileClickOp = new BuilderNewFileClickOperation(this.mode, this._gameView, this, file);
            return newFileClickOp;
        }

        return null;
    }

    findGameObjectObjectForHit(hit: Intersection): GameObject {
        if (!hit) {
            return null;
        }
        
        let obj = this.findGameObjectUpHierarchy(hit.object);

        if (obj) {
            return obj;
        } else {
            return this.findWorkspaceForIntersection(hit);
        }
    }

    findWorkspaceForIntersection(hit: Intersection): BuilderGroup3D {
        if (!hit) {
            return null;
        }
        
        return this.findWorkspaceForMesh(hit.object);
    }

    findWorkspaceForMesh(mesh: Object3D): BuilderGroup3D {
        if (!mesh) {
            return null;
        }

        if (mesh instanceof BuilderGroup3D) {
            return mesh;
        } else if (mesh instanceof AuxFile3D) {
            return <BuilderGroup3D>mesh.contextGroup;
        } else {
            return this.findWorkspaceForMesh(mesh.parent);
        }
    }
 
    canShrinkWorkspace(file: ContextGroup3D) {
        if (file && file.file.tags.size >= 1) {
            if (file.file.tags.size === 1) {
                // Can only shrink to zero size if there are no objects on the workspace.
                const allObjects = this._gameView.getContexts().map((o) => { return o.file });
                const workspaceObjects = objectsAtWorkspace(allObjects, file.file.id);
                if (workspaceObjects && workspaceObjects.length > 0) {
                    return false;
                }
            }
            return true;
        }
    }

    /**
     * Determines if we're in the correct mode to manipulate the given file.
     * @param file The file.
     */
    isInCorrectMode(file: AuxFile3D | ContextGroup3D) {
        if (!file) {
            return true;
        }
        if (file instanceof ContextGroup3D) {
            return this.mode === 'worksurfaces';
        } else {
            return this.mode === 'files';
        }
    }
    
    /**
     * Raises the tile at the given point by the given amount.
     * @param file The file.
     * @param position The tile position.
     * @param height The new height.
     */
    updateTileHeightAtGridPosition(file: ContextGroup3D, position: Axial, height: number) {
        const key = posToKey(position);
        appManager.fileManager.updateFile(file.file, {
            tags: {
                [`aux.${file.domain}.context.grid`]: {
                    [key]: {
                        height: height
                    }
                }
            }
        });
    }

    /**
     * Calculates the grid location and workspace that the given ray intersects with.
     * @param ray The ray to test.
     */
    pointOnWorkspaceGrid(calc: FileCalculationContext, ray: Ray) {
        const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
        const workspaces = this.getSurfaceObjects();
        const hits = raycaster.intersectObjects(workspaces, true);
        const hit = hits[0];
        if (hit) {
            const point = hit.point;
            const workspace = this.findWorkspaceForIntersection(hit);
            if (workspace && workspace.file.tags[`aux.${workspace.domain}.context`] && !getContextMinimized(calc, workspace.file, workspace.domain)) {
                const workspaceMesh = workspace.surface;
                const closest = workspaceMesh.closestTileToPoint(point);

                if (closest) {
                    return {
                        good: true,
                        gridPosition: closest.tile.gridPosition,
                        height: closest.tile.localPosition.y,
                        workspace
                    };
                }
            }
        }
        return {
            good: false
        };
    }

    /**
     * Finds the closest non-minimized workspace to the given point.
     * Returns undefined if there is no workspace.
     * @param point The point.
     * @param exclude The optional workspace to exclude from the search.
     */
    closestWorkspace(calc: FileCalculationContext, point: Vector3, exclude?: AuxFile3D | ContextGroup3D) {
        const workspaceMeshes = this._gameView.getContexts().filter(context => context !== exclude && !getContextMinimized(calc, context.file, context.domain));
        const center = new Axial();

        const gridPositions = workspaceMeshes.map(mesh => {
            const w = <Workspace>mesh.file;
            const gridPos = this._worldPosToGridPos(calc, mesh, point);
            const grid = getContextGrid(calc, w, mesh.domain);
            const tilePositions = grid ? keys(grid).map(keyToPos) : [];
            const distToCenter = gridDistance(center, gridPos);
            const size = getContextSize(calc, w, mesh.domain);
            const scaledDistance = distToCenter - (size - 1);
            const distances = [
                { position: center, distance: scaledDistance },
                ...tilePositions.map(pos => ({
                    position: pos,
                    distance: gridDistance(pos, gridPos) 
                }))
            ];

            // never null because distances always has at least one element.
            const closest = minBy(distances, d => d.distance);

            return {
                mesh, 
                gridPosition: gridPos, 
                distance: closest.distance
            };
        });

        const closest = minBy(gridPositions, g => g.distance);
        return closest;
    }

    /**
     * Gets the first context that the given workspace has.
     */
    firstContextInWorkspace(workspace: ContextGroup3D): string {
        const contexts = [...workspace.contexts.keys()];
        if (contexts.length > 0) {
            return contexts[0];
        }
        return null;
    }

    isFile(hit: Intersection): boolean {
        return this.findWorkspaceForIntersection(hit) === null;
    }

    getSurfaceObjects() {
        if (this._surfaceObjectsDirty) {
            this._surfaceColliders = flatMap((<GameView>this._gameView).getContexts().filter(f => f.file.tags[`aux.${f.domain}.context`]), f => f.surface.colliders);
            this._surfaceObjectsDirty = false;
        }
        return this._surfaceColliders;
    }

    protected _contextMenuActions(calc: FileCalculationContext, gameObject: GameObject, point: Vector3, pagePos: Vector2): ContextMenuAction[] {
        
        let actions: ContextMenuAction[] = [];

        if (gameObject) {

            if (gameObject instanceof ContextGroup3D && gameObject.file.tags[`aux.${gameObject.domain}.context`]) {
                
                const tile = this._worldPosToGridPos(calc, gameObject, point);
                const currentGrid = getContextGrid(calc, gameObject.file, gameObject.domain);
                const currentTile = currentGrid ? currentGrid[posToKey(tile)] : null;
                const defaultHeight = getContextDefaultHeight(calc, gameObject.file, gameObject.domain);
                const currentHeight = (!!currentTile ? currentTile.height : defaultHeight) || DEFAULT_WORKSPACE_HEIGHT;
                const increment = DEFAULT_WORKSPACE_HEIGHT_INCREMENT; // TODO: Replace with a configurable value.
                const minHeight = DEFAULT_WORKSPACE_MIN_HEIGHT; // TODO: This too
                const minimized = isMinimized(calc, gameObject.file, gameObject.domain);
                
                if (this.isInCorrectMode(gameObject)) {
                    if (!minimized) {
                        actions.push({ label: 'Raise', onClick: () => this.updateTileHeightAtGridPosition(gameObject, tile, currentHeight + increment) });
                        if (currentTile && currentHeight - increment >= minHeight) {
                            actions.push({ label: 'Lower', onClick: () => this.updateTileHeightAtGridPosition(gameObject, tile, currentHeight - increment) });
                        }
                        
                        actions.push({ label: 'Expand', onClick: () => this._expandWorkspace(calc, gameObject) });
                        if (this.canShrinkWorkspace(gameObject)) {
                            actions.push({ label: 'Shrink', onClick: () => this._shrinkWorkspace(calc, gameObject) });
                        }
                    }

                    actions.push({ label: 'Change Color', onClick: () => {    
                        
                        // This function is invoked as the color picker changes the color value.
                        let colorUpdated = (hexColor: string) => {
                            appManager.fileManager.updateFile(gameObject.file, { 
                                tags: { 
                                    [`aux.${gameObject.domain}.context.color`]: hexColor 
                                }
                            });
                        };
                        
                        let workspace = <Workspace>gameObject.file;
                        const currentColor = getContextColor(calc, gameObject.file, gameObject.domain);
                        let colorPickerEvent: ColorPickerEvent = { pagePos: pagePos, initialColor: currentColor, colorUpdated: colorUpdated };
                        
                        EventBus.$emit('onColorPicker', colorPickerEvent);
                    }});
                }
    
                const minimizedLabel = minimized ? 'Maximize' : 'Minimize';
                actions.push({ label: minimizedLabel, onClick: () => this._toggleWorkspace(calc, gameObject) });
            }

        }
    
        return actions;
    }

    private _shrinkWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file && file.file.tags[`aux.${file.domain}.context`]) {
            const size = getContextSize(calc, file.file, file.domain);
            appManager.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.size`]: (size || 0) - 1
                }
            });
        }
    }

    /**
     * Minimizes or maximizes the given workspace.
     * @param file 
     */
    private _toggleWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file && file.file.tags[`aux.${file.domain}.context`]) {
            const minimized = !isMinimized(calc, file.file, file.domain);
            appManager.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.minimized`]: minimized
                }
            });
        }
    }

    private _expandWorkspace(calc: FileCalculationContext, file: ContextGroup3D) {
        if (file) {
            const size = getContextSize(calc, file.file, file.domain);
            appManager.fileManager.updateFile(file.file, {
                tags: {
                    [`aux.${file.domain}.context.size`]: (size || 0) + 1
                }
            });
        }
    }

    private _worldPosToGridPos(calc: FileCalculationContext, file: ContextGroup3D, pos: Vector3) {
        const w = file.file;
        const scale = getContextScale(calc, file.file, file.domain);
        const localPos = new Vector3().copy(pos).sub(file.position);
        return realPosToGridPos(new Vector2(localPos.x, localPos.z), scale);
    }

    protected _markDirty() {
        super._markDirty();
        this._surfaceObjectsDirty = true;
    }
}
