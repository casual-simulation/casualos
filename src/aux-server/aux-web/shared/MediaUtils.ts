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
import { hasValue } from '@casual-simulation/aux-common';
import { appManager } from './AppManager';
import type { ParsedCasualOSUrl } from './UrlUtils';

/**
 * Gets the media for the given CasualOS URL.
 * Returns null if the media could not be found.
 * @param url The URL that should be used to get the media.
 */
export async function getMediaForCasualOSUrl(
    url: ParsedCasualOSUrl | null
): Promise<MediaProvider> {
    if (url && url.type === 'camera-feed') {
        try {
            const media = await window.navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                    // Use the user specified one if specified.
                    // Otherwise default to environment.
                    facingMode: hasValue(url.camera)
                        ? {
                              exact:
                                  url.camera === 'front'
                                      ? 'user'
                                      : 'environment',
                          }
                        : { ideal: 'environment' },
                },
            });

            return media;
        } catch (err) {
            console.warn(
                '[Game] Unable to get camera feed for background.',
                err
            );
            return;
        }
    } else if (url && url.type === 'video-element') {
        for (let sim of appManager.simulationManager.simulations.values()) {
            let stream = sim.livekit.getMediaByAddress(url.address);
            if (stream) {
                return stream;
            }
        }
    }
    return null;
}
