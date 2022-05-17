import { test, expect } from '@playwright/test';
import { expectRenderedState } from './utils';

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

test('bot label', async ({ context, page }) => {
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

test('bot label color', async ({ context, page }) => {
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

// let labelAncors = [
//     'front',
//     'back',
//     'left',
//     'right'
// ];

// test('bot label front', async ({ context, page }) => {
//     await expectRenderedState(context, page, {
//         shared: {
//             test: {
//                 id: 'test',
//                 tags: {
//                     home: true,
//                     label: 'test'
//                 }
//             }
//         }
//     });
// });
