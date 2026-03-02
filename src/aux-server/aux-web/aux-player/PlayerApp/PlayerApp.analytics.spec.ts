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
import { asyncResult } from '@casual-simulation/aux-common';
import {
    recordAnalyticsEvent,
    type SimpleAnalyticsRecordEvent,
} from './PlayerApp.analytics';

describe('recordAnalyticsEvent()', () => {
    let transaction: jest.Mock;

    beforeEach(() => {
        transaction = jest.fn();
    });

    it('should record using simple analytics when available', () => {
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

        recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 1,
            },
            transaction,
            simpleAnalytics,
            posthog,
            posthogApiKey: undefined,
            isDev: false,
        });

        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledWith(
            'test_event',
            { source: 'spec' },
            expect.any(Function)
        );
        expect(posthog.capture).not.toHaveBeenCalled();
        expect(transaction).toHaveBeenCalledWith(asyncResult(1, null));
    });

    it('should record using posthog when posthog is configured and simple analytics is not available', () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 2,
            },
            transaction,
            posthog,
            posthogApiKey: 'ph_test_key',
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(posthog.capture).toHaveBeenCalledWith('test_event', {
            source: 'spec',
        });
        expect(transaction).toHaveBeenCalledWith(asyncResult(2, null));
    });

    it('should record using both simple analytics and posthog when both are available', () => {
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

        recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 3,
            },
            transaction,
            simpleAnalytics,
            posthog,
            posthogApiKey: 'ph_test_key',
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
        expect(transaction).toHaveBeenCalledWith(asyncResult(3, null));
    });

    it('should throw when neither provider is enabled', () => {
        expect(() =>
            recordAnalyticsEvent({
                event: {
                    name: 'test_event',
                    metadata: { source: 'spec' },
                    taskId: 4,
                },
                transaction,
                posthogApiKey: undefined,
                isDev: false,
            })
        ).toThrow('Analytics are not supported on this inst.');

        expect(transaction).not.toHaveBeenCalled();
    });

    it('should fallback to simple analytics when posthog capture throws', () => {
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

        recordAnalyticsEvent({
            event: {
                name: 'test_event',
                metadata: { source: 'spec' },
                taskId: 5,
            },
            transaction,
            simpleAnalytics,
            posthog,
            posthogApiKey: 'ph_test_key',
            isDev: false,
        });

        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(simpleAnalytics).toHaveBeenCalledTimes(1);
        expect(transaction).toHaveBeenCalledWith(asyncResult(5, null));
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should throw when posthog capture throws and simple analytics is unavailable', () => {
        const consoleSpy = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        const posthog = {
            capture: jest.fn(() => {
                throw new Error('posthog failed');
            }),
            has_opted_out_capturing: jest.fn(() => false),
        };

        expect(() =>
            recordAnalyticsEvent({
                event: {
                    name: 'test_event',
                    metadata: { source: 'spec' },
                    taskId: 6,
                },
                transaction,
                posthog,
                posthogApiKey: 'ph_test_key',
                isDev: false,
            })
        ).toThrow('posthog failed');

        expect(transaction).not.toHaveBeenCalled();
        expect(consoleSpy).toHaveBeenCalled();
        consoleSpy.mockRestore();
    });

    it('should throw in development mode when simple analytics is unavailable', () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => false),
        };

        expect(() =>
            recordAnalyticsEvent({
                event: {
                    name: 'test_event',
                    metadata: { source: 'spec' },
                    taskId: 7,
                },
                transaction,
                posthog,
                posthogApiKey: 'ph_test_key',
                isDev: true,
            })
        ).toThrow('Analytics are not supported on this inst.');

        expect(posthog.capture).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });

    it('should throw when posthog is opted out and simple analytics is unavailable', () => {
        const posthog = {
            capture: jest.fn(),
            has_opted_out_capturing: jest.fn(() => true),
        };

        expect(() =>
            recordAnalyticsEvent({
                event: {
                    name: 'test_event',
                    metadata: { source: 'spec' },
                    taskId: 8,
                },
                transaction,
                posthog,
                posthogApiKey: 'ph_test_key',
                isDev: false,
            })
        ).toThrow('Analytics are not supported on this inst.');

        expect(posthog.capture).not.toHaveBeenCalled();
        expect(transaction).not.toHaveBeenCalled();
    });
});
