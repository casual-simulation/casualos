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
import { Object3D } from '@casual-simulation/three';

/**
 * Defines an interface for a game object that contains a set of colliders.
 */
export interface IGameObject {
    /**
     * The colliders that this object has.
     */
    colliders: Object3D[];

    /**
     * Allows object to clean itself up before being removed.
     */
    dispose(): void;
}

/**
 * Defines a class for a game object that can contain a mesh and a collider.
 */
export class GameObject extends Object3D implements IGameObject {
    name = 'GameObject';
    
    private _colliders: Object3D[];

    /**
     * The colliders that this object has.
     */
    get colliders(): Object3D[] {
        return this._colliders;
    }

    /**
     * The colliders that this object has.
     */
    set colliders(value: Object3D[]) {
        this._colliders = value;
    }

    /**
     * Whether the object can receive pointer events.
     */
    pointable: boolean;

    /**
     * Whether the object can receive focus events.
     */
    focusable: boolean;

    constructor() {
        super();
        this.colliders = [];
        this.pointable = true;
        this.focusable = true;
    }

    /**
     * Runs any logic that the object needs to do each frame.
     */
    // frameUpdate() {
    // }

    /**
     * Allows object to clean itself up before being removed.
     */
    dispose() {}
}
