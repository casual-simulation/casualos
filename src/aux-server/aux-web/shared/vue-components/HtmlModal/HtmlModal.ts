import Vue from 'vue';
import Component from 'vue-class-component';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { appManager } from '../../AppManager';
import { Simulation } from '@casual-simulation/aux-vm';

@Component
export default class HtmlModal extends Vue {
    innerHtml: string = '';
    open: boolean = false;

    private _sub: Subscription;
    private _simulationSubs: Map<Simulation, Subscription>;

    get html() {
        return `<html><head>
            <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline'; script-src 'none'; style-src * 'unsafe-inline'">
            <style>* { box-sizing: border-box; } html { font-family: Roboto, apple-system, BlinkMacSystemFont, 'Segoe UI', Oxygen, Ubuntu, Cantarell, 'Fira Sans', 'Droid Sans', 'Helvetica Neue', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; } html, body { width: 100%;height: 100%; margin: 0; position: absolute; } body > iframe, body > video { width: 100%; height: 100%; }</style></head><body>${
                this.innerHtml
            }</body></html>`;
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
                    this.innerHtml = e.html;
                    this.open = true;
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
