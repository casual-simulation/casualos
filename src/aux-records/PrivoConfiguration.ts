import z from 'zod';

export const privoSchema = z.object({
    gatewayEndpoint: z
        .string()
        .describe('The Privo API (aslo called the Gateway) URL.')
        .nonempty(),
    publicEndpoint: z.string().describe('The Privo Public API URL.').nonempty(),
    clientId: z
        .string()
        .describe('The Client ID that should be used.')
        .nonempty(),
    clientSecret: z
        .string()
        .describe('The client secret that should be used.')
        .nonempty(),
    redirectUri: z
        .string()
        .describe(
            'The URI that Privo users should be redirected to after a login.'
        )
        .nonempty(),

    // verificationIntegration: z
    //     .string()
    //     .describe('The verification integration that should be used.')
    //     .nonempty(),
    // verificationServiceId: z
    //     .string()
    //     .describe('The service ID that should be used.')
    //     .nonempty(),
    // verificationSiteId: z
    //     .string()
    //     .describe('The site ID that should be used.')
    //     .nonempty(),

    roleIds: z.object({
        child: z.string().describe('The ID of the child role.').nonempty(),
        parent: z.string().describe('The ID of the parent role.').nonempty(),
        adult: z.string().describe('The ID of the adult role.').nonempty(),
    }),

    featureIds: z.object({
        childPrivoSSO: z
            .string()
            .describe('The ID of the child Privo ID Single Sign-On feature')
            .nonempty(),
        adultPrivoSSO: z
            .string()
            .describe('The ID of the adult Privo ID Single Sign-On feature')
            .nonempty(),
        joinAndCollaborate: z
            .string()
            .describe('The ID of the "Join & Collaborate" feature.')
            .nonempty(),
        publishProjects: z
            .string()
            .describe(
                'The ID of the "Publish Projects" feature. Also known as the "Publish Public Eggs" feature.'
            )
            .nonempty(),
        projectDevelopment: z
            .string()
            .describe(
                'The ID of the "Project Development" feature. Also known as the "Build Private Eggs" feature.'
            )
            .nonempty(),
        buildAIEggs: z
            .string()
            .describe('The ID of the "Build AI Eggs" feature.')
            .nonempty(),
    }),

    clientTokenScopes: z
        .string()
        .describe('The scopes that should be requested for client tokens.')
        .nonempty()
        .optional()
        .default(
            'openid profile email user_profile offline_access address additional_info TRUST delete_account service_profile connected_profiles manage_consent consent_url update_password_link'
        ),

    userTokenScopes: z
        .string()
        .describe('The scopes that should be requested for user tokens.')
        .nonempty()
        .optional()
        .default(
            'TRUST openid profile user_profile address service_profile connected_profiles manage_consent email additional_info offline_access delete_account consent_url update_password_link'
        ),

    ageOfConsent: z
        .number()
        .describe(
            'The age of consent for users. Users who are under this age must have consent given for them via a parent account.'
        )
        .int()
        .positive()
        .default(18),
});

export const PrivoConfiguration = Symbol.for('PrivoConfiguration');
export type PrivoConfiguration = z.infer<typeof privoSchema>;

export function parsePrivoConfiguration(
    config: any,
    defaultConfig: PrivoConfiguration
): PrivoConfiguration {
    if (config) {
        const result = privoSchema.safeParse(config);
        if (result.success) {
            return result.data as PrivoConfiguration;
        } else {
            console.error('[PrivoConfiguration] Invalid privo config', result);
        }
    }
    return defaultConfig;
}
