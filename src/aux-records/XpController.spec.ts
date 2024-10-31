import { createTestControllers, createTestUser } from './TestUtils';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { AuthController } from './AuthController';
import { MemoryStore } from './MemoryStore';
import { GetXpUserResult, XpController } from '../aux-records/XpController';
import { XpUser } from './XpStore';
import { isOfXType } from './Utils';
import { PromiseT } from './TypeUtils';

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
    //* EOCS: Init services

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
        const successXpUser: GetXpUserResult = {
            success: true,
            user: {
                id: expect.any(String),
                userId: expect.any(String),
                accountId: expect.any(String),
                requestedRate: null,
                createdAtMs: expect.any(Number),
                updatedAtMs: expect.any(Number),
            },
        };

        beforeEach(async () => {
            _authUser = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                'xp.test@localhost'
            );
        });

        it('should get an xp user by auth id', async () => {
            expect(
                await xpController.getXpUser({
                    userId: _authUser.userId,
                })
            ).toEqual(successXpUser);
        });

        it('should get an xp user by xp id', async () => {
            // Get an xp user by auth id to subsequently get it by xp id
            const xpUserRes = await xpController.getXpUser({
                userId: _authUser.userId,
            });

            // Ensure the xp user was successfully created / retrieved
            if (!xpUserRes.success) fail('Failed to get xp user by auth id');

            // Get the xp user by xp id
            expect(
                await xpController.getXpUser({
                    xpId: xpUserRes.user.id,
                })
            ).toEqual(successXpUser);
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
