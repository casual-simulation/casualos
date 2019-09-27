import { AuxCausalTree } from './AuxCausalTree';
import { map, startWith, flatMap, share } from 'rxjs/operators';
import { sortBy } from 'lodash';
import { tagsOnBot } from '../Files';
import { Atom, RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { AuxFile } from './AuxState';
import { AuxOp, AuxOpType } from './AuxOpTypes';
import { getAtomBot, getAtomTag } from './AuxTreeCalculations';

export interface AuxStateDiff {
    addedBots: AuxFile[];
    removedBots: string[];
    updatedBots: UpdatedFile[];
}

export interface UpdatedFile {
    bot: AuxFile;
    tags: string[];
}

/**
 * Builds the botAdded, botRemoved, and botUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function fileChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {
    const stateDiffs = tree.onUpdated.pipe(
        startWith(tree.tree.weave.atoms),
        map(events => {
            let addedIds: { [key: string]: boolean } = {};
            let addedBots: AuxFile[] = [];
            let updatedBots: Map<string, UpdatedFile> = new Map();
            let deletedFiles: string[] = [];
            events.forEach((e: Atom<AuxOp>) => {
                if (e.value.type === AuxOpType.bot) {
                    const id = e.value.id;
                    const val = tree.tree.value[id];
                    const existing = addedIds[id];
                    if (!existing && val) {
                        addedBots.push(val);
                        addedIds[id] = true;
                    }
                    return;
                } else if (e.value.type === AuxOpType.delete) {
                    let cause = tree.tree.weave.getAtom(e.cause);
                    if (cause.value.type === AuxOpType.bot) {
                        const id = cause.value.id;
                        deletedFiles.push(id);
                        return;
                    }
                }

                // Some update happened
                const bot = getAtomBot(tree.tree.weave, e);
                if (bot) {
                    const id = bot.value.id;
                    const val = tree.tree.value[id];
                    const tag = getAtomTag(tree.tree.weave, e);
                    if (tag) {
                        const update = updatedBots.get(id);
                        if (update) {
                            if (update.tags.indexOf(tag.value.name) < 0) {
                                update.tags.push(tag.value.name);
                            }
                        } else {
                            updatedBots.set(id, {
                                bot: val,
                                tags: [tag.value.name],
                            });
                        }
                    }
                }
            });

            let diff: AuxStateDiff = {
                addedBots: addedBots,
                removedBots: deletedFiles,
                updatedBots: [...updatedBots.values()],
            };

            return diff;
        }),
        share()
    );

    const botsAdded = stateDiffs.pipe(
        map(diff => {
            return sortBy(
                diff.addedBots,
                f => {
                    let tags = tagsOnBot(f);
                    return tags.length > 0 &&
                        tags.some(t => t === 'aux.context')
                        ? 0
                        : 1;
                },
                f => f.id
            );
        })
    );

    const botsRemoved = stateDiffs.pipe(map(diff => diff.removedBots));

    const botsUpdated = stateDiffs.pipe(map(diff => diff.updatedBots));

    return {
        botsAdded,
        botsRemoved,
        botsUpdated,
    };
}
