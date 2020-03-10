import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';
import { wrapHtmlWithSandboxContentSecurityPolicy } from '../../../shared/SharedUtils';

@Component
export default class HtmlModal extends Vue {
    innerHtml: string = '';
    open: boolean = false;

    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    get html() {
        return wrapHtmlWithSandboxContentSecurityPolicy(this.innerHtml);
    }

    created() {
        this._sub = new Subscription();
        this._simulationSubs = new Map();

        this._sub.add(
            appManager.simulationManager.simulationAdded
                .pipe(tap(sim => this._simulationAdded(sim)))
                .subscribe()
        );
        this._sub.add(
            appManager.simulationManager.simulationRemoved
                .pipe(tap(sim => this._simulationRemoved(sim)))
                .subscribe()
        );
    }

    beforeDestroy() {
        this._sub.unsubscribe();
    }

    closeDialog() {
        this.open = false;
        this.innerHtml = '';
    }

    private _simulationAdded(sim: Simulation): void {
        let sub = new Subscription();
        this._sub.add(sub);

        sub.add(
            sim.localEvents.subscribe(e => {
                if (e.type === 'show_html') {
                    if (e.visible) {
                        this.innerHtml = e.html;
                    }
                    this.open = e.visible;
                }
            })
        );
    }

    private _simulationRemoved(sim: Simulation): void {
        const sub = this._simulationSubs.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulationSubs.delete(sim);
    }
}
