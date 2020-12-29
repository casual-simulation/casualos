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
     * Gets the list of tags that are currently in use.
     */
    async getTags(): Promise<string[]> {
        return await this._vm.getTags();
    }
}
