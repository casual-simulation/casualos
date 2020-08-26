import {
    CausalRepoStageStore,
    Atom,
    AtomIndexFullDiff,
    atomIdToString,
    atomId,
} from '@casual-simulation/causal-trees';
import { Collection } from 'mongodb';
import { handleMongoDBDuplicateErrors } from '@casual-simulation/causal-tree-store-mongodb';

/**
 * Defines a stage store that is backed by MongoDB.
 */
export class MongoDBStageStore implements CausalRepoStageStore {
    private _stageCollection: Collection<MongoDBStagedAtom>;

    constructor(stageCollection: Collection<MongoDBStagedAtom>) {
        this._stageCollection = stageCollection;
    }

    async init() {
        await this._stageCollection.createIndex({ branch: 1 });
    }

    async getStage(branch: string): Promise<AtomIndexFullDiff> {
        const stagedAtoms = await this._stageCollection
            .find({ branch: branch })
            .toArray();
        const addedAtoms = stagedAtoms.filter(
            a => a.type === 'added'
        ) as MongoDBAddedAtom[];
        const removedAtoms = stagedAtoms.filter(
            a => a.type === 'removed'
        ) as MongoDBRemovedAtom[];
        const added = addedAtoms.map(a => a.atom);
        let deletions: AtomIndexFullDiff['deletions'] = {};
        for (let atom of removedAtoms) {
            deletions[atom.hash] = atom.id;
        }

        return {
            additions: added,
            deletions: deletions,
        };
    }

    async clearStage(branch: string): Promise<void> {
        await this._stageCollection.deleteMany({
            branch: branch,
        });
    }

    async addAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        if (atoms.length <= 0) {
            return;
        }
        const final = atoms.map(
            a =>
                ({
                    type: 'added',
                    branch: branch,
                    atom: a,
                } as MongoDBAddedAtom)
        );

        try {
            await this._stageCollection.insertMany(final);
        } catch (err) {
            handleMongoDBDuplicateErrors(err);
        }
    }

    async removeAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        if (atoms.length <= 0) {
            return;
        }
        const final = atoms.map(
            a =>
                ({
                    type: 'removed',
                    branch: branch,
                    hash: a.hash,
                    id: atomIdToString(a.id),
                } as MongoDBRemovedAtom)
        );
        try {
            await this._stageCollection.insertMany(final);
        } catch (err) {
            handleMongoDBDuplicateErrors(err);
        }
    }
}

export interface MongoDBAddedAtom {
    type: 'added';
    branch: string;
    atom: Atom<any>;
}

export interface MongoDBRemovedAtom {
    type: 'removed';
    branch: string;
    hash: string;
    id: string;
}

export type MongoDBStagedAtom = MongoDBAddedAtom | MongoDBRemovedAtom;
