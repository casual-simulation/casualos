import {
    APISubscription,
    SubscriptionConfiguration,
    allowAllFeatures,
    getSubscriptionFeatures,
    getSubscriptionTier,
    subscriptionMatchesRole,
} from './SubscriptionConfiguration';

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
                    data: {
                        allowed: true,
                    },
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
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
                data: {
                    allowed: true,
                },
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
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
                data: {
                    allowed: true,
                },
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
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
                        data: {
                            allowed: true,
                        },
                        events: {
                            allowed: true,
                        },
                        files: {
                            allowed: true,
                        },
                        records: {
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
                    data: {
                        allowed: true,
                    },
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
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
                    data: {
                        allowed: true,
                    },
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
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
                data: {
                    allowed: true,
                },
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
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
                data: {
                    allowed: true,
                },
                events: {
                    allowed: true,
                },
                files: {
                    allowed: true,
                },
                records: {
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
                    data: {
                        allowed: true,
                    },
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
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
                    data: {
                        allowed: true,
                    },
                    events: {
                        allowed: true,
                    },
                    files: {
                        allowed: true,
                    },
                    records: {
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
        expect(getSubscriptionTier(config, 'active', 'sub0')).toBe('tier2');
        expect(getSubscriptionTier(config, 'active', 'subId')).toBe('beta');
        expect(getSubscriptionTier(config, 'active', 'missing')).toBe(null);

        expect(getSubscriptionTier(config, 'ended', 'sub0')).toBe(null);
        expect(getSubscriptionTier(config, 'ended', 'subId')).toBe(null);
        expect(getSubscriptionTier(config, 'ended', 'missing')).toBe(null);
    });
});
