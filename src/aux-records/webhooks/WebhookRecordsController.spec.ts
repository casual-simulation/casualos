import { MemoryCrudRecordsStore } from '../crud/MemoryCrudRecordsStore';
import { MemoryStore } from '../MemoryStore';
import { PolicyController } from '../PolicyController';
import { RecordsController } from '../RecordsController';
import {
    createTestControllers,
    createTestRecordKey,
    createTestUser,
} from '../TestUtils';
import { WebhookRecordsController } from './WebhookRecordsController';
import { MemoryWebhookRecordsStore } from './MemoryWebhookRecordsStore';

describe('WebhookRecordsController', () => {
    let store: MemoryStore;
    let itemsStore: MemoryWebhookRecordsStore;
    let records: RecordsController;
    let policies: PolicyController;
    let manager: WebhookRecordsController;
    let key: string;
    let subjectlessKey: string;

    let userId: string;
    let sessionKey: string;
    let otherUserId: string;

    beforeEach(async () => {
        const services = createTestControllers();

        store = services.store;
        itemsStore = new MemoryCrudRecordsStore(store);
        policies = services.policies;
        records = services.records;
        manager = new WebhookRecordsController({
            policies,
            store: itemsStore,
            name: 'testItem',
            config: store,
        });

        const user = await createTestUser(services, 'test@example.com');
        userId = user.userId;
        sessionKey = user.sessionKey;

        const testRecordKey = await createTestRecordKey(
            services,
            userId,
            'testRecord',
            'subjectfull'
        );
        key = testRecordKey.recordKey;

        const subjectlessRecordKey = await createTestRecordKey(
            services,
            userId,
            'testRecord',
            'subjectless'
        );
        subjectlessKey = subjectlessRecordKey.recordKey;

        otherUserId = 'otherUserId';
        await store.saveUser({
            id: otherUserId,
            allSessionRevokeTimeMs: null,
            currentLoginRequestId: null,
            email: 'other@example.com',
            phoneNumber: null,
        });
    });
});
