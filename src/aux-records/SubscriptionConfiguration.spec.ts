import {
    SubscriptionConfiguration,
    getSubscriptionFeatures,
} from './SubscriptionConfiguration';

describe('getSubscriptionFeatures()', () => {
    const config: SubscriptionConfiguration = {
        cancelUrl: 'url',
        returnUrl: 'url',
        successUrl: 'url',
        subscriptions: [],
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

    it('should return the features for the given tier', () => {
        const features = getSubscriptionFeatures(config, 'beta', 'user');

        expect(features === config.tiers.beta).toBe(true);
    });

    it('should return the default features for the user subscriber type', () => {
        const features = getSubscriptionFeatures(config, 'missing', 'user');

        expect(features === config.defaultFeatures.user).toBe(true);
    });

    it('should return the default features for the studio subscriber type', () => {
        const features = getSubscriptionFeatures(config, 'missing', 'user');

        expect(features === config.defaultFeatures.studio).toBe(true);
    });
});
