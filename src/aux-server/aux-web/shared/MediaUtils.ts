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
