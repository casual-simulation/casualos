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
} from '@casual-simulation/aux-common';
import { Text3D } from '../Text3D';
import { Color, Vector3, Box3, PerspectiveCamera } from 'three';
import { WordBubbleElement } from '../WordBubbleElement';
import { Game } from '../Game';
import { Orthographic_FrustrumSize } from '../CameraRigFactory';
import { calculateScale, buildSRGBColor } from '../SceneUtils';

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

    _oldLabel: any;

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
        this.text3D = null;
        this._autoSizeMode = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        let label = this.bot3D.bot.tags['auxLabel'];

        const anchor = getBotLabelAnchor(calc, this.bot3D.bot);

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
                this.text3D = new Text3D(botWidth * 100);
                // Parent the labels directly to the bot.
                // Labels do all kinds of weird stuff with their transforms, so this makes it easier to let them do that
                // without worrying about what the AuxBot3D scale is etc.
                this.bot3D.container.add(this.text3D);
            }

            // Update label text content.
            if (isFormula(label)) {
                let calculatedValue = calculateFormattedBotValue(
                    calc,
                    this.bot3D.bot,
                    'auxLabel'
                );
                this.text3D.setText(calculatedValue);
            } else {
                this.text3D.setText(<string>label);
            }

            // Update auto size mode.
            if (this.bot3D.bot.tags['auxLabelSizeMode']) {
                let mode = calculateBotValue(
                    calc,
                    this.bot3D.bot,
                    'auxLabelSizeMode'
                );
                this._autoSizeMode = mode === 'auto';
            } else {
                this._autoSizeMode = false;
            }

            this._updateLabelSize(calc);
            this._updateLabelAnchor(calc);
            this._updateLabelColor(calc);
            this.bot3D.forceComputeBoundingObjects();

            this.text3D.setPositionForBounds(this.bot3D.boundingBox);

            if (this._oldLabel === undefined) {
                this._oldLabel = label;
                this.text3D.setPositionForBounds(this.bot3D.boundingBox);
            }
        } else {
            this.disposeText3D();
        }

        this._oldLabel = label;

        if (label) {
            this.text3D.setPositionForBounds(this.bot3D.boundingBox);
        }
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this.text3D) {
            if (this._autoSizeMode) {
                this._updateLabelSize(calc);
                this.bot3D.forceComputeBoundingObjects();
                this.text3D.setPositionForBounds(this.bot3D.boundingBox);
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
        return this._autoSizeMode;
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
        let labelColor = this.bot3D.bot.tags['auxLabelColor'];
        if (labelColor) {
            if (isFormula(labelColor)) {
                let calculatedValue = calculateFormattedBotValue(
                    calc,
                    this.bot3D.bot,
                    'auxLabelColor'
                );

                // Don't convert sRGB to linear
                // because labels ignore the renderer's output encoding.
                let color = new Color(calculatedValue);
                if (color) {
                    this.text3D.setColor(color);
                } else {
                    this.text3D.setColor(new Color('#000'));
                }
            } else {
                let color = new Color(<string>labelColor);
                if (color) {
                    this.text3D.setColor(color);
                } else {
                    this.text3D.setColor(new Color('#000'));
                }
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
