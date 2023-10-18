import { Observable, Subject, Subscription, SubscriptionLike } from 'rxjs';
import { BrowserSimulation } from './BrowserSimulation';
import {
    Simulation,
    SimulationManager,
} from '@casual-simulation/aux-vm/managers';
import { AuthHelper } from './AuthHelper';
import { generateV1ConnectionToken } from '@casual-simulation/aux-records/AuthUtils';
import {
    DenialReason,
    MissingPermissionDenialReason,
    PartitionAuthRequest,
} from '@casual-simulation/aux-common';

/**
 * Defines a class that is able to coordinate authentication across multiple simulations.
 */
export class AuthCoordinator<TSim extends BrowserSimulation>
    implements SubscriptionLike
{
    private _simulationManager: SimulationManager<TSim>;
    private _onMissingPermission: Subject<MissingPermissionEvent> =
        new Subject();
    private _sub: Subscription;

    get onMissingPermission(): Observable<MissingPermissionEvent> {
        return this._onMissingPermission;
    }

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
        if (request.kind === 'need_indicator') {
            await this._handleNeedIndicator(sim, request);
        } else if (request.kind === 'invalid_indicator') {
            await this._handleInvalidIndicator(sim, request);
        } else if (request.kind === 'not_authorized') {
            await this._handleNotAuthorized(sim, request);
        }
    }

    private async _handleNeedIndicator(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
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

    private async _handleInvalidIndicator(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        const endpoint = sim.auth.primary;
        let key: string;
        if (request.errorCode === 'invalid_token') {
            if (await endpoint.isAuthenticated()) {
                await endpoint.logout();
                await endpoint.authenticate();
            }
        } else {
            key = await endpoint.getConnectionKey();
            if (!key) {
                await endpoint.authenticate();
            }
        }

        if (!key) {
            key = await endpoint.getConnectionKey();
        }

        if (key) {
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

    private async _handleNotAuthorized(
        sim: TSim,
        request: PartitionAuthRequest
    ) {
        if (request.reason?.type === 'missing_permission') {
            await this._handleMissingPermission(sim, request, request.reason);
        }
    }

    private async _handleMissingPermission<TSim extends BrowserSimulation>(
        sim: TSim,
        request: PartitionAuthRequest,
        reason: MissingPermissionDenialReason
    ) {
        this._onMissingPermission.next({
            simulationId: sim.id,
            errorCode: request.errorCode,
            errorMessage: request.errorMessage,
            reason,
        });
    }

    unsubscribe(): void {
        return this._sub.unsubscribe();
    }

    get closed(): boolean {
        return this._sub.closed;
    }
}

export interface MissingPermissionEvent {
    simulationId: string;
    errorCode: string;
    errorMessage: string;
    reason: MissingPermissionDenialReason;
}
