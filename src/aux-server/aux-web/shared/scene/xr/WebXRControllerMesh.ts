import {
    MotionController,
    Constants,
} from '@webxr-input-profiles/motion-controllers';
import { Mesh, Object3D, Scene, Quaternion } from 'three';
import { getGLTFPool } from '../GLTFHelpers';
import { SubscriptionLike } from 'rxjs';
import { disposeScene } from '../SceneUtils';
import values from 'lodash/values';
import { XRFrame, XRPose } from './WebXRTypes';
import { copyPose } from './WebXRHelpers';

const pool = getGLTFPool('webxr');

export class WebXRControllerMesh implements SubscriptionLike {
    closed: boolean;

    controller: MotionController;
    scene: Scene;

    private _root: Object3D;
    private _nodes: Map<string, Object3D>;

    constructor(controller: MotionController) {
        this.controller = controller;
        this._nodes = new Map();
    }

    async init() {
        const gltf = await pool.loadGLTF(this.controller.assetUrl);
        this.scene = gltf.scene;
        this._root = this.scene;

        // Loop through the components and find the nodes needed for each components' visual responses
        for (let component of values(this.controller.components)) {
            const { touchPointNodeName, visualResponses } = component;
            if (touchPointNodeName) {
                this._nodes.set(
                    touchPointNodeName,
                    this._root.getObjectByName(touchPointNodeName)
                );
            }

            // Loop through all the visual responses to be applied to this component
            for (let visualResponse of values(visualResponses)) {
                const {
                    valueNodeName,
                    minNodeName,
                    maxNodeName,
                    valueNodeProperty,
                } = visualResponse;
                // If animating a transform, find the two nodes to be interpolated between.
                if (
                    valueNodeProperty ===
                    Constants.VisualResponseProperty.TRANSFORM
                ) {
                    const minNode = this._root.getObjectByName(minNodeName);
                    const maxNode = this._root.getObjectByName(maxNodeName);

                    // If the extents cannot be found, skip this animation
                    if (minNode) {
                        this._nodes.set(minNodeName, minNode);
                    } else {
                        console.log(
                            `Could not find ${minNodeName} in the model`
                        );
                        return;
                    }
                    if (maxNode) {
                        this._nodes.set(maxNodeName, maxNode);
                    } else {
                        console.log(
                            `Could not find ${maxNodeName} in the model`
                        );
                        return;
                    }
                }

                // If the target node cannot be found, skip this animation
                const valueNode = this._root.getObjectByName(valueNodeName);
                if (valueNode) {
                    this._nodes.set(valueNodeName, valueNode);
                } else {
                    console.log(`Could not find ${valueNodeName} in the model`);
                }
            }
        }
    }

    update(pose: XRPose) {
        this.controller.updateFromGamepad();
        this.updateMotionControllerModel(pose);
        this.scene.updateMatrixWorld();
    }

    updateMotionControllerModel(pose: XRPose) {
        // Update the 3D model to reflect the button, thumbstick, and touchpad state
        for (let component of values(this.controller.components)) {
            // Update node data based on the visual responses' current states
            for (let visualResponse of values(component.visualResponses)) {
                const {
                    valueNodeName,
                    minNodeName,
                    maxNodeName,
                    value,
                    valueNodeProperty,
                } = visualResponse;
                const valueNode = this._nodes.get(valueNodeName);

                // Skip if the visual response node is not found. No error is needed,
                // because it will have been reported at load time.
                if (!valueNode) return;

                // Calculate the new properties based on the weight supplied
                if (
                    valueNodeProperty ===
                    Constants.VisualResponseProperty.VISIBILITY
                ) {
                    valueNode.visible = <boolean>value;
                } else if (
                    valueNodeProperty ===
                    Constants.VisualResponseProperty.TRANSFORM
                ) {
                    const minNode = this._nodes.get(minNodeName);
                    const maxNode = this._nodes.get(maxNodeName);
                    Quaternion.slerp(
                        minNode.quaternion,
                        maxNode.quaternion,
                        valueNode.quaternion,
                        <number>value
                    );

                    valueNode.position.lerpVectors(
                        minNode.position,
                        maxNode.position,
                        <number>value
                    );
                }
            }
        }

        copyPose(pose, this._root);
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this.scene) {
            disposeScene(this.scene);
            this.scene = null;
        }
        this._nodes = new Map();
    }
}
