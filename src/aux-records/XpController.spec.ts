import { createTestControllers, createTestUser } from './TestUtils';
import { ParsePromiseGeneric } from '../xp-api/util/generic/TypeUtils';
import { TestCache, TestConfig } from '../xp-api/util/test-util/Typings';
import { RecordsServer } from './RecordsServer';

const testConfig: TestConfig = {
    userEmail: 'test+xp.user@localhost',
};

/**
 * XpController tests
 */
describe('XpController', () => {
    //* Setup cache in an appropriate scope
    let cache: TestCache<
        ParsePromiseGeneric<ReturnType<typeof createTestUser>>
    >;

    beforeAll(async () => {
        //* Setup services
        const services = createTestControllers();

        // const server = new RecordsServer(
        // TODO: Implement RecordsServer with minimal functionality
        // )

        //* Create login request with test user
        const user = await createTestUser(services, testConfig.userEmail);
    });

    //* Test case until proper tests are implemented
    it('should be defined', () => {
        expect(true).toBeTruthy();
    });
});
