import { Box3, Object3D, BoxHelper, Scene, Vector3, Box3Helper, Color, Matrix4, AxesHelper, Points, LineBasicMaterial, LinearMipMapLinearFilter, Line, LineSegments, NoColors } from "three";
import { remove as lodashRemove } from 'lodash';
import { setLayer } from "./SceneUtils";
import { LayersHelper } from "./LayersHelper";
import { Time } from "./Time";
import { getOptionalValue } from "../SharedUtils";

/**
 * A helper module from drawing THREE objects to the scene that are useful for visual debugging.
 * By default, debug objects are only drawn for one frame and are automatically removed by the manager.
 */
export namespace DebugObjectManager {

    var _time: Time;
    var _scene: Scene;
    var _debugObjects: DebugObject[];

    /**
     * Initalize the Debug Object Manager.
     * @param time The Time module the debug object manager will use to create timestamps and decide when debug objects have passed their expiration time.
     * @param scene The scene that debug objects will by default be parented to.
     */
    export function init(time:Time, scene: Scene): void {
        _time = time;
        _scene = scene;
        _debugObjects = [];
    }

    /**
     * Remove all currently active debug objects.
     */
    export function removeAll(): void {
        _debugObjects.forEach((o) => {
            o.dispose();
        })
        _debugObjects = [];
    }
    
    export function update(): void {
        // Filter for elements that should still be alive.
        // Dispose of elements that should not be alive anymore.
        _debugObjects = _debugObjects.filter(o => {
            if (o.killTime <= _time.timeSinceStart) {
                o.dispose();
                return false;
            } else {
                return true;
            }
        });
    }

    /**
     * Draw a wireframe box that represents the given Box3 object.
     * @param box3 The box3 to represent.
     * @param parent The object the debug object should be parented to. Default is the scene.
     * @param color The color the debug object should. Default is green.
     * @param depthTest Should the wireframe box write to the depth buffer? Default is false.
     * @param duration How long the debug object should render for. Default is one frame.
     */
    export function debugBox3(box3: Box3, parent?: Object3D, color?: Color, depthTest?: boolean, duration?: number) {
        if (!hasValue(box3))
            return;
        let parentObj = getOptionalValue(parent, _scene);
        let boxColor = getOptionalValue(color, new Color(0, 1, 0));
        let depth = getOptionalValue(depthTest, false);
        let killTime = getOptionalValue(duration, _time.timeSinceStart);
        let debugBox3 = new DebugBox3(killTime, parentObj, box3, boxColor, depth);
        _debugObjects.push(debugBox3);
    }

    /**
     * Draw a axes helper that represents the given Vector3 point.
     * @param box3 The Vector3 to represent.
     * @param parent The object the debug object should be parented to. Default is the scene.
     * @param size How big the axes helper should be. Default is 1.
     * @param depthTest Should the wireframe box write to the depth buffer? Default is false.
     * @param color The color the debug object should. Default is the color of axes that the lines represent (red, green, blue).
     * @param duration How long the debug object should render for. Default is one frame.
     */
    export function debugPoint(point: Vector3, parent?: Object3D, size?: number, depthTest?: boolean, color?: Color, duration?: number) {
        if (!hasValue(point))
            return;
        let parentObj = getOptionalValue(parent, _scene);
        let pointSize = getOptionalValue(size, 1);
        let pointColor = getOptionalValue(color, null);
        let depth = getOptionalValue(depthTest, false);
        let killTime = getOptionalValue(duration, _time.timeSinceStart);
        let debugPoint = new DebugPoint(killTime, parentObj, point, pointSize, pointColor, depth)
        _debugObjects.push(debugPoint);
    }

    /**
     * Draw a axes helper that represents the given Object3D's position.
     * @param object3d The Object3D to represent.
     * @param worldspace Should we draw the point using the object's world position or local position?
     * @param size How big the axes helper should be. Default is 1.
     * @param depthTest Should the wireframe box write to the depth buffer? Default is false.
     * @param color The color the debug object should. Default is the color of axes that the lines represent (red, green, blue).
     * @param duration How long the debug object should render for. Default is one frame.
     */
    export function debugObjectPosition(object3d: Object3D, worldspace: boolean, size?: number, depthTest?: boolean, color?: Color, duration?: number) {
        if (!hasValue(object3d))
            return;
        let pointSize = getOptionalValue(size, 1);
        let pointColor = getOptionalValue(color, null);
        let world = getOptionalValue(worldspace, false);
        let depth = getOptionalValue(depthTest, false);
        let killTime = getOptionalValue(duration, _time.timeSinceStart);
        let debugObjPosition = new DebugObjectPosition(killTime, _scene, object3d, world, pointSize, pointColor, depth);
        _debugObjects.push(debugObjPosition);
    }

    function hasValue(obj: any): boolean {
        return (obj !== undefined && obj !== null);
    }



    //
    // Internal Helper Classes
    //
    abstract class DebugObject {
        parent: Object3D;
        killTime: number;

        constructor(killTime: number, parent: Object3D) {
            this.killTime = killTime;
            this.parent = parent;
        }

        abstract dispose(): void;
    }
    
    class DebugBox3 extends DebugObject {
        killTime: number;
        box3Helper: Box3Helper;
    
        constructor(killTime: number, parent: Object3D, box3: Box3, color: Color, depthTest: boolean) {
            super(killTime, parent);
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

            // Position the box helper using the given box3.
            (<any>this.box3Helper).box.copy(box3);
            this.box3Helper.updateMatrixWorld(true);
        }

        dispose(): void {
            this.parent.remove(this.box3Helper);
        }
    }
    
    class DebugPoint extends DebugObject {
        axesHelper: AxesHelper;
    
        constructor(killTime: number, parent: Object3D, point: Vector3, size: number, color: Color, depthTest: boolean) {
            super(killTime, parent);
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

            // Position the helper using the given point.
            this.axesHelper.position.copy(point);
            this.axesHelper.updateMatrixWorld(true);
        }

        dispose(): void {
            this.parent.remove(this.axesHelper);
        }
    }

    class DebugObjectPosition extends DebugObject {
        object3d: Object3D;
        worldspace: boolean;
        axesHelper: AxesHelper;
    
        constructor(killTime: number, scene: Scene, object3d: Object3D, worldspace: boolean, size: number, color: Color, depthTest: boolean) {
            super(killTime, scene);
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

            if (worldspace) {
                this.parent.add(this.axesHelper);

                // Position the helper using the given object's world position.
                let pos = new Vector3();
                this.object3d.getWorldPosition(pos);
                this.axesHelper.position.copy(pos);
                this.axesHelper.updateMatrixWorld(true);
            } else {
                this.object3d.add(this.axesHelper);
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