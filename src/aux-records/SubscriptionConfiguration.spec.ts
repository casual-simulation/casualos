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
import type {
    APISubscription,
    SubscriptionConfiguration,
} from './SubscriptionConfiguration';
import {
    allowAllFeatures,
    getDataFeaturesSchema,
    getSubscription,
    getSubscriptionFeatures,
    getSubscriptionTier,
    subscriptionMatchesRole,
} from './SubscriptionConfiguration';

describe('getSubscription()', () => {
    let config: SubscriptionConfiguration = {
        cancelUrl: 'url',
        returnUrl: 'url',
        successUrl: 'url',
        subscriptions: [
            {
                id: 'subId',
                tier: 'beta',
                eligibleProducts: [],
                featureList: [],
                product: '',
            },
        ],
        tiers: {
            beta: {
                features: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
            },
        },
        defaultFeatures: {
            studio: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
            user: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
        },
        webhookSecret: 'secret',
    };

    beforeEach(() => {
        config = {
            cancelUrl: 'url',
            returnUrl: 'url',
            successUrl: 'url',
            subscriptions: [
                {
                    id: 'subId',
                    tier: 'beta',
                    eligibleProducts: [],
                    featureList: [],
                    product: '',
                },
            ],
            tiers: {
                beta: {
                    features: {
                        data: getDataFeaturesSchema().parse({
                            allowed: true,
                        }),
                        events: {
                            allowed: true,
                        },
                        files: {
                            allowed: true,
                        },
                        records: {
                            allowed: true,
                        },
                        policies: {
                            allowed: true,
                        },
                        ai: {
                            chat: {
                                allowed: false,
                            },
                            images: {
                                allowed: false,
                            },
                            skyboxes: {
                                allowed: false,
                            },
                        },
                        insts: {
                            allowed: true,
                        },
                    },
                },
            },
            defaultFeatures: {
                studio: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
                user: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
            },
            webhookSecret: 'secret',
        };
    });

    it('should return undefined when given a null config', () => {
        const sub = getSubscription(null, 'active', 'subId', 'user');
        expect(sub).toBeUndefined();
    });

    it('should return the sub for the given subscription ID', () => {
        const sub = getSubscription(config, 'active', 'subId', 'user');

        expect(sub).toEqual(config.subscriptions[0]);
    });

    it('should return the features for the default subscription for the user subscriber type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                defaultSubscription: true,
            },
        ];

        const sub = getSubscription(config, null, null, 'user');

        expect(sub).toEqual(config.subscriptions[0]);
    });

    it('should return the features for the default subscription for the studio subscriber type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                defaultSubscription: true,
            },
        ];

        const sub = getSubscription(config, null, null, 'studio');

        expect(sub).toEqual(config.subscriptions[0]);
    });

    it('should return null if no default subscription matches the user type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                studioOnly: true,
                defaultSubscription: true,
            },
        ];

        const sub = getSubscription(config, null, null, 'user');

        expect(sub).toBe(null);
    });

    it('should return null if no default subscription matches the studio type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                userOnly: true,
                defaultSubscription: true,
            },
        ];

        const sub = getSubscription(config, null, null, 'studio');

        expect(sub).toBe(null);
    });

    it('should return the default features for the user subscriber type', () => {
        const features = getSubscriptionFeatures(
            config,
            'active',
            'missing',
            'user'
        );

        expect(features === config.defaultFeatures.user).toBe(true);
    });

    const statusTypes = [
        ['active', true] as const,
        ['trialing', true] as const,
        ['canceled', false] as const,
        ['ended', false] as const,
        ['past_due', false] as const,
        ['unpaid', false] as const,
        ['incomplete', false] as const,
        ['incomplete_expired', false] as const,
        ['paused', false] as const,
        ['invalid status', false] as const,
        [null as any, false] as const,
        [undefined as any, false] as const,
    ];

    describe.each(statusTypes)('%s status', (status, expected) => {
        if (expected) {
            it('should return the sub for the subscription ID for the user', () => {
                const sub = getSubscription(config, status, 'subId', 'user');
                expect(sub).toEqual(config.subscriptions[0]);
            });

            it('should return the sub for the subscription ID for the studio', () => {
                const sub = getSubscription(config, status, 'subId', 'studio');
                expect(sub).toEqual(config.subscriptions[0]);
            });

            it('should return null if the subscription has expired', () => {
                const sub = getSubscription(
                    config,
                    status,
                    'subId',
                    'user',
                    1000, // start
                    2000, // end
                    2001 // now
                );
                expect(sub).toBeNull();
            });

            it('should return the sub for the subscription if it is still active', () => {
                const sub = getSubscription(
                    config,
                    status,
                    'subId',
                    'user',
                    1000, // start
                    2000, // end
                    1500 // now
                );
                expect(sub).toEqual(config.subscriptions[0]);
            });
        } else {
            it('should return null for the user', () => {
                const sub = getSubscription(config, status, 'subId', 'user');
                expect(sub).toBeNull();
            });

            it('should return null for the studio', () => {
                const sub = getSubscription(config, status, 'subId', 'studio');
                expect(sub).toBeNull();
            });
        }
    });
});

describe('getSubscriptionFeatures()', () => {
    let config: SubscriptionConfiguration = {
        cancelUrl: 'url',
        returnUrl: 'url',
        successUrl: 'url',
        subscriptions: [
            {
                id: 'subId',
                tier: 'beta',
                eligibleProducts: [],
                featureList: [],
                product: '',
            },
        ],
        tiers: {
            beta: {
                features: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
            },
        },
        defaultFeatures: {
            studio: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
            user: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
        },
        webhookSecret: 'secret',
    };

    beforeEach(() => {
        config = {
            cancelUrl: 'url',
            returnUrl: 'url',
            successUrl: 'url',
            subscriptions: [
                {
                    id: 'subId',
                    tier: 'beta',
                    eligibleProducts: [],
                    featureList: [],
                    product: '',
                },
            ],
            tiers: {
                beta: {
                    features: {
                        data: getDataFeaturesSchema().parse({
                            allowed: true,
                        }),
                        events: {
                            allowed: true,
                        },
                        files: {
                            allowed: true,
                        },
                        records: {
                            allowed: true,
                        },
                        policies: {
                            allowed: true,
                        },
                        ai: {
                            chat: {
                                allowed: false,
                            },
                            images: {
                                allowed: false,
                            },
                            skyboxes: {
                                allowed: false,
                            },
                        },
                        insts: {
                            allowed: true,
                        },
                    },
                },
            },
            defaultFeatures: {
                studio: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
                user: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
            },
            webhookSecret: 'secret',
        };
    });

    it('should allow all but AI features when given a null config', () => {
        const features = getSubscriptionFeatures(
            null,
            'active',
            'subId',
            'user'
        );
        expect(features).toEqual(allowAllFeatures());
    });

    it('should return the features for the given subscription ID', () => {
        const features = getSubscriptionFeatures(
            config,
            'active',
            'subId',
            'user'
        );

        expect(features === config.tiers.beta.features).toBe(true);
    });

    it('should return the features for the default subscription for the user subscriber type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                defaultSubscription: true,
            },
        ];

        const features = getSubscriptionFeatures(config, null, null, 'user');

        expect(features === config.tiers.beta.features).toBe(true);
    });

    it('should return the features for the default subscription for the studio subscriber type', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                defaultSubscription: true,
            },
        ];

        const features = getSubscriptionFeatures(config, null, null, 'studio');

        expect(features === config.tiers.beta.features).toBe(true);
    });

    it('should ignore default features if they are for the wrong subscriber type for users', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                studioOnly: true,
                defaultSubscription: true,
            },
        ];

        const features = getSubscriptionFeatures(config, null, null, 'user');

        expect(features === config.defaultFeatures.user).toBe(true);
    });

    it('should ignore default features if they are for the wrong subscriber type for studios', () => {
        config.subscriptions = [
            {
                id: 'default',
                tier: 'beta',
                featureList: [],
                userOnly: true,
                defaultSubscription: true,
            },
        ];

        const features = getSubscriptionFeatures(config, null, null, 'studio');

        expect(features === config.defaultFeatures.studio).toBe(true);
    });

    it('should return the default features for the user subscriber type', () => {
        const features = getSubscriptionFeatures(
            config,
            'active',
            'missing',
            'user'
        );

        expect(features === config.defaultFeatures.user).toBe(true);
    });

    it('should return the default features for the studio subscriber type', () => {
        const features = getSubscriptionFeatures(
            config,
            'active',
            'missing',
            'studio'
        );

        expect(features === config.defaultFeatures.studio).toBe(true);
    });

    it('should allow all features when no default features are provided', () => {
        delete (config as any).defaultFeatures;
        const features = getSubscriptionFeatures(
            config,
            'active',
            'missing',
            'studio'
        );

        expect(features).toEqual(allowAllFeatures());
    });

    it('should return the default features if there are no tiers', () => {
        delete (config as any).tiers;
        const features = getSubscriptionFeatures(
            config,
            'active',
            'subId',
            'user'
        );

        expect(features).toEqual(config.defaultFeatures.user);
    });

    it('should return all features if there are no tiers and no default features', () => {
        delete (config as any).tiers;
        delete (config as any).defaultFeatures;
        const features = getSubscriptionFeatures(
            config,
            'active',
            'subId',
            'user'
        );

        expect(features).toEqual(allowAllFeatures());
    });

    const statusTypes = [
        ['active', true] as const,
        ['trialing', true] as const,
        ['canceled', false] as const,
        ['ended', false] as const,
        ['past_due', false] as const,
        ['unpaid', false] as const,
        ['incomplete', false] as const,
        ['incomplete_expired', false] as const,
        ['paused', false] as const,
        ['invalid status', false] as const,
        [null as any, false] as const,
        [undefined as any, false] as const,
    ];

    describe.each(statusTypes)('%s status', (status, expected) => {
        if (expected) {
            it('should return the features for the subscription ID for the user', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'user'
                );
                expect(features === config.tiers.beta.features).toBe(true);
            });

            it('should return the features for the subscription ID for the studio', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'studio'
                );
                expect(features === config.tiers.beta.features).toBe(true);
            });

            it('should return the default features if the subscription has expired', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'user',
                    1000, // start
                    2000, // end
                    2001 // now
                );
                expect(features === config.defaultFeatures.user).toBe(true);
            });

            it('should return the features for the subscription if it is still active', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'user',
                    1000, // start
                    2000, // end
                    1500 // now
                );
                expect(features === config.tiers.beta.features).toBe(true);
            });
        } else {
            it('should return the default features for the user', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'user'
                );
                expect(features === config.defaultFeatures.user).toBe(true);
            });

            it('should return the default features for the studio', () => {
                const features = getSubscriptionFeatures(
                    config,
                    status,
                    'subId',
                    'studio'
                );
                expect(features === config.defaultFeatures.studio).toBe(true);
            });
        }
    });
});

describe('subscriptionMatchesRole()', () => {
    const cases = [['user'] as const, ['studio'] as const];

    describe.each(cases)('%s', (role) => {
        const subscriptionCases: [string, APISubscription, boolean][] = [
            [
                'user only',
                {
                    id: 'sub',
                    userOnly: true,
                    featureList: [],
                },
                role === 'user',
            ],
            [
                'studio only',
                {
                    id: 'sub',
                    studioOnly: true,
                    featureList: [],
                },
                role === 'studio',
            ],
            [
                'any',
                {
                    id: 'sub',
                    featureList: [],
                },
                true,
            ],
        ];

        it.each(subscriptionCases)(
            'should support %s subscriptions',
            (desc, sub, expected) => {
                expect(subscriptionMatchesRole(sub, role)).toBe(expected);
            }
        );
    });
});

describe('allowAllFeatures()', () => {
    it('should match the snapshot', () => {
        expect(allowAllFeatures()).toMatchSnapshot();
    });
});

describe('getSubscriptionTier()', () => {
    let config: SubscriptionConfiguration = {
        cancelUrl: 'url',
        returnUrl: 'url',
        successUrl: 'url',
        subscriptions: [
            {
                id: 'sub0',
                tier: 'tier2',
                eligibleProducts: [],
                featureList: [],
                product: '',
            },
            {
                id: 'subId',
                tier: 'beta',
                eligibleProducts: [],
                featureList: [],
                product: '',
            },
        ],
        tiers: {},
        defaultFeatures: {
            studio: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
            user: {
                data: getDataFeaturesSchema().parse({
                    allowed: true,
                }),
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
                    allowed: true,
                },
                policies: {
                    allowed: true,
                },
                ai: {
                    chat: {
                        allowed: false,
                    },
                    images: {
                        allowed: false,
                    },
                    skyboxes: {
                        allowed: false,
                    },
                },
                insts: {
                    allowed: true,
                },
            },
        },
        webhookSecret: 'secret',
    };

    beforeEach(() => {
        config = {
            cancelUrl: 'url',
            returnUrl: 'url',
            successUrl: 'url',
            subscriptions: [
                {
                    id: 'sub0',
                    tier: 'tier2',
                    eligibleProducts: [],
                    featureList: [],
                    product: '',
                },
                {
                    id: 'subId',
                    tier: 'beta',
                    eligibleProducts: [],
                    featureList: [],
                    product: '',
                },
            ],
            tiers: {},
            defaultFeatures: {
                studio: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
                user: {
                    data: getDataFeaturesSchema().parse({
                        allowed: true,
                    }),
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
                        allowed: true,
                    },
                    policies: {
                        allowed: true,
                    },
                    ai: {
                        chat: {
                            allowed: false,
                        },
                        images: {
                            allowed: false,
                        },
                        skyboxes: {
                            allowed: false,
                        },
                    },
                    insts: {
                        allowed: true,
                    },
                },
            },
            webhookSecret: 'secret',
        };
    });

    it('should return the tier for the given subscription ID', () => {
        expect(getSubscriptionTier(config, 'active', 'sub0', 'studio')).toBe(
            'tier2'
        );
        expect(getSubscriptionTier(config, 'active', 'subId', 'studio')).toBe(
            'beta'
        );
        expect(getSubscriptionTier(config, 'active', 'missing', 'studio')).toBe(
            null
        );

        expect(getSubscriptionTier(config, 'ended', 'sub0', 'studio')).toBe(
            null
        );
        expect(getSubscriptionTier(config, 'ended', 'subId', 'studio')).toBe(
            null
        );
        expect(getSubscriptionTier(config, 'ended', 'missing', 'studio')).toBe(
            null
        );
    });
});
