import { procedure } from './GenericRPCInterface';
import z from 'zod';

describe('procedure()', () => {
    it('should be able to create a new procedure', async () => {
        const proc = procedure()
            .origins(true)
            .inputs(z.string())
            .handler(async (str) => ({
                success: true,
                value: `hello ${str}`,
            }));

        expect(await proc.handler('world', null as any)).toEqual({
            success: true,
            value: 'hello world',
        });
        expect(proc.allowedOrigins).toBe(true);
    });
});
