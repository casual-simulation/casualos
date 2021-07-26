import { Doc, Text } from 'yjs';
import { DNA_TAG_PREFIX } from '..';
import {
    Transpiler,
    anyArgument,
    replaceMacros,
    calculateOriginalLineLocation,
    calculateIndexFromLocation,
    calculateLocationFromIndex,
    TranspilerResult,
} from './Transpiler';

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

        describe('loops', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler();
            });

            describe('while', () => {
                it('should add a call to __energyCheck() in while loops', () => {
                    const result = transpiler.transpile(
                        'while(true) { console.log("Hello"); }'
                    );
                    expect(result).toBe(
                        'while(true) {__energyCheck(); console.log("Hello"); }'
                    );
                });

                it('should add a call to __energyCheck() in inline while loops', () => {
                    const result = transpiler.transpile(
                        'while(true) console.log("Hello");'
                    );

                    expect(result).toBe(
                        'while(true) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should add a call to __energyCheck() in empty while loops', () => {
                    const result = transpiler.transpile('while(true);');
                    expect(result).toBe('while(true)__energyCheck();');
                });

                it('should add a call to __energyCheck() in nested while loops', () => {
                    const result = transpiler.transpile(
                        'while(true) { while(true) {} }'
                    );
                    expect(result).toBe(
                        'while(true) {__energyCheck(); while(true) {__energyCheck();} }'
                    );
                });

                it('should add a call to __energyCheck() in inline nested while loops', () => {
                    const result = transpiler.transpile(
                        'while(true) while(true) {}'
                    );
                    expect(result).toBe(
                        'while(true) {__energyCheck();while(true) {__energyCheck();}}'
                    );
                });
            });

            describe('do while', () => {
                it('should add a call to __energyCheck() in do while loops', () => {
                    const result = transpiler.transpile(
                        'do { console.log("Hello"); } while(true)'
                    );

                    expect(result).toBe(
                        'do {__energyCheck(); console.log("Hello"); } while(true)'
                    );
                });

                it('should add a call to __energyCheck() in nested do while loops', () => {
                    const result = transpiler.transpile(
                        'do { do {} while(true); } while(true);'
                    );

                    expect(result).toBe(
                        'do {__energyCheck(); do {__energyCheck();} while(true); } while(true);'
                    );
                });

                it('should support inline do while loops', () => {
                    const result = transpiler.transpile(
                        'do console.log("abc"); while(true);'
                    );

                    expect(result).toBe(
                        'do {__energyCheck();console.log("abc");} while(true);'
                    );
                });

                it('should support empty do while loops', () => {
                    const result = transpiler.transpile('do ; while(true);');

                    expect(result).toBe('do __energyCheck(); while(true);');
                });
            });

            describe('for', () => {
                it('should add a call to __energyCheck() in for loops', () => {
                    const result = transpiler.transpile(
                        'for(let i = 1; i > 0; i++) { console.log("Hello"); }'
                    );
                    expect(result).toBe(
                        'for(let i = 1; i > 0; i++) {__energyCheck(); console.log("Hello"); }'
                    );
                });

                it('should add a call to __energyCheck() in inline for loops', () => {
                    const result = transpiler.transpile(
                        'for(let i = 1; i > 0; i++) console.log("Hello");'
                    );
                    expect(result).toBe(
                        'for(let i = 1; i > 0; i++) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should support for loops that declare a global variable', () => {
                    const result = transpiler.transpile(
                        'for(let i = 1; i > 0; i++) var abc = 123 + i;'
                    );
                    expect(result).toBe(
                        'for(let i = 1; i > 0; i++) {__energyCheck();var abc = 123 + i;}'
                    );
                });

                it('should add a call to __energyCheck() in nested foor loops', () => {
                    const result = transpiler.transpile(
                        'for(;;) { for(;;) {} }'
                    );

                    expect(result).toBe(
                        'for(;;) {__energyCheck(); for(;;) {__energyCheck();} }'
                    );
                });

                it('should support for loops without an init expression', () => {
                    const result = transpiler.transpile(
                        'for(; i > 0; i++) console.log("Hello");'
                    );
                    expect(result).toBe(
                        'for(; i > 0; i++) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should support for loops without a test expression', () => {
                    const result = transpiler.transpile(
                        'for(let i = 0; ; i++) console.log("Hello");'
                    );
                    expect(result).toBe(
                        'for(let i = 0; ; i++) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should support for loops without an update expression', () => {
                    const result = transpiler.transpile(
                        'for(let i = 0; i > 0;) console.log("Hello");'
                    );
                    expect(result).toBe(
                        'for(let i = 0; i > 0;) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should support empty for loops', () => {
                    const result = transpiler.transpile('for(;;) ;');
                    expect(result).toBe('for(;;) __energyCheck();');
                });
            });

            describe('for in', () => {
                it('should add a call to __energyCheck() in for in loops', () => {
                    const result = transpiler.transpile(
                        'for(let key in obj) { console.log("Hello"); }'
                    );
                    expect(result).toBe(
                        'for(let key in obj) {__energyCheck(); console.log("Hello"); }'
                    );
                });

                it('should add a call to __energyCheck() in inline for in loops', () => {
                    const result = transpiler.transpile(
                        'for(let key in obj) console.log("Hello");'
                    );

                    expect(result).toBe(
                        'for(let key in obj) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should preserve existing formatting as much as possible', () => {
                    const result = transpiler.transpile(
                        `for(let key in obj) {
                            console.log("Hello");
                        }`
                    );
                    expect(result).toBe(
                        `for(let key in obj) {__energyCheck();
                            console.log("Hello");
                        }`
                    );
                });

                it('should support inline for of loops without semicolons', () => {
                    const result = transpiler.transpile(
                        'for(let key in arr) console.log("Hello")'
                    );

                    expect(result).toBe(
                        'for(let key in arr) {__energyCheck();console.log("Hello")}'
                    );
                });

                it('should support inline for of loops with comments', () => {
                    const result = transpiler.transpile(
                        'for(let key in arr) /* comment */ console.log("Hello")'
                    );

                    expect(result).toBe(
                        'for(let key in arr) /* comment */ {__energyCheck();console.log("Hello")}'
                    );
                });
            });

            describe('for of', () => {
                it('should add a call to __energyCheck() in for of loops', () => {
                    const result = transpiler.transpile(
                        'for(let key of arr) { console.log("Hello"); }'
                    );

                    expect(result).toBe(
                        'for(let key of arr) {__energyCheck(); console.log("Hello"); }'
                    );
                });

                it('should add a call to __energyCheck() in inline for of loops', () => {
                    const result = transpiler.transpile(
                        'for(let key of arr) console.log("Hello");'
                    );

                    expect(result).toBe(
                        'for(let key of arr) {__energyCheck();console.log("Hello");}'
                    );
                });

                it('should support inline for of loops without semicolons', () => {
                    const result = transpiler.transpile(
                        'for(let key of arr) console.log("Hello")'
                    );

                    expect(result).toBe(
                        'for(let key of arr) {__energyCheck();console.log("Hello")}'
                    );
                });

                it('should support inline for of loops with comments', () => {
                    const result = transpiler.transpile(
                        'for(let key of arr) /* comment */ console.log("Hello")'
                    );

                    expect(result).toBe(
                        'for(let key of arr) /* comment */ {__energyCheck();console.log("Hello")}'
                    );
                });
            });
        });

        describe('jsx', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler({
                    jsxFactory: 'h',
                    jsxFragment: 'Fragment',
                });
            });

            it('should convert basic JSX to preact code', () => {
                const result = transpiler.transpile('<div>Hello</div>');

                expect(result).toBe('h("div",null,`Hello`,)');
            });

            it('should convert basic JSX attributes to preact code', () => {
                const result = transpiler.transpile(
                    '<div val="123" other="str">Hello</div>'
                );

                expect(result).toBe(
                    'h("div",{ "val":"123" ,"other":"str"},`Hello`,)'
                );
            });

            it('should preserve whitespace as much as possible', () => {
                const result = transpiler.transpile(
                    [
                        `<div `,
                        `  val="123" `,
                        `  other="str">`,
                        `  Hello`,
                        `</div>`,
                    ].join('\n')
                );

                expect(result).toBe(
                    [
                        `h("div",{ `,
                        `  "val":"123" `,
                        `  ,"other":"str"},\``,
                        `  Hello`,
                        `\`,)`,
                    ].join('\n')
                );
            });

            it('should support nested elements', () => {
                const result = transpiler.transpile(
                    '<div><h1>Hello, World!</h1></div>'
                );

                expect(result).toBe(
                    `h("div",null,h("h1",null,\`Hello, World!\`,),)`
                );
            });

            it('should support elements with text and other elements', () => {
                const result = transpiler.transpile(
                    [
                        `<div>`,
                        `  Some text`,
                        `  <h1>Hello, World!</h1>`,
                        `</div>`,
                    ].join('\n')
                );

                expect(result).toBe(
                    [
                        'h("div",null,`',
                        `  Some text`,
                        '  `,h("h1",null,`Hello, World!`,),`',
                        '`,)',
                    ].join('\n')
                );
            });

            it('should support expressions in attributes', () => {
                const result = transpiler.transpile(`<div abc={123}></div>`);

                expect(result).toBe(`h("div",{ "abc":123},)`);
            });

            it('should support JSX in attributes', () => {
                const result = transpiler.transpile(
                    `<div abc={<h1>Hello</h1>}></div>`
                );

                expect(result).toBe(
                    `h("div",{ "abc":h("h1",null,\`Hello\`,)},)`
                );
            });

            it('should support expressions as children', () => {
                const result = transpiler.transpile(`<div>{123}</div>`);

                expect(result).toBe(`h("div",null,123,)`);
            });

            it('should support multiple expressions as children', () => {
                const result = transpiler.transpile(
                    `<div>{123}{true}{false}{'abc'}{{ obj: true }}</div>`
                );

                expect(result).toBe(
                    `h("div",null,123,true,false,'abc',{ obj: true },)`
                );
            });

            it('should make capitalized elements variable references', () => {
                const result = transpiler.transpile(
                    `<Button>My Button</Button>`
                );

                expect(result).toBe(`h(Button,null,\`My Button\`,)`);
            });

            it('should support fragments', () => {
                const result = transpiler.transpile(`<>My Button</>`);

                expect(result).toBe(`h(Fragment,null,\`My Button\`,)`);
            });

            it('should support fragments with multiple children', () => {
                const result = transpiler.transpile(
                    [`<>`, `<div></div>`, `<button></button>`, `</>`].join('')
                );

                expect(result).toBe(
                    `h(Fragment,null,h("div",null,),h("button",null,),)`
                );
            });

            it('should support the attribute spread syntax', () => {
                const result = transpiler.transpile(
                    `<div {...myAttribute}></div>`
                );

                expect(result).toBe(`h("div",{ ...myAttribute},)`);
            });

            it('should apply spread attributes in the order they are provided compared to normal attributes', () => {
                const result = transpiler.transpile(
                    `<div name="bob" {...myAttribute} value="123"></div>`
                );

                expect(result).toBe(
                    `h("div",{ "name":"bob" ,...myAttribute ,"value":"123"},)`
                );
            });

            it('should support additional expressions in a spread attribute', () => {
                const result = transpiler.transpile(
                    `<div {...{ bob: true, value: 123 }}></div>`
                );

                expect(result).toBe(
                    `h("div",{ ...{ bob: true, value: 123 }},)`
                );
            });

            it('should support elements in spread attributes', () => {
                const result = transpiler.transpile(
                    `<div {...{ bob: <button></button> }}></div>`
                );

                expect(result).toBe(
                    `h("div",{ ...{ bob: h("button",null,) }},)`
                );
            });

            it('should support attributes with no value', () => {
                const result = transpiler.transpile(`<div bob></div>`);

                expect(result).toBe(`h("div",{ "bob":true},)`);
            });

            // const cases = [];

            // it.each(cases)('%s', (desc, given, expected) => {
            //     const result = transpiler.transpile(
            //         given
            //     );

            //     expect(result).toBe(
            //         expected
            //     );
            // });
        });

        it('should support dynamic import statements', () => {
            const transpiler = new Transpiler();
            const result = transpiler.transpile('import("test");');
            expect(result.trim()).toEqual('import("test");');
        });
    });

    describe('replaceMacros()', () => {
        it('should remove the 🧬 character from the front', () => {
            expect(replaceMacros(`${DNA_TAG_PREFIX}${DNA_TAG_PREFIX}`)).toEqual(
                '🧬'
            );
        });

        it('should convert curly quotes to normal quotes', () => {
            expect(replaceMacros('’')).toEqual("'");
            expect(replaceMacros('‘')).toEqual("'");
            expect(replaceMacros('”')).toEqual('"');
            expect(replaceMacros('“')).toEqual('"');
        });
    });
});

describe('calculateOriginalLineLocation()', () => {
    let doc: Doc;
    let text: Text;
    let original: string;

    beforeEach(() => {
        doc = new Doc();
        doc.clientID = 0;
        original = 'abcdef\nghijfk\nlmn';
        text = doc.getText();
        text.insert(0, original);
    });

    it('should return the given location if the text was only edited by client 0', () => {
        const location = calculateOriginalLineLocation(getResult(), {
            lineNumber: 1,
            column: 1,
        });

        expect(location).toEqual({
            lineNumber: 1,
            column: 1,
        });
    });

    it('should return the closest edit from client 0 that is left of the given location', () => {
        doc.clientID = 1;
        text.insert(1, '1');
        text.insert(9, '9999');
        // text looks like "a1bcdef\ng9999hijfk\nlmn"

        const location = calculateOriginalLineLocation(getResult(), {
            lineNumber: 1,
            column: 2,
        });

        expect(location).toEqual({
            lineNumber: 1,
            column: 1,
        });
    });

    function getResult() {
        return {
            code: text.toString(),
            original,
            metadata: {
                doc,
                text,
            },
        } as TranspilerResult;
    }
});

const locationCases = [
    [
        'should support getting the first position',
        '',
        {
            lineNumber: 0,
            column: 0,
        },
        0,
    ],
    [
        'should support getting the last position in a single line',
        'abcdef',
        {
            lineNumber: 0,
            column: 6,
        },
        6,
    ],
    [
        'should support getting a position in the second line',
        'abcdef\nghijfk',
        {
            lineNumber: 1,
            column: 2,
        },
        9,
    ],
    [
        'should support getting the last position in the second line',
        'abcdef\nghijfk',
        {
            lineNumber: 1,
            column: 6,
        },
        13,
    ],
    [
        'should support the first position after a line ending',
        'abcdef\nghijfk',
        {
            lineNumber: 1,
            column: 0,
        },
        7,
    ],
    [
        'should support windows line endings',
        'abcdef\r\nghijfk',
        {
            lineNumber: 1,
            column: 0,
        },
        8,
    ],
] as const;

describe('calculateIndexFromLocation()', () => {
    it.each(locationCases)('%s', (desc, code, location, index) => {
        const result = calculateIndexFromLocation(code, location);
        expect(result).toBe(index);
    });
});

describe('calculateLocationFromIndex()', () => {
    it.each(locationCases)('%s', (desc, code, location, index) => {
        const result = calculateLocationFromIndex(code, index);
        expect(result).toEqual(location);
    });
});
