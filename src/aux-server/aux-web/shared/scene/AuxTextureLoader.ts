import {
    Texture,
    ImageLoader,
    RGBFormat,
    RGBAFormat,
    Loader,
    VideoTexture,
} from '@casual-simulation/three';
import { addCorsQueryParam } from './SceneUtils';
import { appManager } from '../AppManager';
import { parseCasualOSUrl } from '../UrlUtils';

// TODO: Put a max size on the cache.
const cache = new Map<string, Promise<Texture>>();

/**
 * Custom version of THREE.TextureLoader that exposes the ability to cancel an image load.
 */
export class AuxTextureLoader {
    crossOrigin: string = 'anonymous';
    path: string;
    image: HTMLImageElement;
    video: HTMLVideoElement;

    get isLoading(): boolean {
        return this.image !== null;
    }

    constructor() {}

    load(url: string): Promise<Texture> {
        // Do not allow casualos:// URLs to be cached
        const canCache = !url.startsWith('casualos://');
        let promise = canCache ? cache.get(url) : null;
        if (!promise) {
            promise = this._load(url);
            if (canCache) {
                cache.set(url, promise);
            }
        }
        return promise;
    }

    private async _load(url: string): Promise<Texture> {
        return this._loadImage(url).catch((err) => {
            console.log(
                '[AuxTextureLoader] Failed to load image. Trying to load video.',
                err
            );
            return this._loadVideo(url);
        });
    }

    private async _loadImage(url: string): Promise<Texture> {
        return new Promise<Texture>((resolve, reject) => {
            let texture = new Texture();

            let loader = new ImageLoader();
            loader.setCrossOrigin(this.crossOrigin);
            loader.setPath(this.path);

            let onImageLoad = (image: HTMLImageElement) => {
                texture.image = image;
                // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
                let isJPEG =
                    url.search(/\.jpe?g($|\?)/i) > 0 ||
                    url.search(/^data\:image\/jpeg/) === 0;

                texture.format = isJPEG ? RGBFormat : RGBAFormat;
                texture.needsUpdate = true;

                this.image = null;
                resolve(texture);
            };
            onImageLoad = onImageLoad.bind(this);

            let onImageError = (event: ErrorEvent) => {
                this.cancel();
                reject(event);
            };
            onImageError = onImageError.bind(this);

            this.image = loader.load(
                this.crossOrigin === 'anonymous' ? addCorsQueryParam(url) : url,
                onImageLoad,
                null,
                onImageError
            );
        });
    }

    private async _loadVideo(url: string): Promise<Texture> {
        const el = await this._loadVideoElement(url);
        return new VideoTexture(el);
    }

    private _loadVideoElement(url: string): Promise<HTMLVideoElement> {
        return new Promise<HTMLVideoElement>((resolve, reject) => {
            const casualOsUrl = parseCasualOSUrl(url);
            let video = document.createElement('video');
            video.addEventListener('canplay', () => {
                resolve(video);
            });
            video.addEventListener('error', (err) => {
                reject(err);
            });
            video.crossOrigin = this.crossOrigin;
            video.autoplay = true;
            video.loop = true;
            video.muted = true;

            let resolveImmediately = false;
            if (casualOsUrl && casualOsUrl.type === 'video-element') {
                for (let sim of appManager.simulationManager.simulations.values()) {
                    const vid = sim.livekit.getVideoByAddress(
                        casualOsUrl.address
                    );
                    if (vid) {
                        video = vid;
                        resolveImmediately = true;
                        break;
                    }
                }
            } else {
                video.src = url;
            }

            video.play();

            this.video = video;

            if (resolveImmediately) {
                resolve(video);
            }
        });
    }

    cancel(): void {
        if (this.image) {
            this.image = null;
        }
        if (this.video) {
            this.video.remove();
            this.video = null;
        }
    }

    dispose(): void {
        this.cancel();
    }

    setCrossOrigin(crossOrigin: string): AuxTextureLoader {
        this.crossOrigin = crossOrigin;
        return this;
    }

    setPath(path: string): AuxTextureLoader {
        this.path = path;
        return this;
    }
}
