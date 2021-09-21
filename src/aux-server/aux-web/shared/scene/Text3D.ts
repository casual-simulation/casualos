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
    Quaternion,
} from '@casual-simulation/three';

import {
    BotLabelAnchor,
    BotLabelAlignment,
    BotLabelWordWrap,
} from '@casual-simulation/aux-common';
import { DebugObjectManager } from './debugobjectmanager/DebugObjectManager';
import { Text as TextMesh } from 'troika-three-text';
import Roboto from '@casual-simulation/aux-components/fonts/Roboto/roboto-v18-latin-regular.woff';

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

    public static readonly extraSpace: number = 0.001;
    public static readonly floatingExtraSpace: number = 0.4;

    /**
     * Number chosen by expirementation to place 5-6 characters on a bot.
     */
    public static readonly defaultFontSize: number = 0.325;
    public static readonly defaultWidth: number = 1;
    public static readonly minWidth: number = 0.01;

    public static readonly defaultScale: number = 1;

    public currentWidth: number = 200;

    // The TextMesh that this object wraps.
    private _mesh: TextMesh;

    // the text that was last set on this text3d.
    private _unprocessedText: string;

    // The bounding box for the text 3d in world space.
    private _boundingBox: Box3;

    // The anchor position for the text 3d.
    private _anchor: BotLabelAnchor = 'top';

    // The word wrapping mode for the text 3d.
    private _wordWrap: BotLabelWordWrap = 'breakCharacters';

    private _renderedThisFrame: boolean = false;

    // The anchor position for the text 3d.

    /**
     * Gets whether this Text3D has been rendered since the last time this property was checked.
     */
    renderedThisFrame() {
        const rendered = this._renderedThisFrame;
        this._renderedThisFrame = false;
        return rendered;
    }

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
     * The bounding box of this text 3d in local space.
     */
    private get _localBoundingBox(): Box3 {
        if (this._mesh) {
            return this._mesh.geometry.boundingBox;
        }
        return new Box3();
    }

    /**
     * Create text 3d.
     */
    constructor() {
        super();

        let width = Text3D.defaultWidth;

        this._mesh = new TextMesh();

        this._mesh.text = '';
        this._mesh.textAlign = 'center';
        this._mesh.font = Roboto;
        this._mesh.fontSize = Text3D.defaultFontSize;
        this._mesh.maxWidth = width;
        this._mesh.anchorX = 'center';
        this._mesh.anchorY = 'middle';
        this._mesh.whiteSpace = 'normal';
        this._mesh.overflowWrap = 'break-word';

        this.add(this._mesh);

        this._mesh.position.set(0, 0, 0);

        this.updateBoundingBox();
    }

    /**
     * Sets the position of the text based on the size of the given bounding box.
     * Returns whether a call to sync() is required.
     * @param obj The object that this text's position should be set for.
     * @param offset An arbitrary offset to apply to the text.
     */
    public setPositionForObject(obj: Object3D, objCenter: Vector3 = null) {
        this.updateBoundingBox();

        const tempPos = new Vector3();
        const tempRot = new Quaternion();
        const worldScale = new Vector3();
        obj.matrixWorld.decompose(tempPos, tempRot, worldScale);

        const center = objCenter ? obj.worldToLocal(objCenter.clone()) : null;
        if (center) {
            center.multiply(worldScale);
        }

        const [pos, rotation, anchor] = this._calculateAnchorPosition(
            worldScale,
            center
        );

        // Grab the world scale and "remove" it from the final position.
        // We have to do this because labels shouldn't be affected by scale
        // but parenting bots via the transformer tag causes the bot container to be placed inside another
        // bot's scale container.
        this.parent.matrixWorld.decompose(tempPos, tempRot, worldScale);
        pos.divide(worldScale);

        const worldPos = pos.clone();
        this.parent.localToWorld(worldPos);

        this.position.copy(pos);
        let changed = this._mesh.anchorX !== anchor;
        this._mesh.anchorX = anchor;
        this._mesh.rotation.copy(new Euler(rotation.x, rotation.y, rotation.z));

        if (!changed) {
            this.updateBoundingBox();
        }

        return changed;
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
        this._mesh.geometry.computeBoundingBox();
        if (!this._boundingBox) {
            this._boundingBox = new Box3();
        }
        this._boundingBox.copy(this._mesh.geometry.boundingBox);
        // box.min.z = -1;
        // box.max.z = 1;

        // Apply the matrix to the bounding box.
        let matrix = this._mesh.matrixWorld;
        this._boundingBox.applyMatrix4(matrix);
    }

    /**
     * Set the text to display with this 3d text.
     * Returns whether an update was needed.
     * @param text the text to display.
     * @param alignment The alignment to set.
     */
    public setText(text: string, alignment?: BotLabelAlignment) {
        // Ignore if the text is already set to provided value.
        if (
            this._unprocessedText === text &&
            this._mesh.textAlign === alignment
        ) {
            return false;
        }

        this._unprocessedText = text;

        if (text) {
            // Text has value, enable the mesh and update the geometry.
            this.visible = true;
            this._mesh.text = text;
            this._mesh.textAlign = alignment;
            this.updateBoundingBox();
        } else {
            // Disable the text's rendering.
            this.visible = false;
        }
        return true;
    }

    /**
     * Set the text's color.
     * @param color The color value either in string or THREE.Color.
     */
    public setColor(color: Color) {
        this._mesh.color = color;
    }

    /**
     * Set the text's opacity.
     * @param number The opacity value either in between 0 and 1.
     */
    public setOpacity(number: number) {
        this._mesh.material.opacity = number;
    }

    /**
     * Sets the text's font. Returns whether a call to sync() is needed.
     * @param fontUrl The URL to the font file that should be used. Supports .otf and .woff.
     */
    public setFont(fontUrl: string): boolean {
        if (this._mesh.font === fontUrl) {
            return false;
        }
        this._mesh.font = fontUrl;
        return true;
    }

    /**
     * Set the scale of the text.
     * Returns whether a call to sync() is needed.
     * @param scale The scale of the text mesh. (default is 0.004)
     */
    public setScale(scale: number): boolean {
        if (this.scale.x !== scale) {
            this.scale.setScalar(scale);
            this.updateBoundingBox();
        }

        return false;
    }

    /**
     * Set the font size of the text.
     * Returns whether a call to sync() is needed.
     * @param size The font size of the text.
     */
    public setFontSize(size: number): boolean {
        if (this._mesh.fontSize !== size) {
            this._mesh.fontSize = size;
            return true;
        } else {
            return false;
        }
    }

    /**
     * Sets the width of the text.
     * @param width The width that the text should be.
     */
    public setWidth(width: number): boolean {
        if (this.currentWidth !== width) {
            if (width === undefined) {
                width = Text3D.defaultWidth;
            } else if (width < Text3D.minWidth) {
                width = Text3D.minWidth;
            }

            this.currentWidth = width;
            this._mesh.maxWidth = width;
            return true;
        }

        return false;
    }

    /**
     * Calculates the font size required so that this text fits the given target bounding box.
     * @param height The target height that the text should fit in.
     * @param minFontSize The minimum allowed font size.
     * @param maxFontSize The maximum allowed font size.
     * @param fit The maximum difference in font size between a perfect fit to the target and the calculated fit.
     * @param maxIterations The maximum number of iterations that the binary search should perform.
     */
    public async calculateFontSizeToFit(
        height: number,
        minFontSize = 0.1 * Text3D.defaultFontSize,
        maxFontSize = 2 * Text3D.defaultFontSize,
        fit: number = 0.01,
        maxIterations: number = 5
    ): Promise<number> {
        const text = new Text3D();
        text.copy(this);

        text.parent = this.parent;
        text.visible = false;
        text.updateMatrixWorld(true);

        try {
            let lowerBound = 0;
            let upperBound = maxFontSize;
            let current = midpoint(lowerBound, upperBound);
            let currentSize = new Vector3();
            let bestFit = Infinity;
            let bestFitSize = current;
            text._localBoundingBox.getSize(currentSize);

            for (let i = 0; i < maxIterations; i++) {
                // update the font size
                text.setFontSize(current);
                await text.sync();

                // check the bounding box size compared to the bot
                text._localBoundingBox.getSize(currentSize);

                // axis is always Y because we are comparing in local space
                const delta = currentSize.y - height;

                // While the best fit is larger than the target
                // box, choose the smallest delta
                if (bestFit > 0) {
                    if (delta < bestFit) {
                        bestFit = delta;
                        bestFitSize = current;
                    }

                    // otherwise only take sizes that are smaller than the
                    // target box
                } else if (delta < 0) {
                    if (delta > bestFit) {
                        bestFit = delta;
                        bestFitSize = current;
                    }
                }

                if (delta < 0 && Math.abs(delta) < fit) {
                    // We fit inside the area and have met a target size we can break now.
                    break;
                }

                // We have reached the minimum allowed font size but still need to go smaller.
                // break to prevent smaller sizes
                if (current <= minFontSize) {
                    break;
                }

                if (current >= maxFontSize) {
                    break;
                }

                if (Math.abs(lowerBound - upperBound) < 0.001) {
                    // Short curcuit for when the lower bounds and the upper bounds have crossed
                    break;
                }

                if (delta < 0) {
                    // Too small
                    lowerBound = current;
                    current = midpoint(lowerBound, upperBound);

                    // Clamp the current size to the max font size
                    if (current >= maxFontSize) {
                        current = maxFontSize;
                    }
                } else {
                    // we are still too large, need to reduce the bounds and font size.
                    upperBound = current;
                    current = midpoint(lowerBound, upperBound);

                    // Clamp the current size to the minimum font size
                    if (current <= minFontSize) {
                        current = minFontSize;
                    }
                }
            }

            return bestFitSize;
        } finally {
            text.parent = null;
            text.dispose();
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
     * Returns whether a call to sync() is required.
     * @param anchor The anchor.
     */
    public setAnchor(anchor: BotLabelAnchor): boolean {
        if (this._anchor === anchor) {
            return false;
        }
        this._anchor = anchor;

        if (anchor === 'floating') {
            this._mesh.anchorY = 'bottom';
        } else {
            this._mesh.anchorY = 'middle';
        }
        return true;
    }

    /**
     * Sets the word wrapping mode that this text should use.
     * Returns whether a call to sync() is required.
     * @param mode The word wrap mode.
     */
    public setWordWrapMode(mode: BotLabelWordWrap): boolean {
        if (this._wordWrap === mode) {
            return false;
        }
        this._wordWrap = mode;

        if (this._wordWrap === 'breakCharacters') {
            this._mesh.whiteSpace = 'normal';
            this._mesh.overflowWrap = 'break-word';
        } else if (this._wordWrap === 'breakWords') {
            this._mesh.whiteSpace = 'normal';
            this._mesh.overflowWrap = 'normal';
        } else if (this._wordWrap === 'none') {
            this._mesh.whiteSpace = 'nowrap';
        }

        return true;
    }

    public dispose(): void {
        this._mesh.dispose();
        this._mesh = null;
    }

    public copy(other: this, recursive?: boolean): this {
        this._mesh.text = other._mesh.text;
        this._mesh.textAlign = other._mesh.textAlign;
        this._mesh.font = other._mesh.font;
        this._mesh.fontSize = other._mesh.fontSize;
        this._mesh.maxWidth = other._mesh.maxWidth;
        this._mesh.anchorX = other._mesh.anchorX;
        this._mesh.anchorY = other._mesh.anchorY;
        this._mesh.whiteSpace = other._mesh.whiteSpace;
        this._mesh.overflowWrap = other._mesh.overflowWrap;
        this._mesh.color = other._mesh.color;
        this._mesh.rotation.copy(other._mesh.rotation);
        this._anchor = other._anchor;
        this._unprocessedText = other._unprocessedText;
        this.currentWidth = other.currentWidth;
        this._boundingBox = other.boundingBox.clone();
        this.scale.copy(other.scale);
        this.position.copy(other.position);
        this.rotation.copy(other.rotation);

        return this;
    }

    /**
     * Syncs the updated properties with the mesh geometry.
     */
    public sync(): Promise<void> {
        return new Promise((resolve, reject) => {
            this._mesh.sync(() => {
                this._onSync();
                resolve();
            });
        });
    }

    private _onSync() {
        if (!this._mesh) {
            return;
        }
        this.updateBoundingBox();
        this._renderedThisFrame = true;
    }

    private _calculateAnchorPosition(
        scale: Vector3,
        objCenter: Vector3
    ): [Vector3, Euler, 'left' | 'right' | 'center'] {
        // // Position the mesh some distance above the given object's bounding box.
        let targetSize = scale;
        let targetCenter = objCenter
            ? objCenter
            : new Vector3(0, targetSize.y * 0.5, 0);

        const positionMultiplier = 0.5;

        if (this._anchor === 'floating') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y +
                        targetSize.y * positionMultiplier +
                        Text3D.floatingExtraSpace,
                    targetCenter.z
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(0), 0), anchor];
        } else if (this._anchor === 'front') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y,
                    targetCenter.z +
                        targetSize.z * positionMultiplier +
                        Text3D.extraSpace
                )
            );

            return [pos, new Euler(ThreeMath.degToRad(0), 0, 0), anchor];
        } else if (this._anchor === 'back') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                -1,
                new Vector3(
                    0,
                    targetCenter.y,
                    targetCenter.z -
                        targetSize.z * positionMultiplier -
                        Text3D.extraSpace
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(180), 0), anchor];
        } else if (this._anchor === 'left') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'z',
                this._mesh.textAlign,
                -1,
                new Vector3(
                    targetCenter.x +
                        targetSize.x * positionMultiplier +
                        Text3D.extraSpace,
                    targetCenter.y,
                    0
                )
            );

            return [pos, new Euler(0, ThreeMath.degToRad(90), 0), anchor];
        } else if (this._anchor === 'right') {
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'z',
                this._mesh.textAlign,
                1,
                new Vector3(
                    targetCenter.x -
                        targetSize.x * positionMultiplier -
                        Text3D.extraSpace,
                    targetCenter.y,
                    0
                )
            );
            return [pos, new Euler(0, ThreeMath.degToRad(-90), 0), anchor];
        } else {
            // default to top
            let [pos, anchor] = this._positionOffset(
                targetCenter,
                targetSize,
                'x',
                this._mesh.textAlign,
                1,
                new Vector3(
                    0,
                    targetCenter.y +
                        targetSize.y * positionMultiplier +
                        Text3D.extraSpace,
                    targetCenter.z
                )
            );

            return [
                pos,
                new Euler(ThreeMath.degToRad(-90), ThreeMath.degToRad(0), 0),
                anchor,
            ];
        }
    }

    private _positionOffset(
        center: Vector3,
        size: Vector3,
        alignAxis: 'x' | 'y' | 'z',
        align: 'left' | 'right' | 'center' | 'justify',
        alignMultiplier: number,
        offset: Vector3
    ) {
        const half = 0.5;
        let final = offset.clone();
        let alignOffset = new Vector3(
            alignAxis === 'x'
                ? align === 'left'
                    ? center.x - size.x * half
                    : align === 'right'
                    ? center.x + size.x * half
                    : center.x
                : 0,
            alignAxis === 'y'
                ? align === 'left'
                    ? center.y - size.y * half
                    : align === 'right'
                    ? center.y + size.y * half
                    : center.y
                : 0,
            alignAxis === 'z'
                ? align === 'left'
                    ? center.z - size.z * half
                    : align === 'right'
                    ? center.z + size.z * half
                    : center.z
                : 0
        );
        alignOffset.multiplyScalar(alignMultiplier);
        let anchor: 'left' | 'right' | 'center';
        if (align === 'left') {
            anchor = 'left';
        } else if (align === 'right') {
            anchor = 'right';
        } else {
            anchor = 'center';
        }

        final.add(alignOffset);
        return [final, anchor] as const;
    }
}

function midpoint(lower: number, upper: number) {
    let half = (upper - lower) * 0.5;
    return lower + half;
}
