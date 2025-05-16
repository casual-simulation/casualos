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
import type { PortalData, PortalUpdate } from '@casual-simulation/aux-vm';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import { appManager } from '../../AppManager';
import { Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import Vue from 'vue';
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
