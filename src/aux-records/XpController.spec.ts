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
import type { XpUser } from './XpStore';
import { v4 as uuid } from 'uuid';
import { AccountCodes } from './financial/FinancialInterface';
import { AccountFlags } from './financial/Types';
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
                    id: 'xpUserId',
                    userId: 'userId',
                    accountId: '0',
                    requestedRate: null,
                    createdAtMs: 1,
                    updatedAtMs: 1,
                },
            });
        });
    });

    /**
     * Successful getXpUser invocations across the board should be indicative of—
     * successful XP user initialization as well as retrieval
     */
    describe('getXpUser', () => {
        //* An auth user for use in testing getXpUser
        let user: TestUser;

        const id = 'xpUserId';
        const userId = 'userId';

        beforeEach(async () => {
            uuidMock
                .mockReturnValueOnce(userId)
                .mockReturnValueOnce(userId)
                .mockReturnValueOnce(id);

            user = await createTestUser(
                {
                    auth: authController,
                    authMessenger: authMessenger,
                },
                'xp.test@localhost'
            );

            const xpUser: XpUser = {
                id,
                userId: user.userId,
                accountId: String(services.financialInterface.generateId()),
                requestedRate: null,
                createdAtMs: 1,
                updatedAtMs: 1,
            };

            await memoryStore.saveXpUser(xpUser.id, xpUser);

            // _xpUser = xpUser;

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

            expect(
                await xpController.getXpUser({
                    userId: newAuthUser.userId,
                })
            ).toEqual(
                success({
                    user: {
                        id: 'newXpUserId',
                        userId: 'newUserId',
                        accountId: '1',
                        requestedRate: null,
                        createdAtMs: 1,
                        updatedAtMs: 1,
                    },
                })
            );
        });

        it('should get an xp user by auth id', async () => {
            expect(
                await xpController.getXpUser({
                    userId: user.userId,
                })
            ).toEqual(
                success({
                    user: {
                        id: id,
                        userId: userId,
                        accountId: '0',
                        requestedRate: null,
                        createdAtMs: 1,
                        updatedAtMs: 1,
                    },
                })
            );
        });

        it('should get an xp user by xp id', async () => {
            expect(
                await xpController.getXpUser({
                    requestedXpId: id,
                    userId: user.userId,
                })
            ).toEqual(
                success({
                    user: {
                        id: id,
                        userId: user.userId,
                        accountId: '0',
                        requestedRate: null,
                        createdAtMs: 1,
                        updatedAtMs: 1,
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
                requestedXpId: 'non-existent-id',
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
