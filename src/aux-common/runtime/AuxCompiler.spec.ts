import { AuxCompiler } from './AuxCompiler';

describe('AuxCompiler', () => {
    let compiler: AuxCompiler;

    beforeEach(() => {
        compiler = new AuxCompiler();
    });

    describe('compile()', () => {
        it('should return a function that executes the given code', () => {
            const func = compiler.compile('return 1 + 2');

            expect(func()).toEqual(3);
        });

        it('should make the given variables available to the script', () => {
            const func = compiler.compile('return num1 + num2', {
                variables: {
                    num1: () => 10,
                    num2: () => 5,
                },
            });

            expect(func()).toEqual(15);
        });

        it('should bind the given "this" variable to the script', () => {
            const func = compiler.compile('return this + num', {
                variables: {
                    num: () => 10,
                    this: () => 'hello',
                },
            });

            expect(func()).toEqual('hello10');
        });

        it('should support using a context object to derive variables', () => {
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
            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should support constant values compiled into the script', () => {
            const func = compiler.compile('return num;', {
                constants: {
                    num: -5,
                },
            });

            expect(func()).toEqual(-5);
        });

        it('should return metadata for the compiled script', () => {
            const script = 'return str + num + abc;';
            const func = compiler.compile(script, {
                constants: {
                    num: -5,
                    str: 'abc',
                },
                variables: {
                    abc: () => 'def',
                },
                before: () => {},
                after: () => {},
            });

            const source = func.metadata.scriptFunction.toString();
            const lines = source.split('\n');
            const scriptLine = lines[func.metadata.scriptLineOffset].trim();

            expect(scriptLine).toEqual(script);
        });

        it('should transpile the user code to include energy checks', () => {
            function __energyCheck() {
                throw new Error('Energy Check Hit!');
            }

            const script = 'let num = 0; while(num === 0) { num += 1; }';
            const func = compiler.compile(script, {
                constants: {
                    __energyCheck,
                },
            });

            expect(() => {
                func();
            }).toThrow(new Error('Energy Check Hit!'));
        });
    });
});
