import { Box3, Object3D, BoxHelper, Scene, Vector3, Box3Helper, Color, Matrix4, AxesHelper, Points, LineBasicMaterial, LinearMipMapLinearFilter, Line, LineSegments, NoColors } from "three";
import { remove as lodashRemove } from 'lodash';
import { setLayer } from "./SceneUtils";
import { LayersHelper } from "./LayersHelper";

export namespace DebugObjectManager {

    var _scene: Scene;
    var _debugObjects: DebugObject[];

    export function init(scene: Scene): void {
        console.log('[DebugObjectManager] init w/ scene: ' + scene.id);
        _debugObjects = [];
        _scene = scene;
    }

    export function removeAll(): void {
        console.log('[DebugObjectManager] remove all');
        _debugObjects.forEach((o) => {
            o.dispose();
        })
        _debugObjects = [];
    }

    export function remove(id: string) {
        lodashRemove(_debugObjects, (o) => {
            if (o.id === id) {
                console.log('[DebugObjectManager] remove id: ' + id);
                o.dispose();
                return true;
            } else {
                return false;
            }
        });
    }

    export function forceUpdate(id: string) {
        _debugObjects.forEach((o) => {
            if (o.id === id) {
                o.update();
            }
        })
    }
    
    export function frameUpdate(): void {
        _debugObjects.forEach(o => {
            o.update();
        });
    }

    export function debugBox3(id: string, box3: Box3, parent?: Object3D, color?: Color, depthTest?: boolean) {
        console.log('[DebugObjectManager] debugBox3 id: ' + id);
        let parentObj = getOptionalValue(parent, _scene);
        let boxColor = getOptionalValue(color, new Color(0, 1, 0));
        let depth = getOptionalValue(depthTest, false);
        let debugBox3 = new DebugBox3(id, parentObj, box3, boxColor, depth);
        _debugObjects.push(debugBox3);
    }

    export function debugPoint(id: string, point: Vector3, parent?: Object3D, size?: number, depthTest?: boolean, color?: Color) {
        console.log('[DebugObjectManager] debugPosition id: ' + id);
        let parentObj = getOptionalValue(parent, _scene);
        let pointSize = getOptionalValue(size, 1);
        let pointColor = getOptionalValue(color, null);
        let depth = getOptionalValue(depthTest, false);
        let debugPoint = new DebugPoint(id, parentObj, point, pointSize, pointColor, depth)
        _debugObjects.push(debugPoint);
    }

    export function debugObjectPosition(id: string, object3d: Object3D, worldspace: boolean, size?: number, depthTest?: boolean, color?: Color) {
        console.log('[DebugObjectManager] debugObjectPosition id: ' + id);
        let pointSize = getOptionalValue(size, 1);
        let pointColor = getOptionalValue(color, null);
        let world = getOptionalValue(worldspace, false);
        let depth = getOptionalValue(depthTest, false);
        let debugObjPosition = new DebugObjectPosition(id, _scene, object3d, world, pointSize, pointColor, depth);
        _debugObjects.push(debugObjPosition);
    }

    function getOptionalValue(obj: any, defaultValue: any): any {
        return (obj !== undefined && obj !== null) ? obj : defaultValue;
    }



    //
    // Internal Helper Classes
    //
    abstract class DebugObject {
        id: string;
        parent: Object3D;

        constructor(id: string, parent: Object3D) {
            this.id = id;
            this.parent = parent;
        }

        abstract update(): void;
        abstract dispose(): void;
    }
    
    class DebugBox3 extends DebugObject {
        box3: Box3;
        box3Helper: Box3Helper;
    
        constructor(id: string, parent: Object3D, box3: Box3, color: Color, depthTest: boolean) {
            super(id, parent);
            this.box3 = box3;
            this.box3Helper = new Box3Helper(box3, color);

            if (!depthTest) {
                let lineMaterial = <LineBasicMaterial>(<LineSegments>this.box3Helper).material;
                if (lineMaterial) {
                    lineMaterial.depthTest = false;
                    lineMaterial.depthWrite = false;
                }

                setLayer(this.box3Helper, LayersHelper.Layer_UIWorld, true);
            }

            this.parent.add(this.box3Helper);
        }
    
        update(): void {
            let box = this.box3.clone();
            (<any>this.box3Helper).box.copy(box);
            this.box3Helper.updateMatrixWorld(true);
        }

        dispose(): void {
            this.parent.remove(this.box3Helper);
        }
    }
    
    class DebugPoint extends DebugObject {
        point: Vector3;
        axesHelper: AxesHelper;
    
        constructor(id: string, parent: Object3D, point: Vector3, size: number, color: Color, depthTest: boolean) {
            super(id, parent);
            this.point = point;
            this.axesHelper = new AxesHelper(size);

            if (!depthTest) {
                let lineMaterial = <LineBasicMaterial>this.axesHelper.material;
                if (lineMaterial) {
                    lineMaterial.depthTest = false;
                    lineMaterial.depthWrite = false;
                }

                setLayer(this.axesHelper, LayersHelper.Layer_UIWorld, true);
            }

            if (color) {
                let lineMaterial = <LineBasicMaterial>this.axesHelper.material;
                if (lineMaterial) {
                    lineMaterial.vertexColors = NoColors;
                    lineMaterial.color = color;
                }
            }

            this.parent.add(this.axesHelper);
        }
    
        update(): void {
            let pos = this.point.clone();
            this.axesHelper.position.copy(pos);
            this.axesHelper.updateMatrixWorld(true);
        }

        dispose(): void {
            this.parent.remove(this.axesHelper);
        }
    }

    class DebugObjectPosition extends DebugObject {
        object3d: Object3D;
        axesHelper: AxesHelper;
        worldspace: boolean;
    
        constructor(id: string, scene: Scene, object3d: Object3D, worldspace: boolean, size: number, color: Color, depthTest: boolean) {
            super(id, scene);
            this.object3d = object3d;
            this.worldspace = worldspace;
            this.axesHelper = new AxesHelper(size);

            if (!depthTest) {
                let lineMaterial = <LineBasicMaterial>this.axesHelper.material;
                if (lineMaterial) {
                    lineMaterial.depthTest = false;
                    lineMaterial.depthWrite = false;
                }

                setLayer(this.axesHelper, LayersHelper.Layer_UIWorld, true);
            }

            if (color) {
                let lineMaterial = <LineBasicMaterial>this.axesHelper.material;
                if (lineMaterial) {
                    lineMaterial.vertexColors = NoColors;
                    lineMaterial.color = color;
                }
            }

            if (this.worldspace) {
                this.parent.add(this.axesHelper);
            } else {
                this.object3d.add(this.axesHelper);
            }
        }
    
        update(): void {
            if (this.worldspace) {
                let pos = new Vector3();
                this.object3d.getWorldPosition(pos);
                this.axesHelper.position.copy(pos);
                this.axesHelper.updateMatrixWorld(true);
            }
        }

        dispose(): void {
            if (this.worldspace) {
                this.parent.remove(this.axesHelper);
            } else {
                if (this.object3d) {
                    this.object3d.remove(this.axesHelper);
                }
            }
        }
    }
}