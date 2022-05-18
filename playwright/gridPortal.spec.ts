import { test, expect } from '@playwright/test';
import { expectRenderedState } from './utils';

// test.describe.configure({
//     mode: 'parallel'
// });

test('white bot', async ({ context, page }) => {
    await expectRenderedState(context, page, {
        shared: {
            test: {
                id: 'test',
                tags: {
                    home: true,
                },
            },
        },
    });
});

test('black bot', async ({ context, page }) => {
    await expectRenderedState(context, page, {
        shared: {
            test: {
                id: 'test',
                tags: {
                    home: true,
                    color: 'black',
                },
            },
        },
    });
});

test('hex color bot', async ({ context, page }) => {
    await expectRenderedState(context, page, {
        shared: {
            test: {
                id: 'test',
                tags: {
                    home: true,
                    color: '#7B64FF',
                },
            },
        },
    });
});

test('bot position X,Y,Z', async ({ context, page }) => {
    await expectRenderedState(context, page, {
        shared: {
            test: {
                id: 'test',
                tags: {
                    home: true,
                    homeX: 2,
                    homeY: 3,
                    homeZ: 0.22,
                },
            },
        },
    });
});

test('bot rotation X,Y,Z', async ({ context, page }) => {
    await expectRenderedState(context, page, {
        shared: {
            test: {
                id: 'test',
                tags: {
                    home: true,
                    homeRotationX: 2,
                    homeRotationY: 3,
                    homeRotationZ: 1,
                },
            },
        },
    });
});

test.describe('labels', () => {
    test('simple', async ({ context, page }) => {
        await expectRenderedState(context, page, {
            shared: {
                test: {
                    id: 'test',
                    tags: {
                        home: true,
                        label: 'test',
                    },
                },
            },
        });
    });

    test('color', async ({ context, page }) => {
        await expectRenderedState(context, page, {
            shared: {
                test: {
                    id: 'test',
                    tags: {
                        home: true,
                        label: 'test',
                        labelColor: 'blue',
                    },
                },
            },
        });
    });

    const labelPositions = [
        ['top', [0, 0]] as const,
        ['front', [Math.PI / 2, 0]] as const,
        ['back', [Math.PI / 2, Math.PI]] as const,
        ['left', [Math.PI / 2, Math.PI / 2]] as const,
        ['right', [Math.PI / 2, Math.PI * (3 / 2)]] as const,
        ['floating', [Math.PI / 2, 0]] as const,
    ];

    for (let [position, rotation] of labelPositions) {
        let [rotationX, rotationY] = rotation;
        test(`${position}`, async ({ context, page }) => {
            await expectRenderedState(context, page, {
                shared: {
                    test: {
                        id: 'test',
                        tags: {
                            home: true,
                            label: 'test',
                            labelPosition: position,
                            onInstJoined: `@os.focusOn(thisBot, { 
                                duration: 0,
                                rotation: {
                                    x: ${JSON.stringify(rotationX)},
                                    y: ${JSON.stringify(rotationY)}
                                }
                            })`,
                        },
                    },
                },
            });
        });
    }
});
