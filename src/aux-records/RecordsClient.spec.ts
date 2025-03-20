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
import {
    RecordsClient,
    createRecordsClient,
    streamJsonLines,
} from './RecordsClient';
import {
    asyncIterable,
    readableFromAsyncIterable,
    unwindAndCaptureAsync,
} from './TestUtils';

jest.mock('axios');

const originalFetch = globalThis.fetch;

describe('RecordsClient', () => {
    let client: RecordsClient;
    let fetch: jest.Mock<
        Promise<{
            status: number;
            headers?: Headers;
            json?: () => Promise<any>;
            text?: () => Promise<string>;
            body?: ReadableStream;
        }>
    >;

    beforeEach(() => {
        client = new RecordsClient('http://localhost:3000');
        fetch = globalThis.fetch = jest.fn();
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    describe('callProcedure()', () => {
        it('should call the procedure with the given name and input', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        it('should include the session key', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });
            client.sessionKey = 'sessionKey';

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                        Authorization: 'Bearer sessionKey',
                    },
                }
            );
        });

        it('should support streaming responses', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/x-ndjson',
                }),
                body: readableFromAsyncIterable(
                    asyncIterable([
                        Promise.resolve(
                            Buffer.from(`{"success":true,"test":true}\n`)
                        ),
                        Promise.resolve(Buffer.from(`{"value": 123}\n`)),
                    ])
                ),
            });

            const response = await client.callProcedure('test', { test: true });

            expect(Symbol.asyncIterator in response).toBe(true);

            const result = await unwindAndCaptureAsync(response);
            expect(result).toEqual({
                states: [{ success: true, test: true }, { value: 123 }],
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                fetch.mockResolvedValueOnce({
                    status: code,
                    json: async () => ({
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    }),
                });

                const response = await client.callProcedure('test', {
                    test: true,
                });
                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'error message',
                });

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3000/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'test',
                            input: { test: true },
                        }),
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            Accept: 'application/json,application/x-ndjson',
                        },
                    }
                );
            }
        );
    });
});

describe('createRecordsClient()', () => {
    let client: ReturnType<typeof createRecordsClient>;
    let fetch: jest.Mock<
        Promise<{
            status: number;
            headers?: Headers;
            json?: () => Promise<any>;
            text?: () => Promise<string>;
            body?: ReadableStream;
        }>
    >;

    beforeEach(() => {
        client = createRecordsClient('http://localhost:3000');
        fetch = globalThis.fetch = jest.fn();
    });

    afterAll(() => {
        globalThis.fetch = originalFetch;
    });

    describe('callProcedure()', () => {
        it('should call the procedure with the given name and input', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        it('should include the session key', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });

            client.sessionKey = 'sessionKey';

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                        Authorization: 'Bearer sessionKey',
                    },
                }
            );
        });

        it('should support custom options', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });
            client.sessionKey = 'sessionKey';

            const response = await client.callProcedure(
                'test',
                { test: true },
                {
                    sessionKey: 'customSessionKey',
                    endpoint: 'http://example.com',
                }
            );
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://example.com/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                        Authorization: 'Bearer customSessionKey',
                    },
                }
            );
        });

        it('should support streaming responses', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/x-ndjson',
                }),
                body: readableFromAsyncIterable(
                    asyncIterable([
                        Promise.resolve(
                            Buffer.from(`{"success":true,"test":true}\n`)
                        ),
                        Promise.resolve(Buffer.from(`{"value": 123}\n`)),
                    ])
                ),
            });

            const response = await client.callProcedure('test', { test: true });

            expect(Symbol.asyncIterator in response).toBe(true);

            const result = await unwindAndCaptureAsync(response);
            expect(result).toEqual({
                states: [{ success: true, test: true }, { value: 123 }],
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'test',
                        input: { test: true },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                fetch.mockResolvedValueOnce({
                    status: code,
                    json: async () => ({
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    }),
                });

                const response = await client.callProcedure('test', {
                    test: true,
                });
                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'error message',
                });

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3000/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'test',
                            input: { test: true },
                        }),
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            Accept: 'application/json,application/x-ndjson',
                        },
                    }
                );
            }
        );
    });

    it('should return undefined for Promise properties', () => {
        expect((client as any).then).toBeUndefined();
        expect((client as any).catch).toBeUndefined();
    });

    describe('proxied methods', () => {
        it('should have all the methods that the client has', () => {
            expect(client).toHaveProperty('callProcedure');
            expect(client.callProcedure).toBeInstanceOf(Function);
            expect(client).toHaveProperty('sessionKey');
            expect(client).toHaveProperty('_authenticationHeaders');
            expect(client).toHaveProperty('hasOwnProperty');
        });

        it('should call the procedure', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });

            const response = await client.getData({
                recordName: 'test',
                address: 'address',
            });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'getData',
                        input: { recordName: 'test', address: 'address' },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        it('should include the session key', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });
            client.sessionKey = 'sessionKey';

            const response = await client.getData({
                recordName: 'test',
                address: 'address',
            });
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'getData',
                        input: { recordName: 'test', address: 'address' },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                        Authorization: 'Bearer sessionKey',
                    },
                }
            );
        });

        it('should support custom options', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                json: async () => ({
                    success: true,
                    test: true,
                }),
            });
            client.sessionKey = 'sessionKey';

            const response = await client.getData(
                {
                    recordName: 'test',
                    address: 'address',
                },
                { sessionKey: 'customSessionKey' }
            );
            expect(response).toEqual({ success: true, test: true });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'getData',
                        input: { recordName: 'test', address: 'address' },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                        Authorization: 'Bearer customSessionKey',
                    },
                }
            );
        });

        it('should support streaming responses', async () => {
            fetch.mockResolvedValueOnce({
                status: 200,
                headers: new Headers({
                    'Content-Type': 'application/x-ndjson',
                }),
                body: readableFromAsyncIterable(
                    asyncIterable([
                        Promise.resolve(
                            Buffer.from(`{"success":true,"test":true}\n`)
                        ),
                        Promise.resolve(Buffer.from(`{"value": 123}\n`)),
                    ])
                ),
            });

            const response = await client.aiChatStream({
                messages: [
                    {
                        role: 'user',
                        content: 'hello',
                    },
                ],
            });

            expect(Symbol.asyncIterator in response).toBe(true);

            const result = await unwindAndCaptureAsync(response as any);
            expect(result).toEqual({
                states: [{ success: true, test: true }, { value: 123 }],
            });

            expect(fetch).toHaveBeenCalledWith(
                'http://localhost:3000/api/v3/callProcedure',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        procedure: 'aiChatStream',
                        input: {
                            messages: [
                                {
                                    role: 'user',
                                    content: 'hello',
                                },
                            ],
                        },
                    }),
                    headers: {
                        'Content-Type': 'application/json;charset=UTF-8',
                        Accept: 'application/json,application/x-ndjson',
                    },
                }
            );
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                fetch.mockResolvedValueOnce({
                    status: code,
                    json: async () => ({
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    }),
                });
                const response = await client.getData({
                    recordName: 'test',
                    address: 'address',
                });
                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'error message',
                });

                expect(fetch).toHaveBeenCalledWith(
                    'http://localhost:3000/api/v3/callProcedure',
                    {
                        method: 'POST',
                        body: JSON.stringify({
                            procedure: 'getData',
                            input: { recordName: 'test', address: 'address' },
                        }),
                        headers: {
                            'Content-Type': 'application/json;charset=UTF-8',
                            Accept: 'application/json,application/x-ndjson',
                        },
                    }
                );
            }
        );
    });
});

describe('streamJsonLines()', () => {
    let newlineCases = [
        ['\\n', '\n'],
        ['\\r\\n', '\r\n'],
    ];

    describe.each(newlineCases)('%s', (desc, newline) => {
        it('should parse the lines', async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(Buffer.from(`{"test":true}${newline}`)),
                    Promise.resolve(Buffer.from(`{"num": 123}${newline}`)),
                    Promise.resolve(Buffer.from('{"value": "string"}')),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }],
                // The last value after the newline is the result
                result: {
                    value: 'string',
                },
            });
        });

        it('should correctly handle when the last chunk has a newline in it', async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(Buffer.from(`{"test":true}${newline}`)),
                    Promise.resolve(Buffer.from(`{"num": 123}${newline}`)),
                    Promise.resolve(
                        Buffer.from(
                            `{"abc": "def"}${newline}{"value": "string"}`
                        )
                    ),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }, { abc: 'def' }],
                // The last value after the newline is the result
                result: {
                    value: 'string',
                },
            });
        });

        it(`should correctly buffer and parse lines that come in separate chunks`, async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(Buffer.from('{"test":t')),
                    Promise.resolve(Buffer.from(`rue}${newline}{`)),
                    Promise.resolve(Buffer.from('"num":12')),
                    Promise.resolve(Buffer.from(`3}${newline}`)),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }],
            });
        });

        it('should correctly process multiple lines in one chunk', async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(
                        Buffer.from(
                            `{"test":true}${newline}{"num": 123}${newline}`
                        )
                    ),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }],
            });
        });

        it('should ignore empty lines', async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(Buffer.from(`${newline}${newline}`)),
                    Promise.resolve(Buffer.from(`{"test":t`)),
                    Promise.resolve(
                        Buffer.from(`rue}${newline}${newline}${newline}{`)
                    ),
                    Promise.resolve(Buffer.from(`"num":12`)),
                    Promise.resolve(
                        Buffer.from(`3}${newline}${newline}${newline}`)
                    ),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }],
            });
        });
    });

    describe('\\r\\n', () => {
        it('should handle when \\r and \\n come in different chunks', async () => {
            const stream = readableFromAsyncIterable(
                asyncIterable([
                    Promise.resolve(Buffer.from('{"test":t')),
                    Promise.resolve(Buffer.from(`rue}\r`)),
                    Promise.resolve(Buffer.from('\n{"num":12')),
                    Promise.resolve(Buffer.from(`3}\r\n`)),
                ])
            );

            const results = await unwindAndCaptureAsync(
                streamJsonLines(stream, new TextDecoder())
            );
            expect(results).toEqual({
                states: [{ test: true }, { num: 123 }],
            });
        });
    });
});
