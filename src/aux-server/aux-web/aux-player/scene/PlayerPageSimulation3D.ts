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
    DEFAULT_INVENTORY_VISIBLE,
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
} from 'three';
import { CameraRig } from '../../shared/scene/CameraRigFactory';
import { Game } from '../../shared/scene/Game';
import { PlayerGame } from './PlayerGame';
import { UpdatedBotInfo, BotDimensionEvent } from '@casual-simulation/aux-vm';
import { PlayerSimulation3D } from './PlayerSimulation3D';
import { portalToHand } from '../../shared/scene/xr/WebXRHelpers';
import { DimensionGroup } from '../../shared/scene/DimensionGroup';
import { Subscription } from 'rxjs';
import { WristPortalConfig } from './WristPortalConfig';

export class PlayerPageSimulation3D extends PlayerSimulation3D {
    private _handBindings = new Map<string, Subscription>();

    constructor(game: Game, simulation: BrowserSimulation) {
        super(
            ['auxPagePortal', 'auxLeftWristPortal', 'auxRightWristPortal'],
            game,
            simulation
        );
    }

    getMainCameraRig(): CameraRig {
        return this._game.getMainCameraRig();
    }

    get pageConfig() {
        return this.getPortalConfig('auxPagePortal');
    }

    get leftWristConfig() {
        return this.getPortalConfig('auxLeftWristPortal');
    }

    get rightWristConfig() {
        return this.getPortalConfig('auxRightWristPortal');
    }

    /**
     * Gets the background color that the simulation defines.
     */
    get backgroundColor() {
        return this.pageConfig.backgroundColor || super.backgroundColor;
    }

    /**
     * Gets the pannability of the inventory camera that the simulation defines.
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
     * Gets if rotation is allowed in the inventory that the simulation defines.
     */
    get rotatable() {
        return this.pageConfig.rotatable;
    }

    /**
     * Gets if zooming is allowed in the inventory that the simulation defines.
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

    protected _createPortalConfig(portalTag: string) {
        const hand = portalToHand(portalTag);
        if (hand) {
            return new WristPortalConfig(portalTag, this.simulation);
        }
        return super._createPortalConfig(portalTag);
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

    private _bindDimensionGroupToHand(group: DimensionGroup3D, hand: string) {
        const input = this.game.getInput();
        const sub = input.controllerAdded
            .pipe(
                filter(c => c.inputSource.handedness === hand),
                tap(controller => {
                    console.log(
                        '[PlayerPageSimulation3D] Bind to controller',
                        controller
                    );
                    controller.mesh.group.add(group);
                    group.updateMatrixWorld(true);
                }),
                switchMap(controller => {
                    return input.controllerRemoved.pipe(
                        filter(c => c === controller),
                        take(1),
                        tap(controller => {
                            console.log(
                                '[PlayerPageSimulation3D] Remove from controller',
                                controller
                            );
                            controller.mesh.group.remove(group);
                        })
                    );
                })
            )
            .subscribe();

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
        hand: string
    ) {
        console.log('[PlayerPageSimulation3D] Unbind from controller', hand);
        const sub = this._handBindings.get(hand);
        if (sub) {
            sub.unsubscribe();
        }
        if (group.parent) {
            group.parent.remove(group);
        }
    }
}
