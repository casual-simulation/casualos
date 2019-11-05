import {
    auxTree,
    addAuxAtom,
    AuxResult,
    mergeAuxResults,
} from './AuxCausalTree2';
import { bot } from './AuxOpTypes';
import { createBot } from '../bots/BotCalculations';
import { newSite } from '@casual-simulation/causal-trees/core2';

describe('AuxCausalTree2', () => {
    describe('addAuxAtom()', () => {
        it('should return the state update', () => {
            const tree = auxTree('a');

            const result = addAuxAtom(tree, null, bot('test'));

            expect(result.update).toEqual({
                test: createBot('test'),
            });
        });
    });

    describe('mergeAuxResults()', () => {
        it('should merge the states', () => {
            const result1: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    test: createBot('test', {
                        num: 123,
                    }),
                    other: createBot('other', {
                        abc: 'def',
                    }),
                },
            };
            const result2: AuxResult = {
                results: [],
                newSite: newSite('a', 1),
                update: {
                    other: createBot('other', {
                        abc: 'ghi',
                    }),
                    new: createBot('new'),
                },
            };

            const final = mergeAuxResults(result1, result2);

            expect(final.update).toEqual({
                test: createBot('test', {
                    num: 123,
                }),
                other: createBot('other', {
                    abc: 'ghi',
                }),
                new: createBot('new'),
            });
        });
    });
});
