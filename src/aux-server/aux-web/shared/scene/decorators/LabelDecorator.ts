import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    calculateBotValue,
    isFormula,
    calculateFormattedBotValue,
    calculateNumericalTagValue,
    getBotLabelAnchor,
    BotLabelAnchor,
    getBotScale,
    getBotLabelAlignment,
    calculateStringTagValue,
    DEFAULT_LABEL_FONT_ADDRESS,
} from '@casual-simulation/aux-common';
import { Text3D } from '../Text3D';
import { Color, Vector3, Box3, PerspectiveCamera } from 'three';
import { WordBubbleElement } from '../WordBubbleElement';
import { Game } from '../Game';
import { Orthographic_FrustrumSize } from '../CameraRigFactory';
import { calculateScale, buildSRGBColor } from '../SceneUtils';
import NotoSansKR from '../../public/fonts/NotoSansKR/NotoSansKR-Regular.otf';
import Roboto from '../../public/fonts/Roboto/roboto-v18-latin-regular.woff';

export class LabelDecorator extends AuxBot3DDecoratorBase
    implements WordBubbleElement {
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

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
        this.text3D = null;
        this._autoSizeMode = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        let label = calculateFormattedBotValue(
            calc,
            this.bot3D.bot,
            'auxLabel'
        );

        const anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        const alignment = getBotLabelAlignment(calc, this.bot3D.bot);

        let botWidth = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxScaleX',
            1
        );

        if (anchor === 'left' || anchor === 'right') {
            botWidth = calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxScaleY',
                1
            );
        }

        if (this.text3D) {
            if (botWidth != this.text3D.currentWidth) {
                this.disposeText3D();
            }
        }

        if (label) {
            if (!this.text3D) {
                this.text3D = new Text3D(botWidth);
                // Parent the labels directly to the bot.
                // Labels do all kinds of weird stuff with their transforms, so this makes it easier to let them do that
                // without worrying about what the AuxBot3D scale is etc.
                this.bot3D.container.add(this.text3D);
            }

            // Update label text content.
            this.text3D.setText(label, alignment);

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

                this.text3D.setFont(url.href);
            }

            this._updateLabelSize(calc);
            this._updateLabelAnchor(calc);
            this._updateLabelColor(calc);
            this.bot3D.forceComputeBoundingObjects();

            this._updateTextPosition();
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
        }
    }

    dispose(): void {
        this.disposeText3D();
    }

    disposeText3D(): void {
        if (this.text3D) {
            this.text3D.dispose();
            this.bot3D.container.remove(this.text3D);
            this.text3D = null;
        }
    }

    getBoundingBox(): Box3 {
        if (this.text3D) {
            return this.text3D.boundingBox;
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

        this.text3D.setPositionForObject(this.bot3D.scaleContainer, objCenter);
    }

    private _updateLabelSize(calc: BotCalculationContext) {
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
                const distanceToCamera = mainCamera.position.distanceTo(
                    labelWorldPos
                );
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

            this.text3D.setScale(finalScale);
        } else {
            this.text3D.setScale(labelSize);
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

    private _updateLabelAnchor(calc: BotCalculationContext) {
        let anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        this.text3D.setAnchor(anchor);
    }
}
