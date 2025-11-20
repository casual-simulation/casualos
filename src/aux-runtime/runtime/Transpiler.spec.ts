/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type { Text } from 'yjs';
import { Doc } from 'yjs';
import { DNA_TAG_PREFIX } from '@casual-simulation/aux-common';
import type { TranspilerResult } from './Transpiler';
import {
    Transpiler,
    replaceMacros,
    calculateOriginalLineLocation,
    calculateFinalLineLocation,
} from './Transpiler';
import {
    calculateIndexFromLocation,
    calculateLocationFromIndex,
} from './TranspilerUtils';

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

            it('should support dot notation in element names', () => {
                const result = transpiler.transpile(
                    `<Html.Button></Html.Button>`
                );

                expect(result).toBe(`h(Html.Button,null,)`);
            });

            it('should leave HTML escaped character sequences in text', () => {
                const result = transpiler.transpile(`<p>10 is &lt; 20</p>`);

                expect(result).toBe(`h("p",null,\`10 is &lt; 20\`,)`);
            });

            it('should support self closing elements', () => {
                const result = transpiler.transpile(`<span/>`);

                expect(result).toBe(`h("span",null,)`);
            });

            it('should support self closing elements with attributes', () => {
                const result = transpiler.transpile(`<span attribute={123} />`);
                const result2 = transpiler.transpile(`<span attribute={123}/>`);
                const result3 = transpiler.transpile(
                    `<span attribute={123} attribute2="hello"/>`
                );

                expect(result).toBe(`h("span",{ "attribute":123 },)`);
                expect(result2).toBe(`h("span",{ "attribute":123},)`);
                expect(result3).toBe(
                    `h("span",{ "attribute":123 ,"attribute2":"hello"},)`
                );
            });

            it('should support self closing elements with function expressions', () => {
                const result = transpiler.transpile(
                    `<input onInput={(e) => console.log("Hello!")} />`
                );
                const result2 = transpiler.transpile(
                    `<input onInput={(e) => console.log("Hello!")}/>`
                );
                const result3 = transpiler.transpile(
                    `<input onInput={(e) => console.log("Hello!")} name="test"/>`
                );

                expect(result).toBe(
                    `h("input",{ "onInput":(e) => console.log("Hello!") },)`
                );
                expect(result2).toBe(
                    `h("input",{ "onInput":(e) => console.log("Hello!")},)`
                );
                expect(result3).toBe(
                    `h("input",{ "onInput":(e) => console.log("Hello!") ,"name":"test"},)`
                );
            });

            it('should not break multi-line loops', () => {
                const result = transpiler.transpile(
                    [
                        `let el = <div>`,
                        `  Some text`,
                        `  <h1>Hello, World!</h1>`,
                        `</div>`,
                        `for(let abc of def) {`,
                        `  let test = {`,
                        `    value: abc`,
                        `  };`,
                        `}`,
                    ].join('\n')
                );

                expect(result).toBe(
                    [
                        'let el = h("div",null,`',
                        `  Some text`,
                        '  `,h("h1",null,`Hello, World!`,),`',
                        '`,)',
                        `for(let abc of def) {__energyCheck();`,
                        `  let test = {`,
                        `    value: abc`,
                        `  };`,
                        `}`,
                    ].join('\n')
                );
            });

            it('should not break single-line loops', () => {
                const result = transpiler.transpile(
                    [
                        `let el = <div>`,
                        `  Some text`,
                        `  <h1>Hello, World!</h1>`,
                        `</div>`,
                        `for(let abc of def) console.log("abc")`,
                    ].join('\n')
                );

                expect(result).toBe(
                    [
                        'let el = h("div",null,`',
                        `  Some text`,
                        '  `,h("h1",null,`Hello, World!`,),`',
                        '`,)',
                        `for(let abc of def) {__energyCheck();console.log("abc")}`,
                    ].join('\n')
                );
            });

            it('should not break multi-line loops that have no braces', () => {
                const result = transpiler.transpile(
                    [
                        `let el = <div>`,
                        `  Some text`,
                        `  <h1>Hello, World!</h1>`,
                        `</div>`,
                        `for(let abc of def)`,
                        `  console.log("abc")`,
                    ].join('\n')
                );

                expect(result).toBe(
                    [
                        'let el = h("div",null,`',
                        `  Some text`,
                        '  `,h("h1",null,`Hello, World!`,),`',
                        '`,)',
                        `for(let abc of def)`,
                        `  {__energyCheck();console.log("abc")}`,
                    ].join('\n')
                );
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

            it('should support async callbacks', () => {
                const result = transpiler.transpile(
                    `<span onClick={ async () => { await os.tip("Hello!"); } }></span>`
                );

                expect(result).toBe(
                    `h("span",{ "onClick": async () => { await os.tip("Hello!"); } },)`
                );
            });

            it('should support empty expressions nested in elements', () => {
                const result = transpiler.transpile(`<span>{}</span>`);

                expect(result).toBe(`h("span",null,'',)`);
            });

            it('should support comment expressions', () => {
                const result = transpiler.transpile(
                    `<span>{/**This is a comment*/}</span>`
                );

                expect(result).toBe(`h("span",null,'',)`);
            });

            it('should support multi-line comment expressions', () => {
                const result = transpiler.transpile(
                    `<span>{/**This is a comment
                        that spans multiple lines
                    */}</span>`
                );

                expect(result).toBe(`h("span",null,'',)`);
            });
        });

        it('should support dynamic import statements', () => {
            const transpiler = new Transpiler();
            const result = transpiler.transpile('import("test");');
            expect(result.trim()).toEqual('importModule("test", importMeta);');
        });

        it('should compile in strict mode for keywords', () => {
            const transpiler = new Transpiler();

            // "public" is a strict mode keyword
            expect(() => {
                transpiler.transpile('let public = "abc";');
            }).toThrow();
        });

        describe('async', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler();
            });

            it('should be able to compile await statements', () => {
                const result = transpiler.transpile(`await test();`);

                expect(result).toBe(`await test();`);
            });

            it('should identify code with a top-level await expression as async', () => {
                const result =
                    transpiler.transpileWithMetadata(`await test();`);

                expect(result.metadata.isAsync).toBe(true);
            });

            it('should identify code with await inside brackets as async', () => {
                const result = transpiler.transpileWithMetadata(`{
                    await test();
                }`);

                expect(result.metadata.isAsync).toBe(true);
            });

            it('should identify variables that await their definitions as async', () => {
                const result = transpiler.transpileWithMetadata(
                    `let abc = await test();`
                );

                expect(result.metadata.isAsync).toBe(true);
            });

            it('should identify await statements in function arguments as async', () => {
                const result =
                    transpiler.transpileWithMetadata(`abc( await test() );`);

                expect(result.metadata.isAsync).toBe(true);
            });

            it('should identify code with await inside a function as synchronous', () => {
                const result = transpiler.transpileWithMetadata(
                    'async function abc() { await test(); }'
                );

                expect(result.metadata.isAsync).toBe(false);
            });

            it('should identify code with await inside a lambda function as synchronous', () => {
                const result = transpiler.transpileWithMetadata(
                    'const abc = async () => await test();'
                );

                expect(result.metadata.isAsync).toBe(false);
            });
        });

        describe('force sync', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler({
                    forceSync: true,
                });
            });

            it('should be able to compile out async/await keywords on function declarations', () => {
                const result = transpiler.transpile(
                    `async function abc() {
                        await test();
                    }`
                );

                expect(result).toBe(
                    `function abc() {
                        test();
                    }`
                );
            });

            it('should be able to compile out async/await keywords in lambda functions', () => {
                const result = transpiler.transpile(
                    `let abc = async () => {
                        await test();
                    };`
                );

                expect(result).toBe(
                    `let abc = () => {
                        test();
                    };`
                );
            });

            it('should be able to compile out await keywords in complex expressions', () => {
                const result = transpiler.transpile(
                    `async function abc() {
                        let result = await fun() + await test();
                    }`
                );

                expect(result).toBe(
                    `function abc() {
                        let result = fun() + test();
                    }`
                );
            });

            it('should be able to compile out nested awaits', () => {
                const result = transpiler.transpile(
                    `async function abc() {
                        await (await (await abc()));
                    }`
                );

                expect(result).toBe(
                    `function abc() {
                        ((abc()));
                    }`
                );
            });

            it('should be able to compile out async function expressions', () => {
                const result = transpiler.transpile(
                    `let abc = async function() {}`
                );

                expect(result).toBe(`let abc = function() {}`);
            });

            it('should be able to compile out async functions in object declarations', () => {
                const result = transpiler.transpile(
                    `let abc = {
                        fun: 123,
                        async test() {},
                        cool: true,
                    }`
                );

                expect(result).toBe(
                    `let abc = {
                        fun: 123,
                        test() {},
                        cool: true,
                    }`
                );
            });

            it('should do nothing if forceSync is not specified', () => {
                transpiler = new Transpiler({
                    forceSync: false,
                });
                const result = transpiler.transpile(
                    `async function abc() {
                        await test();
                    }`
                );

                expect(result).toBe(
                    `async function abc() {
                        await test();
                    }`
                );
            });
        });

        describe('imports', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler({});
            });

            it('should be able to compile simple import statements', () => {
                const result = transpiler.transpile(`import "test";`);

                expect(result).toBe(`await importModule("test", importMeta);`);
            });

            it('should be able to compile dynamic import statements', () => {
                const result = transpiler.transpile(`await import("test");`);

                expect(result).toBe(`await importModule("test", importMeta);`);
            });

            it('should not mark dynamic import expressions as modules', () => {
                const result =
                    transpiler.transpileWithMetadata(`import("test");`);
                expect(result.metadata.isModule).toBe(false);
            });

            it('should mark the script as a module', () => {
                const result =
                    transpiler.transpileWithMetadata(`import "test";`);

                expect(result.metadata.isModule).toBe(true);
            });

            it('should be able to compile default import statements', () => {
                const result = transpiler.transpile(
                    `import testModule from "test";`
                );

                expect(result).toBe(
                    `const { default: testModule, } = await importModule("test", importMeta);`
                );
            });

            it('should be able to compile named import statements', () => {
                const result = transpiler.transpile(
                    `import { myImport } from "test";`
                );

                expect(result).toBe(
                    `const { myImport, } = await importModule("test", importMeta);`
                );
            });

            it('should support named import statements', () => {
                const result = transpiler.transpile(
                    `import { myImport, myImport2 } from "test";`
                );

                expect(result).toBe(
                    `const { myImport, myImport2, } = await importModule("test", importMeta);`
                );
            });

            it('should support default and named import statements', () => {
                const result = transpiler.transpile(
                    `import defaultImport, { myImport, myImport2 } from "test";`
                );

                expect(result).toBe(
                    `const { default: defaultImport, myImport, myImport2, } = await importModule("test", importMeta);`
                );
            });

            it('should support namespace import statements', () => {
                const result = transpiler.transpile(
                    `import * as everything from "test";`
                );

                expect(result).toBe(
                    `const everything = await importModule("test", importMeta);`
                );
            });

            it('should support named import statements with renaming', () => {
                const result = transpiler.transpile(
                    `import { myImport, myImport2 as otherImport } from "test";`
                );

                expect(result).toBe(
                    `const { myImport, myImport2: otherImport, } = await importModule("test", importMeta);`
                );
            });

            it('should support the default import and namespace import', () => {
                const result = transpiler.transpile(
                    `import MyImport, * as Everything from "test";`
                );

                expect(result).toBe(
                    `const Everything = await importModule("test", importMeta);\nconst { default: MyImport } = Everything;`
                );
            });

            it('should support when the statement doesnt end with a semi-colon', () => {
                const result = transpiler.transpile(
                    `import { myImport, myImport2 as otherImport } from "test"`
                );

                expect(result).toBe(
                    `const { myImport, myImport2: otherImport, } = await importModule("test", importMeta)`
                );
            });

            it('should support multiple import statements', () => {
                const result = transpiler.transpile(
                    `import { myImport, myImport2 as otherImport } from "test";
                     import Module from "test2";`
                );

                expect(result).toBe(
                    `const { myImport, myImport2: otherImport, } = await importModule("test", importMeta);
                     const { default: Module, } = await importModule("test2", importMeta);`
                );
            });

            it('should support other statements after import statments', () => {
                const result = transpiler.transpile(
                    `import { myImport, myImport2 as otherImport } from "test";
                     console.log('abc');`
                );

                expect(result).toBe(
                    `const { myImport, myImport2: otherImport, } = await importModule("test", importMeta);
                     console.log('abc');`
                );
            });

            it('should support other statements before import statments', () => {
                const result = transpiler.transpile(
                    `console.log('abc');
                     import { myImport, myImport2 as otherImport } from "test";`
                );

                expect(result).toBe(
                    `console.log('abc');
                     const { myImport, myImport2: otherImport, } = await importModule("test", importMeta);`
                );
            });

            it('should support using a custom import factory', () => {
                transpiler = new Transpiler({
                    importFactory: 'myImportModule',
                });
                const result = transpiler.transpile(
                    `import { myImport, myImport2 as otherImport } from "test";`
                );

                expect(result).toBe(
                    `const { myImport, myImport2: otherImport, } = await myImportModule("test", importMeta);`
                );
            });

            it('should convert import.meta statements', () => {
                const result = transpiler.transpile(
                    `console.log(import.meta);`
                );

                expect(result).toBe(`console.log(importMeta);`);
            });
        });

        describe('exports', () => {
            let transpiler: Transpiler;

            beforeEach(() => {
                transpiler = new Transpiler({});
            });

            it('should be able to compile object export statements', () => {
                const result = transpiler.transpile(
                    `const value = "test"; export { value };`
                );

                expect(result).toBe(
                    `const value = "test"; await exports({ value, });`
                );
            });

            it('should mark the script as a module', () => {
                const result = transpiler.transpileWithMetadata(
                    `const value = "test"; export { value };`
                );
                expect(result.metadata.isModule).toBe(true);
            });

            it('should be able to compile empty export statements', () => {
                const result = transpiler.transpile(`export { };`);

                expect(result).toBe(`await exports({});`);
            });

            it('should work if the semi-colon is omitted', () => {
                const result = transpiler.transpile(
                    `const value = "test";\nexport { value }`
                );

                expect(result).toBe(
                    `const value = "test";\nawait exports({ value, });`
                );
            });

            it('should work if the space after "export" is omitted', () => {
                const result = transpiler.transpile(
                    `const value = "test";\nexport{ value };`
                );

                expect(result).toBe(
                    `const value = "test";\nawait exports({ value, });`
                );
            });

            it('should be able to compile object export statements with aliases', () => {
                const result = transpiler.transpile(
                    `const value = "test"; export { value as otherValue };`
                );

                expect(result).toBe(
                    `const value = "test"; await exports({ otherValue: value, });`
                );
            });

            it('should be able to compile variable export statements', () => {
                const result = transpiler.transpile(
                    `export const value = "test";`
                );

                expect(result).toBe(
                    `const value = "test";\nawait exports({ value, });`
                );
            });

            it('should be able to compile multiple variable export statements', () => {
                const result = transpiler.transpile(
                    `export const value = "test", value2 = 123;`
                );

                expect(result).toBe(
                    `const value = "test", value2 = 123;\nawait exports({ value, value2, });`
                );
            });

            it('should be able to compile mutable variable statements', () => {
                const result = transpiler.transpile(
                    `export let value = "test";`
                );

                expect(result).toBe(
                    `let value = "test";\nawait exports({ value, });`
                );
            });

            it('should be able to compile function export statements', () => {
                const result = transpiler.transpile(
                    `export function myFunc() { return "test"; }`
                );

                expect(result).toBe(
                    `function myFunc() { return "test"; }\nawait exports({ myFunc, });`
                );
            });

            it('should be able to compile default export statements', () => {
                const result = transpiler.transpile(`export default "test";`);

                expect(result).toBe(`await exports({ default: "test" });`);
            });

            it('should be able to compile empty export from source statements', () => {
                const result = transpiler.transpile(`export {} from "test";`);

                expect(result).toBe(`await exports({});`);
            });

            it('should be able to compile export all statements', () => {
                const result = transpiler.transpile(`export * from "test";`);

                expect(result).toBe(`await exports("test");`);
            });

            it('should be able to compile export object from source statements', () => {
                const result = transpiler.transpile(
                    `export { value, value2 } from "test";`
                );

                expect(result).toBe(
                    `await exports("test", ['value', 'value2', ]);`
                );
            });

            it('should be able to compile export object statements from source with aliases', () => {
                const result = transpiler.transpile(
                    `export { value as example, value2 } from "test";`
                );

                expect(result).toBe(
                    `await exports("test", [['value', 'example'], 'value2', ]);`
                );
            });

            it('should use the given exportFactory', () => {
                transpiler = new Transpiler({
                    exportFactory: 'myExport',
                });
                const result = transpiler.transpile(
                    `export { value as example, value2 } from "test";`
                );

                expect(result).toBe(
                    `await myExport("test", [['value', 'example'], 'value2', ]);`
                );
            });

            it('should properly transpile exports with statements directly after them', () => {
                const result = transpiler.transpile(
                    `const abc = 12;export {abc};callFunction();`
                );

                expect(result).toBe(
                    `const abc = 12;await exports({ abc, });callFunction();`
                );
            });

            it('should properly transpile empty exports with statements directly after them', () => {
                const result = transpiler.transpile(
                    `const abc = 12;export {};callFunction();`
                );

                expect(result).toBe(
                    `const abc = 12;await exports({});callFunction();`
                );
            });

            it('should properly transpile empty exports from source with statements directly after them', () => {
                const result = transpiler.transpile(
                    `const abc = 12;export {} from "test";callFunction();`
                );

                expect(result).toBe(
                    `const abc = 12;await exports({});callFunction();`
                );
            });

            it('should properly transpile function exports with statements immediately afterwards', () => {
                const result = transpiler.transpile(
                    `export function func1() {return 123;}async function A(){}`
                );

                expect(result).toBe(
                    `function func1() {return 123;}\nawait exports({ func1, });async function A(){}`
                );
            });

            it('should properly transpile variable exports with statements immediately afterwards', () => {
                const result = transpiler.transpile(
                    `export var abc=123;async function A(){}`
                );

                expect(result).toBe(
                    `var abc=123;\nawait exports({ abc, });async function A(){}`
                );
            });

            it('should properly transpile variable exports without semicolons', () => {
                const result = transpiler.transpile(
                    `export var abc=123\nasync function A(){}`
                );

                expect(result).toBe(
                    `var abc=123\nawait exports({ abc, });\nasync function A(){}`
                );
            });
        });

        it('should support return statements outside of functions', () => {
            const transpiler = new Transpiler();
            const result = transpiler.transpile('return 123;');

            expect(result).toBe('return 123;');
        });

        describe('typescript', () => {
            it('should remove type annotations from variable declarations', () => {
                const transpiler = new Transpiler();

                // number
                expect(transpiler.transpile(`let abc = 123;`)).toBe(
                    `let abc = 123;`
                );
                expect(transpiler.transpile(`let abc: number = 123;`)).toBe(
                    `let abc = 123;`
                );
                expect(transpiler.transpile(`var abc = 123;`)).toBe(
                    `var abc = 123;`
                );
                expect(transpiler.transpile(`var abc: number = 123;`)).toBe(
                    `var abc = 123;`
                );
                expect(transpiler.transpile(`const abc = 123;`)).toBe(
                    `const abc = 123;`
                );
                expect(transpiler.transpile(`const abc: number = 123;`)).toBe(
                    `const abc = 123;`
                );

                // string
                expect(transpiler.transpile(`let abc = "def";`)).toBe(
                    `let abc = "def";`
                );
                expect(transpiler.transpile(`let abc: string = "def";`)).toBe(
                    `let abc = "def";`
                );
                expect(transpiler.transpile(`var abc = "def";`)).toBe(
                    `var abc = "def";`
                );
                expect(transpiler.transpile(`var abc: string = "def";`)).toBe(
                    `var abc = "def";`
                );
                expect(transpiler.transpile(`const abc = "def";`)).toBe(
                    `const abc = "def";`
                );
                expect(transpiler.transpile(`const abc: string = "def";`)).toBe(
                    `const abc = "def";`
                );

                // boolean
                expect(transpiler.transpile(`let abc = true;`)).toBe(
                    `let abc = true;`
                );
                expect(transpiler.transpile(`let abc: boolean = true;`)).toBe(
                    `let abc = true;`
                );
                expect(transpiler.transpile(`var abc = true;`)).toBe(
                    `var abc = true;`
                );
                expect(transpiler.transpile(`var abc: boolean = true;`)).toBe(
                    `var abc = true;`
                );
                expect(transpiler.transpile(`const abc = true;`)).toBe(
                    `const abc = true;`
                );
                expect(transpiler.transpile(`const abc: boolean = true;`)).toBe(
                    `const abc = true;`
                );

                // any
                expect(transpiler.transpile(`let abc = 123;`)).toBe(
                    `let abc = 123;`
                );
                expect(transpiler.transpile(`let abc: any = 123;`)).toBe(
                    `let abc = 123;`
                );
                expect(transpiler.transpile(`var abc = 123;`)).toBe(
                    `var abc = 123;`
                );
                expect(transpiler.transpile(`var abc: any = 123;`)).toBe(
                    `var abc = 123;`
                );
                expect(transpiler.transpile(`const abc = 123;`)).toBe(
                    `const abc = 123;`
                );
                expect(transpiler.transpile(`const abc: any = 123;`)).toBe(
                    `const abc = 123;`
                );

                // object
                expect(transpiler.transpile(`let abc = {};`)).toBe(
                    `let abc = {};`
                );
                expect(transpiler.transpile(`let abc: object = {};`)).toBe(
                    `let abc = {};`
                );
                expect(transpiler.transpile(`var abc = {};`)).toBe(
                    `var abc = {};`
                );
                expect(transpiler.transpile(`var abc: object = {};`)).toBe(
                    `var abc = {};`
                );
                expect(transpiler.transpile(`const abc = {};`)).toBe(
                    `const abc = {};`
                );
                expect(transpiler.transpile(`const abc: object = {};`)).toBe(
                    `const abc = {};`
                );

                // arrow function
                expect(transpiler.transpile(`let abc = () => 123;`)).toBe(
                    `let abc = () => 123;`
                );
                expect(
                    transpiler.transpile(`let abc: () => number = () => 123;`)
                ).toBe(`let abc = () => 123;`);
                expect(transpiler.transpile(`var abc = () => 123;`)).toBe(
                    `var abc = () => 123;`
                );
                expect(
                    transpiler.transpile(`var abc: () => number = () => 123;`)
                ).toBe(`var abc = () => 123;`);
                expect(transpiler.transpile(`const abc = () => 123;`)).toBe(
                    `const abc = () => 123;`
                );
                expect(
                    transpiler.transpile(`const abc: () => number = () => 123;`)
                ).toBe(`const abc = () => 123;`);

                // as const
                expect(
                    transpiler.transpile(`let abc = { one: 1, two: 2 };`)
                ).toBe(`let abc = { one: 1, two: 2 };`);
                expect(
                    transpiler.transpile(
                        `let abc = { one: 1, two: 2 } as const;`
                    )
                ).toBe(`let abc = { one: 1, two: 2 };`);
                expect(
                    transpiler.transpile(
                        `var abc = { one: 1, two: 2 } as const;`
                    )
                ).toBe(`var abc = { one: 1, two: 2 };`);
                expect(
                    transpiler.transpile(
                        `var abc = { one: 1, two: 2 } as const;`
                    )
                ).toBe(`var abc = { one: 1, two: 2 };`);
                expect(
                    transpiler.transpile(
                        `const abc = { one: 1, two: 2 } as const;`
                    )
                ).toBe(`const abc = { one: 1, two: 2 };`);
                expect(
                    transpiler.transpile(
                        `const abc = { one: 1, two: 2 } as const;`
                    )
                ).toBe(`const abc = { one: 1, two: 2 };`);
            });

            describe('function', () => {
                it('should remove type annotations from simple function declarations', () => {
                    const transpiler = new Transpiler();

                    // simple number
                    expect(
                        transpiler.transpile(`function abc() {
                        return 123;
                    }`)
                    ).toBe(`function abc() {
                        return 123;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(): number {
                        return 123;
                    }`)
                    ).toBe(`function abc() {
                        return 123;
                    }`);

                    // string
                    expect(
                        transpiler.transpile(`function abc() {
                        return "def";
                    }`)
                    ).toBe(`function abc() {
                        return "def";
                    }`);
                    expect(
                        transpiler.transpile(`function abc(): string {
                        return "def";
                    }`)
                    ).toBe(`function abc() {
                        return "def";
                    }`);

                    // boolean
                    expect(
                        transpiler.transpile(`function abc() {
                        return true;
                    }`)
                    ).toBe(`function abc() {
                        return true;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(): boolean {
                        return true;
                    }`)
                    ).toBe(`function abc() {
                        return true;
                    }`);

                    // any
                    expect(
                        transpiler.transpile(`function abc() {
                        return 123;
                    }`)
                    ).toBe(`function abc() {
                        return 123;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(): any {
                        return 123;
                    }`)
                    ).toBe(`function abc() {
                        return 123;
                    }`);

                    // object
                    expect(
                        transpiler.transpile(`function abc() {
                        return {};
                    }`)
                    ).toBe(`function abc() {
                        return {};
                    }`);
                    expect(
                        transpiler.transpile(`function abc(): object {
                        return {};
                    }`)
                    ).toBe(`function abc() {
                        return {};
                    }`);
                });

                it('should remove type annotations from single parameter function declarations', () => {
                    const transpiler = new Transpiler();

                    // simple number
                    expect(
                        transpiler.transpile(`function abc(n) {
                        return 123;
                    }`)
                    ).toBe(`function abc(n) {
                        return 123;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(n: number): number {
                        return 123;
                    }`)
                    ).toBe(`function abc(n) {
                        return 123;
                    }`);

                    // string
                    expect(
                        transpiler.transpile(`function abc(n) {
                        return "def";
                    }`)
                    ).toBe(`function abc(n) {
                        return "def";
                    }`);
                    expect(
                        transpiler.transpile(`function abc(n: number): string {
                        return "def";
                    }`)
                    ).toBe(`function abc(n) {
                        return "def";
                    }`);

                    // boolean
                    expect(
                        transpiler.transpile(`function abc(n) {
                        return true;
                    }`)
                    ).toBe(`function abc(n) {
                        return true;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(n: number): boolean {
                        return true;
                    }`)
                    ).toBe(`function abc(n) {
                        return true;
                    }`);

                    // any
                    expect(
                        transpiler.transpile(`function abc(n) {
                        return 123;
                    }`)
                    ).toBe(`function abc(n) {
                        return 123;
                    }`);
                    expect(
                        transpiler.transpile(`function abc(n: number): any {
                        return 123;
                    }`)
                    ).toBe(`function abc(n) {
                        return 123;
                    }`);

                    // object
                    expect(
                        transpiler.transpile(`function abc(n) {
                        return {};
                    }`)
                    ).toBe(`function abc(n) {
                        return {};
                    }`);
                    expect(
                        transpiler.transpile(`function abc(n: number): object {
                        return {};
                    }`)
                    ).toBe(`function abc(n) {
                        return {};
                    }`);
                });

                it('should remove type guard annotations', () => {
                    const transpiler = new Transpiler();

                    expect(
                        transpiler.transpile(`function abc(n: unknown): n is number {
                        return typeof n === "number";
                    }`)
                    ).toBe(`function abc(n) {
                        return typeof n === "number";
                    }`);
                });

                it('should remove assert annotations', () => {
                    const transpiler = new Transpiler();

                    expect(
                        transpiler.transpile(`function abc(n: unknown): asserts n is number {
                        return typeof n === "number";
                    }`)
                    ).toBe(`function abc(n) {
                        return typeof n === "number";
                    }`);
                });

                it('should remove generic type arguments', () => {
                    const transpiler = new Transpiler();

                    expect(
                        transpiler.transpile(`function abc<T>(n: T): T {
                        return n;
                    }`)
                    ).toBe(`function abc(n) {
                        return n;
                    }`);
                });

                it('should remove optional indicators', () => {
                    const transpiler = new Transpiler();

                    expect(
                        transpiler.transpile(`function abc(n?: number): number {
                        return n;
                    }`)
                    ).toBe(`function abc(n) {
                        return n;
                    }`);
                });
            });

            it('should remove interface declarations', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `interface ABC { hello: number; name: string; }`
                    )
                ).toBe(`const ABC = void 0;`);

                // With extends
                expect(
                    transpiler.transpile(
                        `interface First {} interface ABC extends First { hello: number; name: string; }`
                    )
                ).toBe(`const First = void 0; const ABC = void 0;`);

                // With new()
                expect(
                    transpiler.transpile(`interface ABC { new(val: any); }`)
                ).toBe(`const ABC = void 0;`);

                // With call()
                expect(
                    transpiler.transpile(`interface ABC { (val: any): void; }`)
                ).toBe(`const ABC = void 0;`);

                // With generics
                expect(
                    transpiler.transpile(`interface ABC<T> { val: T }`)
                ).toBe(`const ABC = void 0;`);

                // With export
                expect(
                    transpiler.transpile(`export interface ABC<T> { val: T }`)
                ).toBe(`const ABC = void 0;\nawait exports({ ABC, });`);

                // With separate export
                expect(
                    transpiler.transpile(
                        `interface ABC<T> { val: T }\nexport { ABC };`
                    )
                ).toBe(`const ABC = void 0;\nawait exports({ ABC, });`);
            });

            it('should remove type declarations', () => {
                const transpiler = new Transpiler();
                expect(transpiler.transpile(`type ABC = number;`)).toBe(
                    `const ABC = void 0;`
                );
                expect(transpiler.transpile(`export type ABC = number;`)).toBe(
                    `const ABC = void 0;\nawait exports({ ABC, });`
                );

                // With generics
                expect(transpiler.transpile(`type ABC<T> = { val: T }`)).toBe(
                    `const ABC = void 0;`
                );
            });

            it('should remove import type declarations', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(`import type { ABC } from "module";`)
                ).toBe(`const { ABC, } = {};`);

                expect(
                    transpiler.transpile(
                        `import type { ABC, DEF, GHI as other } from "module";`
                    )
                ).toBe(`const { ABC, DEF, GHI: other, } = {};`);
            });

            it('should remove module declarations', () => {
                const transpiler = new Transpiler();
                expect(transpiler.transpile(`module ABC {}`)).toBe(``);
            });

            it('should remove union type declarations', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(`type ABC = number | string;`)
                ).toBe(`const ABC = void 0;`);
                expect(
                    transpiler.transpile(`export type ABC = number | string;`)
                ).toBe(`const ABC = void 0;\nawait exports({ ABC, });`);
            });

            it('should remove enum type declarations', () => {
                const transpiler = new Transpiler();
                expect(transpiler.transpile(`enum ABC { One, Two }`)).toBe(
                    `const ABC = void 0;`
                );
                expect(
                    transpiler.transpile(`export enum ABC { One, Two }`)
                ).toBe(`const ABC = void 0;\nawait exports({ ABC, });`);
            });

            it('should remove type casts', () => {
                const transpiler = new Transpiler();
                expect(transpiler.transpile(`let abc = 123 as any;`)).toBe(
                    `let abc = 123;`
                );
            });

            it('should remove implements expressions from class declarations and expressions', () => {
                const transpiler = new Transpiler();

                // Single
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string}; class Test implements ABC {}`
                    )
                ).toBe(`const ABC = void 0;; class Test  {}`);
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string}; let c = class Test implements ABC {}`
                    )
                ).toBe(`const ABC = void 0;; let c = class Test  {}`);

                // Two
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string } interface DEF {} class Test implements ABC, DEF {}`
                    )
                ).toBe(
                    `const ABC = void 0; const DEF = void 0; class Test  {}`
                );
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string } interface DEF {} let c = class Test implements ABC, DEF {}`
                    )
                ).toBe(
                    `const ABC = void 0; const DEF = void 0; let c = class Test  {}`
                );

                // Two with extends
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string } interface DEF {} class Base {} class Test extends Base implements ABC, DEF {}`
                    )
                ).toBe(
                    `const ABC = void 0; const DEF = void 0; class Base {} class Test extends Base  {}`
                );
                expect(
                    transpiler.transpile(
                        `interface ABC { name: string } interface DEF {} class Base {} let c = class Test extends Base implements ABC, DEF {}`
                    )
                ).toBe(
                    `const ABC = void 0; const DEF = void 0; class Base {} let c = class Test extends Base  {}`
                );
            });

            it('should remove method declaration visbility modifiers from classes', () => {
                const transpiler = new Transpiler();

                // private
                expect(
                    transpiler.transpile(
                        `class Test { private abc(): void {} }`
                    )
                ).toBe(`class Test { abc() {} }`);

                // public
                expect(
                    transpiler.transpile(`class Test { public abc(): void {} }`)
                ).toBe(`class Test { abc() {} }`);

                // private abstract
                expect(
                    transpiler.transpile(
                        `abstract class Test { private abstract abc(): void; }`
                    )
                ).toBe(`class Test {  }`);

                // public abstract
                expect(
                    transpiler.transpile(
                        `abstract class Test { public abstract abc(): void; }`
                    )
                ).toBe(`class Test {  }`);

                // abstract private
                expect(
                    transpiler.transpile(
                        `abstract class Test { abstract private abc(): void; }`
                    )
                ).toBe(`class Test {  }`);

                // abstract public
                expect(
                    transpiler.transpile(
                        `abstract class Test { abstract public abc(): void; }`
                    )
                ).toBe(`class Test {  }`);

                // private static
                expect(
                    transpiler.transpile(
                        `class Test { private static abc(): void {} }`
                    )
                ).toBe(`class Test { static abc() {} }`);

                // public static
                expect(
                    transpiler.transpile(
                        `class Test { public static abc(): void {} }`
                    )
                ).toBe(`class Test { static abc() {} }`);

                // private get
                expect(
                    transpiler.transpile(
                        `class Test { private get abc(): number { return 123; } }`
                    )
                ).toBe(`class Test { get abc() { return 123; } }`);

                // public get
                expect(
                    transpiler.transpile(
                        `class Test { public get abc(): number { return 123; } }`
                    )
                ).toBe(`class Test { get abc() { return 123; } }`);

                // private static get
                expect(
                    transpiler.transpile(
                        `class Test { private static get abc(): number { return 123; } }`
                    )
                ).toBe(`class Test { static get abc() { return 123; } }`);

                // public  static get
                expect(
                    transpiler.transpile(
                        `class Test { public static get abc(): number { return 123; } }`
                    )
                ).toBe(`class Test { static get abc() { return 123; } }`);

                // private abstract get
                expect(
                    transpiler.transpile(
                        `abstract class Test { private abstract get abc(): number; }`
                    )
                ).toBe(`class Test {  }`);

                // public abstract
                expect(
                    transpiler.transpile(
                        `abstract class Test { public abstract get abc(): number; }`
                    )
                ).toBe(`class Test {  }`);
            });

            it('should remove property visbility modifiers from classes', () => {
                const transpiler = new Transpiler();

                // private
                expect(
                    transpiler.transpile(
                        `class Test { private abc: number = 123; }`
                    )
                ).toBe(`class Test { abc = 123; }`);

                // public
                expect(
                    transpiler.transpile(
                        `class Test { public abc: number = 123; }`
                    )
                ).toBe(`class Test { abc = 123; }`);
            });

            it('should leave private methods', () => {
                const transpiler = new Transpiler();

                // private
                expect(
                    transpiler.transpile(`class Test { #abc(): void {} }`)
                ).toBe(`class Test { #abc() {} }`);

                // private static
                expect(
                    transpiler.transpile(
                        `class Test { static #abc(): void {} }`
                    )
                ).toBe(`class Test { static #abc() {} }`);

                // private static get
                expect(
                    transpiler.transpile(
                        `class Test { static get #abc(): number { return 123; } }`
                    )
                ).toBe(`class Test { static get #abc() { return 123; } }`);
            });

            it('should leave private properties', () => {
                const transpiler = new Transpiler();

                // private
                expect(
                    transpiler.transpile(`class Test { #abc: number = 123; }`)
                ).toBe(`class Test { #abc = 123; }`);
            });

            it('should remove generic type arguments from class declarations and expressions', () => {
                const transpiler = new Transpiler();

                // Single
                expect(transpiler.transpile(`class Test<T> {}`)).toBe(
                    `class Test {}`
                );
                expect(transpiler.transpile(`let c = class Test<T> {}`)).toBe(
                    `let c = class Test {}`
                );
                expect(transpiler.transpile(`export class Test<T> {}`)).toBe(
                    `class Test {}\nawait exports({ Test, });`
                );

                // Two
                expect(transpiler.transpile(`class Test<T, B> {}`)).toBe(
                    `class Test {}`
                );
                expect(
                    transpiler.transpile(`let c = class Test<T, B> {}`)
                ).toBe(`let c = class Test {}`);
                expect(transpiler.transpile(`export class Test<T, B> {}`)).toBe(
                    `class Test {}\nawait exports({ Test, });`
                );
            });

            it('should remove the abstract keyword from classes', () => {
                const transpiler = new Transpiler();
                expect(transpiler.transpile(`abstract class Test {}`)).toBe(
                    `class Test {}`
                );

                expect(
                    transpiler.transpile(`export abstract class Test {}`)
                ).toBe(`class Test {}\nawait exports({ Test, });`);
            });

            it('should remove type annotations from field declarations in classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(`class Test { field: number; }`)
                ).toBe(`class Test { field; }`);

                expect(
                    transpiler.transpile(`class Test { field: number = 123; }`)
                ).toBe(`class Test { field = 123; }`);

                // private field
                expect(
                    transpiler.transpile(`class Test { #field: number; }`)
                ).toBe(`class Test { #field; }`);

                expect(
                    transpiler.transpile(`class Test { #field: number = 123; }`)
                ).toBe(`class Test { #field = 123; }`);
            });

            it('should remove type annotations from method declarations in classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `class Test { method(prop: number): number { return 123; } }`
                    )
                ).toBe(`class Test { method(prop) { return 123; } }`);

                expect(
                    transpiler.transpile(
                        `class Test { #method(prop: number): number { return 123; } }`
                    )
                ).toBe(`class Test { #method(prop) { return 123; } }`);
            });

            it('should remove type annotations from getter declarations in classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `class Test { get value(): number { return 123; } }`
                    )
                ).toBe(`class Test { get value() { return 123; } }`);

                expect(
                    transpiler.transpile(
                        `class Test { get #value(): number { return 123; } }`
                    )
                ).toBe(`class Test { get #value() { return 123; } }`);
            });

            it('should remove type annotations from setter declarations in classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `class Test { set value(val: number) { } }`
                    )
                ).toBe(`class Test { set value(val) { } }`);

                expect(
                    transpiler.transpile(
                        `class Test { set #value(val: number) { } }`
                    )
                ).toBe(`class Test { set #value(val) { } }`);
            });

            it('should keep visibility annotations from constructor parameters in classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `class Test { constructor(readonly prop: number) {} }`
                    )
                ).toBe(`class Test { constructor(readonly prop) {} }`);
            });

            it('should remove visibility annotations from constructors in exported classes', () => {
                const transpiler = new Transpiler();
                expect(
                    transpiler.transpile(
                        `export class Test { public constructor(prop: number) {} }`
                    )
                ).toBe(
                    `class Test { constructor(prop) {} }\nawait exports({ Test, });`
                );
            });
        });
    });

    describe('replaceMacros()', () => {
        it('should remove the 🧬 character from the front', () => {
            expect(replaceMacros(`${DNA_TAG_PREFIX}${DNA_TAG_PREFIX}`)).toEqual(
                '🧬'
            );
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

describe('calculateFinalLineLocation()', () => {
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
        const location = calculateFinalLineLocation(getResult(), {
            lineNumber: 1,
            column: 1,
        });

        expect(location).toEqual({
            lineNumber: 1,
            column: 1,
        });
    });

    it('should return the closest edit from the most recent client that is left of the given location', () => {
        doc.clientID = 1;
        text.insert(1, '1');
        text.insert(9, '9999');
        // text looks like "a1bcdef\ng9999hijfk\nlmn"

        const location = calculateFinalLineLocation(getResult(), {
            lineNumber: 1,
            column: 1,
        });

        expect(location).toEqual({
            lineNumber: 1,
            column: 5,
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

    it('should not return an invalid index if given a column that is actually shorter than the given column value', () => {
        const script = 'abc\ndef\nghijfk\ntest';

        const index = calculateIndexFromLocation(script, {
            lineNumber: 1,
            column: 5,
        });

        expect(script.substring(index)).toBe('ghijfk\ntest');
    });
});

describe('calculateLocationFromIndex()', () => {
    it.each(locationCases)('%s', (desc, code, location, index) => {
        const result = calculateLocationFromIndex(code, index);
        expect(result).toEqual(location);
    });
});
