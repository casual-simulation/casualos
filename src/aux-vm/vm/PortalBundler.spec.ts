import {
    createBot,
    createPrecalculatedBot,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import {
    Bundle,
    DEFAULT_BASE_MODULE_URL,
    PortalBundler,
} from './PortalBundler';

jest.mock('axios');

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
                        "warnings": Array [],
                      },
                    ]
                `);
            });

            it('should emit a bundle containing the build error', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        bot1: createPrecalculatedBot('bot1', {
                            main: '📖console.log("ab',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles.length).toBe(1);
                expect(bundles).toMatchInlineSnapshot(`
                    Array [
                      Object {
                        "error": [Error: Unterminated string constant (Note that you need plugins to import files that are not JavaScript)],
                        "portalId": "test",
                        "warnings": Array [],
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

                await waitAsync();

                expect(bundles.length).toBe(1);
                bundles = [];

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

                expect(bundles[0].warnings.length).toBeGreaterThan(0);
            });

            it('should not emit a bundle if none of the tags changed', async () => {
                bundler.registerCustomPortal('test');

                bundler.addEntryPoint('test', { tag: '📖main' });

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main: 'not a script',
                        }),
                    })
                );

                await waitAsync();

                expect(bundles).toEqual([]);
            });

            describe('imports', () => {
                beforeEach(() => {
                    require('axios').__reset();
                });

                it('should try to load modules from skypack', async () => {
                    require('axios').__setResponse({
                        data: `export const fun = globalThis.func1;`,
                    });

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let [url] = require('axios').__getLastGet();

                    expect(url).toBe(`${DEFAULT_BASE_MODULE_URL}/lodash`);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should report errors that occur while fetching data', async () => {
                    require('axios').__setFail(true);

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    expect(bundles[0].error).toMatchInlineSnapshot(
                        `[Error: Could not load https://cdn.skypack.dev/lodash (imported by bot1.main?auxmodule): Error: Get failed.]`
                    );
                });

                it('should support HTTPS modules that have relative references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have relative references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have absolute references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from '/fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have nested references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export * from './other';`,
                        })
                        .__setNextResponse({
                            data: `export * from '/final';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });
            });
        });

        describe('addEntryPoint()', () => {
            it('should emit a bundle containing the code of the specified tags', async () => {
                bundler.registerCustomPortal('test');

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

                bundler.addEntryPoint('test', { tag: '📖main' });

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
                        "warnings": Array [],
                      },
                    ]
                `);
            });

            it('should execute entry points in bot ID alphabetical order', async () => {
                bundler.registerCustomPortal('test');

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

                bundler.addEntryPoint('test', { tag: '📖main' });

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'first');
                expect(func1).toHaveBeenNthCalledWith(2, 'second');
            });

            it('should be able to import scripts from other tags', async () => {
                bundler.registerCustomPortal('test');

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main:
                                '📖import "📖other"; globalThis.func1("main");',
                            other: '📖globalThis.func1("other");',
                        }),
                    })
                );

                bundler.addEntryPoint('test', { tag: '📖main' });

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'other');
                expect(func1).toHaveBeenNthCalledWith(2, 'main');
            });

            it('should handle modules that reference each other', async () => {
                bundler.registerCustomPortal('test');

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

                bundler.addEntryPoint('test', { tag: '📖main' });

                await waitAsync();

                expect(bundles.length).toBe(1);

                eval(bundles[0].source);

                expect(func1).toBeCalledTimes(2);
                expect(func1).toHaveBeenNthCalledWith(1, 'other');
                expect(func1).toHaveBeenNthCalledWith(2, 'main');

                expect(bundles[0].warnings.length).toBeGreaterThan(0);
            });

            it('should not emit a bundle if none of the tags changed', async () => {
                bundler.registerCustomPortal('test');

                bundler.stateUpdated(
                    stateUpdatedEvent({
                        abc: createPrecalculatedBot('abc', {
                            main: 'not a script',
                        }),
                    })
                );

                bundler.addEntryPoint('test', { tag: '📖main' });

                await waitAsync();

                expect(bundles).toEqual([]);
            });

            it('should do nothing if the portal is not registered', async () => {
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

                bundler.addEntryPoint('test', { tag: '📖main' });

                await waitAsync();

                expect(bundles).toEqual([]);
            });

            describe('imports', () => {
                beforeEach(() => {
                    require('axios').__reset();
                });

                it('should try to load modules from skypack', async () => {
                    require('axios').__setResponse({
                        data: `export const fun = globalThis.func1;`,
                    });

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let [url] = require('axios').__getLastGet();

                    expect(url).toBe(`${DEFAULT_BASE_MODULE_URL}/lodash`);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should report errors that occur while fetching data', async () => {
                    require('axios').__setFail(true);

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    expect(bundles[0].error).toMatchInlineSnapshot(
                        `[Error: Could not load https://cdn.skypack.dev/lodash (imported by bot1.main?auxmodule): Error: Get failed.]`
                    );
                });

                it('should support HTTPS modules that have relative references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have relative references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have absolute references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from '/fun';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/fun`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });

                it('should support HTTPS modules that have nested references', async () => {
                    require('axios')
                        .__setNextResponse({
                            data: `export * from './fun';`,
                        })
                        .__setNextResponse({
                            data: `export * from './other';`,
                        })
                        .__setNextResponse({
                            data: `export * from '/final';`,
                        })
                        .__setNextResponse({
                            data: `export const fun = globalThis.func1;`,
                        });

                    bundler.registerCustomPortal('test');

                    bundler.stateUpdated(
                        stateUpdatedEvent({
                            bot1: createPrecalculatedBot('bot1', {
                                main: '📖import { fun } from "lodash"; fun();',
                            }),
                        })
                    );

                    bundler.addEntryPoint('test', { tag: '📖main' });

                    await waitAsync();

                    expect(bundles.length).toBe(1);
                    let requests = require('axios').__getRequests();

                    expect(requests).toEqual([
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`],
                        ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                    ]);

                    eval(bundles[0].source);

                    expect(func1).toBeCalledTimes(1);
                });
            });
        });
    });
});
