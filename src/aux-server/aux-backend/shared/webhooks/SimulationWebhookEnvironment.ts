import {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    WebhookEnvironment,
} from '@casual-simulation/aux-records';
import { DenoSimulationImpl, DenoVM } from '@casual-simulation/aux-vm-deno';
import { getSimulationId } from '../../../aux-web/shared/AppManager';
import { v4 as uuid } from 'uuid';
import {
    AuxConfig,
    Simulation,
    SimulationOrigin,
} from '@casual-simulation/aux-vm';
import {
    addState,
    applyUpdatesToInst,
    ConnectionIndicator,
    first,
    remote,
} from '@casual-simulation/aux-common';

export type WebhookSimulationFactory = (
    simId: string,
    indicator: ConnectionIndicator,
    origin: SimulationOrigin,
    config: AuxConfig
) => Simulation;

/**
 * Defines a webhook environment that is able to run webhooks in a Simulation.
 */
export class SimulationWebhookEnvironment implements WebhookEnvironment {
    private _factory: WebhookSimulationFactory;

    constructor(factory: WebhookSimulationFactory) {
        this._factory = factory;
    }

    async handleHttpRequest(
        request: HandleHttpRequestRequest
    ): Promise<HandleHttpRequestResult> {
        const configBotId = uuid();
        const inst = request.inst ?? uuid();
        const simId = getSimulationId(request.recordName, inst, false);
        const origin: SimulationOrigin = {
            recordName: request.recordName,
            inst: inst,
        };
        const config: AuxConfig = {
            config: {
                version: GIT_TAG,
                versionHash: GIT_HASH,
            },
            configBotId,
            partitions: {
                shared: {
                    type: 'yjs',
                },
            },
        };
        const indicator: ConnectionIndicator = {
            connectionId: configBotId,
        };

        const sim = this._factory(simId, indicator, origin, config);
        try {
            await sim.init();

            if (request.state) {
                if (request.state.type === 'aux') {
                    const state = request.state.state;
                    if (state.version === 1) {
                        await sim.helper.transaction(addState(state.state));
                    } else if (state.version === 2) {
                        await sim.helper.transaction(
                            remote(applyUpdatesToInst(state.updates))
                        );
                    }
                } else if (request.state.type === 'url') {
                    // TODO: Handle other state types.
                }
            }

            const results = await sim.helper.shout('onWebhook', null, {});

            return {
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify(first(results.results)),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
            };
        } catch (err) {
            console.error('[DenoWebhookEnvironment] Error occurred:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage:
                    'An error occurred while trying to handle the request.',
            };
        } finally {
            sim.unsubscribe();
        }
    }
}
