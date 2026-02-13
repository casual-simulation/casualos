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
import type {
    MeshBasicMaterial,
    Texture,
    MeshStandardMaterial,
    SpriteMaterial,
    MeshToonMaterial,
} from '@casual-simulation/three';
import { SRGBColorSpace } from '@casual-simulation/three';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import { calculateBotValue, hasValue } from '@casual-simulation/aux-common';
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type { IMeshDecorator } from './IMeshDecorator';
import { AuxTextureLoader } from '../AuxTextureLoader';
import { EventBus } from '@casual-simulation/aux-components';

export class TextureDecorator extends AuxBot3DDecoratorBase {
    /**
     * The url path of the texture.
     */
    image: string = null;

    private _targetMeshDecorator: IMeshDecorator;
    private _loader: AuxTextureLoader;
    private _texture: Texture = null;

    constructor(bot3D: AuxBot3D, targetMeshDecorator: IMeshDecorator) {
        super(bot3D);

        this._loader = new AuxTextureLoader();

        this._targetMeshDecorator = targetMeshDecorator;

        this._handleTargetMeshUpdated =
            this._handleTargetMeshUpdated.bind(this);
        this._handleTextureLoaded = this._handleTextureLoaded.bind(this);
        this._handleTextureError = this._handleTextureError.bind(this);

        this._targetMeshDecorator.onMeshUpdated.addListener(
            this._handleTargetMeshUpdated
        );
    }

    botUpdated(calc: BotCalculationContext): void {
        let imageValueChanged = false;

        // Get value of image tag.
        const imageValue: string = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxFormAddress'
        );

        if (this._canSetTexture() && hasValue(imageValue)) {
            if (this.image !== imageValue) {
                this.image = imageValue;
                imageValueChanged = true;
            }
        } else {
            if (this.image !== null && this.image !== undefined) {
                this.image = null;
                imageValueChanged = true;
            }
        }

        if (imageValueChanged) {
            if (this._loader.isLoading) {
                // Cancel texture loading if previously in progress.
                this._loader.cancel();
            }

            if (this._texture) {
                // Dispose of previous texture.
                this._texture.dispose();
            }

            // Assign value of texture.
            if (this.image) {
                if (this._targetMeshDecorator.allowModifications) {
                    this.bot3D.display.visible = false;
                }
                this._loader
                    .load(this.image)
                    .then(this._handleTextureLoaded, this._handleTextureError);
            } else {
                this._texture = null;
            }

            this._updateTargetMeshTexture();
        }
    }

    private _canSetTexture() {
        return (
            this._targetMeshDecorator.mesh &&
            this._targetMeshDecorator.allowMaterialModifications
        );
    }

    dispose() {
        if (this._targetMeshDecorator) {
            this._targetMeshDecorator.onMeshUpdated.removeListener(
                this._handleTargetMeshUpdated
            );
        }

        if (this._texture) {
            this._texture.dispose();
        }

        this._loader.dispose();
    }

    private _updateTargetMeshTexture(): void {
        if (
            !this._targetMeshDecorator.allowModifications ||
            !this._canSetTexture()
        ) {
            return;
        }

        let material = <
            | MeshBasicMaterial
            | MeshToonMaterial
            | MeshStandardMaterial
            | SpriteMaterial
        >this._targetMeshDecorator.mesh.material;
        material.map = this._texture;
        // material.transparent = true;
        material.needsUpdate = true;
        EventBus.$emit('bot_render_refresh', this.bot3D.bot);
    }

    private _handleTargetMeshUpdated(meshDecorator: IMeshDecorator): void {
        this._updateTargetMeshTexture();
    }

    private _handleTextureLoaded(texture: Texture): void {
        if (this._targetMeshDecorator.allowModifications) {
            this.bot3D.display.visible = true;
        }
        texture.colorSpace = SRGBColorSpace;
        this._texture = texture;

        texture.needsUpdate = true;
        this._updateTargetMeshTexture();
        EventBus.$emit('bot_render_refresh', this.bot3D.bot);
    }

    private _handleTextureError(error: ErrorEvent): void {
        if (this._targetMeshDecorator.allowModifications) {
            this.bot3D.display.visible = true;
        }
        if (this._texture) {
            this._texture.dispose();
        }
        this._texture = null;
        this._updateTargetMeshTexture();

        console.error('[TextureDecorator] Error loading texture:', error);
    }
}
