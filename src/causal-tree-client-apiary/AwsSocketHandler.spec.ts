import { AwsSocketHandler } from './AwsSocketHandler';

describe('AwsSocketHandler', () => {
    describe('encode()', () => {
        let handler: AwsSocketHandler;

        beforeEach(() => {
            handler = new AwsSocketHandler(1_000);
        });

        it('should encode the given data', () => {
            const messages = handler.encode('abcdefghijk', 0);
            expect(messages).toHaveLength(1);
            expect(messages[0]).not.toEqual('');
        });
    });

    describe('handleMessage()', () => {
        let handler: AwsSocketHandler;

        beforeEach(() => {
            handler = new AwsSocketHandler(30);
        });

        it('should be able to decode previously encoded data', () => {
            const messages = handler.encode('abcdef', 0);

            const event = handler.handleMessage({
                data: messages[0],
            });

            expect(event).toEqual({
                data: 'abcdef',
            });
        });

        it('should be able to decode data that was encoded into multiple messages', () => {
            let str = 'abcdefghijklmnopqrstuvwxyz';
            const data = str.repeat(10);
            const messages = handler.encode(data, 0);

            expect(messages.every((m) => m.length <= 30)).toBe(true);

            for (let message of messages.slice(0, messages.length - 1)) {
                const event = handler.handleMessage({
                    data: message,
                });
                expect(event).toBe(null);
            }

            const event = handler.handleMessage({
                data: messages[messages.length - 1],
            });

            expect(event).toEqual({
                data: data,
            });
        });
    });
});
