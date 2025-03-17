import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type {
    BotCalculationContext,
    BotLOD,
    ShoutAction,
} from '@casual-simulation/aux-common';
import {
    calculateGridScale,
    getBuilderDimensionGrid,
    DEFAULT_WORKSPACE_GRID_SCALE,
    botHasLOD,
    DEFAULT_BOT_LOD,
    calculateNumericalTagValue,
    DEFAULT_BOT_LOD_MIN_THRESHOLD,
    DEFAULT_BOT_LOD_MAX_THRESHOLD,
    calculateBotLOD,
    onLODArg,
    ON_MAX_LOD_ENTER_ACTION_NAME,
    ON_MIN_LOD_ENTER_ACTION_NAME,
    ON_MIN_LOD_EXIT_ACTION_NAME,
    ON_ANY_MIN_LOD_EXIT_ACTION_NAME,
    ON_MAX_LOD_EXIT_ACTION_NAME,
    ON_ANY_MAX_LOD_EXIT_ACTION_NAME,
    ON_ANY_MIN_LOD_ENTER_ACTION_NAME,
    ON_ANY_MAX_LOD_ENTER_ACTION_NAME,
} from '@casual-simulation/aux-common';
import { calculateScale, percentOfScreen } from '../SceneUtils';
import type { Camera } from '@casual-simulation/three';
import type { Simulation } from '@casual-simulation/aux-vm';
import { DebugObjectManager } from '../debugobjectmanager/DebugObjectManager';

export class BotLODDecorator extends AuxBot3DDecoratorBase {
    private _currentLOD: BotLOD = DEFAULT_BOT_LOD;
    private _minThreshold: number;
    private _maxThreshold: number;
    private _camera: Camera;
    private _simulation: Simulation;

    constructor(bot3D: AuxBot3D) {
        super(bot3D);
        if (this.bot3D.dimensionGroup) {
            this._simulation =
                this.bot3D.dimensionGroup.simulation3D.simulation;
        }
    }

    frameUpdate?(calc: BotCalculationContext): void;

    botUpdated(calc: BotCalculationContext): void {
        this._updateCamera();
        if (!this._camera) {
            return;
        }
        const hasLOD = botHasLOD(calc, this.bot3D.bot);
        this._minThreshold = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxMinLODThreshold',
            DEFAULT_BOT_LOD_MIN_THRESHOLD
        );
        this._maxThreshold = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxMaxLODThreshold',
            DEFAULT_BOT_LOD_MAX_THRESHOLD
        );

        if (hasLOD && !this.frameUpdate) {
            this.frameUpdate = this._frameUpdate;
            this.bot3D.updateFrameUpdateList();
        } else if (!hasLOD && this.frameUpdate) {
            this.frameUpdate = null;
            this.bot3D.updateFrameUpdateList();
        }

        this._updateLOD(calc);
    }

    dispose(): void {}

    private _frameUpdate(calc: BotCalculationContext): void {
        this._updateCamera();
        if (!this._camera) {
            return;
        }
        this._updateLOD(calc);
    }

    private _updateCamera() {
        if (this.bot3D.dimensionGroup) {
            this._camera =
                this.bot3D.dimensionGroup.simulation3D.getMainCameraRig().mainCamera;
        }
    }

    private _updateLOD(calc: BotCalculationContext) {
        const percent = percentOfScreen(
            this._camera,
            this.bot3D.unitBoundingSphere
        );
        const nextLOD = calculateBotLOD(
            percent,
            this._minThreshold,
            this._maxThreshold
        );

        if (this._currentLOD !== nextLOD) {
            this._sendLODEvents(nextLOD);
        }

        this._currentLOD = nextLOD;
    }

    private _sendLODEvents(nextLOD: string) {
        const arg = onLODArg(this.bot3D.bot, this.bot3D.dimension);
        let actions = [] as ShoutAction[];
        if (this._currentLOD === 'min') {
            // send min exit event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MIN_LOD_EXIT_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MIN_LOD_EXIT_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        } else if (this._currentLOD === 'max') {
            // send max exit event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MAX_LOD_EXIT_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MAX_LOD_EXIT_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        }
        if (nextLOD === 'min') {
            // send min enter event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MIN_LOD_ENTER_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MIN_LOD_ENTER_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        } else if (nextLOD === 'max') {
            // send max enter event
            // send min enter event
            actions.push(
                ...this._simulation.helper.actions([
                    {
                        eventName: ON_MAX_LOD_ENTER_ACTION_NAME,
                        bots: [this.bot3D.bot],
                        arg,
                    },
                    {
                        eventName: ON_ANY_MAX_LOD_ENTER_ACTION_NAME,
                        bots: null,
                        arg,
                    },
                ])
            );
        }
        if (actions.length > 0) {
            this._simulation.helper.transaction(...actions);
        }
    }
}
