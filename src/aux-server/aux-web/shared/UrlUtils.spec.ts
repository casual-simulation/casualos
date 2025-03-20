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
import { parseCasualOSUrl } from './UrlUtils';

describe('parseCasualOSUrl()', () => {
    it('should return an object describing the CasualOS URL', () => {
        expect(parseCasualOSUrl('casualos://camera-feed')).toEqual({
            type: 'camera-feed',
        });

        expect(parseCasualOSUrl('casualos://camera-feed/front')).toEqual({
            type: 'camera-feed',
            camera: 'front',
        });

        expect(parseCasualOSUrl('casualos://camera-feed/rear')).toEqual({
            type: 'camera-feed',
            camera: 'rear',
        });

        expect(parseCasualOSUrl('casualos://camera-feed/other')).toEqual({
            type: 'camera-feed',
        });

        expect(
            parseCasualOSUrl('casualos://video-element/uuid-123-abc')
        ).toEqual({
            type: 'video-element',
            address: 'casualos://video-element/uuid-123-abc',
        });
    });

    // See https://bugs.chromium.org/p/chromium/issues/detail?id=869291
    // See https://bugzilla.mozilla.org/show_bug.cgi?id=1374505
    it('should support Chrome and Firefox URL results', () => {
        // How Chrome/Firefox parse casualos://camera-feed
        expect(
            parseCasualOSUrl({
                protocol: 'casualos:',
                hostname: '',
                host: '',
                pathname: '//camera-feed',
            })
        ).toEqual({
            type: 'camera-feed',
        });

        // How Chrome/Firefox parse casualos://camera-feed/front
        expect(
            parseCasualOSUrl({
                protocol: 'casualos:',
                hostname: '',
                host: '',
                pathname: '//camera-feed/front',
            })
        ).toEqual({
            type: 'camera-feed',
            camera: 'front',
        });

        // How Chrome/Firefox parse casualos://camera-feed/rear
        expect(
            parseCasualOSUrl({
                protocol: 'casualos:',
                hostname: '',
                host: '',
                pathname: '//camera-feed/rear',
            })
        ).toEqual({
            type: 'camera-feed',
            camera: 'rear',
        });

        // How Chrome/Firefox parse casualos://video-element/uuid-123-abc
        expect(
            parseCasualOSUrl({
                protocol: 'casualos:',
                hostname: '',
                host: '',
                pathname: '//video-element/uuid-123-abc',
                href: 'casualos://video-element/uuid-123-abc',
            })
        ).toEqual({
            type: 'video-element',
            address: 'casualos://video-element/uuid-123-abc',
        });
    });

    it('should return null if given a non CasualOS URL', () => {
        expect(parseCasualOSUrl('http://example.com')).toBe(null);
    });
});
