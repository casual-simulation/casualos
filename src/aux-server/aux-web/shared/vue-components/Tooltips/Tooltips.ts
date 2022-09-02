import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    PrecalculatedBot,
    asyncResult,
    asyncError,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { Input } from '../../scene/Input';
import { Vector2 } from '@casual-simulation/three';
import Tooltip from '../Tooltip/Tooltip';

const MAX_TOOLTIP_DISTANCE_SQR = 100 * 100;

@Component({
    components: {
        tooltip: Tooltip,
    },
})
export default class Tooltips extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _tooltipIdCounter: number = 0;
    private _hasCheckLoop: boolean = false;

    tooltips: TooltipInfo[] = [];
    extraStyle: Object = {};

    constructor() {
        super();
    }

    created() {
        this.tooltips = [];
        this._tooltipIdCounter = 0;
        this._sub = new Subscription();
        this._simulations = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap((sim) => this._onSimulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap((sim) => this._onSimulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private _onSimulationAdded(sim: BrowserSimulation) {
        let sub = new Subscription();
        this._simulations.set(sim, sub);

        sub.add(
            sim.localEvents.subscribe((e) => {
                if (e.type === 'show_tooltip') {
                    try {
                        const id = (this._tooltipIdCounter += 1);

                        const mousePosition = Input.instance?.getMousePagePos();
                        const style: any = {};
                        const position = new Vector2(
                            window.innerWidth / 2,
                            window.innerHeight / 2
                        );
                        let useMousePositioning = true;

                        if (hasValue(e.pixelY) || hasValue(mousePosition)) {
                            if (hasValue(e.pixelY)) {
                                useMousePositioning = false;
                            }
                            const y = e.pixelY ?? mousePosition.y + 38;
                            style.top = y + 'px';
                            position.setY(y);
                        }
                        if (hasValue(e.pixelX) || hasValue(mousePosition)) {
                            if (hasValue(e.pixelX)) {
                                useMousePositioning = false;
                            }
                            const x = e.pixelX ?? mousePosition.x;
                            style.left = x + 'px';
                            position.setX(x);
                        }

                        const duration = e.duration;
                        if (Number.isFinite(duration)) {
                            setTimeout(() => {
                                this._animateTooltip(id);
                            }, duration);
                        }

                        this.tooltips = [
                            ...this.tooltips,
                            {
                                id,
                                message: e.message,
                                style: style,
                                hidden: false,
                                position,
                                useMousePositioning,
                            },
                        ];

                        if (useMousePositioning) {
                            this._queueCheckLoop();
                        }
                        if (hasValue(e.taskId)) {
                            sim.helper.transaction(asyncResult(e.taskId, id));
                        }
                    } catch (err) {
                        if (hasValue(e.taskId)) {
                            sim.helper.transaction(
                                asyncError(e.taskId, err.toString())
                            );
                        } else {
                            console.error(err);
                        }
                    }
                } else if (e.type === 'hide_tooltip') {
                    let ids = e.tooltipIds ?? this.tooltips.map((t) => t.id);
                    for (let id of ids) {
                        this._animateTooltip(id);
                    }
                    if (hasValue(e.taskId)) {
                        sim.helper.transaction(asyncResult(e.taskId, null));
                    }
                }
            })
        );
    }

    private _animateTooltip(id: number) {
        const tooltipIndex = this.tooltips.findIndex((t) => t.id === id);
        if (tooltipIndex >= 0) {
            const tooltip = this.tooltips[tooltipIndex];
            tooltip.hidden = true;
            setTimeout(() => {
                this._removeTooltip(id);
            }, 1000);
        }
    }

    private _removeTooltip(id: number) {
        this.tooltips = this.tooltips.filter((t) => t.id !== id);
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
    }

    private _queueCheckLoop() {
        if (!this._hasCheckLoop) {
            this._hasCheckLoop = true;
            window.requestAnimationFrame(() => {
                this._checkTooltipsAgainstMouse();
            });
        }
    }

    private _checkTooltipsAgainstMouse() {
        const mousePosition = Input.instance?.getMousePagePos();

        let hasMousePositionedTooltip = false;
        for (let tip of this.tooltips) {
            if (!tip.hidden && tip.useMousePositioning) {
                hasMousePositionedTooltip = true;
                if (!this._isTooltipNearMouse(tip, mousePosition)) {
                    this._animateTooltip(tip.id);
                }
            }
        }

        this._hasCheckLoop = false;
        if (hasMousePositionedTooltip) {
            this._queueCheckLoop();
        }
    }

    private _isTooltipNearMouse(tooltip: TooltipInfo, mousePosition: Vector2) {
        const distanceSqr = tooltip.position.distanceToSquared(mousePosition);
        return distanceSqr <= MAX_TOOLTIP_DISTANCE_SQR;
    }
}

interface TooltipInfo {
    id: number;
    message: any;
    style: any;
    hidden: boolean;
    position: Vector2;
    useMousePositioning: boolean;
}
