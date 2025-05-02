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
import type { MapProvider } from 'geo-three';
import { FrontSide, LinearFilter, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, RGBAFormat, Side, Texture } from 'three';


export class MapTile extends Object3D {
    private _provider: MapProvider;
    private _plane: THREE.Mesh;

    latitude: number = 0;
    longitude: number = 0;
    zoom: number = 0;

    private get _material(): THREE.MeshBasicMaterial {
        return this._plane.material as THREE.MeshBasicMaterial;
    }

    constructor(provider: MapProvider) {
        super();
        this._provider = provider;
        this._plane = new Mesh(
            new PlaneGeometry(1, 1),
            new MeshBasicMaterial({ side: FrontSide })
        );
    }

    setTile(zoom: number, latitude: number, longitude: number) {
        this.zoom = zoom;
        this.latitude = latitude;
        this.longitude = longitude;

        this._loadTexture();
    }

    private async _loadTexture() {
        const image: HTMLImageElement = await this._provider.fetchTile(this.zoom, this.latitude, this.longitude);
        const texture = new Texture(image);
        texture.generateMipmaps = false;
        texture.format = RGBAFormat;
        texture.magFilter = LinearFilter;
        texture.minFilter = LinearFilter;
        texture.needsUpdate = true;
        
        this._material.map = texture;
        this._material.needsUpdate = true;
    }
}