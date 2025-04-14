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
import type { AuxVM } from '@casual-simulation/aux-vm/vm';
import { BaseSimulation, LoginManager } from '@casual-simulation/aux-vm';
import type { RemoteSimulation } from './RemoteSimulation';
import type { SimulationOrigin } from '@casual-simulation/aux-vm/managers';
import { PortalManager } from '@casual-simulation/aux-vm/managers';

/**
 * Defines a class that provides an implementation of RemoteSimulation.
 */
export class RemoteSimulationImpl
    extends BaseSimulation
    implements RemoteSimulation
{
    private _login: LoginManager;
    private _portals: PortalManager;
    private _origin: SimulationOrigin;

    get login() {
        return this._login;
    }

    get portals() {
        return this._portals;
    }

    constructor(id: string, origin: SimulationOrigin, vm: AuxVM) {
        super(vm);
        this._origin = origin;
        this._login = new LoginManager(this._vm);
    }

    get origin(): SimulationOrigin {
        return this._origin;
    }

    get recordName(): string {
        return this.origin.recordName;
    }

    get inst(): string {
        return this.origin.inst ?? this.id;
    }

    protected _beforeVmInit() {
        super._beforeVmInit();
        this._portals = new PortalManager(this._vm);
        this._subscriptions.push(this._portals);
    }
}
