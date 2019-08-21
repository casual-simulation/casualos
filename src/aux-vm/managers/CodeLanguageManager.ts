import { FileDependentInfo } from './DependencyManager';
import { AuxVM } from '../vm/AuxVM';

/**
 * Defines a class that manages language related to scripting languages.
 */
export class CodeLanguageManager {
    private _vm: AuxVM;

    /**
     * Creates a new CodeLanguageManager.
     * @param vm The VM that the manager should be connected to.
     */
    constructor(vm: AuxVM) {
        this._vm = vm;
    }

    /**
     * Gets the list of references to the given tag.
     * @param tag The tag.
     */
    getReferences(tag: string): Promise<FileDependentInfo> {
        return this._vm.getReferences(tag);
    }
}
