import { MongoClient, Db, Collection } from 'mongodb';
import {
    AtomStore,
    Atom,
    AtomId,
    atomIdToString,
} from '@casual-simulation/causal-trees/core2';
import { sortBy } from 'lodash';

/**
 * Defines a class that implements an AtomStore for MongoDB.
 */
export class MongoDBAtomStore implements AtomStore {
    private _atomsCollection: Collection<MongoDBAtom>;

    constructor(atomsCollection: Collection) {
        this._atomsCollection = atomsCollection;
    }

    async init(): Promise<void> {
        await this._atomsCollection.createIndex({ cause: 1 });
    }

    async add<T>(atoms: Atom<T>[]): Promise<void> {
        let mongoAtoms: MongoDBAtom[] = atoms.map((a) => ({
            _id: a.hash,
            cause: a.cause ? atomIdToString(a.cause) : '',
            atom: a,
        }));

        await this._atomsCollection.insertMany(mongoAtoms, {
            ordered: false,
        });
    }

    async findByCause(cause: AtomId): Promise<Atom<any>[]> {
        const causeId = cause ? atomIdToString(cause) : '';
        const atoms = await this._atomsCollection
            .find({
                cause: causeId,
            })
            .sort({ 'atom.id.timestamp': 1 })
            .map((a) => a.atom)
            .toArray();
        return atoms;
    }

    async findByHashes(hashes: string[]): Promise<Atom<any>[]> {
        const atoms = await this._atomsCollection
            .find({
                _id: { $in: hashes },
            })
            .sort({ 'atom.id.timestamp': 1 })
            .map((a) => a.atom)
            .toArray();
        return atoms;
    }
}

interface MongoDBAtom {
    atom: Atom<any>;
    cause: string;
    _id: string;
}
