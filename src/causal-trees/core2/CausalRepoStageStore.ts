import { AtomIndexFullDiff } from './AtomIndex';
import { Atom } from './Atom2';

/**
 * Defines a store for the stage in a causal repo.
 * That is, a data structore that stores uncommited changes.
 *
 * For basic operations, an in-memory stage is fine.
 * For servers, a semi-persistent stage like redis is recommended. This helps prevent data loss upon abrupt power loss/shutdown.
 */
export interface CausalRepoStageStore {
    /**
     * Gets the stage data for the given branch.
     * @param branch The branch.
     */
    getStage(branch: string): Promise<AtomIndexFullDiff>;

    /**
     * Clears the stage for the given branch.
     * @param branch The branch.
     */
    clearStage(branch: string): Promise<void>;

    /**
     * Adds the given atoms to the stage for the given branch.
     * @param branch The branch.
     * @param atoms The atoms to add.
     */
    addAtoms(branch: string, atoms: Atom<any>[]): Promise<void>;

    /**
     * Marks the given atoms as removed in the stage for the given branch.
     * @param branch The branch.
     * @param atoms The atoms to remove.
     */
    removeAtoms(branch: string, atoms: Atom<any>[]): Promise<void>;
}
