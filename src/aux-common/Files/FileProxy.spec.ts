import { createFile, createCalculationContext } from "./FileCalculations";
import { createFileProxy, isProxy, proxyObject } from './FileProxy';
import formulaLib from '../Formulas/formula-lib';
import { File } from './File';
import { keys } from 'lodash';
import { FileEvent } from ".";

describe('FileProxy', () => {
    describe('createFileProxy()', () => {
        it('should return a proxy object', () => {
            const file = createFile('testId');
            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy[isProxy]).toBe(true);
            expect(proxy).not.toBe(file);
        });

        it('should be able to return the original data', () => {
            const file = createFile('testId');
            file.tags.test = 'hello';

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy[proxyObject]).toBe(file);
            expect(proxy.test[proxyObject]).toBe('hello');
        });

        it('should support Symbol.toPrimitive', () => {
            const file = createFile('testId');
            file.tags.num = 100;

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            const pVal = proxy.num;
            expect(pVal[isProxy]).toBe(true);
            expect(pVal[Symbol.toPrimitive]('default')).toBe(100);
            
            const val = pVal[proxyObject];
            expect(val).toBe(100);
        });

        it('should support valueOf() on primitives', () => {
            const file = createFile('testId');
            file.tags.str = 'hello, world';
            file.tags.num = 100;
            file.tags.bool = true;

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.str.valueOf()).toBe('hello, world');
            expect(proxy.num.valueOf()).toBe(100);
            expect(proxy.bool.valueOf()).toBe(true);
        });

        it('should support toString() on primitives', () => {
            const file = createFile('testId');
            file.tags.str = 'hello, world';
            file.tags.num = 100;
            file.tags.bool = true;

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.str.toString()).toBe('hello, world');
            expect(proxy.num.toString()).toBe('100');
            expect(proxy.bool.toString()).toBe('true');
        });

        it('should be able to add numbers', () => {
            const file = createFile('testId');
            file.tags.num = 100;

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.num + 5).toBe(105);
        });

        it('should be able to concatenate strings', () => {
            const file = createFile('testId');
            file.tags.str = 'hello';

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.str + ', world').toBe('hello, world');
        });

        it('should be able to get simple tag values', () => {
            const file = createFile('testId');
            file.tags.str = 'test';
            file.tags.num = 100;
            file.tags.bool = true;

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.str == 'test').toBe(true);
            expect(proxy.num == 100).toBe(true);
            expect(proxy.bool == true).toBe(true);
        });

        it('should be able to get nested tag values', () => {
            const file = createFile('testId');
            file.tags['aux.builder.context'] = 'test';

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.aux.builder.context == 'test').toBe(true);
        });

        it('should be able to handle nested objects', () => {
            const file = createFile('testId');
            file.tags['my.obj'] = {
                test: 'hahaha'
            };

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.my.obj.test == 'hahaha').toBe(true);
        });

        it('should be able to handle multiple layers of nested objects', () => {
            const file = createFile('testId');
            file.tags['my.obj'] = {
                'test.deep': {
                    final: 'cool'
                }
            };

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.my.obj.test.deep.final == 'cool').toBe(true);
        });

        it('should be able to return a falsy value', () => {
            const file = createFile('testId');

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            expect(proxy.some.crazy.tag == false).toBe(true);
            
            // Type is a 
            expect(!proxy.some.crazy.tag).toBe(false);
            
            const val = proxy.some.crazy.tag;
            expect(typeof val === 'object').toBe(true);
            expect(val instanceof String).toBe(true);
            expect(val.valueOf()).toBe('');
        });

        it('should support listing the tags', () => {
            const file = createFile('testId');
            file.tags.abc = 1;
            file.tags.def = 2;
            
            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            const tags = Object.keys(proxy);
            expect(tags).toEqual([
                'id',
                'abc',
                'def'
            ]);
        });

        it('should support the in operator', () => {
            const file = createFile('testId');
            file.tags.abc = 1;
            
            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);
            expect('abc' in proxy).toBe(true);
            expect('zed' in proxy).toBe(false);
        });

        it('should calculate formula values', () => {
            const file1 = createFile('testId');
            const file2 = createFile('testId');
            file1.tags.num = 5;
            file2.tags.num = 5;

            file1.tags.sum = '=sum(#num)';
            
            const context = createCalculationContext([file1, file2]);
            const proxy = createFileProxy(context, file1);

            expect(proxy.sum.valueOf()).toBe(10);
        });

        it('should call a function when a value was set', () => {
            const file = createFile('testId');
            file.tags.abc = 1;
            
            let tags: string[] = [];
            let vals: any[] = [];

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file, (tag, e) => {
                tags.push(tag);
                vals.push(e);
            });

            proxy.abc = 2;
            proxy.cool.stuff = 'hi';
            proxy.pretty.neat.ability = {
                test: 'hello'
            };

            expect(tags).toEqual([
                'abc',
                'cool.stuff',
                'pretty.neat.ability'
            ]);

            expect(vals).toEqual([
                2,
                'hi',
                { test: 'hello' }
            ]);
        });

        it('should set the value on the tags', () => {
            const file = createFile('testId');
            file.tags.abc = 1;
            
            let tags: string[] = [];
            let vals: any[] = [];

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file, (tag, e) => {
                tags.push(tag);
                vals.push(e);
            });

            proxy.abc = 2;
            proxy.cool.stuff = 'hi';
            
            expect(proxy.abc.valueOf()).toBe(2);
            expect(proxy.cool.stuff.valueOf()).toBe('hi');
            expect(file.tags.abc).toBe(1);
        });

        // TODO: Fix so that only the property
        // that needs to be set on the final tags object
        // is sent to the setValue function.
        // Also make it so that the original tags object is not modified.
        it('should handle setting values on nested objects', () => {
            const file = createFile('testId');
            file.tags['abc.def'] = {
                ghi: 15,
                zzz: true
            };
            
            let tags: string[] = [];
            let vals: any[] = [];

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file, (tag, e) => {
                tags.push(tag);
                vals.push(e);
            });

            proxy.abc.def.ghi = 2;
            proxy.abc.def.zzz = 'hi';
            
            expect(proxy.abc.def.ghi.valueOf()).toBe(2);
            expect(proxy.abc.def.zzz.valueOf()).toBe('hi');
            expect(file.tags['abc.def'].ghi).toBe(15);
            expect(file.tags['abc.def'].zzz).toBe(true);
            expect(tags).toEqual([
                'abc.def',
                'abc.def'
            ]);
            expect(vals).toEqual([
                { ghi: 2, zzz: true },
                { ghi: 2, zzz: 'hi' },
            ]);
        });

        it('should handle setting values on other proxy objects', () => {
            const file = createFile('testId');
            const second = createFile('lalala');
            file.tags['abc.def'] = {
                ghi: 15,
                zzz: true
            };
            file.tags.second = '=@name("other")';
            second.tags.name = 'other';
            
            let files: File[] = [];
            let tags: string[] = [];
            let vals: any[] = [];

            const factory = (o: File) => {
                return (tag: string, value: any) => {
                    files.push(o);
                    tags.push(tag);
                    vals.push(value);
                };
            };
            const context = createCalculationContext([file, second], formulaLib, factory);
            const proxy = createFileProxy(context, file, factory(file));

            proxy.second.def = 2;
            proxy.second.hello = 'abc';
            
            expect(file.tags.second).toBe('=@name("other")');
            expect(second).toEqual({
                id: 'lalala',
                tags: {
                    name: 'other'
                }
            });
            expect(files).toEqual([
                second,
                second
            ]);
            expect(tags).toEqual([
                'def',
                'hello',
            ]);
            expect(vals).toEqual([
                2,
                'abc',
            ]);
        });

        it('should return the same proxy objects from formulas', () => {
            const file = createFile('testId');
            const second = createFile('lalala');
            file.tags['abc.def'] = {
                ghi: 15,
                zzz: true
            };
            file.tags.second = '=@name("other")';
            second.tags.name = 'other';
            
            let files: File[] = [];
            let tags: string[] = [];
            let vals: any[] = [];

            const factory = (o: File) => {
                return (tag: string, value: any) => {
                    files.push(o);
                    tags.push(tag);
                    vals.push(value);
                };
            };
            const context = createCalculationContext([file, second], formulaLib, factory);
            const proxy = createFileProxy(context, file, factory(file));

            proxy.second.def = 2;
            proxy.second.hello = 'abc';
            
            expect(proxy.second.def.valueOf()).toBe(2);
            expect(proxy.second.hello.valueOf()).toBe('abc');
        });

        it('should support using other properties while setting a value', () => {
            const file = createFile('testId');
            file.tags.arr = [0, 1, 2];
            file.tags.index = 0;
            
            let tags: string[] = [];
            let vals: any[] = [];

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file, (tag, e) => {
                tags.push(tag);
                vals.push(e);
            });

            proxy.index = proxy.index >= proxy.arr.length - 1 ? 0 : proxy.index + 1;
            
            expect(proxy.index.valueOf()).toBe(1);
            expect(file.tags.index).toBe(0);
            expect(tags).toEqual([
                'index',
            ]);
            expect(vals).toEqual([
                1
            ]);
        });

        it('should support formulas that return arrays', () => {
            const file = createFile('testId');
            file.tags.arr = '=[0, 1, 2]';

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            const arr = proxy.arr;
            
            expect(arr[isProxy]).toBe(true);
            expect(arr[proxyObject]).toEqual([
                0,
                1,
                2
            ]);

            const _0 = arr[0];
            expect(_0[isProxy]).toBe(true);
            expect(_0.valueOf()).toBe(0);

            const _1 = arr[1];
            expect(_1[isProxy]).toBe(true);
            expect(_1.valueOf()).toBe(1);
            
            const _2 = arr[2];
            expect(_2[isProxy]).toBe(true);
            expect(_2.valueOf()).toBe(2);
        });

        it('should support formulas on properties that return arrays', () => {
            const file = createFile('testId');
            file.tags.arr = '[0,1,2]';
            file.tags.prop = '=this.arr';

            const context = createCalculationContext([file]);
            const proxy = createFileProxy(context, file);

            const arr = proxy.prop;
            
            expect(arr[isProxy]).toBe(true);
            expect(arr[proxyObject]).toEqual([
                0,
                1,
                2
            ]);

            const _0 = arr[0];
            expect(_0[isProxy]).toBe(true);
            expect(_0.valueOf()).toBe(0);

            const _1 = arr[1];
            expect(_1[isProxy]).toBe(true);
            expect(_1.valueOf()).toBe(1);
            
            const _2 = arr[2];
            expect(_2[isProxy]).toBe(true);
            expect(_2.valueOf()).toBe(2);
        });
    });
});