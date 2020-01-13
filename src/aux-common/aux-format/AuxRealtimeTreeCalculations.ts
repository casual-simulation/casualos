import { AuxCausalTree } from './AuxCausalTree';
import { map, startWith, flatMap, share } from 'rxjs/operators';
import sortBy from 'lodash/sortBy';
import { tagsOnBot } from '../bots';
import { Atom, RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { AuxBot } from './AuxState';
import { AuxOp, AuxOpType } from './AuxOpTypes';
import { getAtomBot, getAtomTag } from './AuxTreeCalculations';

export interface AuxStateDiff {
    addedBots: AuxBot[];
    removedBots: string[];
    updatedBots: UpdatedBot[];
}

export interface UpdatedBot {
    bot: AuxBot;
    tags: string[];
}

/**
 * Builds the botAdded, botRemoved, and botUpdated observables from the given channel connection.
 * @param connection The channel connection.
 */
export function botChangeObservables(tree: RealtimeCausalTree<AuxCausalTree>) {
    const stateDiffs = tree.onUpdated.pipe(
        startWith(tree.tree.weave.atoms),
        map(events => atomsToDiff(<Atom<AuxOp>[]>events, tree.tree)),
        share()
    );

    const botsAdded = stateDiffs.pipe(
        map(diff => {
            return sortBy(
                diff.addedBots,
                f => {
                    let tags = tagsOnBot(f);
                    return tags.length > 0 &&
                        tags.some(t => t === 'auxDimensionConfig')
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

export function atomsToDiff(
    events: Atom<AuxOp>[],
    tree: AuxCausalTree
): AuxStateDiff {
    let addedIds: { [key: string]: boolean } = {};
    let addedBots: AuxBot[] = [];
    let updatedBots: Map<string, UpdatedBot> = new Map();
    let deletedBots: string[] = [];
    events.forEach((e: Atom<AuxOp>) => {
        if (e.value.type === AuxOpType.bot) {
            const id = e.value.id;
            const val = tree.value[id];
            const existing = addedIds[id];
            if (!existing && val) {
                addedBots.push(val);
                addedIds[id] = true;
            }
            return;
        } else if (e.value.type === AuxOpType.delete) {
            let cause = tree.weave.getAtom(e.cause);
            if (cause.value.type === AuxOpType.bot) {
                const id = cause.value.id;
                deletedBots.push(id);
                return;
            }
        }

        // Some update happened
        const bot = getAtomBot(tree.weave, e);
        if (bot) {
            const id = bot.value.id;
            const val = tree.value[id];
            const tag = getAtomTag(tree.weave, e);
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
        removedBots: deletedBots,
        updatedBots: [...updatedBots.values()],
    };

    return diff;
}
