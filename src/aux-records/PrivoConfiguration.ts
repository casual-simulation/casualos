import z from 'zod';

export const privoSchema = z.object({
    apiEndpoint: z
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

    verificationIntegration: z
        .string()
        .describe('The verification integration that should be used.')
        .nonempty(),
    verificationServiceId: z
        .string()
        .describe('The service ID that should be used.')
        .nonempty(),
    verificationSiteId: z
        .string()
        .describe('The site ID that should be used.')
        .nonempty(),

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
            .describe('The ID of the "Join & Collaborate" feature')
            .nonempty(),
        publishProjects: z
            .string()
            .describe('The ID of the "Publish Projects" feature')
            .nonempty(),
    }),

    tokenScopes: z
        .string()
        .describe('The scopes that should be requested.')
        .nonempty()
        .optional()
        .default(
            'openid profile email user_profile offline_access address additional_info'
        ),
});

export type PrivoConfiguration = z.infer<typeof privoSchema>;
