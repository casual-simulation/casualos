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
import type {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    WebhookEnvironment,
} from '@casual-simulation/aux-records';
import { STORED_AUX_SCHEMA } from '@casual-simulation/aux-records';
import { v4 as uuid } from 'uuid';
import type {
    AuxConfig,
    AuxConfigParameters,
    Simulation,
    SimulationOrigin,
} from '@casual-simulation/aux-vm';
import { RecordsManager } from '@casual-simulation/aux-vm';
import type {
    BotAction,
    BotsState,
    ConnectionIndicator,
    StoredAux,
} from '@casual-simulation/aux-common';
import {
    addState,
    applyUpdatesToInst,
    botAdded,
    COOKIE_BOT_PARTITION_ID,
    createBot,
    defineGlobalBot,
    first,
    remote,
    TEMPORARY_BOT_PARTITION_ID,
    TEMPORARY_SHARED_PARTITION_ID,
} from '@casual-simulation/aux-common';
import { getSimulationId } from '../../../shared/SimulationHelpers';
import mime from 'mime';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { Observable } from 'rxjs';
import { Subscription, tap } from 'rxjs';
import { sendWebhook } from '../../../shared/WebhookUtils';
import type { AuxVM } from '@casual-simulation/aux-vm/vm';

declare const GIT_TAG: string;
declare const GIT_HASH: string;

export type WebhookSimulationFactory = (
    simId: string,
    indicator: ConnectionIndicator,
    origin: SimulationOrigin,
    config: AuxConfig
) => {
    sim: Simulation;
    vm: AuxVM;
    onLogs?: Observable<string[]>;
};

export interface SimulationEnvironmentOptions {
    /**
     * The configuration parameters that should be passed to the simulation.
     */
    configParameters?: Partial<AuxConfigParameters>;
}

const TRACE_NAME = 'SimulationWebhookEnvironment';

/**
 * Defines a webhook environment that is able to run webhooks in a Simulation.
 */
export class SimulationWebhookEnvironment implements WebhookEnvironment {
    private _factory: WebhookSimulationFactory;
    private _configParameters: Partial<AuxConfigParameters>;

    constructor(
        factory: WebhookSimulationFactory,
        options?: SimulationEnvironmentOptions
    ) {
        this._factory = factory;
        this._configParameters = options?.configParameters ?? {};
    }

    @traced(TRACE_NAME)
    async handleHttpRequest(
        request: HandleHttpRequestRequest
    ): Promise<HandleHttpRequestResult> {
        const configBotId = uuid();
        const inst = request.inst ?? uuid();
        const simId = getSimulationId(
            request.recordName,
            inst,
            request.inst ? 'default' : 'static'
        );
        const origin: SimulationOrigin = request.inst
            ? {
                  recordName: request.recordName,
                  inst: inst,
              }
            : null;

        const initialState: BotsState = {
            [configBotId]: createBot(configBotId, {
                ...request.request.query,
                owner: request.recordName,
                inst: inst,
                staticInst: !origin ? inst : undefined,
            }),
        };

        const config: AuxConfig = {
            config: {
                ...this._configParameters,
                version: typeof GIT_TAG === 'undefined' ? undefined : GIT_TAG,
                versionHash:
                    typeof GIT_HASH === 'undefined' ? undefined : GIT_HASH,
            },
            configBotId,
            partitions: {
                shared: {
                    type: 'yjs',
                    remoteEvents: true,
                },
                [TEMPORARY_BOT_PARTITION_ID]: {
                    type: 'memory',
                    private: true,
                    initialState,
                },
                [COOKIE_BOT_PARTITION_ID]: {
                    type: 'memory',
                    private: true,
                    initialState: {},
                },
                [TEMPORARY_SHARED_PARTITION_ID]: {
                    type: 'memory',
                    initialState: {},
                },
            },
        };

        const indicator: ConnectionIndicator = {
            connectionId: configBotId,
        };

        const sub = new Subscription();
        try {
            const { sim, onLogs, vm } = this._factory(
                simId,
                indicator,
                origin,
                config
            );
            sub.add(sim);

            const sessionKey = request.sessionKey;
            const authOrigin = config.config.authOrigin;
            const recordsOrigin = config.config.recordsOrigin;
            const websocketOrigin = config.config.causalRepoConnectionUrl;
            const websocketProtocol =
                config.config.causalRepoConnectionProtocol;
            const recordsManager = new RecordsManager(
                config.config,
                sim.helper,
                async (
                    endpoint: string,
                    authenticateIfNotLoggedIn: boolean
                ) => {
                    if (!recordsOrigin || endpoint !== authOrigin) {
                        return null;
                    }

                    let headers: Record<string, string> = {
                        Origin: authOrigin,
                    };
                    if (sessionKey) {
                        headers.Authorization = `Bearer ${sessionKey}`;
                    }

                    return {
                        error: false,
                        recordsOrigin,
                        token: sessionKey,
                        headers,
                        websocketOrigin,
                        websocketProtocol,
                    };
                },
                undefined
            );

            sub.add(
                vm.localEvents
                    .pipe(
                        tap((e) => {
                            recordsManager.handleEvents(e as BotAction[]);
                            for (let event of e) {
                                if (event.type === 'send_webhook') {
                                    sendWebhook(sim, event);
                                }
                            }
                        })
                    )
                    .subscribe()
            );

            const initTimeoutMs = request.options?.initTimeoutMs ?? 5000;
            const initErr = await timeout(sim.init(), initTimeoutMs);

            if (initErr && initErr instanceof Error) {
                console.error(
                    '[SimulationWebhookEnvironment] Error initializing simulation:',
                    initErr
                );
                return {
                    success: false,
                    errorCode: 'took_too_long',
                    errorMessage: `The inst took too long to start. It must take less than ${initTimeoutMs}ms.`,
                };
            }

            if (request.sessionUserId) {
                const authBot = createBot(
                    request.sessionUserId,
                    {},
                    TEMPORARY_BOT_PARTITION_ID
                );
                sim.helper.transaction(
                    botAdded(authBot),
                    defineGlobalBot('auth', authBot.id)
                );
            }

            if (request.state) {
                let state: StoredAux;
                if (request.state.type === 'aux') {
                    state = request.state.state;
                } else if (request.state.type === 'url') {
                    // TODO: Handle other state types.
                    const fetchPromise = fetch(request.state.requestUrl, {
                        method: request.state.requestMethod,
                        headers: request.state.requestHeaders,
                        credentials: 'omit',
                        mode: 'no-cors',
                        cache: 'no-store',
                    }).then((response) => response.json());

                    const fetchTimeoutMs =
                        request.options?.fetchTimeoutMs ?? 5000;
                    const data = await timeout(fetchPromise, fetchTimeoutMs);

                    if (data instanceof Error) {
                        console.error(
                            '[SimulationWebhookEnvironment] Error fetching state from URL:',
                            data
                        );
                        return {
                            success: false,
                            errorCode: 'took_too_long',
                            errorMessage: `The inst took too long to fetch the state. It must take less than ${fetchTimeoutMs}ms.`,
                        };
                    }

                    const parseResult = STORED_AUX_SCHEMA.safeParse(data);

                    if (parseResult.success === false) {
                        return {
                            success: false,
                            errorCode: 'invalid_webhook_target',
                            errorMessage:
                                'Invalid webhook target. The targeted record does not contain valid data.',
                            internalError: {
                                success: false,
                                errorCode: 'unacceptable_request',
                                errorMessage:
                                    'The data record does not contain valid AUX data.',
                                issues: parseResult.error.issues,
                            },
                        };
                    }
                    state = parseResult.data as StoredAux;
                }

                if (state) {
                    let addStatePromise: Promise<void>;
                    if (state.version === 1) {
                        addStatePromise = sim.helper.transaction(
                            addState(state.state)
                        );
                    } else if (state.version === 2) {
                        addStatePromise = sim.helper.transaction(
                            remote(applyUpdatesToInst(state.updates))
                        );
                    }

                    const addStateTimeoutMs =
                        request.options?.addStateTimeoutMs ?? 1000;
                    const addStateResult = await timeout(
                        addStatePromise,
                        addStateTimeoutMs
                    );
                    if (addStateResult instanceof Error) {
                        console.error(
                            '[SimulationWebhookEnvironment] Error applying state to inst:',
                            addStateResult
                        );
                        return {
                            success: false,
                            errorCode: 'took_too_long',
                            errorMessage: `The inst took too long to apply the fetched state. It must take less than ${addStateTimeoutMs}ms.`,
                        };
                    }
                }
            }

            let data: any = request.request.body;
            if (
                request.request.headers &&
                mime.getExtension(request.request.headers['content-type']) ===
                    'json'
            ) {
                data = JSON.parse(request.request.body);
            }

            const logs: string[] = [];
            if (onLogs) {
                sub.add(onLogs.subscribe((log) => logs.push(...log)));
            }
            const requestTimeoutMs = request.options?.requestTimeoutMs ?? 5000;
            const result = await timeout(
                sim.helper
                    .shout('onWebhook', null, {
                        method: request.request.method,
                        url: request.request.path,
                        query: request.request.query,
                        data: data,
                        headers: request.request.headers,
                        userId: request.requestUserId ?? undefined,
                    })
                    .then((result) => {
                        if (result.results.length > 0) {
                            return first(result.results);
                        }
                    }),
                requestTimeoutMs
            );

            if (result instanceof Error) {
                console.error(
                    '[SimulationWebhookEnvironment] Error handling webhook request:',
                    result
                );
                return {
                    success: false,
                    errorCode: 'took_too_long',
                    errorMessage: `The inst took too long to respond to the webhook. It must take less than ${requestTimeoutMs}ms.`,
                };
            }

            return {
                success: true,
                response: {
                    statusCode: 200,
                    body: JSON.stringify(result),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                },
                logs,
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            span?.recordException(err);
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error('[DenoWebhookEnvironment] Error occurred:', err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage:
                    'An error occurred while trying to handle the request.',
            };
        } finally {
            sub.unsubscribe();
        }
    }
}

/**
 * Races the given promise against a timeout.
 * Returns the result of the promise if it resolves before the timeout.
 * Returns an error if the timeout is reached.
 * @param promise The promise.
 * @param timeoutMs The number of miliseconds to wait before timing out.
 */
export async function timeout<T>(
    promise: Promise<T>,
    timeoutMs: number
): Promise<T | Error> {
    return await Promise.race([
        promise,
        new Promise<Error>((resolve) => {
            setTimeout(() => {
                resolve(new Error('Simulation took too long to start.'));
            }, timeoutMs);
        }),
    ]);
}
