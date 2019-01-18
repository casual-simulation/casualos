import { Vector2, Vector3, Intersection, Raycaster, Object3D, Ray } from 'three';
import { Input, InputType, MouseButtonId } from '../game-engine/Input';
import { File3D, ContextMenuEvent, ContextMenuAction, DragOperation } from '../game-engine/Interfaces';
import { Object } from '../../common/Files';
import { FileDragOperation } from './FileDragOperation';
import { FileClickOperation } from './FileClickOperation';
import GameView from '../GameView/GameView';
import { Physics } from '../game-engine/Physics';
import { find } from 'lodash';

export class FileInteractionManager {
    
    private _gameView: GameView;
    private _raycaster: Raycaster;
    private _draggableObjects: Object3D[];

    private _fileClickOperation: FileClickOperation;

    constructor(gameView:GameView) {
        this._gameView = gameView;
        this._raycaster = new Raycaster();
        this._draggableObjects = [];

        // Bind event handlers to this instance of the class.
        this._handleFileAdded = this._handleFileAdded.bind(this);
        this._handleFileUpdated = this._handleFileUpdated.bind(this);
        this._handleFileRemoved = this._handleFileRemoved.bind(this);

        // Listen to file events from game view.
        this._gameView.onFileAdded.addListener(this._handleFileAdded);
        this._gameView.onFileUpdated.addListener(this._handleFileUpdated);
        this._gameView.onFileRemoved.addListener(this._handleFileRemoved);
    }

    public update(): void {
        // Update any active operations.
        if (this._fileClickOperation) { 
            this._fileClickOperation.update();
            
            // Dispose of operations that have finished.
            if (this._fileClickOperation.isFinished()) {
                console.log("Dispose of file click operation.");
                this._fileClickOperation.dispose();
                this._fileClickOperation =null;
            }
        }

        const input = this._gameView.input;

        // Detect left click.
        if (input.getMouseButtonDown(MouseButtonId.Left)) {
            const screenPos = input.getMouseScreenPos();
            const clickedObject = this._clickedObject(screenPos);
    
            if (clickedObject) {
                this._gameView.enableCameraControls(false);
                const file = this._fileForIntersection(clickedObject);

                if (file) {
                    // Start file click operation on file.
                    console.log("Create file click operation.");
                    this._fileClickOperation = new FileClickOperation(this._gameView, file);
                }
            
            }

            // If file click operation wasnt started, make sure camera controls are enabled.
            if (!this._fileClickOperation) {
                this._gameView.enableCameraControls(true);
            }
        }
    
        // Middle click.
        if (input.getMouseButtonDown(MouseButtonId.Middle)) {
            // Always allow camera control with middle clicks.
            this._gameView.enableCameraControls(true);
        }
    
        // Show the context menu.
        if (input.getMouseButtonDown(MouseButtonId.Right)) {
            const pagePos = input.getMousePagePos();
            const screenPos = input.getMouseScreenPos();
            const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this._draggableObjects, this._gameView.camera);
            const hit = Physics.firstRaycastHit(raycastResult);
    
            if (hit) {
            const file = this._fileForIntersection(hit);
            if (file && file.file && file.file.type === 'workspace') {
                // Now send the actual context menu event.
                let menuEvent: ContextMenuEvent = { pagePos: pagePos, actions: this._contextMenuActions(file) };
                this._gameView.$emit('onContextMenu', menuEvent);
            }
            }
        }
      
    }

    private _clickedObject(screenPos: Vector2) : Intersection {
      const raycastResult = Physics.raycastAtScreenPos(screenPos, this._raycaster, this._draggableObjects, this._gameView.camera);
      return Physics.firstRaycastHit(raycastResult);
    }

    private _fileForIntersection(hit: Intersection): File3D {
      const id = this._gameView.getFileId(hit.object.id);
      if (id) {
        return this._gameView.getFile(id);
      } else {
        return this._findWorkspaceForIntersection(hit);
      }
    }

    private _findWorkspaceForIntersection(obj: Intersection): File3D | null {
      if (!obj) {
        return null;
      }
      const hasParent = !!obj.object.parent && !!obj.object.parent.parent;
      const fileId = hasParent ? this._gameView.getFileId(obj.object.parent.parent.id) : null;
      const file = fileId ? this._gameView.getFile(fileId) : null;
      if (file && file.file.type === 'workspace') {
        return file;
      } else {
        return null;
      }
    }

    private _contextMenuActions(file: File3D): ContextMenuAction[] {
      let actions = [
        { label: 'Expand', onClick: () => this._expandWorkspace(file) },
      ];
      if (this._canShrinkWorkspace(file)) {
        actions.push({ label: 'Shrink', onClick: () => this._shrinkWorkspace(file) });
      }
      return actions;
    }

    private _canShrinkWorkspace(file: File3D) {
      return file && file.file.type === 'workspace' && file.file.size >= 1;
    }
  
    private _expandWorkspace(file: File3D) {
        if (file && file.file.type === 'workspace') {
            const size = file.file.size;
            this._gameView.fileManager.updateFile(file.file, {
                size: (size || 0) + 1
            });
        }
    }
  
    private _shrinkWorkspace(file: File3D) {
        if (file && file.file.type === 'workspace') {
            const size = file.file.size;
            this._gameView.fileManager.updateFile(file.file, {
                size: (size || 0) - 1
            });
        }
    }

    private _pointOnGrid(ray: Ray) {
      const raycaster = new Raycaster(ray.origin, ray.direction, 0, Number.POSITIVE_INFINITY);
      raycaster.linePrecision = .1;
      const hits = raycaster.intersectObject(this._gameView.grids, true);
      const hit = hits[0];
      if (hit) {
        const point = hit.point;
        const workspace = this._findWorkspaceForIntersection(hit);
        if (workspace) {
          workspace.mesh.worldToLocal(point);
          const cell = workspace.grid.grid.pixelToCell(point);
          const pos = workspace.grid.grid.cellToPixel(cell).clone();
          pos.y = point.y;
          return {
            good: true,
            point: pos,
            workspace
          };
        }
      }
      return {
        good: false
      };
    }

    private _dragFile(mouseDir: Ray, hit: Intersection) {
      const { good, point, workspace } = this._pointOnGrid(mouseDir);
      const file = this._fileForIntersection(hit);
      if (file) {
        if (good) {
          this._gameView.fileManager.updateFile(file.file, {
            tags: {
              _workspace: workspace.file.id,
              _position: {
                x: point.x,
                y: point.y,
                z: point.z
              }
            }
          });
        } else {
          const p = Physics.pointOnRay(mouseDir, 2);
          this._gameView.fileManager.updateFile(file.file, {
            tags: {
              _workspace: null,
              _position: {
                x: p.x,
                y: p.y,
                z: p.z
              }
            }
          });
        }
      }
    }

    private _dragWorkspace(mouseDir: Ray, workspace: File3D) {
      const point = Physics.pointOnPlane(mouseDir, this._gameView.workspacePlane);
      if (point) {
        this._gameView.fileManager.updateFile(workspace.file, {
          position: {
            x: point.x,
            y: point.y,
            z: point.z
          }
        });
      }
    }

    private _selectFile(file: File3D) {
      this._gameView.fileManager.selectFile(<Object>file.file);
    }

    private _tryCombineFiles(drag: DragOperation) {
      const raycast = Physics.raycastAtScreenPos(drag.screenPos, this._raycaster, this._draggableObjects, this._gameView.camera);
      const other = find(raycast.intersects, (val, index, col) => val.object !== drag.hit.object);
      if (other) {
        const file = this._fileForIntersection(drag.hit);
        const otherFile = this._fileForIntersection(other);
        if (file && otherFile && file.file.type === 'object' && otherFile.file.type === 'object') {
          this._gameView.fileManager.action(file.file, otherFile.file, '+');
        }
      }
    }

    private _isFile(hit: Intersection): boolean {
      return this._findWorkspaceForIntersection(hit) === null;
    }
  
    private _handleDrag(mouseDir: Ray, workspace: File3D, hit: Intersection) {
      if (workspace) {
        this._dragWorkspace(mouseDir, workspace);
      } else {
        this._dragFile(mouseDir, hit);
      }
    }

    private _handleFileAdded(file:File3D): void {
        // Add file's mesh to draggable objects list.
        this._draggableObjects.push(file.mesh);
    }

    private _handleFileUpdated(file:File3D): void {

    }

    private _handleFileRemoved(file:File3D): void {
        // Remove file's mesh from draggable objects list.
        const index = this._draggableObjects.indexOf(file.mesh);
        if (index >= 0) {
            this._draggableObjects.slice(index, 1);
        }
    }
}