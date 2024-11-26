import {
    AuthUser,
    XpAccount,
    XpAccountEntry,
    XpContract,
    XpInvoice,
    XpStore,
    XpUser,
} from '@casual-simulation/aux-records';
import { SuccessResult } from '@casual-simulation/aux-records/TypeUtils';
import {
    PrismaClient,
    DataRecord as PrismaDataRecord,
    Prisma,
} from './generated';

/**
 * A helper function that runs the given function and returns null if an error occurs.
 * @param fn The function to run.
 * * Useful for database operations that may fail due to invalid input.
 * * Still be wary of cases where invalid input could be malicious as this could be used to hide errors.
 */
async function noThrowNull<Fn extends (...args: any[]) => any>(
    fn: Fn,
    ...args: Parameters<Fn>
): Promise<ReturnType<Fn> | null> {
    try {
        return await fn(...args);
    } catch (error) {
        console.warn(error);
        return null;
    }
}

export class PrismaXpStore implements XpStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    getXpAccount: (accountId: XpAccount['id']) => Promise<XpAccount>;
    getXpAccountEntry: (
        entryId: XpAccountEntry['id']
    ) => Promise<XpAccountEntry>;
    getXpContract: (contractId: XpContract['id']) => Promise<XpContract>;
    getXpInvoice: (invoiceId: XpInvoice['id']) => Promise<XpInvoice>;

    async getXpUserById(id: XpUser['id']) {
        const pUser = await noThrowNull(this._client.xpUser.findUnique, {
            where: { id },
        });
        return !pUser
            ? null
            : {
                  id: pUser.id,
                  accountId: pUser.accountId,
                  userId: pUser.userId,
                  requestedRate: pUser.requestedRate,
                  createdAtMs: pUser.createdAt.getTime(),
                  updatedAtMs: pUser.updatedAt.getTime(),
              };
    }

    async getXpUserByAuthId(id: AuthUser['id']) {
        const pUser = await noThrowNull(this._client.xpUser.findUnique, {
            where: { userId: id },
        });
        return !pUser
            ? null
            : {
                  id: pUser.id,
                  accountId: pUser.accountId,
                  userId: pUser.userId,
                  requestedRate: pUser.requestedRate,
                  createdAtMs: pUser.createdAt.getTime(),
                  updatedAtMs: pUser.updatedAt.getTime(),
              };
    }

    saveXpAccount<T extends 'user' | 'contract' = 'user'>(
        associationId: T extends 'user' ? XpUser['id'] : XpContract['id'],
        account: XpAccount
    ): Promise<SuccessResult> {
        throw new Error('Method not implemented.');
    }

    async saveXpContract(contract: XpContract, account: XpAccount | null) {
        await this._client.xpContract.create({
            data: {
                id: contract.id,
                rate: contract.rate,
                offeredWorth: contract.offeredWorth,
                ...(account !== null
                    ? {
                          account: {
                              create: {
                                  id: account.id,
                                  currency: account.currency,
                                  createdAt: new Date(account.createdAtMs),
                                  updatedAt: new Date(account.updatedAtMs),
                              },
                          },
                      }
                    : {}),
                issuer: {
                    connect: {
                        id: contract.issuerUserId,
                    },
                },
                ...(contract.holdingUserId !== null
                    ? {
                          holdingUser: {
                              connect: {
                                  id: contract.holdingUserId,
                              },
                          },
                      }
                    : {}),
                status: contract.status,
                createdAt: new Date(contract.createdAtMs),
                updatedAt: new Date(contract.updatedAtMs),
            },
        });
    }

    async saveXpUserWithAccount(user: XpUser, account: XpAccount) {
        await this._client.xpUser.create({
            data: {
                id: user.id,
                account: {
                    create: {
                        id: account.id,
                        currency: account.currency,
                        createdAt: new Date(account.createdAtMs),
                        updatedAt: new Date(account.updatedAtMs),
                    },
                },
                user: {
                    connect: {
                        id: user.userId,
                    },
                },
                requestedRate: user.requestedRate,
                createdAt: new Date(user.createdAtMs),
                updatedAt: new Date(user.updatedAtMs),
            },
        });
    }

    async saveXpUser(id: XpUser['id'], user: XpUser) {
        const upsert = await this._client.xpUser.upsert({
            where: { id },
            create: {
                id,
                accountId: user.accountId,
                userId: user.userId,
                requestedRate: user.requestedRate,
                createdAt: new Date(user.createdAtMs),
                updatedAt: new Date(user.updatedAtMs),
            },
            update: {
                accountId: user.accountId,
                requestedRate: user.requestedRate,
                updatedAt: new Date(user.updatedAtMs),
            },
        });
        return { success: upsert ? true : false };
    }
}
