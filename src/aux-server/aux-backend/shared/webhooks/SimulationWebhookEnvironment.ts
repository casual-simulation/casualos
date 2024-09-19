import {
    HandleHttpRequestRequest,
    HandleHttpRequestResult,
    STORED_AUX_SCHEMA,
    WebhookEnvironment,
} from '@casual-simulation/aux-records';
import { v4 as uuid } from 'uuid';
import {
    AuxConfig,
    AuxConfigParameters,
    AuxVM,
    RecordsManager,
    Simulation,
    SimulationOrigin,
} from '@casual-simulation/aux-vm';
import {
    addState,
    applyUpdatesToInst,
    BotAction,
    ConnectionIndicator,
    first,
    remote,
    StoredAux,
} from '@casual-simulation/aux-common';
import { getSimulationId } from '../../../shared/SimulationHelpers';
import mime from 'mime';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { Observable, Subscription, tap } from 'rxjs';

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
        const simId = getSimulationId(request.recordName, inst, false);
        const origin: SimulationOrigin = request.inst
            ? {
                  recordName: request.recordName,
                  inst: inst,
              }
            : null;
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
                        tap((e) =>
                            recordsManager.handleEvents(e as BotAction[])
                        )
                    )
                    .subscribe()
            );

            const initTimeoutMs = request.options?.initTimeoutMs ?? 5000;
            const initErr = await timeout(sim.init(), initTimeoutMs);

            if (initErr) {
                return {
                    success: false,
                    errorCode: 'took_too_long',
                    errorMessage: 'The inst took too long to start.',
                };
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
                        return {
                            success: false,
                            errorCode: 'took_too_long',
                            errorMessage:
                                'The inst took too long to fetch the state.',
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
                        return {
                            success: false,
                            errorCode: 'took_too_long',
                            errorMessage:
                                'The inst took too long to apply the fetched state.',
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
                        data: data,
                        headers: request.request.headers,
                    })
                    .then((result) => {
                        if (result.results.length > 0) {
                            return first(result.results);
                        }
                    }),
                requestTimeoutMs
            );

            if (result instanceof Error) {
                return {
                    success: false,
                    errorCode: 'took_too_long',
                    errorMessage:
                        'The inst took too long to respond to the webhook.',
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
