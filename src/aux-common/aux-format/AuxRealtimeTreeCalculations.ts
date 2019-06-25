import { AuxCausalTree } from './AuxCausalTree';
import { map, startWith, flatMap, share } from 'rxjs/operators';
import { sortBy } from 'lodash';
import { tagsOnFile } from '../Files';
import { Atom, RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { AuxFile } from './AuxState';
import { AuxOp, AuxOpType } from './AuxOpTypes';
import { getAtomFile, getAtomTag } from './AuxTreeCalculations';

export interface AuxStateDiff {
    addedFiles: AuxFile[];
    removedFiles: string[];
    updatedFiles: UpdatedFile[];
}

export interface UpdatedFile {
    file: AuxFile;
    tags: string[];
}

/**
 * Builds the fileAdded, fileRemoved, and fileUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {
    const stateDiffs = tree.onUpdated.pipe(
        startWith(tree.tree.weave.atoms),
        map(events => {
            let addedIds: { [key: string]: boolean } = {};
            let addedFiles: AuxFile[] = [];
            let updatedFiles: Map<string, UpdatedFile> = new Map();
            let deletedFiles: string[] = [];
            events.forEach((e: Atom<AuxOp>) => {
                if (e.value.type === AuxOpType.file) {
                    const id = e.value.id;
                    const val = tree.tree.value[id];
                    const existing = addedIds[id];
                    if (!existing && val) {
                        addedFiles.push(val);
                        addedIds[id] = true;
                    }
                    return;
                } else if (e.value.type === AuxOpType.delete) {
                    let cause = tree.tree.weave.getAtom(e.cause);
                    if (cause.value.type === AuxOpType.file) {
                        const id = cause.value.id;
                        deletedFiles.push(id);
                        return;
                    }
                }

                // Some update happened
                const file = getAtomFile(tree.tree.weave, e);
                if (file) {
                    const id = file.value.id;
                    const val = tree.tree.value[id];
                    const tag = getAtomTag(tree.tree.weave, e);
                    if (tag) {
                        const update = updatedFiles.get(id);
                        if (update) {
                            if (update.tags.indexOf(tag.value.name) < 0) {
                                update.tags.push(tag.value.name);
                            }
                        } else {
                            updatedFiles.set(id, {
                                file: val,
                                tags: [tag.value.name],
                            });
                        }
                    }
                }
            });

            let diff: AuxStateDiff = {
                addedFiles: addedFiles,
                removedFiles: deletedFiles,
                updatedFiles: [...updatedFiles.values()],
            };

            return diff;
        }),
        share()
    );

    const filesAdded = stateDiffs.pipe(
        map(diff => {
            return sortBy(
                diff.addedFiles,
                f => {
                    let tags = tagsOnFile(f);
                    return tags.length > 0 &&
                        tags.some(t => t === 'aux.context')
                        ? 0
                        : 1;
                },
                f => f.id
            );
        })
    );

    const filesRemoved = stateDiffs.pipe(map(diff => diff.removedFiles));

    const filesUpdated = stateDiffs.pipe(map(diff => diff.updatedFiles));

    return {
        filesAdded,
        filesRemoved,
        filesUpdated,
    };
}
