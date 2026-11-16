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
import { privoSchema, parsePrivoConfiguration } from './PrivoConfiguration';

const legacy = {
    gatewayEndpoint: 'endpoint',
    publicEndpoint: 'publicEndpoint',
    clientId: 'clientId',
    clientSecret: 'clientSecret',
    redirectUri: 'redirectUri',
    roleIds: { child: 'childRole', adult: 'adultRole', parent: 'parentRole' },
    featureIds: {
        adultPrivoSSO: 'adultAccount',
        childPrivoSSO: 'childAccount',
        joinAndCollaborate: 'joinAndCollaborate',
        publishProjects: 'publish',
        projectDevelopment: 'dev',
        buildAIEggs: 'buildaieggs',
    },
};

describe('PRIVO2 configuration compatibility', () => {
    it('preserves legacy configuration and defaults without PRIVO2 settings', () => {
        const result = privoSchema.parse(legacy);
        expect(result.privo2).toBeUndefined();
        expect(result.ageOfConsent).toBe(18);
        expect(result.clientTokenScopes).toContain('manage_consent');
        expect(result.userTokenScopes).toContain('TRUST');
        expect(result).toMatchObject(legacy);
    });

    it('retains PRIVO2 settings when parsing stored PRIVO configuration', () => {
        const privo2 = {
            consentEndpoint: 'https://consent.example.com',
            authEndpoint: 'https://idp.example.com',
            tokenEndpoint: 'https://idp.example.com/token',
            serviceIdentifier: 'service',
            clientId: 'new-client',
            clientSecret: 'new-secret',
        };
        const result = parsePrivoConfiguration(
            { ...legacy, privo2 },
            privoSchema.parse(legacy)
        );
        expect(result.privo2).toEqual({
            ...privo2,
            scope: 'openid',
            timeoutMs: 10000,
        });
        expect(result.clientId).toBe(legacy.clientId);
    });

    it('rejects incomplete PRIVO2 configuration', () => {
        expect(privoSchema.safeParse({ ...legacy, privo2: {} }).success).toBe(
            false
        );
    });
    it('requires an enabled provider before switching new registrations', () => {
        expect(
            privoSchema.safeParse({ ...legacy, registrationProvider: 'privo2' })
                .success
        ).toBe(false);
    });

    it('requires enabled PRIVO2 for login and rejects invalid login selections', () => {
        for (const loginProvider of ['privo2', 'invalid']) {
            expect(
                privoSchema.safeParse({ ...legacy, loginProvider }).success
            ).toBe(false);
            expect(() =>
                parsePrivoConfiguration(
                    { ...legacy, loginProvider },
                    privoSchema.parse(legacy)
                )
            ).toThrow();
        }
        expect(
            privoSchema.parse({ ...legacy, loginProvider: 'privo' })
                .loginProvider
        ).toBe('privo');
        expect(
            privoSchema.parse({ ...legacy, loginProvider: 'both' })
                .loginProvider
        ).toBe('both');
    });

    it('does not silently fall back to legacy when PRIVO2 activation is invalid', () => {
        expect(() =>
            parsePrivoConfiguration(
                { ...legacy, registrationProvider: 'privo2' },
                privoSchema.parse(legacy)
            )
        ).toThrow('Invalid PRIVO2 configuration.');
    });
});
