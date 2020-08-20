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
