import { CameraType } from '@casual-simulation/aux-common';

export type ParsedCasualOSUrl = CasualOSCameraFeedUrl | CasualOSVideoElementUrl;

export interface CasualOSCameraFeedUrl {
    type: 'camera-feed';
    camera?: CameraType;
}

export interface CasualOSVideoElementUrl {
    type: 'video-element';
    address: string;
}

/**
 * Parses special CasualOS URLs into an object that indicates what it should be used for.
 * Currently only supports "casualos://camera-feed/{rear|front}".
 * Returns null if the URL has no special CasualOS meaning.
 * @param url The URL that should be parsed.
 * @returns
 */
export function parseCasualOSUrl(
    url: string | Partial<URL>
): ParsedCasualOSUrl {
    try {
        const uri = typeof url === 'object' ? url : new URL(url);
        if (uri.protocol !== 'casualos:') {
            return null;
        }

        if (uri.hostname === 'camera-feed') {
            let camera: CameraType;
            if (uri.pathname === '/front') {
                camera = 'front';
            } else if (uri.pathname === '/rear') {
                camera = 'rear';
            }

            let result: ParsedCasualOSUrl = {
                type: 'camera-feed',
            };

            if (camera) {
                result.camera = camera;
            }

            return result;
        } else if (uri.hostname === 'video-element') {
            let result: ParsedCasualOSUrl = {
                type: 'video-element',
                address: uri.href,
            };

            return result;
        } else if (uri.hostname === '') {
            // Chrome/Firefox
            // See https://bugs.chromium.org/p/chromium/issues/detail?id=869291 and https://bugzilla.mozilla.org/show_bug.cgi?id=1374505
            if (uri.pathname.startsWith('//camera-feed')) {
                let path = uri.pathname.slice('//camera-feed'.length);
                let camera: CameraType;
                if (path === '/front') {
                    camera = 'front';
                } else if (path === '/rear') {
                    camera = 'rear';
                }

                let result: ParsedCasualOSUrl = {
                    type: 'camera-feed',
                };

                if (camera) {
                    result.camera = camera;
                }

                return result;
            } else if (uri.pathname.startsWith('//video-element')) {
                let result: ParsedCasualOSUrl = {
                    type: 'video-element',
                    address: uri.href,
                };

                return result;
            }
        }

        return null;
    } catch {
        return null;
    }
}
