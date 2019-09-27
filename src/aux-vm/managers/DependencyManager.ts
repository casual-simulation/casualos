import {
    Bot,
    tagsOnBot,
    UpdatedFile,
    hasValue,
    isFormula,
    AuxObject,
    Dependencies,
    AuxScriptExternalDependency,
} from '@casual-simulation/aux-common';
import { mergeWith, reduce } from 'lodash';

/**
 * Defines an interface that represents the list of dependencies a bot has.
 */
export interface FileDependencyInfo {
    [key: string]: AuxScriptExternalDependency[];
}

/**
 * Defines an interface that represents the list of dependents a tag update has.
 */
export interface FileDependentInfo {
    [id: string]: Set<string>;
}

/**
 * Defines a class that is able to track dependencies between bots.
 */
export class DependencyManager {
    private _fileIdMap: Map<string, AuxObject>;

    // TODO: Break up the data structure into 3 parts:
    //  1. A map of tags to affected formulas.
    //      - This allows us to easily lookup which formulas are affected by adding/removing/editing a tag.
    //      - The edits are global, so it is tested when any bot is edited.
    //  2. A map of bot IDs + tag to affected formulas.
    //      - This is useful for dependencies on specific bots.
    //      - e.g. Using the "this" keyword.
    //      - The key to implementing is that map #1 and map #2 are mutually exclusive.
    //        Meaning that updates to tag on a random bot don't trigger refreshes whereas updates to the specific
    //        bot do.
    //  3. A list of bots that are affected by every change. ("all"-type dependencies)

    /**
     * A map of tag names to IDs of bots that contain said tag name.
     */
    private _tagMap: Map<string, string[]>;

    /**
     * A map of bot IDs to tag names.
     */
    private _fileMap: Map<string, string[]>;

    /**
     * A map of bot IDs to dependent tag names.
     */
    private _dependencyMap: Map<string, FileDependencyInfo>;

    /**
     * A map of tag names to dependent bot IDs.
     */
    private _dependentMap: Map<string, FileDependentInfo>;

    /**
     * A map of bot IDs to tags that should always be updated.
     */
    private _allMap: FileDependentInfo;

    private _dependencies: Dependencies;

    constructor() {
        this._tagMap = new Map();
        this._fileMap = new Map();
        this._fileIdMap = new Map();
        this._dependencyMap = new Map();
        this._dependentMap = new Map();
        this._allMap = {};

        this._dependencies = new Dependencies();
    }

    /**
     * Adds the given bot and returns an object that contains the list of bots and tags taht were affected by the update.
     * @param updates The updates.
     */
    addFiles(bots: AuxObject[]): FileDependentInfo {
        if (!bots || bots.length === 0) {
            return {};
        }
        const results = bots.map(f => this.addFile(f));
        return reduce(results, (first, second) =>
            this._mergeDependents(first, second)
        );
    }

    /**
     * Adds the given bot to the dependency manager for tracking and returns an object that represents which bots and tags were affected by the update.
     * @param bot The bot to add.
     */
    addFile(bot: AuxObject): FileDependentInfo {
        const tags = ['id', ...tagsOnBot(bot)];
        let deps: FileDependencyInfo = {};

        const dependents = tags.map(t => this.getDependents(t));
        const updates =
            reduce(dependents, (first, second) =>
                this._mergeDependents(first, second)
            ) || {};

        for (let tag of tags) {
            const val = bot.tags[tag];
            if (isFormula(val)) {
                let formulaDependencies = this._dependencies.calculateAuxDependencies(
                    val
                );
                deps[tag] = formulaDependencies;
                this._addTagDependents(formulaDependencies, tag, bot);
            }
            let arr = this._tagMap.get(tag);
            if (arr) {
                arr.push(bot.id);
            } else {
                this._tagMap.set(tag, [bot.id]);
            }
        }

        this._dependencyMap.set(bot.id, deps);
        this._fileMap.set(bot.id, tags);
        this._fileIdMap.set(bot.id, bot);

        return updates;
    }

    /**
     * Removes the given bots from the dependency manager and returns an object that contains the list of bots and tags taht were affected by the update.
     * @param updates The updates.
     */
    removeFiles(botIds: string[]): FileDependentInfo {
        if (!botIds || botIds.length === 0) {
            return {};
        }
        const results = botIds.map(id => this.removeFile(id));
        const result = reduce(results, (first, second) =>
            this._mergeDependents(first, second)
        );

        for (let id in result) {
            if (botIds.indexOf(id) >= 0) {
                delete result[id];
            }
        }

        return result;
    }

    /**
     * Removes the given bot from the dependency manager and returns an object that represents which bots and tags were affected by the update.
     * @param bot The bot to remove.
     */
    removeFile(botId: string): FileDependentInfo {
        const tags = this._fileMap.get(botId);

        if (tags) {
            this._fileIdMap.delete(botId);
            this._fileMap.delete(botId);
            const dependencies = this.getDependencies(botId);
            if (dependencies) {
                // TODO: Cleanup
                // This code is pretty ugly
                for (let tag in dependencies) {
                    this._removeTagDependents(dependencies, tag, botId);
                }
            }
            this._dependencyMap.delete(botId);
            for (let tag of tags) {
                let ids = this._tagMap.get(tag);
                if (ids) {
                    const index = ids.indexOf(botId);
                    if (index >= 0) {
                        ids.splice(index, 1);
                    }
                }
            }

            const dependents = tags.map(t => this.getDependents(t));
            const updates = reduce(dependents, (first, second) =>
                this._mergeDependents(first, second)
            );

            return updates;
        }

        return {};
    }

    /**
     * Processes the given bot updates and returns an object that contains the list of bots and tags taht were affected by the update.
     * @param updates The updates.
     */
    updateFiles(updates: UpdatedFile[]): FileDependentInfo {
        if (!updates || updates.length === 0) {
            return {};
        }
        const results = updates.map(u => this.updateBot(u));
        return reduce(results, (first, second) =>
            this._mergeDependents(first, second)
        );
    }

    /**
     * Processes the given bot update and returns an object that contains the list of bots and tags that were affected by the update.
     * @param update The update.
     */
    updateBot(update: UpdatedFile): FileDependentInfo {
        this._fileIdMap.set(update.bot.id, update.bot);
        const tags = this._fileMap.get(update.bot.id);
        if (tags) {
            // ID never updates so we don't need to include it.
            const botTags = tagsOnBot(update.bot);
            tags.splice(0, tags.length, ...botTags);

            const dependencies = this.getDependencies(update.bot.id);

            for (let tag of update.tags) {
                const bots = this._tagMap.get(tag);
                const val = update.bot.tags[tag];
                if (hasValue(val)) {
                    if (isFormula(val)) {
                        let formulaDependencies = this._dependencies.calculateAuxDependencies(
                            val
                        );

                        if (dependencies[tag]) {
                            this._removeTagDependents(
                                dependencies,
                                tag,
                                update.bot.id
                            );
                        }

                        dependencies[tag] = formulaDependencies;
                        this._addTagDependents(
                            formulaDependencies,
                            tag,
                            update.bot
                        );
                    }

                    if (bots) {
                        const index = bots.indexOf(update.bot.id);
                        if (index < 0) {
                            bots.push(update.bot.id);
                        }
                    } else {
                        this._tagMap.set(tag, [update.bot.id]);
                    }
                } else {
                    if (dependencies[tag]) {
                        this._removeTagDependents(
                            dependencies,
                            tag,
                            update.bot.id
                        );
                    }
                    delete dependencies[tag];

                    if (bots) {
                        const index = bots.indexOf(update.bot.id);
                        if (index >= 0) {
                            bots.splice(index, 1);
                        }
                    }
                }
            }

            const updates = this._mergeDependents(
                {
                    [update.bot.id]: new Set(update.tags),
                },
                this._resolveDependencies(update)
            );

            return updates;
        } else {
            console.warn(
                '[DependencyManager] Trying to update bot before it was added!'
            );
        }

        return {};
    }

    private _resolveDependencies(update: UpdatedFile) {
        const dependents = update.tags.map(t =>
            this.getDependents(t, update.bot.id)
        );
        const updates = reduce(dependents, (first, second) =>
            this._mergeDependents(first, second)
        );

        return this._deepDependencies(update.tags, updates, 0);
    }

    private _deepDependencies(
        tags: string[],
        update: FileDependentInfo,
        depth: number
    ): FileDependentInfo {
        // TODO: Put in max depth variable
        if (depth > 10) {
            return update;
        }

        let finalUpdate = update;

        let deepTags: string[] = [];
        for (let key in update) {
            const botTags = [...update[key]];

            const dependents = botTags.map(t => this.getDependents(t, key));
            for (let dep of dependents) {
                for (let tag in dep) {
                    deepTags.push(tag);
                }
            }
            finalUpdate = reduce(
                dependents,
                (first, second) => this._mergeDependents(first, second),
                finalUpdate
            );
        }

        let hasNewTags = false;
        for (let tag of deepTags) {
            if (tags.indexOf(tag) < 0) {
                hasNewTags = true;
                break;
            }
        }

        if (!hasNewTags) {
            return update;
        }

        const tagsArray = [...deepTags];
        const dependents = tagsArray.map(t => this.getDependents(t));
        const updates = reduce(
            dependents,
            (first, second) => this._mergeDependents(first, second),
            update
        );

        return this._deepDependencies(tagsArray, updates, depth + 1);
    }

    private _dependentTags(update: FileDependentInfo): Set<string> {
        let tags: string[] = [];
        for (let key in update) {
            const botTags = update[key];
            tags.push(...botTags);
        }

        return new Set(tags);
    }

    /**
     * Gets the list of dependencies that the given bot ID has.
     * @param id The ID of the bot.
     */
    getDependencies(id: string): FileDependencyInfo {
        return this._dependencyMap.get(id);
    }

    /**
     * Gets the list of bots that would be affected by a change to the given tag.
     * @param tag The tag to search for.
     * @param id The optional bot ID to search for.
     */
    getDependents(tag: string, id?: string): FileDependentInfo {
        let general = this._dependentMap.get(tag);
        if (id) {
            const bot = this._dependentMap.get(`${id}:${tag}`);

            general = this._mergeDependents(general, bot);
        }
        general = this._mergeDependents(general, this._allMap);
        return general || {};
    }

    private _mergeDependents(
        general: FileDependentInfo,
        bot: FileDependentInfo
    ): FileDependentInfo {
        return mergeWith(general, bot, (first, second) => {
            if (first instanceof Set && second instanceof Set) {
                return new Set([...first, ...second]);
            }
        });
    }

    /**
     * Gets a map from tag names to bots that contain values for those tags.
     */
    getTagMap(): Map<string, string[]> {
        return this._tagMap;
    }

    /**
     * Gets a map of bot IDs to the list of tags that the bot has.
     */
    getFileMap(): Map<string, string[]> {
        return this._fileMap;
    }

    /**
     * Gets the map of tag names to a hash of bots that are dependent on the tag.
     */
    getDependentMap(): Map<string, FileDependentInfo> {
        return this._dependentMap;
    }

    private _getTagDependents(tag: string) {
        let dependents = this._dependentMap.get(tag);
        if (!dependents) {
            dependents = {};
            this._dependentMap.set(tag, dependents);
        }
        return dependents;
    }

    private _getFileDependents(tag: string, id: string) {
        const dependents = this._getTagDependents(tag);
        let fileDependents = dependents[id];
        if (!fileDependents) {
            fileDependents = new Set();
            dependents[id] = fileDependents;
        }

        return fileDependents;
    }

    private _addTagDependents(
        formulaDependencies: AuxScriptExternalDependency[],
        tag: string,
        bot: Bot
    ) {
        for (let dep of formulaDependencies) {
            // TODO: Support "this" dependencies
            if (dep.type !== 'all' && dep.type !== 'this') {
                const fileDeps = this._getFileDependents(dep.name, bot.id);
                fileDeps.add(tag);
            } else if (dep.type === 'all') {
                const tags = this._allMap[bot.id];
                if (tags) {
                    tags.add(tag);
                } else {
                    this._allMap[bot.id] = new Set([tag]);
                }
            }
        }
    }

    /**
     * Removes all the dependents for the given bot dependencies and returns
     * @param dependencies
     * @param tag
     * @param botId
     */
    private _removeTagDependents(
        dependencies: FileDependencyInfo,
        tag: string,
        botId: string
    ) {
        const deps = dependencies[tag];
        for (let dep of deps) {
            if (dep.type !== 'all' && dep.type !== 'this') {
                const tagDeps = this._dependentMap.get(dep.name);
                if (tagDeps) {
                    let fileDeps = tagDeps[botId];
                    if (fileDeps) {
                        fileDeps.delete(tag);
                        if (fileDeps.size === 0) {
                            delete tagDeps[botId];
                        }
                    }
                }
            } else if (dep.type === 'all') {
                const tags = this._allMap[botId];
                if (tags) {
                    tags.delete(tag);
                    if (tags.size === 0) {
                        delete this._allMap[botId];
                    }
                }
            }
        }
    }
}
