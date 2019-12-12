import { CausalRepoStageStore } from './CausalRepoStageStore';
import { AtomIndexFullDiff } from './AtomIndex';
import { Atom, atomIdToString } from './Atom2';

/**
 * Defines a stage store which keeps everything in memory.
 */
export class MemoryStageStore implements CausalRepoStageStore {
    private _stages = new Map<string, AtomIndexFullDiff>();

    async getStage(branch: string): Promise<AtomIndexFullDiff> {
        let stage = this._stages.get(branch);
        if (!stage) {
            stage = {
                additions: [],
                deletions: {},
            };
            this._stages.set(branch, stage);
        }
        return stage;
    }

    async addAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        let stage = await this.getStage(branch);
        stage.additions.push(...atoms);
    }

    async removeAtoms(branch: string, atoms: Atom<any>[]): Promise<void> {
        let stage = await this.getStage(branch);
        for (let atom of atoms) {
            stage.deletions[atom.hash] = atomIdToString(atom.id);
        }
    }

    async clearStage(branch: string): Promise<void> {
        this._stages.delete(branch);
    }
}
