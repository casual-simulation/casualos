import {
    asyncResult,
    AuxPartitions,
    AuxRuntime,
    BotAction,
    botAdded,
    createBot,
    createMemoryPartition,
    deleteRecord,
    getRecordData,
    getRecords,
    iteratePartitions,
    LocalActions,
    MemoryPartition,
    publishRecord,
    recordData,
    recordFile,
} from '@casual-simulation/aux-common';
import { Subject, Subscription } from 'rxjs';
import { tap } from 'rxjs/operators';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { RecordsManager } from './RecordsManager';
import { AuthHelperInterface } from './AuthHelperInterface';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { BotHelper } from './BotHelper';
import stringify from '@casual-simulation/fast-json-stable-stringify';
import 'aux-jest-matchers';

jest.mock('axios');

console.log = jest.fn();

describe('RecordsManager', () => {
    let records: RecordsManager;
    let actions: BotAction[];
    let userId: string = 'user';
    let vm: TestAuxVM;
    let helper: BotHelper;
    let auth: AuthHelperInterface;
    let authMock = {
        isAuthenticated: jest.fn(),
        authenticate: jest.fn(),
        getAuthToken: jest.fn(),
        createPublicRecordKey: jest.fn(),
    };
    let sub: Subscription;

    beforeEach(async () => {
        actions = [];
        sub = new Subscription();
        helper = createHelper();
        authMock = auth = {
            isAuthenticated: jest.fn(),
            authenticate: jest.fn(),
            getAuthToken: jest.fn(),
            createPublicRecordKey: jest.fn(),
            unsubscribe: jest.fn(),
            get closed() {
                return false;
            },
        };

        records = new RecordsManager(
            {
                version: '1.0.0',
                versionHash: '1234567890abcdef',
                recordsOrigin: 'http://localhost:3002',
            },
            helper,
            auth
        );
    });

    function createHelper() {
        vm = new TestAuxVM(userId);
        const helper = new BotHelper(vm);

        return helper;
    }

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

    describe('handleEvents()', () => {
        describe('record_data', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a POST request to /api/v2/records/data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(getLastPost()).toEqual([
                    'http://localhost:3002/api/v2/records/data',
                    {
                        recordKey: 'myToken',
                        address: 'myAddress',
                        data: {
                            myRecord: true,
                        },
                    },
                    {
                        headers: {
                            Authorization: 'Bearer authToken',
                        },
                    },
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).not.toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should attempt to login if not authenticated', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });

            it('should return a not_logged_in error if there is no token', async () => {
                authMock.isAuthenticated.mockResolvedValueOnce(false);
                authMock.authenticate.mockResolvedValueOnce({});
                authMock.getAuthToken.mockResolvedValueOnce(null);

                records.handleEvents([
                    recordData(
                        'myToken',
                        'myAddress',
                        {
                            myRecord: true,
                        },
                        1
                    ),
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'not_logged_in',
                        errorMessage: 'The user is not logged in.',
                    }),
                ]);
                expect(authMock.isAuthenticated).toBeCalled();
                expect(authMock.authenticate).toBeCalled();
                expect(authMock.getAuthToken).toBeCalled();
            });
        });

        describe('get_record_data', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should make a GET request to /api/v2/records/data', async () => {
                setResponse({
                    data: {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    },
                });

                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    getRecordData('testRecord', 'myAddress', 1),
                ]);

                await waitAsync();

                expect(getLastGet()).toEqual([
                    'http://localhost:3002/api/v2/records/data?recordName=testRecord&address=myAddress',
                ]);

                await waitAsync();

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        recordName: 'testRecord',
                        address: 'myAddress',
                        data: {
                            abc: 'def',
                        },
                    }),
                ]);
            });
        });

        describe('record_file', () => {
            beforeEach(() => {
                require('axios').__reset();
            });

            it('should support strings', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', 'myFile', 'test.txt', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.txt',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: true,
                        url: 'https://example.com/upload',
                    }),
                ]);
            });

            it('should use the given mime type for strings', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.txt',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', 'myFile', 'test.txt', 'text/xml', 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '7b8478283c88551efc6a8e64248cf6b44aa8be4d06e412eb9e4f66a1771bea50',
                            fileByteLength: 6,
                            fileMimeType: 'text/xml',
                            fileDescription: 'test.txt',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'myFile'),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should convert objects to stable JSON', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.json',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const obj = {
                    zyx: 123,
                    abc: {
                        bool: true,
                    },
                };

                const json = stringify(obj);

                records.handleEvents([
                    recordFile('myToken', obj, 'test.json', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '8499ab51a0226b4977bbf0549b394225fe12643376782a2bb3d141014de70820',
                            fileByteLength: 31,
                            fileMimeType: 'application/json',
                            fileDescription: 'test.json',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user provided mime type for objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.json',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const obj = {
                    zyx: 123,
                    abc: {
                        bool: true,
                    },
                };

                const json = stringify(obj);

                records.handleEvents([
                    recordFile('myToken', obj, 'test.json', 'text/plain', 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '8499ab51a0226b4977bbf0549b394225fe12643376782a2bb3d141014de70820',
                            fileByteLength: 31,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.json',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', json),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support blob objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const html = '<abc></abc>';
                const blob = new Blob([html], { type: 'text/html' });

                records.handleEvents([
                    recordFile('myToken', blob, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '95b50f5aa4106c3872f3ba7a52ae035b5875a729f6a8ab6f02d86c57eda56c0b',
                            fileByteLength: 11,
                            fileMimeType: 'text/html',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', html),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for blob objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const html = '<abc></abc>';
                const blob = new Blob([html], { type: 'text/html' });

                records.handleEvents([
                    recordFile('myToken', blob, 'test.html', 'text/plain', 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '95b50f5aa4106c3872f3ba7a52ae035b5875a729f6a8ab6f02d86c57eda56c0b',
                            fileByteLength: 11,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', html),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support objects in the structure of a file from @onFileUpload', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                const file = {
                    name: 'test.zip',
                    size: 15,
                    data: buffer,
                    mimeType: 'application/zip',
                };

                records.handleEvents([
                    recordFile('myToken', file, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/zip',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for files', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                const file = {
                    name: 'test.zip',
                    size: 15,
                    data: buffer,
                    mimeType: 'application/zip',
                };

                records.handleEvents([
                    recordFile(
                        'myToken',
                        file,
                        'test.html',
                        'application/octet-stream',
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support array buffer objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                records.handleEvents([
                    recordFile('myToken', buffer, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should use the user-provided mime type for array buffer objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(123);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }

                records.handleEvents([
                    recordFile(
                        'myToken',
                        buffer,
                        'test.html',
                        'application/zip',
                        1
                    ),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'cc63be92e3a900cd067da89473b61b40579b54ef54f8305c2ffcc893743792e9',
                            fileByteLength: 123,
                            fileMimeType: 'application/zip',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support typed array objects', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                const buffer = new ArrayBuffer(128);
                const bytes = new Uint8Array(buffer);
                for (let i = 0; i < bytes.length; i++) {
                    bytes[i] = i;
                }
                const doubles = new Float64Array(buffer);

                records.handleEvents([
                    recordFile('myToken', doubles, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '471fb943aa23c511f6f72f8d1652d9c880cfa392ad80503120547703e56a2be5',
                            fileByteLength: 128,
                            fileMimeType: 'application/octet-stream',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        bytes,
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support numbers', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', 10, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                '4a44dc15364204a80fe80e9039455cc1608281820fe2b24f1e5233ade6af1dd5',
                            fileByteLength: 2,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', '10'),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            it('should support booleans', async () => {
                setNextResponse({
                    data: {
                        success: true,
                        uploadUrl: 'https://example.com/upload',
                        uploadMethod: 'POST',
                        uploadHeaders: {
                            test: 'abc',
                        },
                        fileName: 'test.html',
                    },
                });
                setNextResponse({
                    status: 200,
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                    [
                        'post',
                        'https://example.com/upload',
                        expect.expect('toBeUtf8EncodedText', 'true'),
                        {
                            headers: {
                                test: 'abc',
                            },
                        },
                    ],
                ]);
            });

            const invalidDataCases = [
                [
                    'a function',
                    function abc() {},
                    'Function instances cannot be stored in files.',
                ],
                [
                    'undefined',
                    undefined,
                    'Null or undefined values cannot be stored in files.',
                ],
                [
                    'null',
                    null,
                    'Null or undefined values cannot be stored in files.',
                ],
            ];

            it.each(invalidDataCases)(
                'should return an error if given %s',
                async (desc, value, message) => {
                    setNextResponse({
                        data: {
                            success: true,
                            uploadUrl: 'https://example.com/upload',
                            uploadMethod: 'POST',
                            uploadHeaders: {
                                test: 'abc',
                            },
                            fileName: 'test.html',
                        },
                    });
                    setNextResponse({
                        status: 200,
                    });

                    authMock.isAuthenticated.mockResolvedValueOnce(true);
                    authMock.getAuthToken.mockResolvedValueOnce('authToken');

                    records.handleEvents([
                        recordFile('myToken', value, 'test.html', undefined, 1),
                    ]);

                    await waitAsync();

                    expect(getRequests()).toEqual([]);
                    expect(vm.events).toEqual([
                        asyncResult(1, {
                            success: false,
                            errorCode: 'invalid_file_data',
                            errorMessage: message,
                        }),
                    ]);
                }
            );

            it('should include the URL if the file already exists', async () => {
                setNextResponse({
                    data: {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: 'The file already exists.',
                        existingFileUrl: 'https://example.com/existing',
                    },
                });

                authMock.isAuthenticated.mockResolvedValueOnce(true);
                authMock.getAuthToken.mockResolvedValueOnce('authToken');

                records.handleEvents([
                    recordFile('myToken', true, 'test.html', undefined, 1),
                ]);

                await waitAsync();

                expect(getRequests()).toEqual([
                    [
                        'post',
                        'http://localhost:3002/api/v2/records/file',
                        {
                            recordKey: 'myToken',
                            fileSha256Hex:
                                'b5bea41b6c623f7c09f1bf24dcae58ebab3c0cdd90ad966bc43a45b44867e12b',
                            fileByteLength: 4,
                            fileMimeType: 'text/plain',
                            fileDescription: 'test.html',
                        },
                        {
                            headers: {
                                Authorization: 'Bearer authToken',
                            },
                        },
                    ],
                ]);

                expect(vm.events).toEqual([
                    asyncResult(1, {
                        success: false,
                        errorCode: 'file_already_exists',
                        errorMessage: 'The file already exists.',
                        existingFileUrl: 'https://example.com/existing',
                    }),
                ]);
            });
        });

        // describe('get_record', () => {
        //     beforeEach(() => {
        //         require('axios').__reset();
        //     });

        //     it('should make a GET request to /api/records', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     prefix: 'myPrefix',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?prefix=myPrefix&authID=myAuthID&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);

        //         await waitAsync();

        //         expect(actions).toEqual([
        //             asyncResult(1, {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             }),
        //         ]);
        //     });

        //     it('should be able to include the given address', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     address: 'myAddress',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?address=myAddress&authID=myAuthID&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);
        //     });

        //     it('should be able to include the given cursor', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 'myToken',
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     cursor: 'myCursor',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'Bearer myToken',
        //                 },
        //             },
        //         ]);
        //     });

        //     it('should include the authorization header even when no token is used', async () => {
        //         setResponse({
        //             data: {
        //                 records: [
        //                     {
        //                         authID: 'myAuthID',
        //                         space: 'tempRestricted',
        //                         address: 'myAddress',
        //                         data: { abc: 'def' },
        //                     },
        //                 ],
        //                 totalCount: 5,
        //                 hasMoreRecords: true,
        //                 cursor: 'myCursor',
        //             },
        //         });

        //         records.handleEvents([
        //             getRecords(
        //                 null,
        //                 'myAuthID',
        //                 'tempRestricted',
        //                 {
        //                     cursor: 'myCursor',
        //                 },
        //                 1
        //             ),
        //         ]);

        //         expect(getLastGet()).toEqual([
        //             'http://localhost:3002/api/records?authID=myAuthID&cursor=myCursor&space=tempRestricted',
        //             {
        //                 headers: {
        //                     Authorization: 'None',
        //                 },
        //             },
        //         ]);
        //     });
        // });

        // describe('delete_record', () => {
        //     beforeEach(() => {
        //         require('axios').__reset();
        //     });

        //     it('should make a POST request to /api/records/delete', async () => {
        //         setResponse({
        //             data: null,
        //             status: 200,
        //         });

        //         records.handleEvents([
        //             deleteRecord('myToken', 'myAddress', 'tempRestricted', 1),
        //         ]);

        //         expect(getLastPost()).toEqual([
        //             'http://localhost:3002/api/records/delete',
        //             {
        //                 token: 'myToken',
        //                 address: 'myAddress',
        //                 space: 'tempRestricted',
        //             },
        //         ]);

        //         await waitAsync();

        //         expect(actions).toEqual([asyncResult(1, null)]);
        //     });
        // });
    });
});
