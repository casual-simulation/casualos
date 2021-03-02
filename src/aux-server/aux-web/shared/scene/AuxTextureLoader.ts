import {
    Texture,
    ImageLoader,
    RGBFormat,
    RGBAFormat,
    Loader,
} from '@casual-simulation/three';

// TODO: Put a max size on the cache.
const cache = new Map<string, Promise<Texture>>();

/**
 * Custom version of THREE.TextureLoader that exposes the ability to cancel an image load.
 */
export class AuxTextureLoader {
    crossOrigin: string = 'anonymous';
    path: string;
    image: HTMLImageElement;

    get isLoading(): boolean {
        return this.image !== null;
    }

    constructor() {}

    load(url: string): Promise<Texture> {
        let promise = cache.get(url);
        if (!promise) {
            promise = new Promise((resolve, reject) =>
                this._load(url, resolve, reject)
            );
            cache.set(url, promise);
        }
        return promise;
    }

    private _load(
        url: string,
        onLoad?: (texture: Texture) => void,
        onError?: (event: ErrorEvent) => void
    ): Texture {
        var texture = new Texture();

        var loader = new ImageLoader();
        loader.setCrossOrigin(this.crossOrigin);
        loader.setPath(this.path);

        var onImageLoad = (image: HTMLImageElement) => {
            texture.image = image;
            // JPEGs can't have an alpha channel, so memory can be saved by storing them as RGB.
            let isJPEG =
                url.search(/\.jpe?g($|\?)/i) > 0 ||
                url.search(/^data\:image\/jpeg/) === 0;

            texture.format = isJPEG ? RGBFormat : RGBAFormat;
            texture.needsUpdate = true;

            this.image = null;

            if (onLoad) {
                onLoad(texture);
            }
        };
        onImageLoad = onImageLoad.bind(this);

        var onImageError = (event: ErrorEvent) => {
            this.cancel();

            if (onError) {
                onError(event);
            }
        };
        onImageError = onImageError.bind(this);

        this.image = loader.load(url, onImageLoad, null, onImageError);

        return texture;
    }

    cancel(): void {
        if (!this.image) return;
        this.image = null;
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
