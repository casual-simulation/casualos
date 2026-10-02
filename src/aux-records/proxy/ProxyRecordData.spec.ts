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
import { unwrap } from '@casual-simulation/aux-common';
import {
    applyProxyData,
    isSupportedProxyDataProperty,
    validateProxyData,
} from './ProxyRecordData';

describe('isSupportedProxyDataProperty()', () => {
    const supported = [
        ['body.apiKey'],
        ['body.auth.key'],
        ['headers.authorization'],
        ['Headers.Authorization'],
        ['headers.authorization.bearer'],
        ['HEADERS.AUTHORIZATION.BEARER'],
        ['headers.x-api-key'],
        ['headers.X-Api-Key'],
        ['Headers.x-api-key'],
        ['headers.x-my_header-2'],
    ];

    it.each(supported)('should support %s', (property) => {
        expect(isSupportedProxyDataProperty(property)).toBe(true);
    });

    const unsupported = [
        ['apiKey'],
        ['body.'],
        ['body'],
        ['body..key'],
        ['headers.cookie'],
        ['headers.host'],
        ['headers.content-length'],
        ['headers.x-'],
        ['headers.x'],
        ['headers.xapi-key'],
        ['headers.x-api.key'],
        ['headers.x-api key'],
        ['headers.x-api:key'],
        ['headers.'],
        ['headers..x-api-key'],
        ['query.apiKey'],
        ['body.__proto__'],
        ['body.constructor.prototype'],
        ['Body.apiKey'],
    ];

    it.each(unsupported)('should not support %s', (property) => {
        expect(isSupportedProxyDataProperty(property)).toBe(false);
    });
});

describe('validateProxyData()', () => {
    it('should allow empty data', () => {
        expect(validateProxyData({}).success).toBe(true);
    });

    it('should reject unsupported properties', () => {
        const result = validateProxyData({
            'headers.cookie': 'abc',
        });
        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('unacceptable_request');
    });

    it('should allow custom x- headers', () => {
        expect(
            validateProxyData({
                'headers.x-api-key': 'abc',
            }).success
        ).toBe(true);
    });

    const invalidHeaderValues = [
        ['carriage return', 'abc\rdef'],
        ['line feed', 'abc\ndef'],
        ['CRLF', 'abc\r\nx-other: def'],
        ['null character', 'abc\0def'],
    ];

    it.each(invalidHeaderValues)(
        'should reject custom header values that contain a %s',
        (desc, value) => {
            const result = validateProxyData({
                'headers.x-api-key': value,
            });
            expect(result.success).toBe(false);
            expect((result as any).error.errorCode).toBe(
                'unacceptable_request'
            );
        }
    );

    it('should reject data that is not an object', () => {
        expect(validateProxyData(null as any).success).toBe(false);
        expect(validateProxyData([] as any).success).toBe(false);
        expect(validateProxyData('abc' as any).success).toBe(false);
    });
});

describe('applyProxyData()', () => {
    it('should set the authorization header', () => {
        const result = applyProxyData(
            {
                'headers.authorization': 'my-key',
            },
            {
                headers: {},
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            headers: {
                authorization: 'my-key',
            },
            body: null,
        });
    });

    it('should set the authorization header as a bearer token', () => {
        const result = applyProxyData(
            {
                'headers.authorization.bearer': 'my-key',
            },
            {
                headers: {},
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            headers: {
                authorization: 'Bearer my-key',
            },
            body: null,
        });
    });

    it('should overwrite existing authorization headers regardless of case', () => {
        const result = applyProxyData(
            {
                'Headers.Authorization.Bearer': 'my-key',
            },
            {
                headers: {
                    Authorization: 'other-key',
                },
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            headers: {
                authorization: 'Bearer my-key',
            },
            body: null,
        });
    });

    it('should set custom x- headers', () => {
        const result = applyProxyData(
            {
                'headers.x-api-key': 'my-key',
                'headers.X-Other': 123,
            },
            {
                headers: {
                    'content-type': 'application/json',
                },
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            headers: {
                'content-type': 'application/json',
                'x-api-key': 'my-key',
                'x-other': '123',
            },
            body: null,
        });
    });

    it('should overwrite existing custom headers regardless of case', () => {
        const result = applyProxyData(
            {
                'headers.x-api-key': 'my-key',
            },
            {
                headers: {
                    'X-API-KEY': 'other-key',
                },
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(unwrap(result)).toEqual({
            headers: {
                'x-api-key': 'my-key',
            },
            body: null,
        });
    });

    it('should reject custom header values that contain line breaks', () => {
        const result = applyProxyData(
            {
                'headers.x-api-key': 'my-key\r\nx-injected: true',
            },
            {
                headers: {},
                body: null,
            }
        );

        expect(result.success).toBe(false);
    });

    it('should set properties on the JSON body', () => {
        const result = applyProxyData(
            {
                'body.apiKey': 'my-key',
            },
            {
                headers: {},
                body: JSON.stringify({ message: 'hello' }),
            }
        );

        expect(result.success).toBe(true);
        expect(JSON.parse(unwrap(result).body)).toEqual({
            message: 'hello',
            apiKey: 'my-key',
        });
    });

    it('should overwrite existing properties in the body', () => {
        const result = applyProxyData(
            {
                'body.apiKey': 'my-key',
            },
            {
                headers: {},
                body: JSON.stringify({ apiKey: 'their-key' }),
            }
        );

        expect(result.success).toBe(true);
        expect(JSON.parse(unwrap(result).body)).toEqual({
            apiKey: 'my-key',
        });
    });

    it('should support nested body properties', () => {
        const result = applyProxyData(
            {
                'body.auth.key': 'my-key',
            },
            {
                headers: {},
                body: JSON.stringify({ message: 'hello' }),
            }
        );

        expect(result.success).toBe(true);
        expect(JSON.parse(unwrap(result).body)).toEqual({
            message: 'hello',
            auth: {
                key: 'my-key',
            },
        });
    });

    it('should treat an empty body as an empty object', () => {
        const result = applyProxyData(
            {
                'body.apiKey': 'my-key',
            },
            {
                headers: {},
                body: null,
            }
        );

        expect(result.success).toBe(true);
        expect(JSON.parse(unwrap(result).body)).toEqual({
            apiKey: 'my-key',
        });
    });

    it('should reject requests that do not contain JSON data', () => {
        const result = applyProxyData(
            {
                'body.apiKey': 'my-key',
            },
            {
                headers: {},
                body: 'not json',
            }
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('unacceptable_request');
    });

    it('should reject requests whose body is not a JSON object', () => {
        const result = applyProxyData(
            {
                'body.apiKey': 'my-key',
            },
            {
                headers: {},
                body: JSON.stringify([1, 2, 3]),
            }
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('unacceptable_request');
    });

    it('should reject nested properties that would overwrite a non-object', () => {
        const result = applyProxyData(
            {
                'body.auth.key': 'my-key',
            },
            {
                headers: {},
                body: JSON.stringify({ auth: 'abc' }),
            }
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('unacceptable_request');
    });

    it('should reject unsupported properties', () => {
        const result = applyProxyData(
            {
                'headers.cookie': 'abc',
            },
            {
                headers: {},
                body: null,
            }
        );

        expect(result.success).toBe(false);
        expect((result as any).error.errorCode).toBe('unacceptable_request');
    });

    it('should not modify the given request', () => {
        const request = {
            headers: {} as { [key: string]: string },
            body: JSON.stringify({ message: 'hello' }),
        };

        applyProxyData(
            {
                'headers.authorization': 'my-key',
                'body.apiKey': 'my-key',
            },
            request
        );

        expect(request.headers).toEqual({});
        expect(JSON.parse(request.body)).toEqual({ message: 'hello' });
    });
});
