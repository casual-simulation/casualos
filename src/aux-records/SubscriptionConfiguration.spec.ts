import {
    SubscriptionConfiguration,
    allowAllFeatures,
    getSubscriptionFeatures,
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

describe('allowAllFeatures()', () => {
    it('should match the snapshot', () => {
        expect(allowAllFeatures()).toMatchSnapshot();
    });
});
