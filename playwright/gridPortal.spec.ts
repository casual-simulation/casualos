import { test, expect } from '@playwright/test';
import {
    expectGridPortalInteraction,
    expectRenderedState,
    screenPosition,
    mouseDragAndDrop,
    getScreenPositionForBot,
    setInputDebugLevel,
    getScreenPositionForPoint,
} from './utils';

test.describe.configure({
    mode: !process.env.CI ? 'parallel' : 'serial',
});

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

test.describe('interaction', () => {
    test.describe('mouse', () => {
        test('onClick', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                onClick: `@tags.color = 'red';`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    const bounds = await gridPortal.boundingBox();
                    const pos = await getScreenPositionForBot(
                        page,
                        bounds,
                        'test'
                    );
                    await page.mouse.click(pos.x, pos.y, {
                        button: 'left',
                    });
                }
            );
        });

        test('onGridClick', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                onGridClick: `@create({
                                home: true,
                                homeX: that.position.x,
                                homeY: that.position.y,
                                color: 'red',
                            })`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    const bounds = await gridPortal.boundingBox();
                    const pos = screenPosition(bounds, 0.7, 0.2);
                    await page.mouse.click(pos.x, pos.y, {
                        button: 'left',
                    });
                }
            );
        });

        test('onDrag default', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    const bounds = await gridPortal.boundingBox();
                    await mouseDragAndDrop(
                        page,
                        screenPosition(bounds, 0.5, 0.5),
                        screenPosition(bounds, 0.7, 0.2)
                    );
                }
            );
        });

        test('onDrag grid', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                onDrag: `@os.addDropSnap('grid')`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    const bounds = await gridPortal.boundingBox();
                    await mouseDragAndDrop(
                        page,
                        screenPosition(bounds, 0.5, 0.5),
                        screenPosition(bounds, 0.7, 0.2)
                    );
                }
            );
        });

        test('onDrag custom-grid', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                onDrag: `@os.addDropGrid({
                                    position: { x: 0, y: 0, z: 0 },
                                    rotation: { x: 0.33, y: 0.33, z: 0.33 },
                                    bounds: { x: 20, y: 20 },
                                    showGrid: true,
                                });`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    const bounds = await gridPortal.boundingBox();
                    const testPosition = await getScreenPositionForBot(
                        page,
                        bounds,
                        'test'
                    );
                    const pointPosition = await getScreenPositionForPoint(
                        page,
                        bounds,
                        { x: 2, y: 2, z: 0 }
                    );
                    await mouseDragAndDrop(page, testPosition, pointPosition);
                }
            );
        });

        test('onDrag face', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                homeRotationZ: 0.333,
                                homeRotationY: 0.666,
                                onGridDown: `@create({ home: true, homeX: 10, homeY: 10, color: 'green' })`,
                            },
                        },

                        target: {
                            id: 'target',
                            tags: {
                                home: true,
                                homeX: 5,
                                homeY: 0,
                                color: 'red',
                                onDrag: `@os.addDropSnap('face')`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    await setInputDebugLevel(page, 2);
                    const bounds = await gridPortal.boundingBox();
                    const targetPosition = await getScreenPositionForBot(
                        page,
                        bounds,
                        'target'
                    );
                    const testPosition = await getScreenPositionForBot(
                        page,
                        bounds,
                        'test'
                    );

                    await mouseDragAndDrop(page, targetPosition, testPosition);
                }
            );
        });

        test('onDrag snap point', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                homeX: 0,
                                homeY: 0,
                            },
                        },
                        target: {
                            id: 'target',
                            tags: {
                                home: true,
                                homeX: 1,
                                homeY: 0,
                                color: 'red',
                                onDrag: `@os.addDropSnap({
                                    position: { x: 5, y: 5, z: 0 },
                                    distance: 10
                                })`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    await setInputDebugLevel(page, 2);
                    const bounds = await gridPortal.boundingBox();
                    const targetPosition = await getScreenPositionForBot(
                        page,
                        bounds,
                        'target'
                    );
                    const pointPosition = await getScreenPositionForPoint(
                        page,
                        bounds,
                        { x: 5, y: 0, z: 5 }
                    );

                    await mouseDragAndDrop(page, targetPosition, pointPosition);
                }
            );
        });

        test('onDrag snap axis', async ({ context, page }) => {
            await expectGridPortalInteraction(
                context,
                page,
                {
                    shared: {
                        test: {
                            id: 'test',
                            tags: {
                                home: true,
                                homeX: 0,
                                homeY: 0,
                            },
                        },
                        target: {
                            id: 'target',
                            tags: {
                                home: true,
                                homeX: 1,
                                homeY: 0,
                                color: 'red',
                                onDrag: `@os.addDropSnap({
                                    direction: { x: 1, y: 1, z: 0 },
                                    origin: { x: 0, y: 0, z: 0 },
                                    distance: 10
                                })`,
                            },
                        },
                    },
                },
                async (page, gridPortal) => {
                    await setInputDebugLevel(page, 2);
                    const bounds = await gridPortal.boundingBox();
                    const targetPosition = await getScreenPositionForBot(
                        page,
                        bounds,
                        'target'
                    );
                    const pointPosition = await getScreenPositionForPoint(
                        page,
                        bounds,
                        { x: 5, y: 0, z: 5 }
                    );

                    await mouseDragAndDrop(page, targetPosition, pointPosition);
                }
            );
        });
    });
});
