import { SubscriptionLike } from 'rxjs';
import { messages } from './Console';
import { ConsoleMessages } from '@casual-simulation/causal-trees';

let logMock = (console.log = jest.fn());
let warnMock = (console.warn = jest.fn());
let errorMock = (console.error = jest.fn());

describe('Console', () => {
    describe('register()', () => {
        let sub: SubscriptionLike;
        let calls: ConsoleMessages[] = [];

        beforeAll(() => {
            sub = messages.subscribe((m) => {
                calls.push(m);
            });
        });

        afterAll(() => {
            sub.unsubscribe();
        });

        beforeEach(() => {
            calls = [];
        });

        const cases = [
            ['log', logMock] as const,
            ['warn', warnMock] as const,
            ['error', errorMock] as const,
        ];

        it.each(cases)(
            'should replace console.%s with a wrapper',
            (type, mock: jest.Mock<any>) => {
                const func: any = (<any>console)[type];
                func('abc');

                expect(calls).toEqual([
                    {
                        type: type,
                        messages: ['abc'],
                        stack: expect.any(String),
                        source: 'app',
                    },
                ]);
                expect(func).not.toBe(mock);
                expect(mock).toBeCalledWith('abc');
            }
        );
    });
});
