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
import {
    Group,
    Mesh,
    MeshBasicMaterial,
    BackSide,
} from '@casual-simulation/three';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import { calculateBotValue, hasValue } from '@casual-simulation/aux-common';
import { disposeMesh, isTransparent, buildSRGBColor } from '../SceneUtils';
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type { IMeshDecorator } from './IMeshDecorator';
import { ArgEvent } from '@casual-simulation/aux-common/Event';

const BASE_SCALAR = 0.25;
const DEFAULT_OUTLINE_COLOR: string = '#000000';
const DEFAULT_OUTLINE_WIDTH: number = 1;

// This decorator is unfinished.
// Need to figure out a way to render the outline meshes in a manner that achieves these things:
//   1. Renders behind normal bot mesh.
//   2. Does not intersect other outlines (dont do full fledged depth sorting against other outlines).
//   3. Still gets occluded by other meshes (hexes and bots) that are in front of it.

// NOTE: This decorator is supposed to replace the aux.stroke implementation
//       that is currently in BotShapeDecorator sometime in the future.
export class OutlineDecorator
    extends AuxBot3DDecoratorBase
    implements IMeshDecorator
{
    /**
     * The mesh for the outline.
     */
    mesh: Mesh;

    /**
     * The container for the meshes.
     */
    container: Group;

    /**
     * The width of the outline.
     */
    width: number = DEFAULT_OUTLINE_WIDTH;

    /**
     * The color of the outline.
     */
    color: string = DEFAULT_OUTLINE_COLOR;

    get allowModifications() {
        return true;
    }

    get allowMaterialModifications() {
        return true;
    }

    onMeshUpdated: ArgEvent<IMeshDecorator> = new ArgEvent<IMeshDecorator>();

    private _targetMeshDecorator: IMeshDecorator;

    constructor(bot3D: AuxBot3D, targetMeshDecorator: IMeshDecorator) {
        super(bot3D);

        this._targetMeshDecorator = targetMeshDecorator;
        this._rebuildOutlineMesh();
        this._updateOutlineMesh();

        this._handleTargetMeshUpdated =
            this._handleTargetMeshUpdated.bind(this);

        this._targetMeshDecorator.onMeshUpdated.addListener(
            this._handleTargetMeshUpdated
        );
    }

    botUpdated(calc: BotCalculationContext): void {
        // Color
        const colorValue: string = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxStrokeColor'
        );
        if (hasValue(colorValue)) {
            this.color = colorValue;
        } else {
            this.color = DEFAULT_OUTLINE_COLOR;
        }

        // Width
        const widthValue: number = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxStrokeWidth'
        );
        if (hasValue(widthValue)) {
            this.width = widthValue;
        } else {
            this.width = DEFAULT_OUTLINE_WIDTH;
        }

        this._updateOutlineMesh();
    }

    dispose() {
        if (this._targetMeshDecorator) {
            this._targetMeshDecorator.onMeshUpdated.removeListener(
                this._handleTargetMeshUpdated
            );
        }

        this.bot3D.display.remove(this.container);
        disposeMesh(this.mesh);

        this.mesh = null;
        this.container = null;
    }

    private _rebuildOutlineMesh() {
        if (this.mesh) {
            this.dispose();
        }

        // Container
        this.container = new Group();
        this.container.position.copy(
            this._targetMeshDecorator.container.position
        );
        this.bot3D.display.add(this.container);

        // Mesh
        let outlineGeo = this._targetMeshDecorator.mesh.geometry;
        let outlineMat = new MeshBasicMaterial({
            color: buildSRGBColor(DEFAULT_OUTLINE_COLOR),
            side: BackSide,
        });

        this.mesh = new Mesh(outlineGeo, outlineMat);
        this.mesh.name = 'Outline_Mesh';
        this.container.add(this.mesh);
    }

    private _updateOutlineMesh() {
        if (!this.mesh) {
            return;
        }

        // Color
        const material = <MeshBasicMaterial>this.mesh.material;
        if (!isTransparent(this.color)) {
            material.visible = true;
            material.color = buildSRGBColor(this.color);
        } else {
            material.visible = false;
        }

        // Width
        if (this.width > 0) {
            material.visible = true;
            const targetScale = this._targetMeshDecorator.mesh.scale;
            this.mesh.scale.set(
                targetScale.x + BASE_SCALAR * this.width,
                targetScale.y + BASE_SCALAR * this.width,
                targetScale.z + BASE_SCALAR * this.width
            );
        } else {
            material.visible = false;
        }
    }

    private _handleTargetMeshUpdated(meshDecorator: IMeshDecorator): void {
        this._rebuildOutlineMesh();
        this._updateOutlineMesh();
    }
}
