import { createFile, createCalculationContext } from "./FileCalculations";
import { createFileProxy, isProxy, proxyObject } from './FileProxy';

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
    });
});