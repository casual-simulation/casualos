import { Subscription, SubscriptionLike } from 'rxjs';
import { BrowserSimulation } from './BrowserSimulation';
import {
    Simulation,
    SimulationManager,
} from '@casual-simulation/aux-vm/managers';
import { AuthHelper } from './AuthHelper';
import { generateV1ConnectionToken } from '@casual-simulation/aux-records/AuthUtils';
import { PartitionAuthRequest } from '@casual-simulation/aux-common';

/**
 * Defines a class that is able to coordinate authentication across multiple simulations.
 */
export class AuthCoordinator<TSim extends BrowserSimulation>
    implements SubscriptionLike
{
    private _simulationManager: SimulationManager<TSim>;
    private _sub: Subscription;

    constructor(manager: SimulationManager<TSim>) {
        this._simulationManager = manager;
        this._sub = new Subscription();

        this._sub.add(
            this._simulationManager.watchSimulations((sim) => {
                let sub = new Subscription();

                sub.add(
                    sim.onAuthMessage.subscribe(async (msg) => {
                        if (msg.type === 'request') {
                            this._handleAuthRequest(sim, msg);
                        }
                    })
                );

                return sub;
            })
        );
    }

    private async _handleAuthRequest(
        sim: TSim,
        request: PartitionAuthRequest
    ): Promise<void> {
        const endpoint = sim.auth.primary;
        const key = await endpoint.getConnectionKey();

        if (!key) {
            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionId: sim.configBotId,
                },
            });
        } else {
            const connectionId = sim.configBotId;
            const recordName = sim.origin.recordName;
            const inst = sim.inst;
            const token = generateV1ConnectionToken(
                key,
                connectionId,
                recordName,
                inst
            );

            sim.sendAuthMessage({
                type: 'response',
                success: true,
                origin: request.origin,
                indicator: {
                    connectionToken: token,
                },
            });
        }
    }

    unsubscribe(): void {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}
