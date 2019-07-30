import { SubscriptionLike } from 'rxjs';
import { messages, ConsoleMessages } from './Console';

let logMock = (console.log = jest.fn());
let warnMock = (console.warn = jest.fn());
let errorMock = (console.error = jest.fn());

describe('Console', () => {
    describe('register()', () => {
        let sub: SubscriptionLike;
        let calls: ConsoleMessages[] = [];

        beforeAll(() => {
            sub = messages.subscribe(m => {
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
            ['log', logMock],
            ['warn', warnMock],
            ['error', errorMock],
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
                    },
                ]);
                expect(func).not.toBe(mock);
                expect(mock).toBeCalledWith('abc');
            }
        );
    });
});
