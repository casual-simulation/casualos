import { MongoClient, Db, Collection } from 'mongodb';
import {
    CausalRepoStore,
    CausalRepoObject,
    CausalRepoBranch,
    getObjectHash,
    CausalRepoIndex,
    getAtomHashes,
    CausalRepoReflog,
    reflog,
    CausalRepoSitelog,
    sitelog,
    CausalRepoSitelogType,
    CausalRepoSitelogConnectionReason,
    CausalRepoBranchSettings,
} from '@casual-simulation/causal-trees/core2';

/**
 * Defines a class that is able to store a causal tree in MongoDB.
 */
export class MongoDBRepoStore implements CausalRepoStore {
    private _objects: Collection<MongoDBObject>;
    private _heads: Collection<MongoDBHead>;
    private _indexes: Collection<MongoDBIndex>;
    private _reflog: Collection<MongoDBReflog>;
    private _sitelog: Collection<MongoDBSitelog>;
    private _settings: Collection<MongoDBBranchSettings>;

    constructor(
        objectsCollection: Collection<MongoDBObject>,
        headsCollection: Collection<MongoDBHead>,
        indexesCollection: Collection<MongoDBIndex>,
        reflogCollection: Collection<MongoDBReflog>,
        sitelogCollection: Collection<MongoDBSitelog>,
        branchSettingsCollection: Collection<MongoDBBranchSettings>
    ) {
        this._objects = objectsCollection;
        this._heads = headsCollection;
        this._indexes = indexesCollection;
        this._reflog = reflogCollection;
        this._sitelog = sitelogCollection;
        this._settings = branchSettingsCollection;
    }

    async init() {
        await this._heads.createIndex({ name: 1 }, { unique: true });
        await this._reflog.createIndex({ branch: 1, time: -1 });
        await this._sitelog.createIndex({ branch: 1, time: -1 });
        await this._sitelog.createIndex({ site: 1, branch: 1, time: -1 });
    }

    async getBranchSettings(branch: string): Promise<CausalRepoBranchSettings> {
        const settings = await this._settings.findOne(
            { branch },
            { sort: { time: -1 } }
        );

        return {
            type: 'branch_settings',
            branch: settings.branch,
            passwordHash: settings.passwordHash,
            time: settings.time,
        };
    }

    async saveSettings(settings: CausalRepoBranchSettings): Promise<void> {
        await this._settings.insertOne(settings);
    }

    async getSitelog(branch: string): Promise<CausalRepoSitelog[]> {
        const sitelog = await this._sitelog
            .find({ branch: branch })
            .sort({
                time: -1,
            })
            .toArray();

        return sitelog.map(
            ref =>
                ({
                    type: 'sitelog',
                    branch: ref.branch,
                    site: ref.site,
                    time: ref.time,
                    sitelogType: ref.sitelogType,
                } as CausalRepoSitelog)
        );
    }

    async logSite(
        branch: string,
        site: string,
        type: CausalRepoSitelogType,
        connectionReason: CausalRepoSitelogConnectionReason
    ): Promise<CausalRepoSitelog> {
        const log = sitelog(branch, site, type, connectionReason);
        await this._sitelog.insertOne(log);
        return log;
    }

    async getReflog(branch: string): Promise<CausalRepoReflog[]> {
        const reflog = await this._reflog
            .find({ branch: branch })
            .sort({
                time: -1,
            })
            .toArray();

        return reflog.map(
            ref =>
                ({
                    type: 'reflog',
                    branch: ref.branch,
                    hash: ref.hash,
                    time: ref.time,
                } as CausalRepoReflog)
        );
    }

    async loadIndex(
        head: string,
        index: CausalRepoIndex
    ): Promise<CausalRepoObject[]> {
        let idx = await this._indexes.findOne({
            _id: index.data.hash,
        });
        if (!idx) {
            return await this.getObjects(head, getAtomHashes(index.data.atoms));
        }

        return idx.objects;
    }

    async storeIndex(
        head: string,
        index: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        const idx: MongoDBIndex = {
            _id: index,
            objects,
        };

        await this._indexes.updateOne(
            { _id: index },
            {
                $set: idx,
            },
            { upsert: true }
        );
        await this.storeObjects(head, objects);
    }

    async getObjects(
        head: string,
        keys: string[]
    ): Promise<CausalRepoObject[]> {
        const objs = await this._objects
            .find({
                _id: { $in: keys },
            })
            .sort({ 'atom.id.timestamp': 1 })
            .map(a => a.object)
            .toArray();
        return objs;
    }

    async getObject(key: string): Promise<CausalRepoObject> {
        const obj = await this._objects.findOne({
            _id: key,
        });
        if (obj) {
            return obj.object;
        } else {
            return null;
        }
    }

    /**
     * Stores the given objects.
     * @param objects The objects to store.
     */
    async storeObjects(
        head: string,
        objects: CausalRepoObject[]
    ): Promise<void> {
        const mongoObjects: MongoDBObject[] = objects.map(o => ({
            _id: getObjectHash(o),
            object: o,
        }));

        if (mongoObjects.length <= 0) {
            return;
        }

        let op = this._objects.initializeUnorderedBulkOp();
        mongoObjects.forEach(o => {
            op.find({ _id: o._id })
                .upsert()
                .updateOne(o);
        });
        await op.execute();
    }

    /**
     * Gets the list of branches that match the given prefix.
     * @param prefix The prefix that branch names should match. If null, then all branches are returned.
     */
    async getBranches(prefix: string | null): Promise<CausalRepoBranch[]> {
        if (prefix) {
            prefix = escapeRegex(prefix);
            const branches = await this._heads
                .find({
                    name: { $regex: new RegExp(`^${prefix}`) },
                })
                .sort({
                    name: 1,
                })
                .toArray();
            return branches;
        } else {
            const branches = await this._heads
                .find({})
                .sort({
                    name: 1,
                })
                .toArray();
            return branches;
        }
    }

    /**
     * Saves/updates the given head to the given repo.
     * @param head The branch to save.
     */
    async saveBranch(head: CausalRepoBranch): Promise<void> {
        const result = await this._heads.updateOne(
            { name: head.name },
            {
                $set: head,
            },
            {
                upsert: true,
            }
        );
        if (result.modifiedCount > 0 || result.upsertedCount > 0) {
            const ref = reflog(head);
            await this._reflog.insertOne(ref);
        }
    }

    /**
     * Deletes the given branch from the repo.
     * @param head The branch to delete.
     */
    async deleteBranch(head: CausalRepoBranch): Promise<void> {
        await this._heads.deleteOne({
            name: head.name,
        });
    }
}

export interface MongoDBHead extends CausalRepoBranch {}
export interface MongoDBObject {
    _id: string;
    object: CausalRepoObject;
}

export interface MongoDBIndex {
    _id: string;
    objects: CausalRepoObject[];
}

export interface MongoDBReflog {
    _id?: any;
    branch: string;
    hash: string;
    time: Date;
}

export interface MongoDBSitelog {
    _id?: any;
    branch: string;
    site: string;
    time: Date;
    sitelogType?: CausalRepoSitelogType;
}

export interface MongoDBBranchSettings {
    _id?: any;
    branch: string;
    time: Date;
    passwordHash?: string;
}

export function escapeRegex(value: string): string {
    let final = value;
    for (let char of REGEX_SPECIAL_CHARACTERS) {
        final = final.replace(char, `\\${char}`);
    }
    return final;
}

export const REGEX_SPECIAL_CHARACTERS = [
    '\\',
    '^',
    '$',
    '.',
    '*',
    '+',
    '?',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
    '|',
];
