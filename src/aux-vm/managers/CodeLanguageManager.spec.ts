import { TestAuxVM } from '../vm/test/TestAuxVM';
import { CodeLanguageManager } from './CodeLanguageManager';
import {
    createPrecalculatedBot,
    createBot,
    botAdded,
} from '@casual-simulation/aux-common';

describe('CodeLanguageManager', () => {
    let vm: TestAuxVM;
    let subject: CodeLanguageManager;

    beforeEach(() => {
        vm = new TestAuxVM('user');
        vm.processEvents = true;
        subject = new CodeLanguageManager(vm);
    });

    describe('getReferences()', () => {
        it('should find references by tag name', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: '=getTag(this, "def")',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        fun: '=getTag(this, "def")',
                    })
                ),
            ]);

            const references = await subject.getReferences('def');

            expect(references).toEqual({
                tag: 'def',
                references: {
                    test: new Set(['abc']),
                    test2: new Set(['fun']),
                },
            });
        });

        it('should find references when given a tag with a hash', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: '=getTag(this, "def")',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        fun: '=getTag(this, "def")',
                    })
                ),
            ]);

            const references = await subject.getReferences('#def');

            expect(references).toEqual({
                tag: 'def',
                references: {
                    test: new Set(['abc']),
                    test2: new Set(['fun']),
                },
            });
        });

        it('should find references to tags that are accessed using hashtags', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: '=getTag(this, "#def")',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        fun: '=getTag(this, "#def")',
                    })
                ),
            ]);

            const references = await subject.getReferences('def');

            expect(references).toEqual({
                tag: 'def',
                references: {
                    test: new Set(['abc']),
                    test2: new Set(['fun']),
                },
            });
        });

        it('should find references when given an action tag', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: '=getTag(this, "onClick()")',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        fun: '=getTag(this, "onClick()")',
                    })
                ),
            ]);

            const references = await subject.getReferences('onClick()');

            expect(references).toEqual({
                tag: 'onClick()',
                references: {
                    test: new Set(['abc']),
                    test2: new Set(['fun']),
                },
            });
        });

        it('should find references to action tags which are referenced using hashtags', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: '=getTag(this, "#onClick()")',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        fun: '=getTag(this, "#onClick()")',
                    })
                ),
            ]);

            const references = await subject.getReferences('onClick()');

            expect(references).toEqual({
                tag: 'onClick()',
                references: {
                    test: new Set(['abc']),
                    test2: new Set(['fun']),
                },
            });
        });
    });

    describe('getTags()', () => {
        it('should get the full list of tags', async () => {
            await vm.sendEvents([
                botAdded(
                    createBot('test', {
                        abc: 'test',
                        def: 'other',
                    })
                ),
                botAdded(
                    createBot('test2', {
                        '123': 456,
                        abc: 'haha',
                        ghi: 'final',
                    })
                ),
            ]);

            const tags = await subject.getTags();

            expect(tags).toEqual(['123', 'abc', 'def', 'ghi']);
        });
    });
});
