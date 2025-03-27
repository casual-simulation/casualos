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
import { Howl, Howler } from 'howler';

// Workaround so that .mpga files can be played as sounds.
let _setup = (Howler as any)._setup.bind(Howler);
(Howler as any)._setup = function () {
    const ret = _setup();
    // Add the mpga extension to the internal list of codecs that howler keeps
    (Howler as any)._codecs['mpga'] = (Howler as any)._codecs['mp3'];
    return ret;
};

/**
 * Defines a class that can manage how game audio is handled.
 */
export class GameAudio {
    // /**
    //  * The cache of audio elements.
    //  * It is a map of URLs to their elements.
    //  */
    // private _cache = new Map<string, HTMLMediaElement>();
    private _playingSounds: Map<number | string, Howl>;

    constructor() {
        this._playingSounds = new Map();
    }

    /**
     * Plays the audio from the given URL.
     * @param url The URL.
     */
    playFromUrl(url: string, soundId: number | string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const sound = new Howl({
                src: url,
                onplay: () => {
                    resolve();
                },
                onend: () => {
                    this._playingSounds.delete(soundId);
                },
                onstop: () => {
                    this._playingSounds.delete(soundId);
                },
                onloaderror: (id: number | string, error: number) => {
                    this._playingSounds.delete(soundId);
                    reject(
                        new Error(
                            'Unable to play audio for: ' +
                                url +
                                ' Error code: ' +
                                error
                        )
                    );
                },
                onplayerror: () => {
                    this._playingSounds.delete(soundId);
                    reject(new Error('Unable to play audio for: ' + url));
                },
            });
            this._playingSounds.set(soundId, sound);
            sound.play();
        });
    }

    /**
     * Stops playing the sound with the given ID.
     * @param soundId The ID of the sound to stop.
     */
    cancelSound(soundId: number | string): void {
        const sound = this._playingSounds.get(soundId);
        if (sound) {
            sound.stop();
        }
    }

    /**
     * Preloads the audio from the given URL.
     * Returns a promise that resolves when the audio is loaded.
     * @param url The URL.
     */
    bufferFromUrl(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sound = new Howl({
                src: url,
                preload: true,
                onload: () => {
                    resolve();
                },
                onloaderror: () => {
                    reject(new Error('Unable to load audio from: ' + url));
                },
            });
        });
    }

    // private _getMediaElement(url: string) {
    //     let element = this._cache.get(url);
    //     if(!element) {
    //         element = new Audio(url);
    //         element.loop = false;
    //         element.play();
    //         element.pause();
    //         element.currentTime = 0;
    //         this._cache.set(url, element);
    //     }

    //     return element;
    // }
}
