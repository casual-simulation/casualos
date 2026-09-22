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
import type { Result, SimpleError } from '@casual-simulation/aux-common';
import { failure, success } from '@casual-simulation/aux-common';
import type { ProxyRecordData } from './ProxyRecordsStore';

/**
 * The prefix that is used for properties that should be set on the body of the target request.
 */
export const BODY_PROPERTY_PREFIX = 'body.';

/**
 * The property that sets the authorization header on the target request.
 */
export const AUTHORIZATION_HEADER_PROPERTY = 'headers.authorization';

/**
 * The property that sets the authorization header on the target request to a bearer token.
 */
export const AUTHORIZATION_BEARER_HEADER_PROPERTY =
    'headers.authorization.bearer';

/**
 * The set of property names that are never allowed in a body property path.
 * These are disallowed in order to prevent prototype pollution.
 */
const FORBIDDEN_BODY_PROPERTY_NAMES = new Set([
    '__proto__',
    'constructor',
    'prototype',
]);

/**
 * Determines whether the given proxy data property is supported.
 * @param property The property that should be checked.
 */
export function isSupportedProxyDataProperty(property: string): boolean {
    const lower = property.toLowerCase();
    if (
        lower === AUTHORIZATION_HEADER_PROPERTY ||
        lower === AUTHORIZATION_BEARER_HEADER_PROPERTY
    ) {
        return true;
    }

    if (property.startsWith(BODY_PROPERTY_PREFIX)) {
        const path = property.slice(BODY_PROPERTY_PREFIX.length);
        if (path.length <= 0) {
            return false;
        }

        // Every segment of the path needs to be non-empty and safe to set.
        return path
            .split('.')
            .every(
                (p) => p.length > 0 && !FORBIDDEN_BODY_PROPERTY_NAMES.has(p)
            );
    }

    return false;
}

/**
 * Validates that the given proxy data only contains supported properties.
 * @param data The data that should be validated.
 */
export function validateProxyData(
    data: ProxyRecordData
): Result<void, SimpleError> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage: 'The proxy data must be an object.',
        });
    }

    for (let property of Object.keys(data)) {
        if (!isSupportedProxyDataProperty(property)) {
            return failure({
                errorCode: 'unacceptable_request',
                errorMessage: `The proxy data property "${property}" is not supported. Supported properties are "body.{property}", "${AUTHORIZATION_HEADER_PROPERTY}", and "${AUTHORIZATION_BEARER_HEADER_PROPERTY}".`,
            });
        }
    }

    return success();
}

/**
 * Defines the request that proxy data can be applied to.
 */
export interface ProxyTargetRequest {
    /**
     * The headers that should be sent with the request.
     */
    headers: {
        [key: string]: string;
    };

    /**
     * The body that should be sent with the request.
     * Null if the request has no body.
     */
    body: string | null;
}

/**
 * Applies the given proxy data to the given request and returns the resulting request.
 *
 * Returns a failure if the data contains an unsupported property or if the data
 * needs to modify the body of a request that doesn't contain JSON data.
 *
 * @param data The data that should be applied.
 * @param request The request that the data should be applied to.
 */
export function applyProxyData(
    data: ProxyRecordData,
    request: ProxyTargetRequest
): Result<ProxyTargetRequest, SimpleError> {
    const validation = validateProxyData(data);
    if (validation.success === false) {
        return validation;
    }

    const headers: ProxyTargetRequest['headers'] = {
        ...request.headers,
    };
    let body: string | null = request.body;

    const bodyProperties = Object.keys(data).filter((p) =>
        p.startsWith(BODY_PROPERTY_PREFIX)
    );

    if (bodyProperties.length > 0) {
        const parsed = parseJsonObject(request.body);
        if (parsed.success === false) {
            return parsed;
        }

        const json = parsed.value;
        for (let property of bodyProperties) {
            const path = property.slice(BODY_PROPERTY_PREFIX.length).split('.');
            const setResult = setProperty(json, path, data[property]);
            if (setResult.success === false) {
                return setResult;
            }
        }

        body = JSON.stringify(json);
    }

    for (let property of Object.keys(data)) {
        const lower = property.toLowerCase();
        if (lower === AUTHORIZATION_HEADER_PROPERTY) {
            deleteHeader(headers, 'authorization');
            headers['authorization'] = String(data[property]);
        } else if (lower === AUTHORIZATION_BEARER_HEADER_PROPERTY) {
            deleteHeader(headers, 'authorization');
            headers['authorization'] = `Bearer ${String(data[property])}`;
        }
    }

    return success({
        headers,
        body,
    });
}

function deleteHeader(
    headers: ProxyTargetRequest['headers'],
    name: string
): void {
    for (let key of Object.keys(headers)) {
        if (key.toLowerCase() === name) {
            delete headers[key];
        }
    }
}

function parseJsonObject(
    body: string | null
): Result<Record<string, any>, SimpleError> {
    if (body === null || body === undefined || body === '') {
        // An empty body can be treated as an empty JSON object.
        return success({});
    }

    let json: any;
    try {
        json = JSON.parse(body);
    } catch (err) {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage:
                'The proxy is configured to set properties on the request body, but the request body does not contain JSON data.',
        });
    }

    if (!json || typeof json !== 'object' || Array.isArray(json)) {
        return failure({
            errorCode: 'unacceptable_request',
            errorMessage:
                'The proxy is configured to set properties on the request body, but the request body does not contain a JSON object.',
        });
    }

    return success(json);
}

function setProperty(
    json: Record<string, any>,
    path: string[],
    value: string | number | boolean | null
): Result<void, SimpleError> {
    let current = json;
    for (let i = 0; i < path.length - 1; i++) {
        const segment = path[i];
        let next = current[segment];
        if (
            next === null ||
            next === undefined ||
            typeof next !== 'object' ||
            Array.isArray(next)
        ) {
            if (next !== null && next !== undefined) {
                return failure({
                    errorCode: 'unacceptable_request',
                    errorMessage: `The proxy is unable to set the "${path.join(
                        '.'
                    )}" property because "${path
                        .slice(0, i + 1)
                        .join('.')}" is not an object.`,
                });
            }
            next = {};
            current[segment] = next;
        }
        current = next;
    }

    current[path[path.length - 1]] = value;
    return success();
}
