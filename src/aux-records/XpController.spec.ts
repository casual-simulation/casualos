import { createTestControllers, createTestUser } from './TestUtils';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { AuthController } from './AuthController';
import { MemoryStore } from './MemoryStore';
import { XpController } from '../aux-records/XpController';
import { XpAccount, XpInvoice, XpUser } from './XpStore';
import { NotNullOrOptional, PromiseT } from './TypeUtils';
import { v4 as uuid } from 'uuid';

jest.mock('uuid');
const uuidMock: jest.Mock = <any>uuid;

interface UniqueConfig {
    /** A test scope name to be used in the uuid for easy debug */
    name: string;
    /** An optional index to start the unique count at */
    c?: number;
}

const unique = (uConf: UniqueConfig) => {
    uConf.c = typeof uConf?.c === 'undefined' ? 0 : uConf.c + 1;
    return `unique-gen-${uConf.name}-${uConf.c}`;
};

const uniqueWithMock = (uConf: UniqueConfig) => {
    const v = unique(uConf);
    uuidMock.mockReturnValueOnce(v);
    return v;
};

const manyUniqueWithMock = (uConf: UniqueConfig, n: number) =>
    Array.from({ length: n }, (_, i) => uniqueWithMock(uConf));

/**
 * XpController tests
 */
describe('XpController', () => {
    //* BOCS: Init services
    let services: ReturnType<typeof createTestControllers>;
    let xpController: XpController;
    let memoryStore: MemoryStore;
    let authController: AuthController;
    let authMessenger: MemoryAuthMessenger;
    let _testDateNow: number;
    //* EOCS: Init services

    //* BOCS: Mocking Date.now
    /**
     * Stores original function reference for restoration after tests
     */
    const dateNowRef = Date.now;
    let nowMock: jest.Mock<number>;
    //* EOC: Mocking Date.now

    /**
     * (Re-)Initialize services required for tests
     */
    const initServices = () => {
        services = createTestControllers();
        xpController = new XpController({
            xpStore: services.store,
            authController: services.auth,
            authStore: services.store,
        });
        memoryStore = services.store;
        authController = services.auth;
        authMessenger = services.authMessenger;
    };

    /**
     * Runs before all tests (once)
     */
    beforeAll(async () => {
        initServices();
    });

    /**
     * Runs before each test
     */
    beforeEach(() => {
        initServices();
        _testDateNow = dateNowRef();
        nowMock = Date.now = jest.fn();
        nowMock.mockReturnValue(_testDateNow);
    });

    /**
     * Runs after each test
     */
    afterEach(() => {
        //* Reset the uuid mock to ensure that it is clean for the next test
        uuidMock.mockReset();
        nowMock.mockReset();
        Date.now = dateNowRef;
    });

    //* Test case for the XpController class
    it('should be defined', () => {
        expect(XpController).toBeTruthy();
        expect(xpController).toBeTruthy();
    });

    /**
     * Successful getXpUser invocations across the board should be indicative of—
     * successful XP user initialization as well as retrieval
     */
    describe('getXpUser', () => {
        //* An auth user for use in testing getXpUser
        let _authUser: PromiseT<ReturnType<typeof createTestUser>>;

        //* The expected result of a successful getXpUser call
        let _xpUser: XpUser;

        //* Unique function config
        const uConf = { name: 'getXpUser' };

        beforeEach(async () => {
            const [_, accountId, id] = manyUniqueWithMock(uConf, 3);

            _authUser = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                'xp.test@localhost'
            );

            const xpAccount: XpAccount = {
                id: accountId,
                currency: 'USD',
                closedTimeMs: null,
                createdAtMs: _testDateNow,
                updatedAtMs: _testDateNow,
            };

            const xpUser: XpUser = {
                id,
                userId: _authUser.userId,
                accountId: xpAccount.id,
                requestedRate: null,
                createdAtMs: _testDateNow,
                updatedAtMs: _testDateNow,
            };

            await memoryStore.saveXpUserWithAccount(xpUser, xpAccount);

            _xpUser = xpUser;

            uuidMock.mockReset();
        });

        it('should create and return a new xp user when given a valid userId whose respective auth user does not have an xp user identity', async () => {
            const [userId, accountId, id] = manyUniqueWithMock(uConf, 3);

            const newAuthUser = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                `xp.test.newAuthUser0@localhost`
            );

            expect(
                await xpController.getXpUser({
                    userId: newAuthUser.userId,
                })
            ).toEqual({
                success: true,
                user: {
                    id,
                    userId,
                    accountId,
                    requestedRate: null,
                    createdAtMs: _testDateNow,
                    updatedAtMs: _testDateNow,
                },
            });
        });

        it('should get an xp user by auth id', async () => {
            expect(
                await xpController.getXpUser({
                    userId: _authUser.userId,
                })
            ).toEqual({
                success: true,
                user: _xpUser,
            });
        });

        it('should get an xp user by xp id', async () => {
            expect(
                await xpController.getXpUser({
                    xpId: _xpUser.id,
                })
            ).toEqual({
                success: true,
                user: _xpUser,
            });
        });

        it('should fail to get an xp user due to use of multiple identifiers', async () => {
            const xpUser = await xpController.getXpUser({
                userId: _authUser.userId,
                xpId: 'some-id',
            });
            expect(xpUser).toEqual({
                success: false,
                errorCode: 'invalid_request',
                errorMessage: expect.any(String),
            });
        });

        it('should fail to get an xp user by auth id due to user not found', async () => {
            const xpUser = await xpController.getXpUser({
                userId: 'non-existent-id',
            });
            expect(xpUser).toEqual({
                success: false,
                errorCode: 'user_not_found',
                errorMessage: expect.any(String),
            });
        });

        it('should fail to get an xp user by xp id due to user not found', async () => {
            const xpUser = await xpController.getXpUser({
                xpId: 'non-existent-id',
            });
            expect(xpUser).toEqual({
                success: false,
                errorCode: 'user_not_found',
                errorMessage: expect.any(String),
            });
        });
    });
});
