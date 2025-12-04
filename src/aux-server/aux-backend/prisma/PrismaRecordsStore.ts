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
import { hasValue } from '@casual-simulation/aux-common';
import type {
    Record,
    RecordsStore,
    RecordKey,
    ListedRecord,
    Studio,
    StudioAssignment,
    ListedStudioAssignment,
    ListedUserAssignment,
    StoreListedStudio,
    ListStudioAssignmentFilters,
    StudioAssignmentRole,
    CountRecordsFilter,
    StudioComIdRequest,
    LoomConfig,
    HumeConfig,
    StripeAccountStatus,
    StripeRequirementsStatus,
    CustomDomain,
    CustomDomainWithStudio,
} from '@casual-simulation/aux-records';
import {
    COM_ID_PLAYER_CONFIG,
    COM_ID_CONFIG_SCHEMA,
    LOOM_CONFIG,
    HUME_CONFIG,
} from '@casual-simulation/aux-records';
import type { PrismaClient, Prisma, Studio as PrismaStudio } from './generated';
import { convertToDate, convertToMillis } from './Utils';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type z from 'zod';

const TRACE_NAME = 'PrismaRecordsStore';

export class PrismaRecordsStore implements RecordsStore {
    private _client: PrismaClient;

    constructor(client: PrismaClient) {
        this._client = client;
    }

    async saveCustomDomain(domain: CustomDomain): Promise<void> {
        await this._client.customDomain.upsert({
            create: {
                id: domain.id,
                domainName: domain.domainName,
                studioId: domain.studioId,
                verificationKey: domain.verificationKey,
                verified: domain.verified,
            },
            update: {
                id: domain.id,
                domainName: domain.domainName,
                studioId: domain.studioId,
                verificationKey: domain.verificationKey,
                verified: domain.verified,
            },
            where: {
                id: domain.id,
            },
        });
    }

    async deleteCustomDomain(domainId: string): Promise<void> {
        await this._client.customDomain.delete({
            where: {
                id: domainId,
            },
        });
    }
    async getCustomDomainById(
        domainId: string
    ): Promise<CustomDomainWithStudio | null> {
        const domain = await this._client.customDomain.findUnique({
            where: {
                id: domainId,
            },
            include: {
                studio: true,
            },
        });

        if (!domain) {
            return null;
        }

        return {
            id: domain.id,
            domainName: domain.domainName,
            studioId: domain.studioId,
            verificationKey: domain.verificationKey,
            verified: domain.verified as true | null,
            studio: this._convertToStudio(domain.studio),
        };
    }

    async listCustomDomainsByStudioId(
        studioId: string
    ): Promise<CustomDomain[]> {
        const domains = await this._client.customDomain.findMany({
            where: {
                studioId: studioId,
            },
        });

        return domains.map((domain) => ({
            id: domain.id,
            domainName: domain.domainName,
            studioId: domain.studioId,
            verificationKey: domain.verificationKey,
            verified: domain.verified as true | null,
        }));
    }

    async getVerifiedCustomDomainByName(
        domainName: string
    ): Promise<CustomDomainWithStudio | null> {
        const domain = await this._client.customDomain.findUnique({
            where: {
                domainName_verified: {
                    domainName,
                    verified: true,
                },
            },
            include: {
                studio: true,
            },
        });

        if (!domain) {
            return null;
        }

        return {
            id: domain.id,
            domainName: domain.domainName,
            studioId: domain.studioId,
            verificationKey: domain.verificationKey,
            verified: domain.verified as true | null,
            studio: this._convertToStudio(domain.studio),
        };
    }

    async markCustomDomainAsVerified(domainId: string): Promise<void> {
        await this._client.customDomain.update({
            where: {
                id: domainId,
            },
            data: {
                verified: true,
            },
        });
    }

    async getStudioHumeConfig(studioId: string): Promise<HumeConfig | null> {
        const studio = await this._client.studio.findUnique({
            where: {
                id: studioId,
            },
            select: {
                humeConfig: true,
            },
        });

        if (!studio) {
            return null;
        }

        return zodParseConfig(studio.humeConfig, HUME_CONFIG);
    }

    async updateStudioHumeConfig(
        studioId: string,
        config: HumeConfig
    ): Promise<void> {
        await this._client.studio.update({
            where: {
                id: studioId,
            },
            data: {
                humeConfig: config,
            },
        });
    }

    @traced(TRACE_NAME)
    async getStudioLoomConfig(studioId: string): Promise<LoomConfig> {
        const studio = await this._client.studio.findUnique({
            where: {
                id: studioId,
            },
            select: {
                loomConfig: true,
            },
        });

        if (!studio) {
            return null;
        }

        return zodParseConfig(studio.loomConfig, LOOM_CONFIG);
    }

    @traced(TRACE_NAME)
    async updateStudioLoomConfig(
        studioId: string,
        config: LoomConfig
    ): Promise<void> {
        await this._client.studio.update({
            where: {
                id: studioId,
            },
            data: {
                loomConfig: config,
            },
        });
    }

    @traced(TRACE_NAME)
    async updateRecord(record: Record): Promise<void> {
        await this._client
            .$executeRaw`UPSERT INTO public."Record" ("name", "ownerId", "studioId", "secretHashes", "secretSalt", "updatedAt")
            VALUES (${record.name}, ${record.ownerId}, ${record.studioId}, ${record.secretHashes}, ${record.secretSalt}, NOW())`;
    }

    @traced(TRACE_NAME)
    async addRecord(record: Record): Promise<void> {
        await this.updateRecord(record);
    }

    @traced(TRACE_NAME)
    async getRecordByName(name: string): Promise<Record> {
        const record = await this._client.record.findUnique({
            where: {
                name: name,
            },
        });
        return record as any;
    }

    /**
     * Adds the given record key to the store.
     * @param key The key to add.
     */
    @traced(TRACE_NAME)
    async addRecordKey(key: RecordKey): Promise<void> {
        await this._client.recordKey.create({
            data: {
                recordName: key.recordName,
                secretHash: key.secretHash,
                creatorId: key.creatorId,
                policy: key.policy as any,
            },
        });
    }

    /**
     * Gets the record key for the given record name that has the given hash.
     * @param recordName The name of the record.
     * @param hash The scrypt hash of the key that should be retrieved.
     */
    @traced(TRACE_NAME)
    async getRecordKeyByRecordAndHash(
        recordName: string,
        hash: string
    ): Promise<RecordKey> {
        const recordKey = await this._client.recordKey.findUnique({
            where: {
                recordName_secretHash: {
                    recordName,
                    secretHash: hash,
                },
            },
        });

        return recordKey as any;
    }

    @traced(TRACE_NAME)
    listRecordsByOwnerId(ownerId: string): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                ownerId: ownerId,
            },
            select: {
                name: true,
                ownerId: true,
                studioId: true,
            },
        });
    }

    @traced(TRACE_NAME)
    listRecordsByStudioId(studioId: string): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                studioId: studioId,
            },
            select: {
                name: true,
                ownerId: true,
                studioId: true,
            },
        });
    }

    @traced(TRACE_NAME)
    listRecordsByStudioIdAndUserId(
        studioId: string,
        userId: string
    ): Promise<ListedRecord[]> {
        return this._client.record.findMany({
            where: {
                studioId: studioId,
                studio: {
                    assignments: {
                        some: {
                            userId: userId,
                        },
                    },
                },
            },
            select: {
                name: true,
                ownerId: true,
                studioId: true,
            },
        });
    }

    @traced(TRACE_NAME)
    async addStudio(studio: Studio): Promise<void> {
        await this._client.studio.create({
            data: {
                id: studio.id,
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                subscriptionPeriodStart: convertToDate(
                    studio.subscriptionPeriodStartMs
                ),
                subscriptionPeriodEnd: convertToDate(
                    studio.subscriptionPeriodEndMs
                ),
                subscriptionInfoId: studio.subscriptionInfoId,
                comId: studio.comId,
                comIdConfig: studio.comIdConfig,
                logoUrl: studio.logoUrl,
                ownerStudioComId: studio.ownerStudioComId,
                playerConfig: studio.playerConfig,
                stripeAccountId: studio.stripeAccountId,
                stripeAccountStatus: studio.stripeAccountStatus,
                stripeAccountRequirementsStatus:
                    studio.stripeAccountRequirementsStatus,
            },
        });
    }

    @traced(TRACE_NAME)
    async createStudioForUser(
        studio: Studio,
        adminId: string
    ): Promise<{ studio: Studio; assignment: StudioAssignment }> {
        const result = await this._client.studio.create({
            data: {
                id: studio.id,
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                subscriptionPeriodStart: convertToDate(
                    studio.subscriptionPeriodStartMs
                ),
                subscriptionPeriodEnd: convertToDate(
                    studio.subscriptionPeriodEndMs
                ),
                subscriptionInfoId: studio.subscriptionInfoId,
                comId: studio.comId,
                comIdConfig: studio.comIdConfig,
                logoUrl: studio.logoUrl,
                ownerStudioComId: studio.ownerStudioComId,
                playerConfig: studio.playerConfig,
                assignments: {
                    create: {
                        userId: adminId,
                        isPrimaryContact: true,
                        role: 'admin',
                    },
                },
            },
        });

        return {
            studio: this._convertToStudio(result),
            assignment: {
                studioId: result.id,
                userId: adminId,
                isPrimaryContact: true,
                role: 'admin',
            },
        };
    }

    @traced(TRACE_NAME)
    async getStudioById(id: string): Promise<Studio> {
        const studio = await this._client.studio.findUnique({
            where: {
                id: id,
            },
        });

        if (!studio) {
            return null;
        }

        return this._convertToStudio(studio);
    }

    @traced(TRACE_NAME)
    async getStudioByComId(comId: string): Promise<Studio> {
        const studio = await this._client.studio.findUnique({
            where: {
                comId: comId,
            },
        });

        if (!studio) {
            return null;
        }

        return this._convertToStudio(studio);
    }

    async getStudioByStripeAccountId(accountId: string): Promise<Studio> {
        const studio = await this._client.studio.findUnique({
            where: {
                stripeAccountId: accountId,
            },
        });

        if (!studio) {
            return null;
        }

        return this._convertToStudio(studio);
    }

    @traced(TRACE_NAME)
    async getStudioByStripeCustomerId(customerId: string): Promise<Studio> {
        const studio = await this._client.studio.findUnique({
            where: {
                stripeCustomerId: customerId,
            },
        });

        if (!studio) {
            return null;
        }

        return this._convertToStudio(studio);
    }

    @traced(TRACE_NAME)
    async updateStudio(studio: Studio): Promise<void> {
        await this._client.studio.update({
            where: {
                id: studio.id,
            },
            data: {
                displayName: studio.displayName,
                stripeCustomerId: studio.stripeCustomerId,
                subscriptionId: studio.subscriptionId,
                subscriptionStatus: studio.subscriptionStatus,
                subscriptionInfoId: studio.subscriptionInfoId,
                subscriptionPeriodStart: convertToDate(
                    studio.subscriptionPeriodStartMs
                ),
                subscriptionPeriodEnd: convertToDate(
                    studio.subscriptionPeriodEndMs
                ),
                comIdConfig: studio.comIdConfig,
                playerConfig: studio.playerConfig,
                playerWebManifest: studio.playerWebManifest,
                logoUrl: studio.logoUrl,
                comId: studio.comId,
                ownerStudioComId: studio.ownerStudioComId,
                stripeAccountId: studio.stripeAccountId,
                stripeAccountStatus: studio.stripeAccountStatus,
                stripeAccountRequirementsStatus:
                    studio.stripeAccountRequirementsStatus,
            },
        });
    }

    @traced(TRACE_NAME)
    async saveComIdRequest(request: StudioComIdRequest): Promise<void> {
        await this._client
            .$executeRaw`UPSERT INTO public."StudioComIdRequest" ("id", "studioId", "userId", "requestedComId", "requestingIpAddress", "createdAt", "updatedAt")
            VALUES (${request.id}, ${request.studioId}, ${request.userId}, ${
            request.requestedComId
        }, ${request.requestingIpAddress}, ${convertToDate(
            request.createdAtMs
        )}, NOW())`;
    }

    @traced(TRACE_NAME)
    async listStudiosForUser(userId: string): Promise<StoreListedStudio[]> {
        const assignments = await this._client.studioAssignment.findMany({
            where: {
                userId: userId,
                studio: {
                    ownerStudioComId: null,
                },
            },
            select: {
                studioId: true,
                userId: true,
                role: true,
                isPrimaryContact: true,
                studio: {
                    select: {
                        displayName: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                        comId: true,
                        logoUrl: true,
                        ownerStudioComId: true,
                    },
                },
            },
        });

        return assignments.map((a) => ({
            studioId: a.studioId,
            userId: a.userId,
            role: a.role as StudioAssignmentRole,
            isPrimaryContact: a.isPrimaryContact,
            displayName: a.studio.displayName,
            subscriptionId: a.studio.subscriptionId,
            subscriptionStatus: a.studio.subscriptionStatus,
            comId: a.studio.comId,
            logoUrl: a.studio.logoUrl,
            ownerStudioComId: a.studio.ownerStudioComId,
        }));
    }

    @traced(TRACE_NAME)
    async listStudiosForUserAndComId(
        userId: string,
        comId: string
    ): Promise<StoreListedStudio[]> {
        const assignments = await this._client.studioAssignment.findMany({
            where: {
                userId: userId,
                studio: {
                    ownerStudioComId: comId,
                },
            },
            select: {
                studioId: true,
                userId: true,
                role: true,
                isPrimaryContact: true,
                studio: {
                    select: {
                        displayName: true,
                        subscriptionId: true,
                        subscriptionStatus: true,
                        comId: true,
                        logoUrl: true,
                        ownerStudioComId: true,
                    },
                },
            },
        });

        return assignments.map((a) => ({
            studioId: a.studioId,
            userId: a.userId,
            role: a.role as StudioAssignmentRole,
            isPrimaryContact: a.isPrimaryContact,
            displayName: a.studio.displayName,
            subscriptionId: a.studio.subscriptionId,
            subscriptionStatus: a.studio.subscriptionStatus,
            comId: a.studio.comId,
            logoUrl: a.studio.logoUrl,
            ownerStudioComId: a.studio.ownerStudioComId,
        }));
    }

    @traced(TRACE_NAME)
    async countStudiosInComId(comId: string): Promise<number> {
        return this._client.studio.count({
            where: {
                ownerStudioComId: comId,
            },
        });
    }

    @traced(TRACE_NAME)
    async addStudioAssignment(assignment: StudioAssignment): Promise<void> {
        await this._client.studioAssignment.create({
            data: {
                studioId: assignment.studioId,
                userId: assignment.userId,
                isPrimaryContact: assignment.isPrimaryContact,
                role: assignment.role,
            },
        });
    }

    @traced(TRACE_NAME)
    async updateStudioAssignment(assignment: StudioAssignment): Promise<void> {
        await this._client.studioAssignment.update({
            where: {
                studioId_userId: {
                    studioId: assignment.studioId,
                    userId: assignment.userId,
                },
            },
            data: {
                isPrimaryContact: assignment.isPrimaryContact,
                role: assignment.role,
            },
        });
    }

    @traced(TRACE_NAME)
    async removeStudioAssignment(
        studioId: string,
        userId: string
    ): Promise<void> {
        await this._client.studioAssignment.delete({
            where: {
                studioId_userId: {
                    studioId: studioId,
                    userId: userId,
                },
            },
        });
    }

    @traced(TRACE_NAME)
    async listStudioAssignments(
        studioId: string,
        filters?: ListStudioAssignmentFilters
    ): Promise<ListedStudioAssignment[]> {
        let filter: Prisma.StudioAssignmentWhereInput = {
            studioId: studioId,
        };

        if (hasValue(filters?.userId)) {
            filter.userId = filters.userId;
        }

        if (hasValue(filters?.role)) {
            filter.role = filters.role;
        }

        if (hasValue(filters?.isPrimaryContact)) {
            filter.isPrimaryContact = filters.isPrimaryContact;
        }

        const assignments = await this._client.studioAssignment.findMany({
            where: filter,
            select: {
                studioId: true,
                userId: true,
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        phoneNumber: true,
                        privoServiceId: true,
                    },
                },
                role: true,
                isPrimaryContact: true,
            },
            orderBy: [
                {
                    user: {
                        email: 'asc',
                    },
                },
                {
                    user: {
                        phoneNumber: 'asc',
                    },
                },
            ],
        });

        return assignments.map((a) => {
            const assignment: ListedStudioAssignment = {
                studioId: a.studioId,
                userId: a.userId,
                role: a.role as StudioAssignmentRole,
                isPrimaryContact: a.isPrimaryContact,
                user: {
                    id: a.user.id,
                    name: a.user.name,
                    email: a.user.email,
                    phoneNumber: a.user.phoneNumber,
                    privoServiceId: a.user.privoServiceId,
                },
            };

            return assignment;
        });
    }

    @traced(TRACE_NAME)
    async listUserAssignments(userId: string): Promise<ListedUserAssignment[]> {
        const assignments = await this._client.studioAssignment.findMany({
            where: {
                userId: userId,
            },
            select: {
                studioId: true,
                userId: true,
                isPrimaryContact: true,
                role: true,
                studio: {
                    select: {
                        displayName: true,
                    },
                },
            },
        });

        return assignments.map((a) => {
            const assignment: ListedUserAssignment = {
                studioId: a.studioId,
                userId: a.userId,
                role: a.role as StudioAssignmentRole,
                isPrimaryContact: a.isPrimaryContact,
                displayName: a.studio.displayName,
            };

            return assignment;
        });
    }

    @traced(TRACE_NAME)
    async countRecords(filter: CountRecordsFilter): Promise<number> {
        let where: Prisma.RecordWhereInput = {};
        if ('ownerId' in filter) {
            where.ownerId = filter.ownerId;
        }
        if ('studioId' in filter) {
            where.studioId = filter.studioId;
        }
        return await this._client.record.count({
            where,
        });
    }

    private _convertToStudio(studio: PrismaStudio): Studio {
        if (!studio) {
            return null;
        }
        return {
            id: studio.id,
            displayName: studio.displayName,
            stripeCustomerId: studio.stripeCustomerId,
            subscriptionId: studio.subscriptionId,
            subscriptionStatus: studio.subscriptionStatus,
            comId: studio.comId,
            logoUrl: studio.logoUrl,
            subscriptionInfoId: studio.subscriptionInfoId,
            subscriptionPeriodEndMs: convertToMillis(
                studio.subscriptionPeriodEnd
            ),
            subscriptionPeriodStartMs: convertToMillis(
                studio.subscriptionPeriodStart
            ),
            comIdConfig: zodParseConfig(
                studio.comIdConfig,
                COM_ID_CONFIG_SCHEMA
            ),
            ownerStudioComId: studio.ownerStudioComId,
            playerConfig: zodParseConfig(
                studio.playerConfig,
                COM_ID_PLAYER_CONFIG
            ),
            stripeAccountId: studio.stripeAccountId,
            stripeAccountStatus:
                studio.stripeAccountStatus as StripeAccountStatus,
            stripeAccountRequirementsStatus:
                studio.stripeAccountRequirementsStatus as StripeRequirementsStatus,
        };
    }
}

function zodParseConfig<T extends z.ZodType>(
    value: Prisma.JsonValue,
    schema: T
): z.infer<T> | undefined {
    if (!value) {
        return undefined;
    }
    const result = schema.safeParse(value);
    if (result.success) {
        return result.data;
    } else {
        return undefined;
    }
}
