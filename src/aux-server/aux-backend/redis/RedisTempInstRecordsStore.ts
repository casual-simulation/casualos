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
import type {
    BranchName,
    BranchUpdates,
    LoadedPackage,
    TempBranchInfo,
    TemporaryInstRecordsStore,
} from '@casual-simulation/aux-records';
import { traced } from '@casual-simulation/aux-records/tracing/TracingDecorators';
import type { SpanOptions } from '@opentelemetry/api';
import { SpanKind, trace } from '@opentelemetry/api';
import {
    SEMATTRS_DB_NAME,
    SEMRESATTRS_SERVICE_NAME,
} from '@opentelemetry/semantic-conventions';
import type { RedisClientType } from 'redis';
import { tryAcquireLock } from './RedisLock';

const TRACE_NAME = 'RedisTempInstRecordsStore';
const SPAN_OPTIONS: SpanOptions = {
    kind: SpanKind.PRODUCER,
    attributes: {
        [SEMATTRS_DB_NAME]: 'redis',
        [SEMRESATTRS_SERVICE_NAME]: 'redis',
    },
};

/**
 * Defines an implementation of a TempInstRecordsStore for redis.
 */
export class RedisTempInstRecordsStore implements TemporaryInstRecordsStore {
    private _globalNamespace: string;
    private _redis: RedisClientType;
    private _currentGenerationKey: string;
    private _instDataExpirationSeconds: number | null = null;
    private _instDataExpirationMode: 'NX' | 'XX' | 'LT' | 'GT' | null = null;
    private _onlyExpireRecordlessUpdates: boolean;

    /**
     * Creates a new instance of the RedisTempInstRecordsStore class.
     * @param globalNamespace The namespace that should be used for all redis keys.
     * @param redis The client that should be used.
     * @param dataExpirationSeconds The number of seconds that inst data should be stored for. If null, then the data will not expire.
     * @param dataExpirationMode The expiration mode that should be used for inst data.
     * @param onlyExpireRecordlessUpdates Whether to only expire updates that are not associated with a record. This will set the expiration for the updates when they are added. All kinds of branches will have an expiration set when trimmed.
     */
    constructor(
        globalNamespace: string,
        redis: RedisClientType,
        dataExpirationSeconds: number | null = null,
        dataExpirationMode: 'NX' | 'XX' | 'LT' | 'GT' | null = null,
        onlyExpireRecordlessUpdates: boolean = false
    ) {
        this._globalNamespace = globalNamespace;
        this._redis = redis;
        this._currentGenerationKey = `${this._globalNamespace}/currentGeneration`;
        this._instDataExpirationSeconds = dataExpirationSeconds;
        this._instDataExpirationMode = dataExpirationMode;
        this._onlyExpireRecordlessUpdates = onlyExpireRecordlessUpdates;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async saveLoadedPackage(loadedPackage: LoadedPackage): Promise<void> {
        const idsKey = this._getLoadedPackageIdsKey(
            loadedPackage.recordName,
            loadedPackage.inst
        );
        const key = this._getLoadedPackagesKey(
            loadedPackage.recordName,
            loadedPackage.inst
        );

        if (await this._redis.sIsMember(idsKey, loadedPackage.packageId)) {
            // Remove existing entries
            const packages = await this._redis.lRange(key, 0, -1);
            let promises = [];
            for (let p of packages) {
                const savedPackage = JSON.parse(p);
                if (savedPackage.id === loadedPackage.id) {
                    promises.push(this._redis.lRem(key, 1, p));
                }
            }

            await Promise.all(promises);
        }

        const multi = this._redis.multi();

        multi.sAdd(idsKey, loadedPackage.packageId);
        multi.lPush(key, JSON.stringify(loadedPackage));

        this._expireMulti(multi, idsKey, this._instDataExpirationMode);
        this._expireMulti(multi, key, this._instDataExpirationMode);

        await multi.exec();
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async listLoadedPackages(
        recordName: string | null,
        inst: string
    ): Promise<LoadedPackage[]> {
        const key = this._getLoadedPackagesKey(recordName, inst);
        const packages = await this._redis.lRange(key, 0, -1);
        return packages.map((p) => JSON.parse(p));
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async isPackageLoaded(
        recordName: string | null,
        inst: string,
        packageId: string
    ): Promise<LoadedPackage | null> {
        const idsKey = this._getLoadedPackageIdsKey(recordName, inst);
        const isLoaded = await this._redis.sIsMember(idsKey, packageId);

        if (!isLoaded) {
            return null;
        }

        const key = this._getLoadedPackagesKey(recordName, inst);
        const packages = await this._redis.lRange(key, 0, -1);
        for (let p of packages) {
            const loadedPackage = JSON.parse(p);
            if (loadedPackage.packageId === packageId) {
                return loadedPackage;
            }
        }

        return null;
    }

    acquireLock(id: string, timeout: number): Promise<() => Promise<boolean>> {
        return tryAcquireLock(this._redis, id, timeout);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async setDirtyBranchGeneration(generation: string): Promise<void> {
        await this._redis.set(this._currentGenerationKey, generation);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getDirtyBranchGeneration(): Promise<string> {
        const generation = await this._redis.get(this._currentGenerationKey);
        return generation ?? '0';
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async markBranchAsDirty(branch: BranchName): Promise<void> {
        const generation = await this.getDirtyBranchGeneration();
        const key = this._generationKey(generation);
        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.sAdd(key, JSON.stringify(branch));

            // Always reset the expiration for the branch size
            // if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = this._instDataExpirationMode;
            this._expireMulti(multi, key, expireMode);
            await multi.exec();
        } else {
            await this._redis.sAdd(key, JSON.stringify(branch));
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async listDirtyBranches(generation?: string): Promise<BranchName[]> {
        if (!generation) {
            generation = await this.getDirtyBranchGeneration();
        }
        const key = this._generationKey(generation);
        const branches = (await this._redis.sMembers(key)) ?? [];
        return branches.map((b) => JSON.parse(b));
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async clearDirtyBranches(generation: string): Promise<void> {
        const key = this._generationKey(generation);
        console.log('[RedisTempInstRecordsStore] Deleting key:', key);
        await this._redis.del(key);
    }

    private _generationKey(generation: string) {
        return `${this._globalNamespace}/dirtyBranches/${generation}`;
    }

    private _getUpdatesKey(
        recordName: string,
        inst: string,
        branch: string
    ): string {
        return `${this._globalNamespace}/updates/${
            recordName ?? ''
        }/${inst}/${branch}`;
    }

    private _getLoadedPackageIdsKey(recordName: string, inst: string): string {
        return `${this._globalNamespace}/loadedPackageIds/${
            recordName ?? ''
        }/${inst}`;
    }

    private _getLoadedPackagesKey(recordName: string, inst: string): string {
        return `${this._globalNamespace}/loadedPackages/${
            recordName ?? ''
        }/${inst}`;
    }

    private _getInstSizeKey(recordName: string, inst: string): string {
        return `${this._globalNamespace}/instSize/${recordName ?? ''}/${inst}`;
    }

    private _getBranchSizeKey(
        recordName: string,
        inst: string,
        branch: string
    ): string {
        return `${this._globalNamespace}/branchSize/${
            recordName ?? ''
        }/${inst}/${branch}`;
    }

    private _getBranchInfoKey(
        recordName: string,
        inst: string,
        branch: string
    ): string {
        return `${this._globalNamespace}/branchInfo/${
            recordName ?? ''
        }/${inst}/${branch}`;
    }

    private _getInstBranchesKey(recordName: string, inst: string): string {
        return `${this._globalNamespace}/branches/${recordName ?? ''}/${inst}`;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getBranchByName(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<TempBranchInfo & { branchSizeInBytes: number }> {
        const key = this._getBranchInfoKey(recordName, inst, branch);
        const branchInfo = await this._redis.get(key);
        if (!branchInfo) {
            return null;
        }

        return JSON.parse(branchInfo);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async saveBranchInfo(branch: TempBranchInfo): Promise<void> {
        const key = this._getBranchInfoKey(
            branch.recordName,
            branch.inst,
            branch.branch
        );
        await this._redis.set(key, JSON.stringify(branch));

        const mode = !branch.recordName ? this._instDataExpirationMode : null;
        await this._expire(key, mode);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async deleteAllInstBranchInfo(
        recordName: string,
        inst: string
    ): Promise<void> {
        const key = this._getInstBranchesKey(recordName, inst);
        const branches = await this._redis.sMembers(key);

        const multi = this._redis.multi();
        for (let updatesKey of branches) {
            let [recordName, inst, branch] = updatesKey
                .slice(`${this._globalNamespace.length}/updates/`.length)
                .split('/');
            const branchSizeKey = this._getBranchSizeKey(
                recordName,
                inst,
                branch
            );
            const branchInfoKey = this._getBranchInfoKey(
                recordName,
                inst,
                branch
            );
            console.log(
                '[RedisTempInstRecordsStore] Deleting key:',
                updatesKey
            );
            console.log(
                '[RedisTempInstRecordsStore] Deleting key:',
                branchSizeKey
            );
            console.log(
                '[RedisTempInstRecordsStore] Deleting key:',
                branchInfoKey
            );
            multi.del([updatesKey, branchSizeKey, branchInfoKey]);
        }
        const instSizeKey = this._getInstSizeKey(recordName, inst);
        const loadedPackageIdsKey = this._getLoadedPackageIdsKey(
            recordName,
            inst
        );
        const loadedPackagesKey = this._getLoadedPackagesKey(recordName, inst);
        console.log('[RedisTempInstRecordsStore] Deleting key:', key);
        console.log('[RedisTempInstRecordsStore] Deleting key:', instSizeKey);
        console.log(
            '[RedisTempInstRecordsStore] Deleting key:',
            loadedPackageIdsKey
        );
        console.log(
            '[RedisTempInstRecordsStore] Deleting key:',
            loadedPackagesKey
        );
        multi.del([key, instSizeKey, loadedPackageIdsKey, loadedPackagesKey]);
        await multi.exec();
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<BranchUpdates> {
        const key = this._getUpdatesKey(recordName, inst, branch);

        const [updates, instSize, branchSize] = await Promise.all([
            this._redis.lRange(key, 0, -1),
            this.getInstSize(recordName, inst),
            this.getBranchSize(recordName, inst, branch),
        ]);

        let u = [] as string[];
        let timestamps = [] as number[];
        for (let update of updates) {
            const index = update.indexOf(':');
            if (index >= 0) {
                const up = update.slice(0, index);
                const timestamp = parseInt(update.slice(index + 1));
                u.push(up);
                timestamps.push(timestamp);
            } else {
                u.push(update);
                timestamps.push(-1);
            }
        }

        return {
            updates: u,
            timestamps: timestamps,
            instSizeInBytes: instSize,
            branchSizeInBytes: branchSize,
        };
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        const branchesKey = this._getInstBranchesKey(recordName, inst);
        const branchInfoKey = this._getBranchInfoKey(recordName, inst, branch);
        const loadedPackageIdsKey = this._getLoadedPackageIdsKey(
            recordName,
            inst
        );
        const loadedPackagesKey = this._getLoadedPackagesKey(recordName, inst);
        const finalUpdates = updates.map((u) => `${u}:${Date.now()}`);

        const span = trace.getActiveSpan();
        if (span) {
            span.setAttribute('key', key);
            span.setAttribute('branchesKey', branchesKey);
            span.setAttribute('branchInfoKey', branchInfoKey);
            span.setAttribute('numUpdates', updates.length);
            span.setAttribute('sizeInBytes', sizeInBytes);
        }

        // Always reset the expiration for updates if it is for a private record.
        // Otherwise, we can follow the expiration mode.
        const expireMode = !recordName ? this._instDataExpirationMode : null;

        let promise: Promise<any>;
        if (
            (!recordName || !this._onlyExpireRecordlessUpdates) &&
            this._instDataExpirationSeconds
        ) {
            const multi = this._redis.multi();
            multi.rPush(key, finalUpdates);
            this._expireMulti(multi, key, expireMode);
            promise = multi.exec();
        } else {
            const multi = this._redis.multi();
            multi.rPush(key, finalUpdates);
            multi.persist(key);
            promise = multi.exec();
        }

        await Promise.all([
            promise,
            this.addInstSize(recordName, inst, sizeInBytes),
            this.addBranchSize(recordName, inst, branch, sizeInBytes),
            this._redis.sAdd(branchesKey, key),

            // Update the expirations for the branch info
            // and branches
            this._expire(branchInfoKey, expireMode),
            this._expire(branchesKey, null),

            // Update expirations for loaded packages
            this._expire(loadedPackageIdsKey, expireMode),
            this._expire(loadedPackagesKey, expireMode),
        ]);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getInstSize(recordName: string, inst: string): Promise<number> {
        const key = this._getInstSizeKey(recordName, inst);
        const size = await this._redis.get(key);
        return size ? parseInt(size) : 0;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async setInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);

        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.set(key, sizeInBytes.toString());

            // Always reset the expiration for the inst size
            // if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = !recordName
                ? this._instDataExpirationMode
                : null;
            this._expireMulti(multi, key, expireMode);
            await multi.exec();
        } else {
            await this._redis.set(key, sizeInBytes.toString());
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async addInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);
        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.incrBy(key, sizeInBytes);

            // Always reset the expiration for the branch size
            // if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = !recordName
                ? this._instDataExpirationMode
                : null;
            this._expireMulti(multi, key, expireMode);
            await multi.exec();
        } else {
            await this._redis.incrBy(key, sizeInBytes);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async deleteInstSize(recordName: string, inst: string): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);
        console.log('[RedisTempInstRecordsStore] Deleting key:', key);
        await this._redis.del(key);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async getBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        const size = await this._redis.get(key);
        return size ? parseInt(size) : 0;
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async setBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.set(key, sizeInBytes.toString());

            // Always reset the expiration for the branch size
            // if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = !recordName
                ? this._instDataExpirationMode
                : null;
            this._expireMulti(multi, key, expireMode);
            await multi.exec();
        } else {
            await this._redis.set(key, sizeInBytes.toString());
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async addBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.incrBy(key, sizeInBytes);

            // Always reset the expiration for the branch size
            // if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = !recordName
                ? this._instDataExpirationMode
                : null;
            this._expireMulti(multi, key, expireMode);
            await multi.exec();
        } else {
            await this._redis.incrBy(key, sizeInBytes);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async deleteBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        console.log('[RedisTempInstRecordsStore] Deleting key:', key);
        await this._redis.del(key);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        if (this._instDataExpirationSeconds) {
            const multi = this._redis.multi();
            multi.lPopCount(key, numToDelete);

            // Always reset the expiration for updates if it is for a private record.
            // Otherwise, we can follow the expiration mode.
            const expireMode = !recordName
                ? this._instDataExpirationMode
                : null;
            this._expireMulti(multi, key, expireMode);
            const branchSizeKey = this._getBranchSizeKey(
                recordName,
                inst,
                branch
            );
            this._expireMulti(multi, branchSizeKey, expireMode);

            await multi.exec();
        } else {
            await this._redis.lPopCount(key, numToDelete);
        }
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async countBranchUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        return await this._redis.lLen(key);
    }

    @traced(TRACE_NAME, SPAN_OPTIONS)
    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const infoKey = this._getBranchInfoKey(recordName, inst, branch);
        const updatesKey = this._getUpdatesKey(recordName, inst, branch);
        const branchSize = await this.getBranchSize(recordName, inst, branch);

        console.log('[RedisTempInstRecordsStore] Deleting key:', infoKey);
        console.log('[RedisTempInstRecordsStore] Deleting key:', updatesKey);

        await Promise.all([
            this._redis.del([infoKey, updatesKey]),
            this.deleteBranchSize(recordName, inst, branch),
            this.addInstSize(recordName, inst, -branchSize),
        ]);
    }

    private async _expire(
        key: string,
        mode: 'NX' | 'XX' | 'LT' | 'GT' | null = this._instDataExpirationMode
    ) {
        if (this._instDataExpirationSeconds) {
            if (mode) {
                await this._redis.expire(
                    key,
                    this._instDataExpirationSeconds,
                    mode
                );
            } else {
                await this._redis.expire(key, this._instDataExpirationSeconds);
            }
        }
    }

    private _expireMulti(
        multi: ReturnType<RedisClientType['multi']>,
        key: string,
        mode: 'NX' | 'XX' | 'LT' | 'GT' | null = this._instDataExpirationMode
    ) {
        if (this._instDataExpirationSeconds) {
            if (mode) {
                multi.expire(key, this._instDataExpirationSeconds, mode);
            } else {
                multi.expire(key, this._instDataExpirationSeconds);
            }
        }
    }
}
