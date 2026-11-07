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
import {
    FrameScheduler,
    IDLE_RENDER_INTERVAL_MS,
    matrixElementsNearlyEqual,
} from './FrameScheduler';
import { RenderRequests } from './RenderRequests';

describe('matrixElementsNearlyEqual()', () => {
    it('should return true for identical elements', () => {
        expect(matrixElementsNearlyEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should ignore floating point error', () => {
        expect(
            matrixElementsNearlyEqual(
                [0.7053412294217161, 0, -0.4085829887100408, 1500],
                [
                    0.7053412294217158, -1.1102230246251565e-16,
                    -0.408582988710041, 1500.0000000000002,
                ]
            )
        ).toBe(true);
    });

    it('should consider NaN values to be equal', () => {
        expect(matrixElementsNearlyEqual([NaN, 1], [NaN, 1])).toBe(true);
        expect(matrixElementsNearlyEqual([NaN, 1], [0, 1])).toBe(false);
        expect(matrixElementsNearlyEqual([0, 1], [NaN, 1])).toBe(false);
    });

    it('should detect small but real changes', () => {
        expect(matrixElementsNearlyEqual([0.01], [0.01001])).toBe(false);
        expect(matrixElementsNearlyEqual([100], [100.001])).toBe(false);
    });

    it('should return false when the lengths differ', () => {
        expect(matrixElementsNearlyEqual([1, 2], [1, 2, 3])).toBe(false);
    });
});

describe('FrameScheduler', () => {
    beforeEach(() => {
        RenderRequests.reset();
    });

    afterEach(() => {
        RenderRequests.reset();
    });

    /**
     * Simulates animation frames at the given refresh rate and returns the number of frames that were processed.
     */
    function countProcessedFrames(
        scheduler: FrameScheduler,
        refreshRate: number,
        durationMs: number,
        startTime: number = 0
    ) {
        const interval = 1000 / refreshRate;
        let processed = 0;
        for (
            let time = startTime;
            time < startTime + durationMs;
            time += interval
        ) {
            if (scheduler.shouldProcessFrame(time, false)) {
                processed += 1;
            }
        }
        return processed;
    }

    describe('shouldProcessFrame()', () => {
        it('should process every frame when there is no max frame rate', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: null,
            });

            expect(countProcessedFrames(scheduler, 120, 1000)).toBe(120);
        });

        it('should process every frame when the max frame rate is 0', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: 0,
            });

            expect(countProcessedFrames(scheduler, 120, 1000)).toBe(120);
        });

        const cases = [
            // [refresh rate, max frame rate]
            [60, 30],
            [120, 60],
            [120, 30],
            [120, 50],
            [144, 60],
            [60, 60],
        ] as const;

        it.each(cases)(
            'should limit a %s hz display to about %s fps',
            (refreshRate, maxFrameRate) => {
                const scheduler = new FrameScheduler({
                    renderOnDemand: false,
                    maxFrameRate,
                });

                const processed = countProcessedFrames(
                    scheduler,
                    refreshRate,
                    10000
                );
                const fps = processed / 10;
                expect(fps).toBeLessThanOrEqual(maxFrameRate + 1);
                expect(fps).toBeGreaterThanOrEqual(maxFrameRate * 0.9);
            }
        );

        it('should not process the same frame twice when frames arrive slightly early', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: 30,
            });

            expect(scheduler.shouldProcessFrame(0, false)).toBe(true);
            expect(scheduler.shouldProcessFrame(16.6, false)).toBe(false);
            expect(scheduler.shouldProcessFrame(33.2, false)).toBe(true);
            expect(scheduler.shouldProcessFrame(49.8, false)).toBe(false);
            expect(scheduler.shouldProcessFrame(66.4, false)).toBe(true);
        });

        it('should always process immersive frames', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: 30,
            });

            expect(scheduler.shouldProcessFrame(0, true)).toBe(true);
            expect(scheduler.shouldProcessFrame(11, true)).toBe(true);
            expect(scheduler.shouldProcessFrame(22, true)).toBe(true);
        });

        it('should process the next frame after a long pause', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: 30,
            });

            expect(scheduler.shouldProcessFrame(0, false)).toBe(true);
            expect(scheduler.shouldProcessFrame(5000, false)).toBe(true);
            expect(scheduler.shouldProcessFrame(5016, false)).toBe(false);
            expect(scheduler.shouldProcessFrame(5034, false)).toBe(true);
        });

        it('should use the new max frame rate when it is changed', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: null,
            });

            expect(countProcessedFrames(scheduler, 120, 1000)).toBe(120);

            scheduler.maxFrameRate = 30;
            const processed = countProcessedFrames(scheduler, 120, 1000, 1000);
            expect(processed).toBeLessThanOrEqual(31);
            expect(processed).toBeGreaterThanOrEqual(27);

            scheduler.maxFrameRate = null;
            expect(countProcessedFrames(scheduler, 120, 1000, 2000)).toBe(120);
        });
    });

    describe('shouldRender()', () => {
        it('should always render when render on demand is disabled', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
                maxFrameRate: null,
            });

            for (let time = 0; time < 1000; time += 16) {
                expect(scheduler.shouldRender(time, false)).toBe(true);
            }
        });

        it('should render the first frame', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
                maxFrameRate: null,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(scheduler.shouldRender(10016, false)).toBe(false);
        });

        it('should only render while a render is requested', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
                maxFrameRate: null,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(scheduler.shouldRender(10016, false)).toBe(false);

            RenderRequests.requestRender(100, 10020);

            expect(scheduler.shouldRender(10032, false)).toBe(true);
            expect(scheduler.shouldRender(10100, false)).toBe(true);
            expect(scheduler.shouldRender(10120, false)).toBe(false);
            expect(scheduler.shouldRender(10136, false)).toBe(false);
        });

        it('should render when forced', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
                maxFrameRate: null,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(scheduler.shouldRender(10016, false)).toBe(false);
            expect(scheduler.shouldRender(10032, true)).toBe(true);
            expect(scheduler.shouldRender(10048, false)).toBe(false);
        });

        it('should render while a continuous render is requested', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
                maxFrameRate: null,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);

            const sub = RenderRequests.requestContinuousRender();
            const now = performance.now();
            expect(scheduler.shouldRender(now + 10000, false)).toBe(true);
            expect(scheduler.shouldRender(now + 20000, false)).toBe(true);

            sub.unsubscribe();
            expect(scheduler.shouldRender(now + 20016, false)).toBe(false);
        });

        it('should render periodically while idle', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
                maxFrameRate: null,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(
                scheduler.shouldRender(
                    10000 + IDLE_RENDER_INTERVAL_MS - 16,
                    false
                )
            ).toBe(false);
            expect(
                scheduler.shouldRender(10000 + IDLE_RENDER_INTERVAL_MS, false)
            ).toBe(true);
            expect(
                scheduler.shouldRender(
                    10000 + IDLE_RENDER_INTERVAL_MS + 16,
                    false
                )
            ).toBe(false);
        });
    });
});
