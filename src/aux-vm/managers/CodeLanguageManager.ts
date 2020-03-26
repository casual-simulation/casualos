import { AuxVM } from '../vm/AuxVM';
import { trimTag, BotDependentInfo } from '@casual-simulation/aux-common';

export interface TagReferences {
    tag: string;
    references: BotDependentInfo;
}

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
    async getReferences(tag: string): Promise<TagReferences> {
        let trimmed = trimTag(tag);
        return {
            references: await this._vm.getReferences(trimmed),
            tag: trimmed,
        };
    }

    /**
     * Gets the list of tags that are currently in use.
     */
    async getTags(): Promise<string[]> {
        return await this._vm.getTags();
    }
}
