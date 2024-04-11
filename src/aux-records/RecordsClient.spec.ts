import { RecordsClient, createRecordsClient } from './RecordsClient';

jest.mock('axios');

describe('RecordsClient', () => {
    let client: RecordsClient;

    beforeEach(() => {
        client = new RecordsClient('http://localhost:3000');
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('callProcedure()', () => {
        it('should call the procedure with the given name and input', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                { procedure: 'test', input: { test: true } },
                {
                    headers: {},
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        it('should include the session key', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });
            client.sessionKey = 'sessionKey';

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                { procedure: 'test', input: { test: true } },
                {
                    headers: {
                        Authorization: 'Bearer sessionKey',
                    },
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                setResponse({
                    statusCode: code,
                    data: {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    },
                });

                const response = await client.callProcedure('test', {
                    test: true,
                });
                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'error message',
                });

                expect(getLastPost()).toEqual([
                    'http://localhost:3000/api/v3/callProcedure',
                    { procedure: 'test', input: { test: true } },
                    {
                        headers: {},
                        validateStatus: expect.any(Function),
                    },
                ]);
            }
        );
    });
});

describe('createRecordsClient()', () => {
    let client: ReturnType<typeof createRecordsClient>;

    beforeEach(() => {
        client = createRecordsClient('http://localhost:3000');
    });

    function setResponse(response: any) {
        require('axios').__setResponse(response);
    }

    function setNextResponse(response: any) {
        require('axios').__setNextResponse(response);
    }

    function getLastPost() {
        return require('axios').__getLastPost();
    }

    function getLastGet() {
        return require('axios').__getLastGet();
    }

    function getRequests() {
        return require('axios').__getRequests();
    }

    describe('callProcedure()', () => {
        it('should call the procedure with the given name and input', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                { procedure: 'test', input: { test: true } },
                {
                    headers: {},
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        it('should include the session key', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });
            client.sessionKey = 'sessionKey';

            const response = await client.callProcedure('test', { test: true });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                { procedure: 'test', input: { test: true } },
                {
                    headers: {
                        Authorization: 'Bearer sessionKey',
                    },
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        it('should support custom options', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
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

            expect(getLastPost()).toEqual([
                'http://example.com/api/v3/callProcedure',
                { procedure: 'test', input: { test: true } },
                {
                    headers: {
                        Authorization: 'Bearer customSessionKey',
                    },
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                setResponse({
                    statusCode: code,
                    data: {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    },
                });

                const response = await client.callProcedure('test', {
                    test: true,
                });
                expect(response).toEqual({
                    success: false,
                    errorCode: 'invalid_request',
                    errorMessage: 'error message',
                });

                expect(getLastPost()).toEqual([
                    'http://localhost:3000/api/v3/callProcedure',
                    { procedure: 'test', input: { test: true } },
                    {
                        headers: {},
                        validateStatus: expect.any(Function),
                    },
                ]);
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
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });

            const response = await client.getData({
                recordName: 'test',
                address: 'address',
            });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                {
                    procedure: 'getData',
                    input: { recordName: 'test', address: 'address' },
                },
                {
                    headers: {},
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        it('should include the session key', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
            });
            client.sessionKey = 'sessionKey';

            const response = await client.getData({
                recordName: 'test',
                address: 'address',
            });
            expect(response).toEqual({ success: true, test: true });

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                {
                    procedure: 'getData',
                    input: { recordName: 'test', address: 'address' },
                },
                {
                    headers: {
                        Authorization: 'Bearer sessionKey',
                    },
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        it('should support custom options', async () => {
            setResponse({
                statusCode: 200,
                data: {
                    success: true,
                    test: true,
                },
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

            expect(getLastPost()).toEqual([
                'http://localhost:3000/api/v3/callProcedure',
                {
                    procedure: 'getData',
                    input: { recordName: 'test', address: 'address' },
                },
                {
                    headers: {
                        Authorization: 'Bearer customSessionKey',
                    },
                    validateStatus: expect.any(Function),
                },
            ]);
        });

        const statusCodes = [[400], [401], [402], [403], [404], [500]];

        it.each(statusCodes)(
            'should return the response even if the status code is %s',
            async (code) => {
                setResponse({
                    statusCode: code,
                    data: {
                        success: false,
                        errorCode: 'invalid_request',
                        errorMessage: 'error message',
                    },
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

                expect(getLastPost()).toEqual([
                    'http://localhost:3000/api/v3/callProcedure',
                    {
                        procedure: 'getData',
                        input: { recordName: 'test', address: 'address' },
                    },
                    {
                        headers: {},
                        validateStatus: expect.any(Function),
                    },
                ]);
            }
        );
    });
});
