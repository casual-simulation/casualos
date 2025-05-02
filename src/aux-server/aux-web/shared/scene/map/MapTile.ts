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
import { Color, DoubleSide, Vector3 } from '@casual-simulation/three';
import type { MapProvider } from 'geo-three';
import {
    FrontSide,
    LinearFilter,
    Mesh,
    MeshBasicMaterial,
    Object3D,
    PlaneGeometry,
    RGBAFormat,
    Side,
    Texture,
} from 'three';
import { DebugObjectManager } from '../debugobjectmanager/DebugObjectManager';
import { createCube } from '../SceneUtils';

export class MapTile extends Object3D {
    private _provider: MapProvider;
    private _plane: Mesh;
    private _container: Object3D;
    private _scaleContainer: Object3D;

    y: number = 0;
    x: number = 0;
    zoom: number = 0;

    private get _material(): THREE.MeshBasicMaterial {
        return this._plane.material as THREE.MeshBasicMaterial;
    }

    constructor(provider: MapProvider) {
        super();
        this._provider = provider;
        this._plane = new Mesh(
            new PlaneGeometry(1, 1),
            new MeshBasicMaterial({ wireframe: false, side: FrontSide })
        );
        this._plane.setRotationFromAxisAngle(
            new Vector3(1, 0, 0),
            -Math.PI / 2
        );
        this._container = new Object3D();
        this._container.add(this._plane);

        this._scaleContainer = new Object3D();
        this._scaleContainer.add(this._container);
        this.add(this._scaleContainer);
    }

    setTile(zoom: number, x: number, y: number) {
        this.zoom = zoom;
        this.y = y;
        this.x = x;

        this._loadTexture();
    }

    setClip(width: number, height: number, anchor: Vector3) {
        this._scaleContainer.position.set(anchor.x, anchor.y, anchor.z);
        this._plane.position.set(-anchor.x, -anchor.y, -anchor.z);

        this._scaleContainer.scale.set(width, 1, height);
        this._scaleContainer.updateMatrixWorld(true);

        // update UVs so that there is new stretching/squishing
        const geometry = this._plane.geometry as PlaneGeometry;
        const uvAttribute = geometry.attributes.uv;

        let uvLeft = 0;
        let uvRight = 1;
        if (anchor.x > 0) {
            uvLeft = 1 - width;
        } else if (anchor.x < 0) {
            uvRight = width;
        }

        let uvTop = 1;
        let uvBottom = 0;
        if (anchor.z > 0) {
            uvTop = height;
        } else if (anchor.z < 0) {
            uvBottom = 1 - height;
        }

        uvAttribute.setXY(0, uvLeft, uvTop);
        uvAttribute.setXY(1, uvRight, uvTop);
        uvAttribute.setXY(2, uvLeft, uvBottom);
        uvAttribute.setXY(3, uvRight, uvBottom);

        uvAttribute.needsUpdate = true;
        if (this._material.map) {
            this._material.map.needsUpdate = true;
        }
        this._material.needsUpdate = true;
    }

    private async _loadTexture() {
        const image: HTMLImageElement = await this._provider.fetchTile(
            this.zoom,
            this.x,
            this.y
        );
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
