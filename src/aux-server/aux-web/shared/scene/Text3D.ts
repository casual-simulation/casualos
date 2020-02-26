import {
    MathUtils as ThreeMath,
    Mesh,
    Object3D,
    DoubleSide,
    Color,
    TextureLoader,
    Texture,
    Vector3,
    Box3,
    RawShaderMaterial,
    LinearFilter,
    Euler,
    Matrix4,
} from 'three';

import robotoFont from '../public/bmfonts/Roboto.json';
import robotoTexturePath from '../public/bmfonts/Roboto.png';
import createBMFont, {
    TextGeometry,
    TextGeometryOptions,
} from 'three-bmfont-text';
import { calculateAnchorPosition } from './SceneUtils';
import { BotLabelAnchor } from '@casual-simulation/aux-common';

var sdfShader = require('three-bmfont-text/shaders/sdf');

export interface Text3DFont {
    /**
     * The path to the json data for the font.
     */
    dataPath: string;

    /**
     * The path the to texture for the font.
     */
    texturePath: string;
}

export class Text3D extends Object3D {
    // Map of loaded font textures.
    public static FontTextures: {
        [texturePath: string]: Texture;
    } = {};

    public static readonly defaultWidth: number = 200;
    public static readonly extraSpace: number = 0.01;
    public static readonly floatingExtraSpace: number = 0.12;
    public static readonly defaultScale: number = 0.004;

    public currentWidth: number = 200;

    // The text geometry created with 'three-bmfont-text'
    // To change text, run textGeometry.update and include the proper options.
    private _geometry: TextGeometry;

    // The text mesh that is holding onto the text geometry that gets rendered by three.
    private _mesh: Mesh;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

    // The bounding box for the text 3d.
    private _boundingBox: Box3;

    // The anchor position for the text 3d.
    private _anchor: BotLabelAnchor = 'top';

    // The anchor position for the text 3d.

    /**
     * the text that was last set on this text3d.
     */
    get unprocessedText(): string {
        return this._unprocessedText;
    }

    /**
     * The bounding box of this text 3d. This bounding box is in world space.
     */
    get boundingBox(): Box3 {
        return this._boundingBox && this.visible
            ? this._boundingBox.clone()
            : new Box3();
    }

    /**
     * Create text 3d.
     * @param font what font to use for the text3d.
     */
    constructor(width?: number, font?: Text3DFont) {
        super();

        if (!font)
            font = { dataPath: robotoFont, texturePath: robotoTexturePath };

        if (!Text3D.FontTextures[font.texturePath]) {
            // Load font texture and store it for other 3d texts to use.
            Text3D.FontTextures[font.texturePath] = new TextureLoader().load(
                font.texturePath
            );
        }

        var texture = Text3D.FontTextures[font.texturePath];

        // Modify filtering of texture for optimal SDF rendering.
        // This effectively disables the use of any mip maps, allowing the SDF shader to continue
        // to draw the text when view from a long distance. Otherwise, the SDF shader tends to 'fizzle'
        // out when the text is viewed from long distances.
        texture.minFilter = LinearFilter;
        texture.magFilter = LinearFilter;

        if (width === undefined || width < Text3D.defaultWidth) {
            width = Text3D.defaultWidth;
        }

        this.currentWidth = width;

        this._geometry = createBMFont({
            font: font.dataPath,
            text: '',
            flipY: true,
            align: 'center',
            width: width,
        });

        var material = new RawShaderMaterial(
            sdfShader({
                map: texture,
                side: DoubleSide,
                transparent: true,
                // depthTest: false,
                // depthWrite: false,
                color: new Color(0, 0, 0),
            })
        );

        this._mesh = new Mesh(this._geometry, material);
        this.add(this._mesh);
        this.setScale(Text3D.defaultScale);

        // Rotate the text mesh so that it is upright when rendered.
        this._mesh.rotateX(ThreeMath.degToRad(180));
        this._mesh.position.set(0, 0, 0);

        this.updateBoundingBox();
    }

    /**
     * Sets the position of the text based on the size of the given bounding box.
     */
    public setPositionForBounds(bounds: Box3) {
        if (!bounds || bounds.isEmpty()) return;

        this.updateBoundingBox();

        const [pos, rotation] = calculateAnchorPosition(
            bounds,
            this._anchor,
            this,
            this._boundingBox,
            Text3D.defaultScale,
            this._anchor === 'floating'
                ? Text3D.floatingExtraSpace
                : Text3D.extraSpace
        );
        this.position.copy(pos);
        this._mesh.rotation.copy(
            new Euler(
                rotation.x + ThreeMath.degToRad(90),
                rotation.y,
                rotation.z
            )
        );

        this.updateBoundingBox();
    }

    public setWorldPosition(worldPos: Vector3) {
        if (!worldPos) return;

        let myMin = this._boundingBox.min.clone();
        let myMax = this._boundingBox.max.clone();

        let bottomCenter = new Vector3(
            (myMax.x - myMin.x) / 2 + myMin.x,
            myMin.y,
            (myMax.z - myMin.z) / 2 + myMin.z
        );

        let posOffset = this.position.clone().sub(bottomCenter);

        this.position.set(worldPos.x, worldPos.y, worldPos.z);
        this.position.add(posOffset);

        this.updateBoundingBox();
    }

    /**
     * Update the bounding box for this text 3d.
     * This is normally run automatically after updating attributes of the text 3d.
     */
    public updateBoundingBox(): void {
        this.updateMatrixWorld(true);
        this._geometry.computeBoundingBox();
        let box = this._geometry.boundingBox.clone();
        box.min.z = -1;
        box.max.z = 1;

        let anchorWorldScale = new Vector3();
        this.getWorldScale(anchorWorldScale);

        let position = new Vector3();
        this._mesh.getWorldPosition(position);

        // Apply the matrix to the bounding box.
        let matrix = new Matrix4();
        matrix.compose(
            position,
            this._mesh.quaternion.clone(),
            anchorWorldScale
        );
        box.applyMatrix4(matrix);

        if (!this._boundingBox) {
            this._boundingBox = new Box3();
        }

        this._boundingBox.copy(box);
    }

    /**
     * Set the text to display with this 3d text.
     * @param text the text to display.
     */
    public setText(text: string) {
        // Ignore if the text is already set to provided value.
        if (this._unprocessedText === text) return;

        this._unprocessedText = text;

        if (text) {
            if (text.toString().includes('guest_')) {
                text = 'Guest';
            }

            // Text has value, enable the mesh and update the geometry.
            this.visible = true;
            this._geometry.update(text.toString());
            this.updateBoundingBox();
        } else {
            // Disable the text's rendering.
            this.visible = false;
        }
    }

    /**
     * Set the text's color.
     * @param color The color value either in string or THREE.Color.
     */
    public setColor(color: Color) {
        var material = <RawShaderMaterial>this._mesh.material;
        material.uniforms.color.value = color;
    }

    /**
     * Set the options for the text geometry used by this text 3d.
     * @param opt The options to set on the text geometry.
     */
    public setOptions(opt: TextGeometryOptions) {
        this._geometry.update(opt);
        this._unprocessedText = opt.text;

        if (opt.text) {
            // Text has value, enable the mesh.
            this.visible = true;
            this.updateBoundingBox();
        } else {
            // Disable the text's rendering.
            this.visible = false;
        }
    }

    /**
     * Set the scale of the text.
     * @param scale The scale of the text mesh. (default is 0.004)
     */
    public setScale(scale: number) {
        if (this.scale.x !== scale) {
            this.scale.setScalar(scale);
            this.updateBoundingBox();
        }
    }

    public setRotation(x?: number, y?: number, z?: number) {
        let nextRotation = new Euler().copy(this.rotation);
        if (!(x === null || typeof x === 'undefined')) {
            nextRotation.x = x * (Math.PI / 180);
        }
        if (!(y === null || typeof y === 'undefined')) {
            nextRotation.y = y * (Math.PI / 180);
        }
        if (!(z === null || typeof z === 'undefined')) {
            nextRotation.z = z * (Math.PI / 180);
        }

        this.rotation.copy(nextRotation);
        this.updateBoundingBox();
    }

    /**
     * Sets the anchor position that this text should use.
     * Requires updating the position by calling setPositionForBounds after changing the anchor.
     * @param anchor The anchor.
     */
    public setAnchor(anchor: BotLabelAnchor) {
        this._anchor = anchor;
    }

    public dispose(): void {}
}
