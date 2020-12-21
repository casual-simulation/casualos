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
