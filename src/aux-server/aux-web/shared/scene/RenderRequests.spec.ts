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
import { RenderRequests } from './RenderRequests';

describe('RenderRequests', () => {
    beforeEach(() => {
        RenderRequests.reset();
    });

    afterEach(() => {
        RenderRequests.reset();
    });

    describe('requestRender()', () => {
        it('should request a render for the given duration', () => {
            expect(RenderRequests.isRenderRequested(100)).toBe(false);

            RenderRequests.requestRender(50, 100);

            expect(RenderRequests.isRenderRequested(100)).toBe(true);
            expect(RenderRequests.isRenderRequested(149)).toBe(true);
            expect(RenderRequests.isRenderRequested(150)).toBe(false);
        });

        it('should not shorten an existing request', () => {
            RenderRequests.requestRender(1000, 100);
            RenderRequests.requestRender(10, 200);

            expect(RenderRequests.isRenderRequested(500)).toBe(true);
            expect(RenderRequests.isRenderRequested(1100)).toBe(false);
        });

        it('should use the default duration', () => {
            RenderRequests.requestRender(undefined, 100);

            expect(
                RenderRequests.isRenderRequested(
                    100 + RenderRequests.DEFAULT_RENDER_REQUEST_DURATION_MS - 1
                )
            ).toBe(true);
            expect(
                RenderRequests.isRenderRequested(
                    100 + RenderRequests.DEFAULT_RENDER_REQUEST_DURATION_MS
                )
            ).toBe(false);
        });
    });

    describe('requestContinuousRender()', () => {
        it('should request a render until every subscription is unsubscribed', () => {
            const now = performance.now();
            const sub1 = RenderRequests.requestContinuousRender();
            const sub2 = RenderRequests.requestContinuousRender();

            expect(RenderRequests.isRenderRequested(now + 100000)).toBe(true);

            sub1.unsubscribe();
            expect(RenderRequests.isRenderRequested(now + 100000)).toBe(true);

            sub2.unsubscribe();
            expect(RenderRequests.isRenderRequested(now + 100000)).toBe(false);
        });

        it('should only release once when unsubscribed multiple times', () => {
            const now = performance.now();
            const sub1 = RenderRequests.requestContinuousRender();
            const sub2 = RenderRequests.requestContinuousRender();

            sub1.unsubscribe();
            sub1.unsubscribe();

            expect(RenderRequests.isRenderRequested(now + 100000)).toBe(true);
            sub2.unsubscribe();
        });
    });

    describe('trackVideo()', () => {
        let video: HTMLVideoElement;
        let paused: boolean;

        beforeEach(() => {
            paused = true;
            const fakeVideo = new EventTarget() as any;
            Object.defineProperty(fakeVideo, 'paused', {
                get: () => paused,
            });
            fakeVideo.ended = false;
            video = fakeVideo;
        });

        function farFuture() {
            return performance.now() + 100000;
        }

        it('should request renders while the video is playing', () => {
            RenderRequests.trackVideo(video);
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(false);

            paused = false;
            video.dispatchEvent(new Event('playing'));
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(true);

            paused = true;
            video.dispatchEvent(new Event('pause'));
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(false);
        });

        it('should request renders if the video is already playing', () => {
            paused = false;
            RenderRequests.trackVideo(video);
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(true);

            video.dispatchEvent(new Event('ended'));
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(false);
        });

        it('should only track a video once', () => {
            RenderRequests.trackVideo(video);
            RenderRequests.trackVideo(video);

            video.dispatchEvent(new Event('playing'));
            video.dispatchEvent(new Event('waiting'));
            expect(RenderRequests.isRenderRequested(farFuture())).toBe(false);
        });
    });
});
