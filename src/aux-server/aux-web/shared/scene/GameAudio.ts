import { Howl } from 'howler';

/**
 * Defines a class that can manage how game audio is handled.
 */
export class GameAudio {
    // /**
    //  * The cache of audio elements.
    //  * It is a map of URLs to their elements.
    //  */
    // private _cache = new Map<string, HTMLMediaElement>();

    /**
     * Plays the audio from the given URL.
     * @param url The URL.
     */
    playFromUrl(url: string) {
        const sound = new Howl({
            src: url,
        });

        sound.play();
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
