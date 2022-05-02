import Vue from 'vue';
import Component from 'vue-class-component';
import {
    hasValue,
    PrecalculatedBot,
    asyncResult,
} from '@casual-simulation/aux-common';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
    BrowserSimulation,
    userBotChanged,
} from '@casual-simulation/aux-vm-browser';
import { Input } from '../../scene/Input';

@Component({
    components: {},
})
export default class Tooltips extends Vue {
    private _sub: Subscription;
    private _simulations: Map<BrowserSimulation, Subscription> = new Map();
    private _tooltipIdCounter: number = 0;

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
            sim.localEvents.subscribe(e => {
                if (e.type === 'show_tooltip') {
                    const id = this._tooltipIdCounter += 1;

                    const mousePosition = Input.instance?.getMousePagePos();
                    const style: any = {};

                    if (hasValue(e.pixelY) || hasValue(mousePosition)) {
                        style.top = (e.pixelY ?? (mousePosition.y + 20)) + 'px';
                    }
                    if (hasValue(e.pixelX) || hasValue(mousePosition)) {
                        style.left = (e.pixelX ?? (mousePosition.x)) + 'px';
                    }

                    const duration = e.duration;

                    setTimeout(() => {
                        this._animateTooltip(id);
                    }, duration);

                    this.tooltips = [...this.tooltips, {
                        id,
                        message: e.message,
                        style: style,
                        hidden: false
                    }];

                    if (hasValue(e.taskId)) {
                        sim.helper.transaction(asyncResult(e.taskId, id));
                    }
                } else if (e.type === 'hide_tooltip') {
                    let ids = e.tooltipIds ?? this.tooltips.map(t => t.id);
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
        const tooltipIndex = this.tooltips.findIndex(t => t.id === id);
        if (tooltipIndex >= 0) {
            const tooltip = this.tooltips[tooltipIndex];
            tooltip.hidden = true;
            setTimeout(() => {
                this._removeTooltip(id);
            }, 1000);
        }
    }

    private _removeTooltip(id: number) {
        this.tooltips = this.tooltips.filter(t => t.id !== id);
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
    }
}

interface TooltipInfo {
    id: number;
    message: any;
    style: any;
    hidden: boolean;
}