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
    ActionKinds,
    KnownErrorCodes,
    Result,
    SimpleError,
} from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';
import type {
    AuthorizationContext,
    AuthorizeSubjectFailure,
    AuthorizeUserAndInstancesForResourcesSuccess,
    AuthorizeUserAndInstancesSuccess,
    ConstructAuthorizationContextFailure,
} from '../PolicyController';
import type {
    CheckSubscriptionMetricsFailure,
    CheckSubscriptionMetricsSuccess,
    CrudRecordsConfiguration,
} from '../crud/CrudRecordsController';
import { CrudRecordsController } from '../crud/CrudRecordsController';
import type { ProxyRecord, ProxyRecordsStore } from './ProxyRecordsStore';
import type { ProxiesFeaturesConfiguration } from '../SubscriptionConfiguration';
import { getProxyFeatures } from '../SubscriptionConfiguration';
import { traced } from '../tracing/TracingDecorators';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type {
    ProxyInterface,
    ProxyInterfaceResponse,
    ProxyRequestMethod,
} from './ProxyInterface';
import { applyProxyData, validateProxyData } from './ProxyRecordData';
import { parseProxyHost } from './ProxyHost';

const TRACE_NAME = 'ProxyController';

/**
 * The headers that are never returned to the client from a proxied response.
 * These are managed by the CasualOS server itself.
 */
export const EXCLUDED_RESPONSE_HEADERS = [
    'set-cookie',
    'clear-site-data',
    'access-control-allow-origin',
    'access-control-allow-credentials',
    'access-control-max-age',
    'connection',
    'keep-alive',
    'transfer-encoding',
    'content-encoding',
    'content-length',
];

/**
 * Defines the configuration for a proxy controller.
 */
export interface ProxyControllerConfiguration
    extends Omit<
        CrudRecordsConfiguration<ProxyRecord, ProxyRecordsStore>,
        'resourceKind' | 'name'
    > {
    /**
     * The interface that should be used to send requests to proxy hosts.
     */
    proxyInterface: ProxyInterface;
}

/**
 * Defines a controller that is able to manage proxies and send requests through them.
 *
 * Proxies make it possible for an experience to use a service that is secured by an API key
 * without having to ship the API key to the client. Instead, the API key is stored in the proxy
 * record and applied to the request right before it is sent to the destination host.
 */
export class ProxyController extends CrudRecordsController<
    ProxyRecord,
    ProxyRecord,
    ProxyRecordsStore
> {
    private _interface: ProxyInterface;

    constructor(config: ProxyControllerConfiguration) {
        super({
            ...config,
            resourceKind: 'proxy',
            name: 'ProxyController',
        });
        this._interface = config.proxyInterface;
    }

    /**
     * Sends a request through the given proxy and returns the response that the destination host gave.
     * @param request The request.
     */
    @traced(TRACE_NAME)
    async handleProxyRequest(
        request: HandleProxyRequest
    ): Promise<HandleProxyRequestResult> {
        try {
            const requestTimeMs = Date.now();
            const context = await this.policies.constructAuthorizationContext({
                recordKeyOrRecordName: request.recordName,
                userId: request.userId,
            });

            if (context.success === false) {
                return context;
            }

            const recordName = context.context.recordName;
            const proxy = await this.store.getItemByAddress(
                recordName,
                request.address
            );

            if (!proxy) {
                return {
                    success: false,
                    errorCode: 'not_found',
                    errorMessage: 'Proxy not found.',
                };
            }

            const authorization =
                await this.policies.authorizeUserAndInstancesForResources(
                    context.context,
                    {
                        userId: request.userId,
                        instances: request.instances,
                        resources: [
                            {
                                resourceKind: 'proxy',
                                resourceId: proxy.address,
                                action: 'run',
                                markers: proxy.markers,
                            },
                        ],
                    }
                );

            if (authorization.success === false) {
                return authorization;
            }

            const metrics = await this._checkSubscriptionMetrics(
                'run',
                context.context,
                authorization,
                proxy
            );

            if (metrics.success === false) {
                return metrics;
            }

            const path = normalizeProxyPath(request.path);
            if (path.success === false) {
                return {
                    success: false,
                    ...path.error,
                };
            }

            const method: ProxyRequestMethod = request.method ?? 'POST';
            const hasBody =
                request.body !== null &&
                request.body !== undefined &&
                method !== 'GET' &&
                method !== 'HEAD';

            const headers: {
                [key: string]: string;
            } = {};
            let body: string | null = null;

            if (hasBody) {
                body =
                    typeof request.body === 'string'
                        ? request.body
                        : JSON.stringify(request.body);
                headers['content-type'] = 'application/json';
            }

            const applied = applyProxyData(proxy.data ?? {}, {
                headers,
                body,
            });

            if (applied.success === false) {
                return {
                    success: false,
                    ...applied.error,
                };
            }

            const finalBody = applied.value.body;
            const finalHeaders = applied.value.headers;

            if (finalBody !== null && finalBody !== undefined) {
                finalHeaders['content-length'] = String(
                    Buffer.byteLength(finalBody, 'utf8')
                );
            }

            const response = await this._interface.sendRequest({
                host: proxy.host,
                path: path.value,
                method,
                headers: finalHeaders,
                body: finalBody,
                timeoutMs: metrics.features.requestTimeoutMs,
            });

            await this.store.recordProxyRequest({
                recordName,
                proxyAddress: proxy.address,
                requestTimeMs,
            });

            if (response.success === false) {
                return {
                    success: false,
                    ...response.error,
                };
            }

            return {
                success: true,
                response: filterResponseHeaders(response.value),
            };
        } catch (err) {
            const span = trace.getActiveSpan();
            if (err instanceof Error) {
                span?.recordException(err);
            }
            span?.setStatus({ code: SpanStatusCode.ERROR });

            console.error(`[ProxyController] Error handling proxy:`, err);
            return {
                success: false,
                errorCode: 'server_error',
                errorMessage: 'A server error occurred.',
            };
        }
    }

    protected async _checkSubscriptionMetrics(
        action: ActionKinds,
        context: AuthorizationContext,
        authorization:
            | AuthorizeUserAndInstancesSuccess
            | AuthorizeUserAndInstancesForResourcesSuccess,
        item?: ProxyRecord
    ): Promise<CheckProxyMetricsResult> {
        const config = await this.config.getSubscriptionConfiguration();
        const metrics = await this.store.getSubscriptionMetrics({
            ownerId: context.recordOwnerId,
            studioId: context.recordStudioId,
        });

        const features = getProxyFeatures(
            config,
            metrics.subscriptionStatus,
            metrics.subscriptionId,
            metrics.subscriptionType
        );

        if (!features.allowed) {
            return {
                success: false,
                errorCode: 'not_authorized',
                errorMessage: 'Proxies are not allowed for this subscription.',
            };
        }

        if (action === 'create' && typeof features.maxItems === 'number') {
            if (metrics.totalItems >= features.maxItems) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of proxy items has been reached for your subscription.',
                };
            }
        }

        if (action === 'run') {
            if (
                typeof features.maxRequestsPerPeriod === 'number' &&
                metrics.totalRequestsInPeriod >= features.maxRequestsPerPeriod
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of proxy requests has been reached for your subscription.',
                };
            }
            if (
                typeof features.maxRequestsPerHour === 'number' &&
                metrics.totalRequestsInLastHour >= features.maxRequestsPerHour
            ) {
                return {
                    success: false,
                    errorCode: 'subscription_limit_reached',
                    errorMessage:
                        'The maximum number of proxy requests has been reached for your subscription.',
                };
            }
        }

        return {
            success: true,
            features,
        };
    }

    protected async _transformInputItem(
        item: ProxyRecord,
        existingItem: ProxyRecord | null,
        action: ActionKinds
    ): Promise<Result<ProxyRecord, SimpleError>> {
        if (action !== 'create' && action !== 'update') {
            return failure({
                errorCode: 'action_not_supported',
                errorMessage: `The action '${action}' is not supported for proxy records.`,
            });
        }

        const host = parseProxyHost(item.host);
        if (host.success === false) {
            return host;
        }

        if (item.data === null || item.data === undefined) {
            if (action === 'create') {
                return success({
                    ...item,
                    data: {},
                });
            }

            // Leave the data off of the item so that the existing data is kept.
            const { data, ...rest } = item;
            return success(rest as ProxyRecord);
        }

        const data = validateProxyData(item.data);
        if (data.success === false) {
            return data;
        }

        return success(item);
    }
}

/**
 * Normalizes the given path so that it can be appended to the host of a proxy.
 * @param path The path that should be normalized.
 */
export function normalizeProxyPath(
    path: string | null | undefined
): Result<string, SimpleError> {
    if (path === null || path === undefined || path === '') {
        return success('/');
    }

    if (typeof path !== 'string') {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage: 'The path must be a string.',
        });
    }

    if (!path.startsWith('/')) {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage: 'The path must start with a slash. (e.g. "/v1/chat")',
        });
    }

    if (path.startsWith('//')) {
        // Protocol-relative paths would cause the request to be sent to a different host.
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage: 'The path must not start with two slashes.',
        });
    }

    if (/[\r\n]/.test(path)) {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage: 'The path must not contain newline characters.',
        });
    }

    return success(path);
}

function filterResponseHeaders(
    response: ProxyInterfaceResponse
): ProxyInterfaceResponse {
    const headers: {
        [key: string]: string;
    } = {};

    for (let key of Object.keys(response.headers ?? {})) {
        const lowerKey = key.toLowerCase();
        if (EXCLUDED_RESPONSE_HEADERS.includes(lowerKey)) {
            continue;
        }
        headers[lowerKey] = response.headers[key];
    }

    return {
        statusCode: response.statusCode,
        headers,
        body: response.body,
    };
}

export interface HandleProxyRequest {
    /**
     * The name of the record that the proxy is stored in.
     */
    recordName: string;

    /**
     * The address of the proxy.
     */
    address: string;

    /**
     * The ID of the user that is currently logged in.
     * Null if the user is not logged in.
     */
    userId: string | null;

    /**
     * The instances that the request is coming from.
     */
    instances: string[];

    /**
     * The path that the request should be sent to.
     * Appended to the host of the proxy. (e.g. `/v1/chat`)
     */
    path: string;

    /**
     * The body that should be sent with the request.
     * If not a string, then it will be serialized as JSON.
     */
    body?: any;

    /**
     * The HTTP method that should be used for the request.
     * Defaults to POST.
     */
    method?: ProxyRequestMethod;
}

export type HandleProxyRequestResult =
    | HandleProxyRequestSuccess
    | HandleProxyRequestFailure;

export interface HandleProxyRequestSuccess {
    success: true;

    /**
     * The response that the destination host gave.
     */
    response: ProxyInterfaceResponse;
}

export interface HandleProxyRequestFailure {
    success: false;
    errorCode:
        | KnownErrorCodes
        | AuthorizeSubjectFailure['errorCode']
        | ConstructAuthorizationContextFailure['errorCode'];
    errorMessage: string;
    [key: string]: any;
}

export type CheckProxyMetricsResult =
    | CheckProxyMetricsSuccess
    | CheckProxyMetricsFailure;

export interface CheckProxyMetricsSuccess
    extends CheckSubscriptionMetricsSuccess {
    success: true;

    /**
     * The features that the subscription has access to.
     */
    features: ProxiesFeaturesConfiguration;
}

export interface CheckProxyMetricsFailure
    extends CheckSubscriptionMetricsFailure {}
