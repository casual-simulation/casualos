import type {
    AuthUser,
    XpContract,
    XpInvoice,
    XpStore,
    XpUser,
    SuccessResult,
    UseTimeKeys,
    GenericTimeKeysDB,
} from '@casual-simulation/aux-records';
import {
    PrismaClient,
    DataRecord as PrismaDataRecord,
    Prisma,
} from './generated';
import { noThrowNull } from './Utils';
import type { Account } from 'tigerbeetle-node';

export class PrismaXpStore implements XpStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async getXpUserById(id: XpUser['id']) {
        const pUser = await noThrowNull(this._client.xpUser.findUnique, null, {
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
        const pUser = await noThrowNull(this._client.xpUser.findUnique, null, {
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

    async getXpContract(id: XpContract['id']) {
        const contract = await noThrowNull(
            this._client.xpContract.findUnique,
            null,
            {
                where: { id },
            }
        );
        if (!contract) return null;
        const { createdAt, updatedAt, ...rest } = contract;
        return {
            ...rest,
            createdAtMs: createdAt.getTime(),
            updatedAtMs: updatedAt.getTime(),
        };
    }

    async getXpInvoice(id: XpInvoice['id']) {
        const invoice = await noThrowNull(
            this._client.xpInvoice.findUnique,
            null,
            {
                where: { id },
            }
        );
        if (!invoice) return null;
        const { createdAt, updatedAt, ...rest } = invoice;
        return {
            ...rest,
            createdAtMs: createdAt.getTime(),
            updatedAtMs: updatedAt.getTime(),
        };
    }

    async saveXpContract(contract: XpContract) {
        await this._client.xpContract.create({
            data: {
                id: contract.id,
                rate: contract.rate,
                offeredWorth: contract.offeredWorth,
                accountId: contract.accountId,
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

    async updateXpContract(
        id: XpContract['id'],
        config: Partial<Omit<XpContract, 'id' | 'createdAt'>>
    ): ReturnType<XpStore['updateXpContract']> {
        /**
         * directConf is the configuration object without properties which need
         * additional processing before being passed to the update function.
         */
        const { holdingUserId, issuerUserId, updatedAtMs, ...directConf } =
            config;
        const contract = await this._client.xpContract.update({
            where: { id },
            data: {
                ...directConf,
                ...(config.holdingUserId !== null
                    ? {
                          holdingUser: {
                              connect: {
                                  id: config.holdingUserId,
                              },
                          },
                      }
                    : {}),
                ...(config.issuerUserId !== null
                    ? { issuer: { connect: { id: config.issuerUserId } } }
                    : {}),
                updatedAt: new Date(config.updatedAtMs),
            },
        });
        const { createdAt, updatedAt, ...rest } = contract;
        return {
            success: true,
            contract: {
                ...rest,
                createdAtMs: createdAt.getTime(),
                updatedAtMs: updatedAt.getTime(),
            },
        };
    }

    async saveXpInvoice(invoice: XpInvoice) {
        await this._client.xpInvoice.create({
            data: {
                id: invoice.id,
                amount: invoice.amount,
                contract: {
                    connect: {
                        id: invoice.contractId,
                    },
                },
                note: invoice.note,
                status: invoice.status,
                transactionId: invoice.transactionId,
                voidReason: invoice.voidReason,
                createdAt: new Date(invoice.createdAtMs),
                updatedAt: new Date(invoice.updatedAtMs),
            },
        });
    }

    async saveXpUser(id: XpUser['id'], user: XpUser) {
        await this._client.xpUser.upsert({
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
    }
}
