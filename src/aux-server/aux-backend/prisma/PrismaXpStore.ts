import type {
    AuthUser,
    XpContract,
    XpInvoice,
    XpStore,
    XpUser,
} from '@casual-simulation/aux-records';
import { PrismaClient } from './generated';
import { convertDateToDateMS, noThrowNull } from './Utils';

export class PrismaXpStore implements XpStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async getXpUserById(id: XpUser['id']) {
        const pUser = await noThrowNull(this._client.xpUser.findUnique, null, {
            where: { id },
        });
        return !pUser ? null : convertDateToDateMS(pUser);
    }

    async getXpUserByAuthId(id: AuthUser['id']) {
        const pUser = await noThrowNull(this._client.xpUser.findUnique, null, {
            where: { userId: id },
        });
        return !pUser ? null : convertDateToDateMS(pUser);
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
        return convertDateToDateMS(contract);
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
        return convertDateToDateMS(invoice);
    }

    async saveXpContract(contract: XpContract) {
        return convertDateToDateMS(
            await this._client.xpContract.create({
                data: {
                    id: contract.id,
                    rate: contract.rate,
                    offeredWorth: contract.offeredWorth,
                    accountId: String(contract.accountId),
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
            })
        );
    }

    async updateXpContract(
        id: XpContract['id'],
        config: Partial<Omit<XpContract, 'id' | 'createdAt'>>
    ): ReturnType<XpStore['updateXpContract']> {
        /**
         * directConf is the configuration object without properties which need
         * additional processing before being passed to the update function.
         */
        const {
            accountId,
            holdingUserId,
            issuerUserId,
            updatedAtMs,
            ...directConf
        } = config;
        return convertDateToDateMS(
            await this._client.xpContract.update({
                where: { id },
                data: {
                    ...directConf,
                    accountId: String(accountId),
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
            })
        );
    }

    async saveXpInvoice(invoice: XpInvoice) {
        return convertDateToDateMS(
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
            })
        );
    }

    async saveXpUser(
        id: XpUser['id'],
        user: XpUser
    ): ReturnType<XpStore['saveXpUser']> {
        return convertDateToDateMS(
            await this._client.xpUser.upsert({
                where: { id },
                create: {
                    id,
                    accountId: String(user.accountId),
                    userId: user.userId,
                    requestedRate: user.requestedRate,
                    createdAt: new Date(user.createdAtMs),
                    updatedAt: new Date(user.updatedAtMs),
                },
                update: {
                    accountId: String(user.accountId),
                    requestedRate: user.requestedRate,
                    updatedAt: new Date(user.updatedAtMs),
                },
            })
        );
    }
}
