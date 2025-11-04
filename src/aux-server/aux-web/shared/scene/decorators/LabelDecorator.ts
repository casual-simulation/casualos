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
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type {
    BotCalculationContext,
    BotLabelFontSize,
} from '@casual-simulation/aux-common';
import {
    calculateBotValue,
    calculateFormattedBotValue,
    calculateNumericalTagValue,
    getBotLabelAnchor,
    getBotScale,
    getBotLabelAlignment,
    calculateStringTagValue,
    DEFAULT_LABEL_FONT_ADDRESS,
    calculateLabelFontSize,
    calculateLabelWordWrapMode,
    getBotLabelPadding,
    getBotOrientationMode,
} from '@casual-simulation/aux-common';
import { Text3D } from '../Text3D';
import type { Object3D } from '@casual-simulation/three';
import {
    Color,
    Vector3,
    Vector2,
    PerspectiveCamera,
} from '@casual-simulation/three';
import type { WordBubbleElement } from '../WordBubbleElement';
import type { Game } from '../Game';
import { Orthographic_FrustrumSize } from '../CameraRigFactory';
import { buildSRGBColor } from '../SceneUtils';
import NotoSansKR from '@casual-simulation/aux-components/fonts/NotoSansKR/NotoSansKR-Regular.otf';
import Roboto from '@casual-simulation/aux-components/fonts/Roboto/roboto-v18-latin-regular.woff';
import { WordBubbleDecorator } from './WordBubbleDecorator';
import {
    Rotation,
    Vector3 as CasualVector3,
} from '@casual-simulation/aux-common/math';

export class LabelDecorator
    extends AuxBot3DDecoratorBase
    implements WordBubbleElement
{
    /**
     * The distance that should be used when the text sizing mode === 'auto'.
     */
    public static readonly virtualDistance: number = 3;

    /**
     * The optional label for the bot.
     */
    text3D: Text3D | null;

    private _game: Game;
    private _autoSizeMode: boolean;
    private _billboard: boolean;
    private _initialSetup: boolean;
    private _lastFontSize: BotLabelFontSize;
    private _lastHeight: number;
    private _lastLength: number;

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
        this._initialSetup = false;
        this._autoSizeMode = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        const label = calculateFormattedBotValue(
            calc,
            this.bot3D.bot,
            'auxLabel'
        );

        const anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        const alignment = getBotLabelAlignment(calc, this.bot3D.bot);

        const botSize = getBotScale(calc, this.bot3D.bot);

        let botWidth = botSize.x;
        let botHeight = botSize.z;
        let botLength = botSize.y;

        if (anchor === 'left' || anchor === 'right') {
            botWidth = botLength;
        }
        if (anchor === 'top') {
            botHeight = botSize.y;
            botLength = botSize.z;
        }

        this._billboard = anchor === 'floatingBillboard';

        if (label) {
            if (!this.text3D) {
                this.text3D = new Text3D();
                this._initialSetup = true;
            }

            // Parent the labels directly to the bot.
            // Labels do all kinds of weird stuff with their transforms, so this makes it easier to let them do that
            // without worrying about what the AuxBot3D scale is etc.
            // For billboarded bots and floating labels, we need to parent the label directly to the bot so that it does not rotate with the bot.
            const orientationMode = getBotOrientationMode(calc, this.bot3D.bot);
            let targetContainer: Object3D;
            if (
                anchor === 'floating' &&
                (orientationMode === 'billboard' ||
                    orientationMode === 'billboardTop' ||
                    orientationMode === 'billboardFront')
            ) {
                targetContainer = this.bot3D;
            } else if (anchor === 'floatingBillboard') {
                targetContainer = this.bot3D;
            } else {
                targetContainer = this.bot3D.container;
            }
            if (this.text3D.parent !== targetContainer) {
                this.text3D.parent?.remove(this.text3D);
                targetContainer.add(this.text3D);
            }

            const labelPadding = getBotLabelPadding(calc, this.bot3D.bot);

            let updateNeeded = this.text3D.setWidth(
                botWidth - labelPadding.horizontal
            );
            updateNeeded =
                this.text3D.setText(label, alignment) || updateNeeded;

            // Update auto size mode.
            this._autoSizeMode =
                calculateBotValue(calc, this.bot3D.bot, 'auxLabelSizeMode') ===
                'auto';

            let fontAddress = calculateStringTagValue(
                calc,
                this.bot3D.bot,
                'auxLabelFontAddress',
                DEFAULT_LABEL_FONT_ADDRESS
            );

            if (fontAddress) {
                let url: URL;
                try {
                    url = new URL(fontAddress);
                } catch {
                    switch (fontAddress) {
                        case 'noto-sans-kr':
                            url = new URL(NotoSansKR, location.origin);
                            break;
                        default:
                            url = new URL(Roboto, location.origin);
                    }
                }

                updateNeeded = this.text3D.setFont(url.href) || updateNeeded;
            }

            let fontSize = calculateLabelFontSize(calc, this.bot3D.bot);

            const height = botHeight - labelPadding.vertical;

            updateNeeded = updateNeeded || fontSize !== this._lastFontSize;
            updateNeeded = updateNeeded || height !== this._lastHeight;
            updateNeeded = updateNeeded || botLength !== this._lastLength;

            if (typeof fontSize === 'number') {
                updateNeeded =
                    this.text3D.setFontSize(
                        fontSize * Text3D.defaultFontSize
                    ) || updateNeeded;
            }

            updateNeeded = this._updateLabelSize(calc) || updateNeeded;
            updateNeeded = this._updateLabelAnchor(calc) || updateNeeded;
            updateNeeded = this._updateWordWrapMode(calc) || updateNeeded;
            this._updateLabelColor(calc);
            this._updateLabelOpacity(calc);
            this.bot3D.forceComputeBoundingObjects();

            updateNeeded = this._updateTextPosition() || updateNeeded;

            if (updateNeeded && fontSize === 'auto') {
                if (this._initialSetup) {
                    // Hide the text while it is being setup
                    // for the first time.
                    this.text3D.visible = false;
                    this._initialSetup = false;
                }
                this.text3D
                    .calculateFontSizeToFit(
                        height,
                        0.1 * Text3D.defaultFontSize,
                        2 * Text3D.defaultFontSize,
                        0.025
                    )
                    .then(async (size) => {
                        if (this.text3D) {
                            this.text3D.setFontSize(size);
                            this.text3D.visible = true;
                            await this.text3D.sync();
                            this.text3D.updateBoundingBox();

                            for (let d of this.bot3D.decorators) {
                                if (d instanceof WordBubbleDecorator) {
                                    d.botUpdated(calc);
                                }
                            }
                        }
                    })
                    .catch((err) => {
                        console.error('[LabelDecorator]', err);
                        if (this.text3D) {
                            this.text3D.visible = true;
                        }
                    });
            } else if (updateNeeded) {
                this.text3D.sync();
            }

            this._lastFontSize = fontSize;
            this._lastHeight = height;
            this._lastLength = botLength;
        } else {
            this.disposeText3D();
        }
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.text3D) {
            if (this._autoSizeMode) {
                this._updateLabelSize(calc);
                this.bot3D.forceComputeBoundingObjects();
                this._updateTextPosition();
            }

            if (this._billboard) {
                const cameraRig =
                    this.bot3D.dimensionGroup.simulation3D.getMainCameraRig();
                const cameraWorld = new Vector3();
                cameraWorld.setFromMatrixPosition(
                    cameraRig.mainCamera.matrixWorld
                );

                const objWorld = new Vector3();
                objWorld.setFromMatrixPosition(this.text3D.matrixWorld);

                const direction = new CasualVector3(
                    objWorld.x,
                    objWorld.y,
                    objWorld.z
                ).subtract(
                    new CasualVector3(
                        cameraWorld.x,
                        cameraWorld.y,
                        cameraWorld.z
                    )
                );
                const lookRotation = new Rotation({
                    direction: direction,
                    upwards: new CasualVector3(
                        cameraRig.mainCamera.up.x,
                        cameraRig.mainCamera.up.y,
                        cameraRig.mainCamera.up.z
                    ),
                    errorHandling: 'nudge',
                });

                this.text3D.quaternion.set(
                    lookRotation.quaternion.x,
                    lookRotation.quaternion.y,
                    lookRotation.quaternion.z,
                    lookRotation.quaternion.w
                );
                this.text3D.updateMatrixWorld();
            }
        }
    }

    dispose(): void {
        this.disposeText3D();
    }

    disposeText3D(): void {
        if (this.text3D) {
            this.text3D.dispose();
            this.text3D.removeFromParent();
            this.text3D = null;
        }
    }

    getSize(): Vector2 {
        if (this.text3D) {
            const size3D = this.text3D.localBoundingBox.getSize(new Vector3());
            const scale = this.text3D.getScale();
            return new Vector2(size3D.x * scale.x, size3D.y * scale.y);
        } else {
            return null;
        }
    }

    shouldUpdateWorldBubbleThisFrame(): boolean {
        // Should update word bubble every frame if the label is in auto size mode.
        let rendered = this.text3D ? this.text3D.renderedThisFrame() : false;
        return this._autoSizeMode || rendered;
    }

    private _updateTextPosition() {
        let botBoundingBox = this.bot3D.boundingBox;
        let objCenter: Vector3 = null;

        if (botBoundingBox) {
            objCenter = new Vector3();
            botBoundingBox.getCenter(objCenter);
        }

        return this.text3D.setPositionForObject(
            this.bot3D.scaleContainer,
            objCenter
        );
    }

    private _updateLabelSize(calc: BotCalculationContext): boolean {
        let gridScale = this.bot3D.gridScale;
        let labelSize =
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxLabelSize',
                1
            ) *
            gridScale *
            Text3D.defaultScale;

        if (this._autoSizeMode) {
            let labelWorldPos = new Vector3();
            this.text3D.getWorldPosition(labelWorldPos);
            const mainCamera = this._game.getMainCameraRig().mainCamera;

            let finalScale: number;
            if (mainCamera instanceof PerspectiveCamera) {
                const distanceToCamera =
                    mainCamera.position.distanceTo(labelWorldPos);
                const extraScale =
                    distanceToCamera / LabelDecorator.virtualDistance;
                finalScale = labelSize * extraScale;
            } else {
                const extraScale =
                    Orthographic_FrustrumSize /
                    LabelDecorator.virtualDistance /
                    mainCamera.zoom;
                finalScale = labelSize * extraScale;
            }

            return this.text3D.setScale(finalScale);
        } else {
            return this.text3D.setScale(labelSize);
        }
    }

    private _updateLabelColor(calc: BotCalculationContext) {
        let labelColor = calculateFormattedBotValue(
            calc,
            this.bot3D.bot,
            'auxLabelColor'
        );
        if (labelColor) {
            let color = buildSRGBColor(labelColor);
            if (color) {
                this.text3D.setColor(color);
            } else {
                this.text3D.setColor(new Color('#000'));
            }
        } else {
            this.text3D.setColor(new Color('#000'));
        }
    }

    private _updateLabelOpacity(calc: BotCalculationContext) {
        let labelOpacity = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxLabelOpacity',
            1
        );

        this.text3D.setOpacity(labelOpacity);
    }

    private _updateLabelAnchor(calc: BotCalculationContext) {
        let anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        return this.text3D.setAnchor(anchor);
    }

    private _updateWordWrapMode(calc: BotCalculationContext): boolean {
        let mode = calculateLabelWordWrapMode(calc, this.bot3D.bot);
        return this.text3D.setWordWrapMode(mode);
    }
}
