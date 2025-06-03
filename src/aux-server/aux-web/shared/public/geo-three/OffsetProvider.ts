import type { MapProvider } from 'geo-three';

/**
 * The width and height of a tile in pixels.
 */
const TILE_SIZE = 256;

// /**
//  * A Map of zoom levels to the map width and height in pixels.
//  */
// const LOD_TABLE: Map<number, number> = new Map([
//     [1, 512],
//     [2, 1024],
//     [3, 2048],
//     [4, 4096],
//     [5, 8192],
//     [6, 16384],
//     [7, 32768],
//     [8, 65536],
//     [9, 131072],
//     [10, 262144],
//     [11, 524288],
//     [12, 1048576],
//     [13, 2097152],
//     [14, 4194304],
//     [15, 8388608],
//     [16, 16777216],
//     [17, 33554432],
//     [18, 67108864],
//     [19, 134217728],
//     [20, 268435456],
//     [21, 536870912],
//     [22, 1073741824],
//     [23, 2147483648],
// ]);


export class OffsetProvider implements MapProvider {
    get name(): string {
        return this._inner.name;
    }

    get minZoom(): number {
        return this._inner.minZoom;
    }

    get maxZoom(): number {
        return this._inner.maxZoom;
    }

    get bounds(): number[] {
        return this._inner.bounds;
    }

    get center(): number[] {
        return this._inner.center;
    }

    private _inner: MapProvider;
    private _offset: [number, number, number] = [0, 0, 0];

    set offset(value: [number, number, number]) {
        this._offset = value;
    }

    constructor(inner: MapProvider, offset: [number, number, number] = [0, 0, 0]) {
        this._inner = inner;
        this._offset = offset;
    }

    static calculateOffset(zoom: number, x: number, y: number): [number, number, number] {
        const sinLatitude = Math.sin(y * Math.PI / 180);
        const powZoom = Math.pow(2, zoom);
        const mapSize = powZoom * TILE_SIZE;
        const pixelX = ((x + 180) / 360) * mapSize + 0.5;
        const pixelY = (0.5 - Math.log((1 + sinLatitude) / (1 - sinLatitude)) / (4 * Math.PI)) * mapSize + 0.5;

        const tileX = Math.floor(pixelX / TILE_SIZE);
        const tileY = Math.floor(pixelY / TILE_SIZE);

        console.log(`Tile coordinates: (${tileX}, ${tileY})`);
        return [zoom, tileX, tileY];
    }

    async fetchTile(zoom: number, x: number, y: number): Promise<any> {
        const offsetZoom = this._offset[0];
        const offsetX = this._offset[1];
        const offsetY = this._offset[2];
        return this._inner.fetchTile(zoom + offsetZoom, x + offsetX, y + offsetY);
    }

    async getMetaData(): Promise<void> {
        await this._inner.getMetaData();
    }

}