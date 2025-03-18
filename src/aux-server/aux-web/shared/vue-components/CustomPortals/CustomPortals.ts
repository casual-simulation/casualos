import type { PortalData, PortalUpdate } from '@casual-simulation/aux-vm';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { loadScript, userBotChanged } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { concatMap, tap } from 'rxjs/operators';
import Vue, { ComponentOptions } from 'vue';
import Component from 'vue-class-component';
import { Prop } from 'vue-property-decorator';
import CustomPortal from '../CustomPortal/CustomPortal';
import { hasValue } from '@casual-simulation/aux-common/bots/BotCalculations';

@Component({
    components: {
        'custom-portal': CustomPortal,
    },
})
export default class CustomPortals extends Vue {
    @Prop({ default: null })
    vmOrigin: string;

    portals: CustomPortalData[] = [];

    private _simulations: Map<BrowserSimulation, Subscription>;
    private _sub: Subscription;

    created() {
        this.portals = [];
        this._simulations = new Map();
        this._sub = new Subscription();

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
    }

    private _onSimulationRemoved(sim: BrowserSimulation) {
        const sub = this._simulations.get(sim);
        if (sub) {
            sub.unsubscribe();
        }
        this._simulations.delete(sim);
        this.portals = this.portals.filter((p) => p.simulationId !== sim.id);
    }

    private _onPortalDiscovered(
        sim: BrowserSimulation,
        portal: PortalData
    ): void {
        if (hasValue(portal.source)) {
            this.portals.push({
                simulationId: sim.id,
                portalId: portal.id,
                source: portal.source,
                error: portal.error,
                ports: portal.ports,
                style: portal.style ?? {},
            });
        }
    }

    private _onPortalUpdated(
        sim: BrowserSimulation,
        update: PortalUpdate
    ): void {
        const portal = this.portals.find(
            (p) => p.portalId === update.portal.id
        );
        if (portal) {
            portal.source = update.portal.source;
            portal.style = update.portal.style;
            portal.error = update.portal.error;
            portal.ports = update.portal.ports;
        } else {
            this._onPortalDiscovered(sim, update.portal);
        }
    }
}

interface CustomPortalData {
    simulationId: string;
    portalId: string;
    source: string;
    error: string;
    ports: {
        [id: string]: MessagePort;
    };
    style: any;
}
