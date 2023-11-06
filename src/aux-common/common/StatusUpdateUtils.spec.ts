import { remapProgressPercent } from './StatusUpdateUtils';
import { StatusUpdate } from './StatusUpdate';

describe('SharedUtils', () => {
    describe('remapProgressPercent', () => {
        let cases = [
            [0, 0, 0, 1],
            [0, 0.1, 0.1, 1],
            [0, 0.25, 0.25, 1],
            [0.25, 0.4375, 0.25, 1],
            [1, 1, 0.25, 1],
            [1, 0.5, 0.25, 0.5],
        ];

        it.each(cases)(
            'should map %d to %d in range (%d - %d)',
            (value: number, expected: number, start: number, end: number) => {
                let func = remapProgressPercent(start, end);

                let result = func({
                    type: 'progress',
                    progress: value,
                    message: 'a',
                });

                expect(result).toEqual({
                    type: 'progress',
                    message: 'a',
                    progress: expected,
                });
            }
        );

        it('should not affect non progress messages', () => {
            let message: StatusUpdate = {
                type: 'init',
            };

            let result = remapProgressPercent(0, 1)(message);

            expect(result).toBe(message);
        });
    });
});
