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
import type { SubscriptionLike } from 'rxjs';
import { Subscription } from 'rxjs';

/**
 * Tracks requests for the 3D portals to be rendered.
 *
 * When render on demand is enabled (see WebConfig.renderOnDemand), frames are only rendered
 * while a render has been requested. Anything that changes the scene outside of a bot update
 * (async loads, animations, videos, etc.) should request a render so that the change becomes visible.
 *
 * When render on demand is disabled, requests are ignored and every frame is rendered.
 */
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace RenderRequests {
    /**
     * The number of miliseconds that frames should be rendered for after a render is requested.
     * Rendering for a short period after each request gives follow-up effects
     * (camera damping, position lerps, text layout, etc.) a chance to finish.
     */
    export const DEFAULT_RENDER_REQUEST_DURATION_MS = 1000;

    let renderUntil = 0;
    let continuousRenderCount = 0;
    const trackedVideos = new WeakSet<HTMLVideoElement>();

    /**
     * Requests that frames be rendered for the given amount of time.
     * @param durationMs The number of miliseconds that frames should be rendered for.
     * @param now The current time in miliseconds.
     */
    export function requestRender(
        durationMs: number = DEFAULT_RENDER_REQUEST_DURATION_MS,
        now: number = performance.now()
    ): void {
        renderUntil = Math.max(renderUntil, now + durationMs);
    }

    /**
     * Requests that every frame be rendered until the returned subscription is unsubscribed.
     */
    export function requestContinuousRender(): SubscriptionLike {
        continuousRenderCount += 1;
        return new Subscription(() => {
            continuousRenderCount -= 1;
            requestRender();
        });
    }

    /**
     * Requests that every frame be rendered while the given video is playing.
     * Useful for videos that are rendered as textures.
     * @param video The video element.
     */
    export function trackVideo(video: HTMLVideoElement): void {
        if (trackedVideos.has(video)) {
            return;
        }
        trackedVideos.add(video);

        let sub: SubscriptionLike = null;
        const start = () => {
            if (!sub) {
                sub = requestContinuousRender();
            }
        };
        const stop = () => {
            if (sub) {
                sub.unsubscribe();
                sub = null;
            }
        };

        video.addEventListener('playing', start);
        video.addEventListener('pause', stop);
        video.addEventListener('ended', stop);
        video.addEventListener('waiting', stop);
        video.addEventListener('emptied', stop);

        if (!video.paused && !video.ended) {
            start();
        }
    }

    /**
     * Determines whether a render is currently requested.
     * @param now The current time in miliseconds.
     */
    export function isRenderRequested(
        now: number = performance.now()
    ): boolean {
        return continuousRenderCount > 0 || now < renderUntil;
    }

    /**
     * Clears all render requests.
     * Useful for testing.
     */
    export function reset(): void {
        renderUntil = 0;
        continuousRenderCount = 0;
    }
}
