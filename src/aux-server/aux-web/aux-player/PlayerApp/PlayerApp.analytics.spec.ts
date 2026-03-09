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
import type { SimpleAnalyticsRecordEvent } from './PlayerApp.analytics';
import { recordAnalyticsEvent } from './PlayerApp.analytics';

describe('recordAnalyticsEvent()', () => {
    it('should record using simple analytics when available', async () => {
        const simpleAnalytics = jest.fn(
            (...args: [string, any, () => void] | [string, () => void]) => {
                const callback = args[args.length - 1] as () => void;
                callback();
            }
        ) as unknown as SimpleAnalyticsRecordEvent;
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 1,
            },
            simpleAnalytics,
            posthog: undefined,
            isDev: false,
        });

        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledWith(
            'test_event',
            { source: 'spec' },
            expect.any(Function)
        );
        expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should record using posthog when posthog is configured and simple analytics is not available', async () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 2,
            },
            posthog,
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(posthog.capture).toHaveBeenCalledWith('test_event', {
            source: 'spec',
        });
    });

    it('should record using both simple analytics and posthog when both are available', async () => {
        const simpleAnalytics = jest.fn(
            (...args: [string, any, () => void] | [string, () => void]) => {
                const callback = args[args.length - 1] as () => void;
                callback();
            }
        ) as unknown as SimpleAnalyticsRecordEvent;
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 3,
            },
            simpleAnalytics,
            posthog,
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
    });

    it('should throw when neither provider is enabled', async () => {
        await expect(
            async () =>
                await recordAnalyticsEvent({
                    event: {
                        name: 'test_event',
                        metadata: { source: 'spec' },
                        taskId: 4,
                    },
                    isDev: false,
                })
        ).rejects.toThrow('Analytics are not supported on this inst.');
    });

    it('should fallback to simple analytics when posthog capture throws', async () => {
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const simpleAnalytics = jest.fn(
            (...args: [string, any, () => void] | [string, () => void]) => {
                const callback = args[args.length - 1] as () => void;
                callback();
            }
        ) as unknown as SimpleAnalyticsRecordEvent;
        const posthog = {
            capture: jest.fn(() => {
                throw new Error('posthog failed');
            }),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 5,
            },
            simpleAnalytics,
            posthog,
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should throw when posthog capture throws and simple analytics is unavailable', async () => {
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const posthog = {
            capture: jest.fn(() => {
                throw new Error('posthog failed');
            }),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await expect(
            async () =>
                await recordAnalyticsEvent({
                    event: {
                        name: 'test_event',
                        metadata: { source: 'spec' },
                        taskId: 6,
                    },
                    posthog,
                    isDev: false,
                })
        ).rejects.toThrow('posthog failed');

        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should throw in development mode when simple analytics is unavailable', async () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        await expect(
            async () =>
                await recordAnalyticsEvent({
                    event: {
                        name: 'test_event',
                        metadata: { source: 'spec' },
                        taskId: 7,
                    },
                    posthog,
                    isDev: true,
                })
        ).rejects.toThrow('Analytics are not supported on this inst.');

        expect(posthog.capture).not.toHaveBeenCalled();
    });

    it('should throw when posthog is opted out and simple analytics is unavailable', async () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => true),
        };

        await expect(
            async () =>
                await recordAnalyticsEvent({
                    event: {
                        name: 'test_event',
                        metadata: { source: 'spec' },
                        taskId: 8,
                    },
                    posthog,
                    isDev: false,
                })
        ).rejects.toThrow('Analytics are not supported on this inst.');

        expect(posthog.capture).not.toHaveBeenCalled();
    });
});
