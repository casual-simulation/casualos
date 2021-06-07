import {
    Bot,
    BotCalculationContext,
    hasValue,
    DEFAULT_SCENE_BACKGROUND_COLOR,
    isDimensionLocked,
    calculateGridScale,
    PrecalculatedBot,
    toast,
    calculateBotValue,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    BotIndexEvent,
    DEFAULT_MINI_PORTAL_VISIBLE,
    getPortalConfigBotID,
    DEFAULT_PORTAL_ROTATABLE,
    DEFAULT_PORTAL_PANNABLE,
    DEFAULT_PORTAL_ZOOMABLE,
} from '@casual-simulation/aux-common';
import { Simulation3D } from '../../shared/scene/Simulation3D';
import {
    BrowserSimulation,
    userBotChanged,
    userBotTagsChanged,
    watchPortalConfigBot,
} from '@casual-simulation/aux-vm-browser';
import {
    tap,
    filter,
    map,
    distinctUntilChanged,
    switchMap,
    take,
} from 'rxjs/operators';
import { DimensionGroup3D } from '../../shared/scene/DimensionGroup3D';
import { doesBotDefinePlayerDimension } from '../PlayerUtils';
import {
    Color,
    Texture,
    OrthographicCamera,
    PerspectiveCamera,
    MathUtils as ThreeMath,
    Object3D,
    Vector3,
    Euler,
} from '@casual-simulation/three';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { UpdatedBotInfo, BotDimensionEvent } from '@casual-simulation/aux-vm';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { portalToHand, handToPortal } from '../../shared/scene/xr/WebXRHelpers';
import { DimensionGroup } from '../../shared/scene/DimensionGroup';
import { Subscription, Observable } from 'rxjs';
import { WristPortalConfig } from './WristPortalConfig';
import { XRHandedness } from 'aux-web/shared/scene/xr/WebXRTypes';
import { ControllerData, Input } from 'aux-web/shared/scene/Input';
import { PortalConfig } from './PortalConfig';
import { merge } from 'lodash';
import {
    objectForwardRay,
    objectDirectionRay,
    objectWorldDirectionRay,
    cameraForwardRay,
} from '../../shared/scene/SceneUtils';
import { DebugObjectManager } from '../../shared/scene/debugobjectmanager/DebugObjectManager';

const DEFAULT_RIGHT_WRIST_POSITION_OFFSET = new Vector3(0.05, 0.1, 0.1);
const DEFAULT_RIGHT_WRIST_ROTATION_OFFSET = new Euler(
    -120 * ThreeMath.DEG2RAD,
    0,
    -90 * ThreeMath.DEG2RAD
);
const DEFAULT_LEFT_WRIST_POSITION_OFFSET = new Vector3(-0.05, 0.1, 0.1);
const DEFAULT_LEFT_WRIST_ROTATION_OFFSET = new Euler(
    -120 * ThreeMath.DEG2RAD,
    0,
    90 * ThreeMath.DEG2RAD
);

/**
 * The value that the dot product between the camera
 * and the controller grid should be less than in order to show the portal.
 */
const WRIST_ACTIVE_DOT_PRODUCT_RANGE = -0.57;

export class PlayerPageSimulation3D extends PlayerSimulation3D {
    private _handBindings = new Map<string, Subscription>();

    constructor(game: Game, simulation: BrowserSimulation) {
        super(
            ['pagePortal', 'leftWristPortal', 'rightWristPortal'],
            game,
            simulation
        );
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    getDefaultGridScale(): number {
        return this.pageConfig.gridScale;
    }

    get pageConfig() {
        return this.getPortalConfig('pagePortal');
    }

    get leftWristConfig() {
        return this.getPortalConfig('leftWristPortal');
    }

    get rightWristConfig() {
        return this.getPortalConfig('rightWristPortal');
    }

    get cameraControlsMode() {
        return this.pageConfig.cameraControlsMode ?? super.cameraControlsMode;
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.pageConfig.backgroundColor || super.backgroundColor;
    }

    get backgroundAddress() {
        return this.pageConfig.backgroundAddress || super.backgroundAddress;
    }

    /**
     * Gets the pannability of the mini portal camera that the simulation defines.
     */
    get pannable() {
        return this.pageConfig.pannable;
    }

    /**
     * Gets the minimum value the pan can be set to on the x axis
     */
    get panMinX() {
        return this.pageConfig.panMinX;
    }

    /**
     * Gets the maximum value the pan can be set to on the x axis
     */
    get panMaxX() {
        return this.pageConfig.panMaxX;
    }

    /**
     * Gets the minimum value the pan can be set to on the y axis
     */
    get panMinY() {
        return this.pageConfig.panMinY;
    }

    /**
     * Gets the maximum value the pan can be set to on the y axis
     */
    get panMaxY() {
        return this.pageConfig.panMaxY;
    }

    /**
     * Gets if rotation is allowed in the mini portal that the simulation defines.
     */
    get rotatable() {
        return this.pageConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the mini portal that the simulation defines.
     */
    get zoomable() {
        return this.pageConfig.zoomable;
    }

    /**
     * Gets the minimum value the zoom can be set to
     */
    get zoomMin() {
        return this.pageConfig.zoomMin;
    }

    /**
     * Gets the maximum value the zoom can be set to
     */
    get zoomMax() {
        return this.pageConfig.zoomMax;
    }

    /**
     * Gets the zoom level of the player that the simulation defines.
     */
    get playerZoom() {
        return this.pageConfig.playerZoom;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationX() {
        return this.pageConfig.playerRotationX;
    }

    /**
     * Gets the x-axis rotation of the player that the simulation defines.
     */
    get playerRotationY() {
        return this.pageConfig.playerRotationY;
    }

    /**
     * Gets whether to show the camera focus point.
     */
    get showFocusPoint() {
        return this.pageConfig.showFocusPoint;
    }

    /**
     * Gets whether the canvas transparency should be disabled.
     */
    get disableCanvasTransparency() {
        return this.pageConfig.disableCanvasTransparency;
    }

    /**
     * Gets the style the cursor should have for this portal.
     */
    get cursor() {
        return this.pageConfig.cursor;
    }

    protected _frameUpdateCore(calc: BotCalculationContext) {
        super._frameUpdateCore(calc);
        const input = this.game.getInput();
        const controllers = input.controllers;
        for (let controller of controllers) {
            const portal = handToPortal(controller.inputSource.handedness);
            const config = this.getPortalConfig(portal);
            if (!config) {
                continue;
            }
            const gridRay = objectWorldDirectionRay(
                new Vector3(0, 1, 0),
                <Object3D>(<unknown>config.grid3D)
            );

            const cameraRig = this.getMainCameraRig();
            const cameraRay = cameraForwardRay(cameraRig.mainCamera);

            const dot = cameraRay.direction.dot(gridRay.direction);
            // If the grid's up direction is pointing towards the camera's forward direction
            const facingCamera = dot < WRIST_ACTIVE_DOT_PRODUCT_RANGE;
            const group = this.getDimensionGroupForPortal(portal);
            const hasPortal = !!group && group.dimensions.size > 0;
            config.grid3D.enabled = hasPortal && facingCamera;

            if (group) {
                group.visible = facingCamera;
            }
        }

        if (hasValue(this.pageConfig.cameraType)) {
            if (!this.game.isImmersive) {
                this.game.setCameraType(this.pageConfig.cameraType);
            }
        }
    }

    protected _createPortalConfig(portalTag: string) {
        const hand = portalToHand(portalTag);
        if (hand) {
            const config = new WristPortalConfig(portalTag, this.simulation);
            config.grid3D.enabled = false;
            return config;
        }
        return super._createPortalConfig(portalTag);
    }

    protected _bindPortalConfig(config: PortalConfig) {
        if (config instanceof WristPortalConfig) {
            return this._bindWristPortalConfig(config);
        } else {
            return super._bindPortalConfig(config);
        }
    }

    protected _bindWristPortalConfig(config: WristPortalConfig) {
        const hand = portalToHand(config.portalTag);
        const input = this.game.getInput();

        const controllerAdded = input.controllerAdded.pipe(
            filter((c) => c.inputSource.handedness === hand)
        );
        const controllerRemoved = input.controllerRemoved;

        const gridObj = <Object3D>(<unknown>config.grid3D);
        const sub = bindToController(
            controllerAdded,
            controllerRemoved,
            (controller) => {
                controller.mesh.mesh.add(gridObj);
                applyWristControllerOffset(hand, gridObj);

                return new Subscription(() => {
                    controller.mesh.mesh.remove(gridObj);
                });
            }
        );
        this._subs.push(sub);
    }

    protected _bindDimensionGroup(group: DimensionGroup) {
        if (group instanceof DimensionGroup3D) {
            const hand = portalToHand(group.portalTag);
            if (hand) {
                this._bindDimensionGroupToHand(group, hand);
            } else {
                super._bindDimensionGroup(group);
            }
        }
    }

    private _bindDimensionGroupToHand(
        group: DimensionGroup3D,
        hand: XRHandedness
    ) {
        const input = this.game.getInput();
        const portal = handToPortal(hand);
        const config = this.getPortalConfig(portal);

        const controllerAdded = input.controllerAdded.pipe(
            filter((c) => c.inputSource.handedness === hand)
        );
        const controllerRemoved = input.controllerRemoved;

        const sub = bindToController(
            controllerAdded,
            controllerRemoved,
            (controller) => {
                console.log(
                    '[PlayerPageSimulation3D] Bind to controller',
                    controller
                );
                // if (config) {
                //     config.grid3D.enabled = true;
                // }
                controller.mesh.mesh.add(group);
                applyWristControllerOffset(hand, group);
                group.updateMatrixWorld(true);

                return new Subscription(() => {
                    console.log(
                        '[PlayerPageSimulation3D] Remove from controller',
                        controller
                    );
                    if (config) {
                        config.grid3D.enabled = false;
                    }
                    controller.mesh.mesh.remove(group);
                });
            }
        );

        this._handBindings.set(hand, sub);
        this._subs.push(sub);
    }

    protected _unbindDimensionGroup(group: DimensionGroup3D) {
        if (group instanceof DimensionGroup3D) {
            const hand = portalToHand(group.portalTag);
            if (hand) {
                this._unbindDimensionGroupFromHand(group, hand);
            } else {
                super._unbindDimensionGroup(group);
            }
        }
    }

    private _unbindDimensionGroupFromHand(
        group: DimensionGroup3D,
        hand: XRHandedness
    ) {
        console.log('[PlayerPageSimulation3D] Unbind from controller', hand);
        const sub = this._handBindings.get(hand);
        if (sub) {
            sub.unsubscribe();
        }
        const portal = handToPortal(hand);
        const config = this.getPortalConfig(portal);
        if (config) {
            config.grid3D.enabled = false;
        }
        if (group.parent) {
            group.parent.remove(group);
        }
    }
}

const offsets = {
    right: {
        positionOffset: DEFAULT_RIGHT_WRIST_POSITION_OFFSET,
        rotationOffset: DEFAULT_RIGHT_WRIST_ROTATION_OFFSET,
    },
    left: {
        positionOffset: DEFAULT_LEFT_WRIST_POSITION_OFFSET,
        rotationOffset: DEFAULT_LEFT_WRIST_ROTATION_OFFSET,
    },
    none: {
        positionOffset: new Vector3(),
        rotationOffset: new Euler(),
    },
};

if (typeof window !== 'undefined') {
    merge(window, {
        aux: {
            setWristControllerPosition: function (
                hand: keyof typeof offsets,
                x: number,
                y: number,
                z: number
            ) {
                offsets[hand].positionOffset.set(x, y, z);
            },
            setWristControllerRotation: function (
                hand: keyof typeof offsets,
                x: number,
                y: number,
                z: number
            ) {
                offsets[hand].rotationOffset.set(
                    x * ThreeMath.DEG2RAD,
                    y * ThreeMath.DEG2RAD,
                    z * ThreeMath.DEG2RAD
                );
            },
        },
    });
}

function applyWristControllerOffset(hand: keyof typeof offsets, obj: Object3D) {
    obj.position.copy(offsets[hand].positionOffset);
    obj.rotation.copy(offsets[hand].rotationOffset);
}

function bindToController(
    controllerAdded: Observable<ControllerData>,
    controllerRemoved: Observable<ControllerData>,
    action: (controller: ControllerData) => Subscription
): Subscription {
    const sub = controllerAdded
        .pipe(
            map((controller) => ({ sub: action(controller), controller })),
            switchMap((data) => {
                return controllerRemoved.pipe(
                    filter((c) => c === data.controller),
                    take(1),
                    tap((c) => data.sub.unsubscribe())
                );
            })
        )
        .subscribe();

    return sub;
}
