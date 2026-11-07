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

    describe('shouldRender()', () => {
        it('should always render when render on demand is disabled', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: false,
            });

            for (let time = 0; time < 1000; time += 16) {
                expect(scheduler.shouldRender(time, false)).toBe(true);
            }
        });

        it('should render the first frame', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(scheduler.shouldRender(10016, false)).toBe(false);
        });

        it('should only render while a render is requested', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
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
            });

            expect(scheduler.shouldRender(10000, false)).toBe(true);
            expect(scheduler.shouldRender(10016, false)).toBe(false);
            expect(scheduler.shouldRender(10032, true)).toBe(true);
            expect(scheduler.shouldRender(10048, false)).toBe(false);
        });

        it('should render while a continuous render is requested', () => {
            const scheduler = new FrameScheduler({
                renderOnDemand: true,
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
