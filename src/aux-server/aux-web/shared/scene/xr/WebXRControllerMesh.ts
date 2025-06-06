/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { MotionController } from '@webxr-input-profiles/motion-controllers';
import { Constants } from '@webxr-input-profiles/motion-controllers';
import {
    Mesh,
    Object3D,
    Group,
    MeshBasicMaterial,
    SphereGeometry,
    Matrix4,
} from '@casual-simulation/three';
import { getGLTFPool } from '../GLTFHelpers';
import type { SubscriptionLike } from 'rxjs';
import { disposeGroup, objectWorldForwardRay } from '../SceneUtils';
import { values } from 'lodash';
import type {
    XRFrame,
    XRPose,
    XRSpace,
    XRInputSource,
    XRHandJoint,
} from './WebXRTypes';
import { xrHandJoints } from './WebXRTypes';
import { copyPose } from './WebXRHelpers';
import { PointerRay3D } from './PointerRay3D';

const pool = getGLTFPool('webxr');

interface WebXRControllerMeshParams {
    showMesh?: boolean;
    showPointer?: boolean;
}

export class WebXRControllerMesh implements SubscriptionLike {
    closed: boolean;

    controller: MotionController;
    inputSource: XRInputSource;

    /**
     * The group that contains all the 3D objects.
     * Does not get updated but instead exists to act as proper container for the meshes.
     */
    group: Group;

    /**
     * The container for the mesh and pointer objects.
     * Gets updated with the actual pointer positions.
     */
    mesh: Group;

    private _scene: Group;
    private _sceneRoot: Object3D;
    private _nodes: Map<string, Object3D>;
    private _bones: Map<XRHandJoint, Object3D>;
    private _pointer: PointerRay3D;
    private _dummy: Object3D;
    private _params: WebXRControllerMeshParams;

    constructor(
        inputSource: XRInputSource,
        params?: WebXRControllerMeshParams
    ) {
        this.inputSource = inputSource;
        this._params = Object.assign<
            WebXRControllerMeshParams,
            WebXRControllerMeshParams
        >(
            {
                // Params defaults.
                showMesh: true,
                showPointer: true,
            },
            params
        );
        this._nodes = new Map();
        this.group = new Group();
        this.mesh = new Group();

        if (this._params.showPointer) {
            this._pointer = new PointerRay3D();
        }

        this._dummy = new Object3D();

        this.group.add(this.mesh);
        this.group.add(this._dummy);

        if (this._params.showPointer) {
            this.mesh.add(this._pointer);
        }
    }

    async init(controller: MotionController) {
        this.controller = controller;
        if (!this.controller) {
            return;
        }
        if (!this._params.showMesh) {
            return;
        }

        const gltf = await pool.loadGLTF(this.controller.assetUrl);
        this._scene = gltf.scene;
        this._sceneRoot = this._scene;

        this.mesh.add(this._sceneRoot);
        this._addTouchDots();
        this._findNodes();
        this._findBones();
    }

    update(frame: XRFrame, referenceSpace: XRSpace) {
        const inputSource = this.inputSource;

        let space: XRSpace;
        if (
            inputSource.targetRayMode === 'tracked-pointer' &&
            inputSource.gripSpace
        ) {
            space = inputSource.gripSpace;
        } else {
            space = inputSource.targetRaySpace;
        }

        const gripPose = frame.getPose(space, referenceSpace);
        const rayPose = frame.getPose(
            inputSource.targetRaySpace,
            referenceSpace
        );
        copyPose(gripPose, this.mesh);

        this._updateMotionControllerModel();
        this._updateHands(frame, space);
        this._updatePointer(rayPose);

        this.mesh.updateMatrixWorld();
    }

    /**
     * Sets the hit location that the pointer should draw to.
     * @param hit The hit location.
     */
    setPointerHitDistance(distance: number) {
        if (!this._pointer) {
            return;
        }

        if (distance) {
            this._pointer.stopDistance = distance;
        } else {
            this._pointer.stopDistance = null;
        }
    }

    private _updatePointer(pose: XRPose) {
        if (!this._pointer) {
            return;
        }

        copyPose(pose, this._dummy);
        const ray = objectWorldForwardRay(this._dummy);
        this._pointer.ray = ray;
        this._pointer.update();
    }

    private _updateMotionControllerModel() {
        if (!this.controller) {
            return;
        }
        if (!this._params.showMesh) {
            return;
        }

        this.controller.updateFromGamepad();
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

                    valueNode.quaternion.slerpQuaternions(
                        minNode.quaternion,
                        maxNode.quaternion,
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
    }

    private _updateHands(frame: XRFrame, referenceSpace: XRSpace) {
        if (!this.inputSource.hand) {
            return;
        }
        if (!this._bones) {
            return;
        }
        if (!this._params.showMesh) {
            return;
        }

        const tempJointMatrix = new Matrix4();
        const tempParentMatrix = new Matrix4();

        for (const jointSpace of this.inputSource.hand.values()) {
            const jointPose = frame.getJointPose(jointSpace, referenceSpace);
            const bone = this._bones.get(jointSpace.jointName as any);

            if (bone && jointPose) {
                if (bone.visible) {
                    // joint pose is relative to the reference space, which should be the grip space
                    // this means that the joint pose should be relative to the mesh.

                    // Because the hand mesh has multiple bones that are attached in a hierarchy,
                    // we need to calculate the final position relative to the bone's parent.

                    // hold the joint matrix
                    tempJointMatrix.fromArray(jointPose.transform.matrix);

                    // invert the parent matrix so that we can apply the joint matrix in the correct space
                    tempParentMatrix.copy(bone.parent.matrixWorld).invert();

                    // apply the scene root's matrix to the joint matrix
                    tempParentMatrix.premultiply(this._sceneRoot.matrixWorld);

                    bone.matrix.copy(
                        tempParentMatrix.multiply(tempJointMatrix)
                    );
                    bone.updateMatrixWorld();
                }
            }
        }
    }

    private _findNodes() {
        if (!this._params.showMesh) {
            return;
        }

        // Loop through the components and find the nodes needed for each components' visual responses
        for (let component of values(this.controller.components)) {
            const { touchPointNodeName, visualResponses } = component;
            if (touchPointNodeName) {
                this._nodes.set(
                    touchPointNodeName,
                    this._sceneRoot.getObjectByName(touchPointNodeName)
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
                    const minNode =
                        this._sceneRoot.getObjectByName(minNodeName);
                    const maxNode =
                        this._sceneRoot.getObjectByName(maxNodeName);

                    // If the extents cannot be found, skip this animation
                    if (minNode) {
                        this._nodes.set(minNodeName, minNode);
                    } else {
                        console.log(
                            `[WebXRControllerMesh] Could not find ${minNodeName} in the model`
                        );
                        return;
                    }
                    if (maxNode) {
                        this._nodes.set(maxNodeName, maxNode);
                    } else {
                        console.log(
                            `[WebXRControllerMesh] Could not find ${maxNodeName} in the model`
                        );
                        return;
                    }
                }

                // If the target node cannot be found, skip this animation
                const valueNode =
                    this._sceneRoot.getObjectByName(valueNodeName);
                if (valueNode) {
                    this._nodes.set(valueNodeName, valueNode);
                } else {
                    console.log(
                        `[WebXRControllerMesh] Could not find ${valueNodeName} in the model`
                    );
                }
            }
        }
    }

    private _findBones() {
        if (!this.inputSource.hand) {
            return;
        }

        this._bones = new Map();

        xrHandJoints.forEach((jointName) => {
            const bone = this._sceneRoot.getObjectByName(jointName);
            if (bone) {
                bone.matrixAutoUpdate = false;
                this._bones.set(jointName, bone);
            } else {
                console.log(
                    `[WebXRControllerMesh] Could not find ${jointName} in the model`
                );
            }
        });
    }

    /**
     * Add touch dots to all touchpad components so the finger can be seen
     */
    private _addTouchDots() {
        if (!this._params.showMesh) {
            return;
        }

        for (let componentId of Object.keys(this.controller.components)) {
            const component = this.controller.components[componentId];
            // Find the touchpads
            if (component.type === Constants.ComponentType.TOUCHPAD) {
                // Find the node to attach the touch dot.
                const touchPointRoot = this._sceneRoot.getObjectByName(
                    component.touchPointNodeName
                );
                if (!touchPointRoot) {
                    console.log(
                        `[WebXRControllerMesh] Could not find touch dot, ${component.touchPointNodeName}, in touchpad component ${componentId}`
                    );
                } else {
                    const sphereGeometry = new SphereGeometry(0.001);
                    const material = new MeshBasicMaterial({
                        color: 0x0000ff,
                    });
                    const sphere = new Mesh(sphereGeometry, material);
                    touchPointRoot.add(sphere);
                }
            }
        }
    }

    unsubscribe(): void {
        if (this.closed) {
            return;
        }
        this.closed = true;
        if (this._scene) {
            disposeGroup(this._scene);
            this._scene = null;
        }
        if (this._pointer) {
            this._pointer.dispose();
            this._pointer = null;
        }
        this._nodes = new Map();
        this._bones = null;
    }
}
