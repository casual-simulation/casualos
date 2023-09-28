import {
    BranchName,
    BranchUpdates,
    TempBranchInfo,
    TemporaryInstRecordsStore,
} from '@casual-simulation/aux-records';
import { RedisClientType } from 'redis';

/**
 * Defines an implementation of a TempInstRecordsStore for redis.
 */
export class RedisTempInstRecordsStore implements TemporaryInstRecordsStore {
    private _globalNamespace: string;
    private _redis: RedisClientType;
    private _currentGenerationKey: string;

    constructor(globalNamespace: string, redis: RedisClientType) {
        this._globalNamespace = globalNamespace;
        this._redis = redis;
        this._currentGenerationKey = `${this._globalNamespace}/currentGeneration`;
    }

    async setDirtyBranchGeneration(generation: string): Promise<void> {
        await this._redis.set(this._currentGenerationKey, generation);
    }

    async getDirtyBranchGeneration(): Promise<string> {
        const generation = await this._redis.get(this._currentGenerationKey);
        return generation ?? '0';
    }

    async markBranchAsDirty(branch: BranchName): Promise<void> {
        const generation = await this.getDirtyBranchGeneration();
        const key = this._generationKey(generation);
        await this._redis.sAdd(key, JSON.stringify(branch));
    }

    async listDirtyBranches(generation?: string): Promise<BranchName[]> {
        if (!generation) {
            generation = await this.getDirtyBranchGeneration();
        }
        const key = this._generationKey(generation);
        const branches = (await this._redis.sMembers(key)) ?? [];
        return branches.map((b) => JSON.parse(b));
    }

    async clearDirtyBranches(generation: string): Promise<void> {
        const key = this._generationKey(generation);
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

    async saveBranchInfo(branch: TempBranchInfo): Promise<void> {
        const key = this._getBranchInfoKey(
            branch.recordName,
            branch.inst,
            branch.branch
        );
        await this._redis.set(key, JSON.stringify(branch));
    }

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
            multi.del([
                updatesKey,
                this._getBranchSizeKey(recordName, inst, branch),
                this._getBranchInfoKey(recordName, inst, branch),
            ]);
        }
        multi.del([key, this._getInstSizeKey(recordName, inst)]);
        await multi.exec();
    }

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

    async addUpdates(
        recordName: string,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        const branchesKey = this._getInstBranchesKey(recordName, inst);
        const finalUpdates = updates.map((u) => `${u}:${Date.now()}`);

        await Promise.all([
            this._redis.rPush(key, finalUpdates),
            this.addInstSize(recordName, inst, sizeInBytes),
            this.addBranchSize(recordName, inst, branch, sizeInBytes),
            this._redis.sAdd(branchesKey, key),
        ]);
    }

    async getInstSize(recordName: string, inst: string): Promise<number> {
        const key = this._getInstSizeKey(recordName, inst);
        const size = await this._redis.get(key);
        return size ? parseInt(size) : 0;
    }

    async setInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);
        await this._redis.set(key, sizeInBytes.toString());
    }

    async addInstSize(
        recordName: string,
        inst: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);
        await this._redis.incrBy(key, sizeInBytes);
    }

    async deleteInstSize(recordName: string, inst: string): Promise<void> {
        const key = this._getInstSizeKey(recordName, inst);
        await this._redis.del(key);
    }

    async getBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        const size = await this._redis.get(key);
        return size ? parseInt(size) : 0;
    }

    async setBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        await this._redis.set(key, sizeInBytes.toString());
    }

    async addBranchSize(
        recordName: string,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        await this._redis.incrBy(key, sizeInBytes);
    }

    async deleteBranchSize(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const key = this._getBranchSizeKey(recordName, inst, branch);
        await this._redis.del(key);
    }

    async trimUpdates(
        recordName: string,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        await this._redis.lPopCount(key, numToDelete);
    }

    async countBranchUpdates(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<number> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        return await this._redis.lLen(key);
    }

    async deleteBranch(
        recordName: string,
        inst: string,
        branch: string
    ): Promise<void> {
        const key = this._getUpdatesKey(recordName, inst, branch);
        const branchSize = await this.getBranchSize(recordName, inst, branch);
        await Promise.all([
            this._redis.del(key),
            this.deleteBranchSize(recordName, inst, branch),
            this.addInstSize(recordName, inst, -branchSize),
        ]);
    }
}
