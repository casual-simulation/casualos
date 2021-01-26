import {
    createBot,
    createPrecalculatedBot,
    RegisterCustomPortalOptions,
    stateUpdatedEvent,
} from '@casual-simulation/aux-common';
import { waitAsync } from '@casual-simulation/aux-common/test/TestHelpers';
import { Subscription } from 'rxjs';
import {
    Bundle,
    DEFAULT_BASE_MODULE_URL,
    PortalBundler,
} from './PortalBundler';

console.log = jest.fn();
jest.mock('axios');

describe('PortalBundler', () => {
    let bundler: PortalBundler;

    const prefixCases: [string, string[], string, string][] = [
        ['library emoji', ['📖'], '📖', '📖'],
        ['smile emoji', ['🙂'], '🙂', '🙂'],
        ['multiple emoji', ['📖', '🙂'], '🙂', '📖'],
    ];

    describe.each(prefixCases)(
        '%s',
        (desc, scriptPrefixes, firstPrefix, secondPrefix) => {
            let options: RegisterCustomPortalOptions;

            beforeEach(() => {
                options = {
                    scriptPrefixes,
                    style: {},
                };
            });

            describe('esbuild', () => {
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

                    // describe('registerCustomPortal()', () => {
                    //     it('should return true if the portal is new', () => {
                    //         expect(
                    //             bundler.registerCustomPortal('test', options)
                    //         ).toBe(true);
                    //     });

                    //     it('should return false if the portal already exists', () => {
                    //         expect(
                    //             bundler.registerCustomPortal('test', options)
                    //         ).toBe(true);
                    //         expect(
                    //             bundler.registerCustomPortal('test', options)
                    //         ).toBe(false);
                    //     });
                    // });

                    describe('stateUpdated()', () => {
                        it('should emit a bundle containing the code of the specified tags', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(1);
                            expect(bundles).toMatchSnapshot();
                        });

                        it('should emit a bundle containing the build error', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("ab`,
                                    }),
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(1);
                            expect(bundles).toMatchSnapshot();
                        });

                        it('should execute entry points in bot ID alphabetical order', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    def: createPrecalculatedBot('def', {
                                        main: `${firstPrefix}globalThis.func1("second");`,
                                    }),
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${secondPrefix}globalThis.func1("first");`,
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
                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${firstPrefix}globalThis.func1("first");`,
                                    }),
                                })
                            );

                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles.length).toBe(1);
                            bundles = [];

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    def: createPrecalculatedBot('def', {
                                        main: `${firstPrefix}globalThis.func1("second");`,
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
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                                        other: `${secondPrefix}globalThis.func1("other");`,
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
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                                        other: `${secondPrefix}import "${firstPrefix}main"; globalThis.func1("other");`,
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

                        it('should not emit a bundle if none of the tags are script tags', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: 'not a script',
                                    }),
                                })
                            );

                            await waitAsync();

                            expect(bundles).toEqual([]);
                        });

                        it('should handle bots getting deleted', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1'),
                                })
                            );

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: null,
                                })
                            );

                            await waitAsync();

                            expect(bundles).toEqual([]);
                        });

                        it('should emit a bundle if a bot containing code was deleted', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: null,
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).not.toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        it('should emit a bundle if a module stopped being a library', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: {
                                        values: {
                                            main: 'console.log("def")',
                                        },
                                    },
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).not.toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        it('should emit a bundle when an arbitrary module tag is updated', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot3: createPrecalculatedBot('bot3', {
                                        other: `${firstPrefix}let num = 1 + 2`,
                                    }),
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        it('should not emit a bundle when an arbitrary non module tag is updated', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                        other: 123,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: {
                                        tags: {
                                            other: 456,
                                        },
                                        values: {
                                            other: 456,
                                        },
                                    },
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(1);
                            expect(bundles[0]).toMatchSnapshot();
                        });

                        it('should emit a bundle when an arbitrary tag becomes a module tag', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        other: `console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: {
                                        tags: {
                                            other: `${secondPrefix}console.log("def")`,
                                        },
                                        values: {
                                            other: `${secondPrefix}console.log("def")`,
                                        },
                                    },
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);

                            // Bundles are the same because the 📖other tag is not imported
                            expect(bundles[0]).toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        describe('imports', () => {
                            beforeEach(() => {
                                require('axios').__reset();
                            });

                            it('should try to load modules from skypack', async () => {
                                require('axios').__setResponse({
                                    data: `export const fun = globalThis.func1;`,
                                });

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let [url] = require('axios').__getLastGet();

                                expect(url).toBe(
                                    `${DEFAULT_BASE_MODULE_URL}/lodash`
                                );

                                eval(bundles[0].source);

                                expect(func1).toBeCalledTimes(1);
                            });

                            it('should report errors that occur while fetching data', async () => {
                                require('axios').__setFail(true);

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                expect(bundles[0].error).toBeTruthy();
                            });

                            it('should support HTTPS modules that have relative references', async () => {
                                require('axios')
                                    .__setNextResponse({
                                        data: `export * from './fun';`,
                                    })
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func1;`,
                                    });

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`,
                                    ],
                                    ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                                ]);

                                eval(bundles[0].source);

                                expect(func1).toBeCalledTimes(1);
                            });

                            it('should cache HTTP modules across builds', async () => {
                                require('axios')
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func1;`,
                                    })
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func2;`,
                                    });

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(2);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                ]);

                                expect(bundles[0]).toEqual(bundles[1]);
                            });

                            it('should cache HTTP modules that are requested concurrently', async () => {
                                require('axios')
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func1;`,
                                    })
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func2;`,
                                    });

                                bundler.registerCustomPortal('test', options);

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await waitAsync();

                                expect(bundles.length).toBe(2);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                ]);

                                expect(bundles[0]).toEqual(bundles[1]);
                            });
                        });
                    });

                    describe('addEntryPoint()', () => {
                        it('should emit a bundle containing the code of the specified tags', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles.length).toBe(1);
                            expect(bundles).toMatchSnapshot();
                        });

                        it('should execute entry points in bot ID alphabetical order', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    def: createPrecalculatedBot('def', {
                                        main: `${firstPrefix}globalThis.func1("second");`,
                                    }),
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${secondPrefix}globalThis.func1("first");`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles.length).toBe(1);

                            eval(bundles[0].source);

                            expect(func1).toBeCalledTimes(2);
                            expect(func1).toHaveBeenNthCalledWith(1, 'first');
                            expect(func1).toHaveBeenNthCalledWith(2, 'second');
                        });

                        it('should be able to import scripts from other tags', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                                        other: `${secondPrefix}globalThis.func1("other");`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles.length).toBe(1);

                            eval(bundles[0].source);

                            expect(func1).toBeCalledTimes(2);
                            expect(func1).toHaveBeenNthCalledWith(1, 'other');
                            expect(func1).toHaveBeenNthCalledWith(2, 'main');
                        });

                        it('should handle modules that reference each other', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: `${firstPrefix}import "${secondPrefix}other"; globalThis.func1("main");`,
                                        other: `${secondPrefix}import "${firstPrefix}main"; globalThis.func1("other");`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles.length).toBe(1);

                            eval(bundles[0].source);

                            expect(func1).toBeCalledTimes(2);
                            expect(func1).toHaveBeenNthCalledWith(1, 'other');
                            expect(func1).toHaveBeenNthCalledWith(2, 'main');
                        });

                        it('should not emit a bundle if none of the tags are script tags', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    abc: createPrecalculatedBot('abc', {
                                        main: 'not a script',
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles).toEqual([]);
                        });

                        it('should do nothing if the portal is not registered', async () => {
                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            expect(bundles).toEqual([]);
                        });

                        it('should emit a bundle if a bot containing code was deleted', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: null,
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).not.toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        it('should emit a bundle if a module stopped being a library', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot2: {
                                        values: {
                                            main: 'console.log("def")',
                                        },
                                    },
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).not.toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        it('should emit a bundle when an arbitrary module tag is updated', async () => {
                            bundler.registerCustomPortal('test', options);

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot1: createPrecalculatedBot('bot1', {
                                        main: `${firstPrefix}console.log("abc")`,
                                    }),
                                    bot2: createPrecalculatedBot('bot2', {
                                        main: `${secondPrefix}console.log("def")`,
                                    }),
                                })
                            );

                            await bundler.addEntryPoint('test', {
                                tag: `${firstPrefix}main`,
                            });

                            await waitAsync();

                            await bundler.stateUpdated(
                                stateUpdatedEvent({
                                    bot3: createPrecalculatedBot('bot3', {
                                        other: `${firstPrefix}let num = 1 + 2`,
                                    }),
                                })
                            );

                            await waitAsync();

                            expect(bundles.length).toBe(2);
                            expect(bundles[0]).toEqual(bundles[1]);
                            expect(bundles[1]).toMatchSnapshot();
                        });

                        describe('imports', () => {
                            beforeEach(() => {
                                require('axios').__reset();
                            });

                            it('should try to load modules from skypack', async () => {
                                require('axios').__setResponse({
                                    data: `export const fun = globalThis.func1;`,
                                });

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let [url] = require('axios').__getLastGet();

                                expect(url).toBe(
                                    `${DEFAULT_BASE_MODULE_URL}/lodash`
                                );

                                eval(bundles[0].source);

                                expect(func1).toBeCalledTimes(1);
                            });

                            it('should report errors that occur while fetching data', async () => {
                                require('axios').__setFail(true);

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                expect(bundles[0].error).toBeTruthy();
                            });

                            it('should support HTTPS modules that have relative references', async () => {
                                require('axios')
                                    .__setNextResponse({
                                        data: `export * from './fun';`,
                                    })
                                    .__setNextResponse({
                                        data: `export const fun = globalThis.func1;`,
                                    });

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
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

                                bundler.registerCustomPortal('test', options);

                                await bundler.stateUpdated(
                                    stateUpdatedEvent({
                                        bot1: createPrecalculatedBot('bot1', {
                                            main: `${firstPrefix}import { fun } from "lodash"; fun();`,
                                        }),
                                    })
                                );

                                await bundler.addEntryPoint('test', {
                                    tag: `${firstPrefix}main`,
                                });

                                await waitAsync();

                                expect(bundles.length).toBe(1);
                                let requests = require('axios').__getRequests();

                                expect(requests).toEqual([
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun`,
                                    ],
                                    [
                                        'get',
                                        `${DEFAULT_BASE_MODULE_URL}/lodash/fun/other`,
                                    ],
                                    ['get', `${DEFAULT_BASE_MODULE_URL}/final`],
                                ]);

                                eval(bundles[0].source);

                                expect(func1).toBeCalledTimes(1);
                            });
                        });
                    });
                });
            });
        }
    );
});
