import {
    createBot,
    createPrecalculatedBot,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import { Bundle, PortalBundler } from './PortalBundler';

describe('PortalBundler', () => {
    let bundler: PortalBundler;

    beforeEach(() => {
        bundler = new PortalBundler();
    });

    describe('onBundleUpdated', () => {
        let bundles: Bundle[];
        let sub: Subscription;
        let func1: jest.Mock<any>;
        let func2: jest.Mock<any>;

        beforeEach(() => {
            bundles = [];
            (<any>globalThis).func1 = func1 = jest.fn();
            (<any>globalThis).func2 = func2 = jest.fn();
            sub = bundler.onBundleUpdated.subscribe((b) => {
                bundles.push(b);
            });
        });

        afterEach(() => {
            sub.unsubscribe();
            delete (<any>globalThis).func2;
            delete (<any>globalThis).func1;
        });

        describe('stateUpdated()', () => {
            it('should emit a bundle containing the code of the specified tags', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        bot1: createPrecalculatedBot('bot1', {
                            main: '📖console.log("abc")',
                        }),
                        bot2: createPrecalculatedBot('bot2', {
                            main: '📖console.log("def")',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);
                expect(bundles).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "portalId": "test",
                        "source": "(function () {
                    	'use strict';

                    	console.log(\\"abc\\");

                    	console.log(\\"def\\");

                    }());
                    ",
                      },
                    ]
                `);
            });

            it('should execute entry points in bot ID alphabetical order', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        def: createPrecalculatedBot('def', {
                            main: '📖globalThis.func1("second");',
                        }),
                        abc: createPrecalculatedBot('abc', {
                            main: '📖globalThis.func1("first");',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'first');
                expect(func1).toHaveBeenNthCalledWith(2, 'second');
            });

            it('should use scripts from previous states', async () => {
                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main: '📖globalThis.func1("first");',
                        }),
                    })
                );

                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        def: createPrecalculatedBot('def', {
                            main: '📖globalThis.func1("second");',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'first');
                expect(func1).toHaveBeenNthCalledWith(2, 'second');
            });

            it('should be able to import scripts from other tags', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main:
                                '📖import "📖other"; globalThis.func1("main");',
                            other: '📖globalThis.func1("other");',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'other');
                expect(func1).toHaveBeenNthCalledWith(2, 'main');
            });

            it('should handle modules that reference each other', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main:
                                '📖import "📖other"; globalThis.func1("main");',
                            other:
                                '📖import "📖main"; globalThis.func1("other");',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'other');
                expect(func1).toHaveBeenNthCalledWith(2, 'main');
            });
        });
    });
});
