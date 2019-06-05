import {
    File,
    tagsOnFile,
    UpdatedFile,
    hasValue,
    Transpiler,
    isFormula,
    AuxScriptDependency,
    AuxScriptDependencies,
    AuxObject,
} from '@casual-simulation/aux-common';
import { uniq, mergeWith, reduce } from 'lodash';

/**
 * Defines an interface that represents the list of dependencies a file has.
 */
export interface FileDependencyInfo {
    [key: string]: AuxScriptDependency[];
}

/**
 * Defines an interface that represents the list of dependents a tag update has.
 */
export interface FileDependentInfo {
    [id: string]: Set<string>;
}

/**
 * Defines a class that is able to track dependencies between files.
 */
export class DependencyManager {
    private _fileIdMap: Map<string, AuxObject>;

    /**
     * A map of tag names to IDs of files that contain said tag name.
     */
    private _tagMap: Map<string, string[]>;

    /**
     * A map of file IDs to tag names.
     */
    private _fileMap: Map<string, string[]>;

    /**
     * A map of file IDs to dependent tag names.
     */
    private _dependencyMap: Map<string, FileDependencyInfo>;

    /**
     * A map of tag names to dependent file IDs.
     */
    private _dependentMap: Map<string, FileDependentInfo>;

    private _transpiler: Transpiler;

    constructor() {
        this._tagMap = new Map();
        this._fileMap = new Map();
        this._fileIdMap = new Map();
        this._dependencyMap = new Map();
        this._dependentMap = new Map();

        this._transpiler = new Transpiler();
    }

    /**
     * Adds the given file to the dependency manager for tracking.
     * @param file The file to add.
     */
    addFile(file: AuxObject): FileDependentInfo {
        const tags = tagsOnFile(file);
        let deps: FileDependencyInfo = {};

        const dependents = tags.map(t => this.getDependents(t));
        const updates = reduce(dependents, (first, second) =>
            this._mergeDependents(first, second)
        );

        for (let tag of tags) {
            const val = file.tags[tag];
            if (isFormula(val)) {
                let formulaDependencies = this._transpiler.dependencies(val);
                deps[tag] = formulaDependencies.tags;
                this._addTagDependents(formulaDependencies, tag, file);
            }
            let arr = this._tagMap.get(tag);
            if (arr) {
                arr.push(file.id);
            } else {
                this._tagMap.set(tag, [file.id]);
            }
        }

        this._dependencyMap.set(file.id, deps);
        this._fileMap.set(file.id, tags);
        this._fileIdMap.set(file.id, file);

        return updates;
    }

    /**
     * Removes the given file from the dependency manager.
     * @param file The file to remove.
     */
    removeFile(file: AuxObject): FileDependentInfo {
        const tags = this._fileMap.get(file.id);

        if (tags) {
            this._fileIdMap.delete(file.id);
            this._fileMap.delete(file.id);
            const dependencies = this.getDependencies(file.id);
            if (dependencies) {
                // TODO: Cleanup
                // This code is pretty ugly
                for (let tag in dependencies) {
                    this._removeTagDependents(dependencies, tag, file);
                }
            }
            this._dependencyMap.delete(file.id);
            for (let tag of tags) {
                let ids = this._tagMap.get(tag);
                if (ids) {
                    const index = ids.indexOf(file.id);
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
     * Processes the given file update.
     * @param update The update.
     */
    updateFile(update: UpdatedFile): FileDependentInfo {
        this._fileIdMap.set(update.file.id, update.file);
        const tags = this._fileMap.get(update.file.id);
        if (tags) {
            const fileTags = tagsOnFile(update.file);
            tags.splice(0, tags.length, ...fileTags);

            const dependencies = this.getDependencies(update.file.id);

            for (let tag of update.tags) {
                const files = this._tagMap.get(tag);
                const val = update.file.tags[tag];
                if (hasValue(val)) {
                    if (isFormula(val)) {
                        let formulaDependencies = this._transpiler.dependencies(
                            val
                        );

                        if (dependencies[tag]) {
                            this._removeTagDependents(
                                dependencies,
                                tag,
                                update.file
                            );
                        }

                        dependencies[tag] = formulaDependencies.tags;
                        this._addTagDependents(
                            formulaDependencies,
                            tag,
                            update.file
                        );
                    }

                    if (files) {
                        const index = files.indexOf(update.file.id);
                        if (index < 0) {
                            files.push(update.file.id);
                        }
                    } else {
                        this._tagMap.set(tag, [update.file.id]);
                    }
                } else {
                    if (dependencies[tag]) {
                        this._removeTagDependents(
                            dependencies,
                            tag,
                            update.file
                        );
                    }
                    delete dependencies[tag];

                    if (files) {
                        const index = files.indexOf(update.file.id);
                        if (index >= 0) {
                            files.splice(index, 1);
                        }
                    }
                }
            }

            const updates = this._resolveDependencies(update);

            return updates;
        } else {
            console.warn(
                '[DependencyManager] Trying to update file before it was added!'
            );
        }

        return {};
    }

    private _resolveDependencies(update: UpdatedFile) {
        const dependents = update.tags.map(t =>
            this.getDependents(t, update.file.id)
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
            const fileTags = [...update[key]];

            const dependents = fileTags.map(t => this.getDependents(t, key));
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
            const fileTags = update[key];
            tags.push(...fileTags);
        }

        return new Set(tags);
    }

    /**
     * Gets the list of dependencies that the given file ID has.
     * @param id The ID of the file.
     */
    getDependencies(id: string): FileDependencyInfo {
        return this._dependencyMap.get(id);
    }

    /**
     * Gets the list of files that would be affected by a change to the given tag.
     * @param tag The tag to search for.
     * @param id The optional file ID to search for.
     */
    getDependents(tag: string, id?: string): FileDependentInfo {
        const general = this._dependentMap.get(tag);
        if (id) {
            const file = this._dependentMap.get(`${id}:${tag}`);

            return this._mergeDependents(general, file);
        }
        return general;
    }

    private _mergeDependents(
        general: FileDependentInfo,
        file: FileDependentInfo
    ): FileDependentInfo {
        return mergeWith(general, file, (first, second) => {
            if (first instanceof Set && second instanceof Set) {
                return new Set([...first, ...second]);
            }
        });
    }

    /**
     * Gets a map from tag names to files that contain values for those tags.
     */
    getTagMap(): Map<string, string[]> {
        return this._tagMap;
    }

    /**
     * Gets a map of file IDs to the list of tags that the file has.
     */
    getFileMap(): Map<string, string[]> {
        return this._fileMap;
    }

    /**
     * Gets the map of tag names to a hash of files that are dependent on the tag.
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
        formulaDependencies: AuxScriptDependencies,
        tag: string,
        file: File
    ) {
        for (let dep of formulaDependencies.tags) {
            if (dep.type === 'this') {
                let chain: string = null;
                for (let member of dep.members) {
                    if (!chain) {
                        chain = member;
                    } else {
                        chain += '.' + member;
                    }
                    const fileDeps = this._getFileDependents(
                        `${file.id}:${chain}`,
                        file.id
                    );
                    fileDeps.add(tag);
                }
            } else {
                const fileDeps = this._getFileDependents(dep.name, file.id);
                fileDeps.add(tag);
            }
        }
    }

    private _removeTagDependents(
        dependencies: FileDependencyInfo,
        tag: string,
        file: File
    ) {
        const deps = dependencies[tag];
        for (let dep of deps) {
            if (dep.type === 'this') {
                let chain: string = null;
                for (let member of dep.members) {
                    if (!chain) {
                        chain = member;
                    } else {
                        chain += '.' + member;
                    }
                    const tagDeps = this._dependentMap.get(
                        `${file.id}:${chain}`
                    );
                    if (tagDeps) {
                        delete tagDeps[file.id];
                    }
                }
            } else {
                const tagDeps = this._dependentMap.get(dep.name);
                if (tagDeps) {
                    delete tagDeps[file.id];
                }
            }
        }
    }
}
