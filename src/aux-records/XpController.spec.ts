import { createTestControllers, createTestUser } from './TestUtils';
import { MemoryAuthMessenger } from './MemoryAuthMessenger';
import { AuthController, RelyingParty } from './AuthController';
import { MemoryStore } from './MemoryStore';
import { XpController } from '../aux-records/XpController';
import { ParsePromiseGeneric } from '../xp-api/util/generic/TypeUtils';

/**
 * XpController tests
 */
describe('XpController', () => {
    let services = createTestControllers();
    /**
     * Test cache
     */
    const _C: {
        authController: AuthController;
        authMessenger: MemoryAuthMessenger;
        manualDataStore: MemoryStore;
        memoryStore: MemoryStore;
    } = {
        authController: services.auth,
        authMessenger: services.authMessenger,
        manualDataStore: new MemoryStore({
            subscriptions: null as any,
        }),
        memoryStore: services.store,
    };

    const _users: Map<
        string,
        ParsePromiseGeneric<ReturnType<typeof createTestUser>>
    > = new Map();

    beforeAll(async () => {
        //* Create test user(s) with the given role(s)
        new Set(['player', 'owner']).forEach(async (role) => {
            const email = `xp.test_${role}@localhost`;
            _users.set(
                email,
                await createTestUser(
                    {
                        auth: _C['authController'],
                        authMessenger: _C['authMessenger'],
                    },
                    email
                )
            );
        });

        console.log(_users);
    });

    //* Test case until proper tests are implemented
    it('should be defined', () => {
        expect(XpController).toBeTruthy();
    });

    it('should get xp user meta', async () => {
        //const meta = undefined;
        //expect(meta).toBeDefined();
    });

    //it('should ');
});
