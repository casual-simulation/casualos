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
import type { Mesh, MeshToonMaterial } from '@casual-simulation/three';
import { Group, MathUtils as ThreeMath } from '@casual-simulation/three';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import {
    isUserActive,
    calculateBooleanTagValue,
    DEFAULT_PLAYER_USER_COLOR,
} from '@casual-simulation/aux-common';
import { disposeMesh, createUserCone, buildSRGBColor } from '../SceneUtils';
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Event';
/**
 * Defines a class that represents a mesh for an "user" bot.
 */
export class UserMeshDecorator
    extends AuxBot3DDecoratorBase
    implements IMeshDecorator
{
    /**
     * The mesh that acts as the visual representation of the user.
     */
    mesh: Mesh;

    /**
     * The container for the meshes.
     */
    container: Group;

    get allowModifications() {
        return true;
    }

    get allowMaterialModifications() {
        return true;
    }

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    constructor(bot3D: AuxBot3D) {
        super(bot3D);

        // Container
        this.container = new Group();
        this.bot3D.display.add(this.container);

        // User Mesh
        this.mesh = createUserCone();
        this.container.add(this.mesh);
        this.mesh.rotation.x = ThreeMath.degToRad(90.0);
        this.mesh.rotation.y = ThreeMath.degToRad(45.0);

        this.onMeshUpdated.invoke(this);
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateColor(calc);
        this.bot3D.display.updateMatrixWorld(false);
    }

    frameUpdate(calc: BotCalculationContext) {
        // visible if not destroyed, and was active in the last minute
        this.container.visible = this._isActive(calc);
    }

    dispose() {
        this.bot3D.display.remove(this.container);

        this.mesh.geometry.dispose();
        disposeMesh(this.mesh);

        this.mesh = null;
        this.container = null;
    }

    private _isActive(calc: BotCalculationContext): boolean {
        let userVisible = calculateBooleanTagValue(
            calc,
            this.bot3D.dimensionGroup.bot,
            'auxDimensionDevicesVisible',
            true
        );

        return isUserActive(calc, this.bot3D.bot) && userVisible;
    }

    private _updateColor(calc: BotCalculationContext) {
        if (this.bot3D.dimensionGroup === null) {
            return;
        }

        const color = DEFAULT_PLAYER_USER_COLOR;
        const material: MeshToonMaterial = <MeshToonMaterial>this.mesh.material;
        material.color.set(buildSRGBColor(color));

        this.container.visible = this._isActive(calc);
    }
}
