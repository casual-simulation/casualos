/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { TestUser } from './TestUtils';
import {
    createTestControllers,
    createTestUser,
    createTestXpUser,
} from './TestUtils';
import type { MemoryAuthMessenger } from './MemoryAuthMessenger';
import type { AuthController } from './AuthController';
import type { MemoryStore } from './MemoryStore';
// import type { CreateContractResultSuccess } from '../aux-records/XpController';
import { XpController } from '../aux-records/XpController';
import { v4 as uuid } from 'uuid';
import {
    ACCOUNT_IDS,
    AccountCodes,
    LEDGERS,
    TransferCodes,
} from './financial/FinancialInterface';
import { AccountFlags, TransferFlags } from './financial/Types';
import { failure, success, unwrap } from '@casual-simulation/aux-common';

console.log = jest.fn();

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
    let idempotencyKeyTracker = 0n;
    //* EOCS: Init services

    //* BOCS: Mocking Date.now
    /**
     * Stores original function reference for restoration after tests
     */
    const dateNowRef = Date.now;
    let nowMock: jest.Mock<number>;
    //* EOC: Mocking Date.now

    /**
     * Runs before each test
     */
    beforeEach(() => {
        services = createTestControllers();
        xpController = new XpController({
            xpStore: services.store,
            authController: services.auth,
            authStore: services.store,
            financialInterface: services.financialInterface,
            // financialController: services.financialController,
        });
        memoryStore = services.store;
        authController = services.auth;
        authMessenger = services.authMessenger;
        idempotencyKeyTracker = 0n;
        nowMock = Date.now = jest.fn();
        nowMock.mockReturnValue(1);
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

    describe('init()', () => {
        it('should create a stripe assets account', async () => {
            await xpController.init();

            expect([...services.financialInterface.accounts.values()]).toEqual([
                {
                    id: 1001n,
                    debits_pending: 0n,
                    debits_posted: 0n,
                    credits_pending: 0n,
                    credits_posted: 0n,
                    user_data_128: 0n,
                    user_data_64: 0n,
                    user_data_32: 0,
                    reserved: 0,
                    ledger: 1,
                    flags: AccountFlags.credits_must_not_exceed_debits,
                    code: AccountCodes.assets_cash,
                    timestamp: 0n,
                },
            ]);
        });
    });

    describe('createTestXpUser()', () => {
        it('should create an xp user using test function', async () => {
            uuidMock
                .mockReturnValueOnce('userId')
                .mockReturnValueOnce('xpUserId');

            const xpUser = unwrap(
                await createTestXpUser(
                    xpController,
                    { auth: authController, authMessenger: authMessenger },
                    'xp.test2@localhost'
                )
            );

            expect(xpUser).toEqual({
                user: {
                    userId: 'userId',
                    accountId: '0',
                    accountBalance: 0,
                    accountCurrency: 'usd',
                    requestedRate: null,
                    displayName: null,
                    email: 'xp.test2@localhost',
                    phoneNumber: null,
                    privacyFeatures: {
                        allowAI: true,
                        allowPublicData: true,
                        allowPublicInsts: true,
                        publishData: true,
                    },
                    role: 'none',
                    subscriptionTier: 'beta',
                    hasActiveSubscription: true,
                },
            });
        });
    });

    describe('createXpUser()', () => {
        it('should create an xp user', async () => {
            const userId = 'userId';
            await services.store.saveUser({
                id: userId,
                email: 'xp.test@localhost',
                phoneNumber: null,
                allSessionRevokeTimeMs: null,
                currentLoginRequestId: null,
            });

            uuidMock.mockReturnValueOnce('xpId');
            const result = await xpController.createXpUser(userId);

            expect(result).toEqual(
                success({
                    user: {
                        xpId: 'xpId',
                        id: 'userId',
                        userId: 'userId',
                        accountId: '0',
                        requestedRate: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        allSessionRevokeTimeMs: null,
                        currentLoginRequestId: null,
                    },
                })
            );
        });
    });

    /**
     * Successful getXpUser invocations across the board should be indicative of—
     * successful XP user initialization as well as retrieval
     */
    describe('getXpUser', () => {
        //* An auth user for use in testing getXpUser
        let user: TestUser;

        // const xpId = 'xpUserId';
        const userId = 'userId';

        beforeEach(async () => {
            uuidMock.mockReturnValueOnce(userId);

            user = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                'xp.test@localhost'
            );

            uuidMock.mockReset();
        });

        it('should create and return a new xp user when given a valid userId whose respective auth user does not have an xp user identity', async () => {
            uuidMock
                .mockReturnValueOnce('newUserId')
                .mockReturnValueOnce('newXpUserId');

            const newAuthUser = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                `xp.test.newAuthUser0@localhost`
            );

            const result = await xpController.getXpUser({
                userId: newAuthUser.userId,
            });

            expect(result).toEqual(
                success({
                    user: {
                        userId: newAuthUser.userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test.newAuthUser0@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should get an xp user by auth id', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const result = await xpController.getXpUser({
                userId: user.userId,
            });
            expect(result).toEqual(
                success({
                    user: {
                        userId: userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should get an xp user by requested user id', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const result = await xpController.getXpUser({
                requestedUserId: user.userId,
                userId: user.userId,
            });
            expect(result).toEqual(
                success({
                    user: {
                        userId: userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should return user_not_found if requesting a specific xpId that doesnt exist', async () => {
            const result = await xpController.getXpUser({
                requestedXpId: 'missing',
                userId: user.userId,
            });
            expect(result).toEqual(
                failure({
                    errorCode: 'user_not_found',
                    errorMessage: 'The user with the given xpId was not found.',
                })
            );
        });

        it('should get an xp user by xp id', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const result = await xpController.getXpUser({
                requestedXpId: 'xpId',
                userId: user.userId,
            });
            expect(result).toEqual(
                success({
                    user: {
                        userId: user.userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should prefer using the xp ID first', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const result = await xpController.getXpUser({
                requestedXpId: 'xpId',
                requestedUserId: 'missing-user-id',
                userId: user.userId,
            });

            expect(result).toEqual(
                success({
                    user: {
                        userId: user.userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should calculate the current balance', async () => {
            unwrap(await xpController.init());

            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            unwrap(
                await xpController.internalTransfer({
                    transfers: [
                        {
                            amount: 100n,
                            code: TransferCodes.external_credits_user,
                            creditAccountId: 0n,
                            debitAccountId: ACCOUNT_IDS.stripe_assets,
                            currency: 'usd',
                        },
                    ],
                })
            );

            const result = await xpController.getXpUser({
                userId: user.userId,
            });
            expect(result).toEqual(
                success({
                    user: {
                        userId: userId,
                        accountId: '0',
                        accountBalance: 100,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        //* EOL test case now as parameters apply XOR typing making this syntactically invalid
        // it('should fail to get an xp user due to use of multiple identifiers', async () => {
        //     const xpUser = await xpController.getXpUser({
        //         userId: _authUser.userId,
        //         xpId: 'some-id',
        //     });
        //     expect(xpUser).toEqual({
        //         success: false,
        //         errorCode: 'invalid_request',
        //         errorMessage: expect.any(String),
        //     });
        // });

        it('should return not_authorized if trying to get another users info', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const xpUser = await xpController.getXpUser({
                userId: 'otherUserId',
                requestedXpId: 'xpId',
            });
            expect(xpUser).toEqual(
                failure({
                    errorCode: 'not_authorized',
                    errorMessage:
                        'You are not authorized to perform this operation.',
                })
            );
        });

        it('should allow superUsers to get any user xp info for xpUsers that need to be created', async () => {
            const xpUser = await xpController.getXpUser({
                userId: 'otherUserId',
                userRole: 'superUser',
                requestedUserId: user.userId,
            });

            expect(xpUser).toEqual(
                success({
                    user: {
                        userId: user.userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should allow superUsers to get any user xp info', async () => {
            // create the xpUser for the user
            uuidMock.mockReturnValueOnce('xpId');
            unwrap(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            );

            const xpUser = await xpController.getXpUser({
                userId: 'otherUserId',
                userRole: 'superUser',
                requestedXpId: 'xpId',
            });

            expect(xpUser).toEqual(
                success({
                    user: {
                        userId: user.userId,
                        accountId: '0',
                        accountBalance: 0,
                        accountCurrency: 'usd',
                        requestedRate: null,
                        displayName: null,
                        email: 'xp.test@localhost',
                        phoneNumber: null,
                        privacyFeatures: {
                            allowAI: true,
                            allowPublicData: true,
                            allowPublicInsts: true,
                            publishData: true,
                        },
                        role: 'none',
                        subscriptionTier: 'beta',
                        hasActiveSubscription: true,
                    },
                })
            );
        });

        it('should fail to get an xp user by auth id due to user not found', async () => {
            const xpUser = await xpController.getXpUser({
                userId: 'non-existent-id',
            });
            expect(xpUser).toEqual(
                failure({
                    errorCode: 'user_not_found',
                    errorMessage: 'The user was not found.',
                })
            );
        });

        it('should fail to get an xp user by xp id due to user not found', async () => {
            const xpUser = await xpController.getXpUser({
                userId: 'missing-user',
            });
            expect(xpUser).toEqual(
                failure({
                    errorCode: 'user_not_found',
                    errorMessage: 'The user was not found.',
                })
            );
        });
    });

    describe('internalTransfer()', () => {
        let account1Id: bigint;
        let account2Id: bigint;

        beforeEach(async () => {
            unwrap(await xpController.init());

            ({ id: account1Id } = unwrap(
                await xpController.createAccount(AccountCodes.liabilities_user)
            ));
            ({ id: account2Id } = unwrap(
                await xpController.createAccount(AccountCodes.liabilities_user)
            ));
        });

        it('should be able to transfer money from the assets_cash account to a user account', async () => {
            const result = await xpController.internalTransfer({
                transfers: [
                    {
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: 2n,
                    transferIds: [3n],
                })
            );
            expect(services.financialInterface.transfers).toEqual([
                {
                    id: 3n,
                    amount: 100n,
                    code: TransferCodes.external_credits_user,
                    credit_account_id: account1Id,
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 2n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should be able to transfer money from one user account to another', async () => {
            unwrap(
                await xpController.internalTransfer({
                    transfers: [
                        {
                            debitAccountId: ACCOUNT_IDS.stripe_assets,
                            creditAccountId: account1Id,
                            currency: 'usd',
                            amount: 1000n,
                            code: TransferCodes.external_credits_user,
                        },
                    ],
                })
            );

            const result = await xpController.internalTransfer({
                transfers: [
                    {
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: 4n,
                    transferIds: [5n],
                    // accountBalances: [
                    //     {
                    //         accountId: account1Id,
                    //         balance: 900n,
                    //     },
                    //     {
                    //         accountId: account2Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );
            expect(services.financialInterface.transfers.slice(1)).toEqual([
                {
                    id: 5n,
                    amount: 100n,
                    code: TransferCodes.external_credits_user,
                    credit_account_id: account2Id,
                    debit_account_id: account1Id,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 4n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should use the given transfer Id', async () => {
            const result = await xpController.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: 2n,
                    transferIds: [100n],
                    // accountBalances: [
                    //     {
                    //         accountId: ACCOUNT_IDS.stripe_assets,
                    //         balance: -100n,
                    //     },
                    //     {
                    //         accountId: account1Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );
            expect(services.financialInterface.transfers).toEqual([
                {
                    id: 100n,
                    amount: 100n,
                    credit_account_id: account1Id,
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    code: TransferCodes.external_credits_user,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 2n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });

        it('should reject the transfer if it would cause a user account to go negative', async () => {
            const result = await xpController.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                ],
            });

            expect(result).toEqual(
                failure({
                    errorCode: 'debits_exceed_credits',
                    errorMessage:
                        'The transfer would cause the account debits to exceed its credits.',
                    accountId: account1Id,
                })
            );
            expect(services.financialInterface.transfers).toEqual([]);
        });

        it('should be able to perform transfers in a transaction', async () => {
            const result = await xpController.internalTransfer({
                transfers: [
                    {
                        transferId: 100n,
                        debitAccountId: ACCOUNT_IDS.stripe_assets,
                        creditAccountId: account1Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                    {
                        transferId: 101n,
                        debitAccountId: account1Id,
                        creditAccountId: account2Id,
                        currency: 'usd',
                        amount: 100n,
                        code: TransferCodes.external_credits_user,
                    },
                ],
            });

            expect(result).toEqual(
                success({
                    transactionId: 2n,
                    transferIds: [100n, 101n],
                    // accountBalances: [
                    //     {
                    //         accountId: ACCOUNT_IDS.stripe_assets,
                    //         balance: -100n,
                    //     },
                    //     {
                    //         accountId: account1Id,
                    //         balance: 0n,
                    //     },
                    //     {
                    //         accountId: account2Id,
                    //         balance: 100n,
                    //     },
                    // ],
                })
            );

            expect(services.financialInterface.transfers).toEqual([
                {
                    id: 100n,
                    amount: 100n,
                    credit_account_id: account1Id,
                    debit_account_id: ACCOUNT_IDS.stripe_assets,
                    code: TransferCodes.external_credits_user,
                    flags: TransferFlags.linked,
                    ledger: LEDGERS.usd,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 2n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
                {
                    id: 101n,
                    amount: 100n,
                    credit_account_id: account2Id,
                    debit_account_id: account1Id,
                    code: TransferCodes.external_credits_user,
                    flags: TransferFlags.none,
                    ledger: LEDGERS.usd,
                    pending_id: 0n,
                    timeout: 0,
                    timestamp: 0n,
                    user_data_128: 2n,
                    user_data_64: 0n,
                    user_data_32: 0,
                },
            ]);
        });
    });

    describe('externalTransfer()', () => {});

    // describe('createContract', () => {
    //     //* An issuing user for use in testing createContract
    //     let _issuingUser: XpUser;

    //     //* A user that will receive the contract
    //     let _receivingUser: XpUser;

    //     let _contractConfig: NotNullOrOptional<
    //         Parameters<typeof xpController.createContract>[0]
    //     >;

    //     //* Unique function config
    //     const uConf = { name: 'createContract' };

    //     beforeEach(async () => {
    //         /**
    //          * * The ids for the users are irrelevant in terms of caching and expecting for this test scope.
    //          * * However we still need unique ids for user creation.
    //          */
    //         uuidMock.mockImplementation(() => unique(uConf));

    //         //* (re)Initialize the issuing user
    //         _issuingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'issuing@localhost'
    //         );

    //         //* (re)Initialize the receiving user
    //         _receivingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'receiving@localhost'
    //         );

    //         //* (re)Initialize the contract config
    //         _contractConfig = {
    //             creationRequestReceivedAt: Date.now(),
    //             description: 'Test Description',
    //             issuingUserId: { xpId: _issuingUser.id },
    //             receivingUserId: { xpId: _receivingUser.id },
    //             rate: 80.0, // 80 cents per 6 minutes
    //             offeredWorth: 800,
    //             status: 'open',
    //             idempotencyKey: ++idempotencyKeyTracker,
    //         };

    //         uuidMock.mockReset();
    //     });

    //     it('should create an open xp contract', async () => {
    //         const id = uniqueWithMock(uConf);
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: true,
    //             contract: {
    //                 id,
    //                 accountId: '2',
    //                 issuerUserId: (
    //                     _contractConfig.issuingUserId as {
    //                         xpId: XpUser['id'];
    //                     }
    //                 ).xpId,
    //                 holdingUserId: (
    //                     _contractConfig.receivingUserId as {
    //                         xpId: XpUser['id'];
    //                     }
    //                 ).xpId,
    //                 rate: _contractConfig.rate,
    //                 offeredWorth: _contractConfig.offeredWorth,
    //                 description: _contractConfig.description,
    //                 status: _contractConfig.status,
    //                 createdAtMs: _testDateNow,
    //                 updatedAtMs: _testDateNow,
    //             },
    //         });
    //     });

    //     it('should create a draft xp contract', async () => {
    //         _contractConfig.status = 'draft';
    //         _contractConfig.receivingUserId = null as any;
    //         const contractId = uniqueWithMock(uConf);
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: true,
    //             contract: {
    //                 id: contractId,
    //                 accountId: null,
    //                 issuerUserId: (
    //                     _contractConfig.issuingUserId as {
    //                         xpId: XpUser['id'];
    //                     }
    //                 ).xpId,
    //                 holdingUserId: null,
    //                 rate: _contractConfig.rate,
    //                 offeredWorth: _contractConfig.offeredWorth,
    //                 description: _contractConfig.description,
    //                 status: _contractConfig.status,
    //                 createdAtMs: _testDateNow,
    //                 updatedAtMs: _testDateNow,
    //             },
    //         });
    //     });

    //     it('should fail to create an open contract due to missing idempotency key', async () => {
    //         _contractConfig.idempotencyKey = null as any;
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to create an open contract due to missing issuer user', async () => {
    //         _contractConfig.issuingUserId = { xpId: 'non-existent-id' };
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'user_not_found',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to create an open contract due to missing holding user', async () => {
    //         _contractConfig.receivingUserId = { xpId: 'non-existent-id' };
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'user_not_found',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to create a contract due to issuing user being the same as holding', async () => {
    //         _contractConfig.receivingUserId = _contractConfig.issuingUserId;
    //         const contract = await xpController.createContract(_contractConfig);
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: expect.any(String),
    //         });
    //     });
    // });

    // describe('issueDraftContract', () => {
    //     //* An issuing user for use in testing issueDraftContract
    //     let _issuingUser: XpUser;

    //     //* A user that will receive the contract
    //     let _receivingUser: XpUser;

    //     //* A draft contract to be issued
    //     let _draftContract: CreateContractResultSuccess['contract'];

    //     //* Unique function config
    //     const uConf = { name: 'issueDraftContract' };

    //     beforeEach(async () => {
    //         uuidMock.mockImplementation(() => unique(uConf));

    //         //* (re)Initialize the issuing user
    //         _issuingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'issuing@localhost'
    //         );

    //         //* (re)Initialize the receiving user
    //         _receivingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'receiving@localhost'
    //         );

    //         //* (re)Initialize the draft contract
    //         const contract = await xpController.createContract({
    //             creationRequestReceivedAt: Date.now(),
    //             description: 'Test Description',
    //             issuingUserId: { xpId: _issuingUser.id },
    //             receivingUserId: null,
    //             rate: 80.0,
    //             offeredWorth: 800,
    //             status: 'draft',
    //             idempotencyKey: ++idempotencyKeyTracker,
    //         });

    //         if (!contract.success) fail('Failed to create draft contract');

    //         _draftContract = contract.contract;
    //         uuidMock.mockReset();
    //     });

    //     it('should issue a draft contract', async () => {
    //         const contract = await xpController.issueDraftContract({
    //             draftContractId: _draftContract.id,
    //             receivingUserId: { xpId: _receivingUser.id },
    //             idempotencyKey: ++idempotencyKeyTracker,
    //         });
    //         expect(contract).toEqual({
    //             success: true,
    //             contract: {
    //                 id: _draftContract.id,
    //                 accountId: '2',
    //                 issuerUserId: _draftContract.issuerUserId,
    //                 holdingUserId: _receivingUser.id,
    //                 rate: _draftContract.rate,
    //                 offeredWorth: _draftContract.offeredWorth,
    //                 description: _draftContract.description,
    //                 status: 'open',
    //                 createdAtMs: _testDateNow,
    //                 updatedAtMs: _testDateNow,
    //             },
    //         });
    //     });

    //     it('should fail to issue a draft contract due to missing idempotency key', async () => {
    //         const contract = await xpController.issueDraftContract({
    //             draftContractId: _draftContract.id,
    //             receivingUserId: { xpId: _receivingUser.id },
    //             idempotencyKey: null as any,
    //         });
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to issue a draft contract due to missing draft contract', async () => {
    //         const contract = await xpController.issueDraftContract({
    //             draftContractId: 'non-existent-id',
    //             receivingUserId: { xpId: _receivingUser.id },
    //             idempotencyKey: ++idempotencyKeyTracker,
    //         });
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'not_found',
    //             errorMessage: expect.any(String),
    //         });
    //     });
    // });

    // describe('getContract', () => {
    //     //* A contract to be retrieved
    //     let _contract: CreateContractResultSuccess['contract'];

    //     //* Unique function config
    //     const uConf = { name: 'getContract' };

    //     beforeEach(async () => {
    //         uuidMock.mockImplementation(() => unique(uConf));
    //         //* (re)Initialize the issuing user
    //         const _issuingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'issuing@localhost'
    //         );

    //         //* (re)Initialize the receiving user
    //         const _receivingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'receiving@localhost'
    //         );

    //         //* (re)Initialize the contract
    //         const contract = await xpController.createContract({
    //             creationRequestReceivedAt: Date.now(),
    //             description: 'Test Description',
    //             issuingUserId: { xpId: _issuingUser.id },
    //             receivingUserId: { xpId: _receivingUser.id },
    //             rate: 80.0, // 80 cents
    //             status: 'open',
    //             offeredWorth: 800,
    //             idempotencyKey: ++idempotencyKeyTracker,
    //         });

    //         if (!contract.success) fail('Failed to create contract');

    //         _contract = contract.contract;
    //         uuidMock.mockReset();
    //     });

    //     it('should get a contract by id', async () => {
    //         const contract = await xpController.getContractById(_contract.id);
    //         expect(contract).toEqual({
    //             success: true,
    //             contract: {
    //                 id: _contract.id,
    //                 accountId: _contract.accountId,
    //                 issuerUserId: _contract.issuerUserId,
    //                 holdingUserId: _contract.holdingUserId,
    //                 rate: _contract.rate,
    //                 offeredWorth: _contract.offeredWorth,
    //                 description: _contract.description,
    //                 status: _contract.status,
    //                 createdAtMs: _contract.createdAtMs,
    //                 updatedAtMs: _contract.updatedAtMs,
    //             },
    //         });
    //     });

    //     it('should fail to get a contract by id due to contract not found', async () => {
    //         const contract = await xpController.getContractById(
    //             'non-existent-id'
    //         );
    //         expect(contract).toEqual({
    //             success: false,
    //             errorCode: 'not_found',
    //             errorMessage: expect.any(String),
    //         });
    //     });
    // });

    // TODO: Continue development of createInvoice
    // describe('createInvoice', () => {
    //     //* An issuing (contracting) user for use in testing createInvoice
    //     let _contractIssuingUser: XpUser;
    //     //* A contracted user for use in testing createInvoice
    //     let _invoicingUser: XpUser;
    //     //* A contract to be invoiced
    //     let _contract: CreateContractResultSuccess['contract'];
    //     //* An invoice configuration
    //     let _invoiceConfig: Parameters<typeof xpController.createInvoice>[0];
    //     //* Unique function config
    //     const uConf = { name: 'createInvoice' };

    //     beforeEach(async () => {
    //         uuidMock.mockImplementation(() => unique(uConf));
    //         //* (re)Initialize the issuing user
    //         _contractIssuingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'issuing@localhost'
    //         );

    //         //* (re)Initialize the invoicing user
    //         _invoicingUser = await createTestXpUser(
    //             xpController,
    //             {
    //                 auth: authController,
    //                 authMessenger: authMessenger,
    //             },
    //             'invoicing@localhost'
    //         );

    //         //* (re)Initialize the contract
    //         const contract = await xpController.createContract({
    //             creationRequestReceivedAt: _testDateNow,
    //             description: 'Test Description',
    //             issuerUserId: { xpId: _contractIssuingUser.id },
    //             holdingUserId: { xpId: _invoicingUser.id },
    //             rate: 80.0, // 80 cents per
    //             status: 'open',
    //             offeredWorth: 800,
    //         });

    //         if (!contract.success) fail('Failed to create contract');

    //         _contract = contract.contract;

    //         //* (re)Initialize the invoice configuration
    //         _invoiceConfig = {
    //             contractId: _contract.id,
    //             amount: (_contract.offeredWorth ?? 0) * 0.5,
    //             note: 'Test Invoice',
    //         };
    //         uuidMock.mockReset();
    //     });

    //     it('should create an invoice', async () => {
    //         const id = uniqueWithMock(uConf);
    //         const invoice = await xpController.createInvoice(_invoiceConfig);
    //         expect(invoice).toEqual({
    //             success: true,
    //             invoice: {
    //                 id,
    //                 contractId: _invoiceConfig.contractId,
    //                 amount: _invoiceConfig.amount,
    //                 note: _invoiceConfig.note,
    //                 status: 'open',
    //                 transactionId: null,
    //                 voidReason: null,
    //                 createdAtMs: _testDateNow,
    //                 updatedAtMs: _testDateNow,
    //             },
    //         });
    //     });

    //     it('should fail to create an invoice due to missing contract', async () => {
    //         _invoiceConfig.contractId = 'non-existent-id';
    //         const invoice = await xpController.createInvoice(_invoiceConfig);
    //         expect(invoice).toEqual({
    //             success: false,
    //             errorCode: 'not_found',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to create an invoice due to invalid amount', async () => {
    //         _invoiceConfig.amount = -1;
    //         const invoice = await xpController.createInvoice(_invoiceConfig);
    //         expect(invoice).toEqual({
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: expect.any(String),
    //         });
    //     });

    //     it('should fail to create an invoice due to invoice charging more than what is available', async () => {
    //         _invoiceConfig.amount = (_contract.offeredWorth ?? 0) + 1;
    //         const invoice = await xpController.createInvoice(_invoiceConfig);
    //         expect(invoice).toEqual({
    //             success: false,
    //             errorCode: 'invalid_request',
    //             errorMessage: expect.any(String),
    //         });
    //     });
    // });

    // describe('approveInvoice', () => {});
});
