import { Transpiler, anyArgument } from './Transpiler';

describe('Transpiler', () => {
    describe('transpile()', () => {
        const cases = [
            [
                'should not convert @tag to _listObjectsWithTag(tag)',
                '@tag',
                '@tag',
            ],
            [
                'should not convert @tag.nested to _listTagValues(tag.nested)',
                '@tag.nested',
                '@tag.nested',
            ],
            ['should not convert #tag to _listTagValues(tag)', '#tag', '#tag'],
        ];
        it.each(cases)('%s', (description, code, expected) => {
            const transpiler = new Transpiler();
            expect(() => {
                transpiler.transpile(code);
            }).toThrow();
        });

        describe('__inifiniteLoopCheck()', () => {
            describe('while', () => {
                it('should add a call to __energyCheck() in while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'while(true) { console.log("Hello"); }'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in inline while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'while(true) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in empty while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile('while(true);');

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in nested while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'while(true) { while(true) {} }'
                    );

                    const search = /(__energyCheck)/g.exec(result);
                    expect(search.length).toBe(2);
                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });
            });

            describe('do while', () => {
                it('should add a call to __energyCheck() in do while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'do { console.log("Hello"); } while(true)'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in nested do while loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'do { do {} while(true); } while(true);'
                    );

                    const search = /(__energyCheck)/g.exec(result);
                    expect(search.length).toBe(2);
                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });
            });

            describe('for', () => {
                it('should add a call to __energyCheck() in for loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let i = 1; i > 0; i++) { console.log("Hello"); }'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in inline for loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let i = 1; i > 0; i++) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in nested foor loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(;;) { for(;;) {} }'
                    );

                    const search = /(__energyCheck)/g.exec(result);
                    expect(search.length).toBe(2);
                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should support for loops without an init expression', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(; i > 0; i++) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should support for loops without a test expression', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let i = 0; ; i++) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should support for loops without an update expression', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let i = 0; i > 0;) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should support empty for loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile('for(;;) ;');

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });
            });

            describe('for in', () => {
                it('should add a call to __energyCheck() in for in loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let key in obj) { console.log("Hello"); }'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in inline for in loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let key in obj) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });
            });

            describe('for of', () => {
                it('should add a call to __energyCheck() in for of loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let key of arr) { console.log("Hello"); }'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });

                it('should add a call to __energyCheck() in inline for of loops', () => {
                    const transpiler = new Transpiler();

                    const result = transpiler.transpile(
                        'for(let key of arr) console.log("Hello");'
                    );

                    expect(result).toContain('__energyCheck()');
                    expect(result).toMatchSnapshot();
                });
            });
        });
    });
});
