import type {
    PrivoClientCredentials,
    PrivoStore,
} from '@casual-simulation/aux-records/PrivoStore';
import type { PrismaClient } from './generated';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';

const TRACE_NAME = 'PrismaPrivoStore';

export class PrismaPrivoStore implements PrivoStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    @traced(TRACE_NAME)
    async getStoredCredentials(): Promise<PrivoClientCredentials> {
        const credentials = await this._client.privoClientCredentials.findFirst(
            {
                where: {
                    expiresAt: {
                        gt: new Date(),
                    },
                },
                orderBy: {
                    expiresAt: 'desc',
                },
            }
        );

        return credentials;
    }

    @traced(TRACE_NAME)
    async saveCredentials(credentials: PrivoClientCredentials): Promise<void> {
        await this._client.privoClientCredentials.create({
            data: {
                id: credentials.id,
                accessToken: credentials.accessToken,
                refreshToken: credentials.refreshToken,
                expiresAt: new Date(credentials.expiresAtSeconds * 1000),
                expiresAtSeconds: credentials.expiresAtSeconds,
                scope: credentials.scope,
            },
        });
    }
}
