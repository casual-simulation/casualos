import { ProgressManager } from './ProgressManager';
import { TestAuxVM } from '../vm/test/TestAuxVM';
import { ProgressMessage } from '@casual-simulation/causal-trees';

describe('ProgressManager', () => {
    let subject: ProgressManager;
    let vm: TestAuxVM;

    beforeEach(() => {
        vm = new TestAuxVM('user');
        subject = new ProgressManager(vm);
    });

    it('should return the most recent progress message', () => {
        vm.connectionStateChanged.next({
            type: 'progress',
            progress: 0.5,
            message: 'def',
        });

        let messages: ProgressMessage[] = [];
        subject.updates.subscribe(m => messages.push(m));

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0.5,
                message: 'def',
            },
        ]);
    });

    it('should emit a done progress event when initialized', () => {
        let messages: ProgressMessage[] = [];
        subject.updates.subscribe(m => messages.push(m));

        vm.connectionStateChanged.next({
            type: 'init',
        });

        expect(messages).toEqual([
            {
                type: 'progress',
                progress: 0,
                message: 'Starting...',
            },
            {
                type: 'progress',
                progress: 1,
                message: 'Done.',
                done: true,
            },
        ]);
    });
});
