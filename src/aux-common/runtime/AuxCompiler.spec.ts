import { AuxCompiler } from './AuxCompiler';

describe('AuxCompiler', () => {
    describe('compile()', () => {
        it('should return a function that executes the given code', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should make the given variables available to the script', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return num1 + num2', {
                variables: {
                    num1: () => 10,
                    num2: () => 5,
                },
            });

            expect(func()).toEqual(15);
        });

        it('should bind the given "this" variable to the script', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return this + num', {
                variables: {
                    num: () => 10,
                    this: () => 'hello',
                },
            });

            expect(func()).toEqual('hello10');
        });

        it('should support using a context object to derive variables', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return this + num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                    this: () => 'hello',
                },
                context: {
                    num: 5,
                },
            });

            expect(func()).toEqual('hello5');
        });

        it('should support running arbitrary code before execution', () => {
            const compiler = new AuxCompiler();

            const context = {
                num: 0,
            };

            const func = compiler.compile('return num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                before: (ctx: any) => (ctx.num += 1),
                context,
            });

            expect(func()).toEqual(1);
            expect(func()).toEqual(2);

            expect(context).toEqual({
                num: 2,
            });
        });

        it('should support running arbitrary code after execution', () => {
            const compiler = new AuxCompiler();

            const context = {
                num: 0,
            };

            const func = compiler.compile('return num', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                after: (ctx: any) => (ctx.num += 1),
                context,
            });

            expect(func()).toEqual(0);
            expect(func()).toEqual(1);

            expect(context).toEqual({
                num: 2,
            });
        });

        it('should allow redefining variables in the script', () => {
            const compiler = new AuxCompiler();

            const context = {
                num: 5,
            };

            const func = compiler.compile('let num = -1; return num;', {
                variables: {
                    num: (ctx: any) => ctx.num,
                },
                context,
            });

            expect(func()).toEqual(-1);
        });

        it('should not allow reassigning a constant value', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('num = 1; return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(() => {
                func();
            }).toThrow();
        });

        it('should not allow reassigning a variable', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('num = 1; return num;', {
                variables: {
                    num: () => -5,
                },
            });

            expect(() => {
                func();
            }).toThrow();
        });

        it('should support constant values compiled into the script', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should support constant values compiled into the script', () => {
            const compiler = new AuxCompiler();

            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should return metadata for the compiled script', () => {
            const compiler = new AuxCompiler();

            const script = 'return str + num;';
            const func = compiler.compile(script, {
                constants: {
                    num: -5,
                    str: 'abc',
                },
                before: () => {},
                after: () => {},
            });

            const source = func.metadata.scriptFunction.toString();
            const lines = source.split('\n');
            const scriptLine = lines[func.metadata.scriptLineOffset];

            expect(scriptLine).toEqual(script);
        });
    });
});
