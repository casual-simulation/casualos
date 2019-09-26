import {
    Math as ThreeMath,
    MeshBasicMaterial,
    Texture,
    MeshToonMaterial,
    MeshStandardMaterial,
    SpriteMaterial,
} from 'three';
import {
    BotCalculationContext,
    calculateBotValue,
    hasValue,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { IMeshDecorator } from './IMeshDecorator';
import { AuxTextureLoader } from '../AuxTextureLoader';
import { EventBus } from '../../../shared/EventBus';

export class TextureDecorator extends AuxFile3DDecorator {
    /**
     * The url path of the texture.
     */
    image: string = null;

    private _targetMeshDecorator: IMeshDecorator;
    private _loader: AuxTextureLoader;
    private _texture: Texture = null;

    constructor(file3D: AuxFile3D, targetMeshDecorator: IMeshDecorator) {
        super(file3D);

        this._loader = new AuxTextureLoader();

        this._targetMeshDecorator = targetMeshDecorator;

        this._handleTargetMeshUpdated = this._handleTargetMeshUpdated.bind(
            this
        );
        this._handleTextureLoaded = this._handleTextureLoaded.bind(this);
        this._handleTextureError = this._handleTextureError.bind(this);

        this._targetMeshDecorator.onMeshUpdated.addListener(
            this._handleTargetMeshUpdated
        );
    }

    fileUpdated(calc: BotCalculationContext): void {
        let imageValueChanged = false;

        // Get value of image tag.
        const imageValue = calculateBotValue(
            calc,
            this.file3D.file,
            'aux.image'
        );

        if (hasValue(imageValue)) {
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
                this._loader.load(
                    this.image,
                    this._handleTextureLoaded,
                    this._handleTextureError
                );
            } else {
                this._texture = null;
            }

            this._updateTargetMeshTexture();
        }
    }

    frameUpdate(calc: BotCalculationContext) {}

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
        let material = <
            | MeshBasicMaterial
            | MeshToonMaterial
            | MeshStandardMaterial
            | SpriteMaterial
        >this._targetMeshDecorator.mesh.material;
        material.map = this._texture;
        // material.transparent = true;
        material.needsUpdate = true;
        EventBus.$emit('file_render_refresh', this.file3D.file);
    }

    private _handleTargetMeshUpdated(meshDecorator: IMeshDecorator): void {
        this._updateTargetMeshTexture();
    }

    private _handleTextureLoaded(texture: Texture): void {
        this._texture = texture;
        texture.needsUpdate = true;
        this._updateTargetMeshTexture();
        EventBus.$emit('file_render_refresh', this.file3D.file);
    }

    private _handleTextureError(error: ErrorEvent): void {
        if (this._texture) {
            this._texture.dispose();
        }
        this._texture = null;
        this._updateTargetMeshTexture();
    }
}
