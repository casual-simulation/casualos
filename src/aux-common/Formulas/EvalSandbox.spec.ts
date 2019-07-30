import { EvalSandbox } from './EvalSandbox';

console.log = jest.fn();
console.warn = jest.fn();
console.error = jest.fn();

describe('EvalSandbox', () => {
    it('should return logs from the script', () => {
        const sandbox = new EvalSandbox({});

        const result = sandbox.run(
            'console.log("abc"); console.warn("def"); console.error("lol")',
            null,
            null
        );

        expect(result.logs).toEqual([
            {
                type: 'log',
                messages: ['abc'],
                source: 'script',
                stack: expect.any(String),
            },
            {
                type: 'warn',
                messages: ['def'],
                source: 'script',
                stack: expect.any(String),
            },
            {
                type: 'error',
                messages: ['lol'],
                source: 'script',
                stack: expect.any(String),
            },
        ]);
    });
});
