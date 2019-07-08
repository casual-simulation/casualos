import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import {
    FileCalculationContext,
    calculateFileValue,
    isFormula,
    calculateFormattedFileValue,
    calculateNumericalTagValue,
    getFileLabelAnchor,
} from '@casual-simulation/aux-common';
import { Text3D } from '../Text3D';
import { Color, Vector3, Box3, PerspectiveCamera } from 'three';
import { WordBubbleElement } from '../WordBubbleElement';
import { Game } from '../Game';
import { Orthographic_FrustrumSize } from '../CameraRigFactory';

export class LabelDecorator extends AuxFile3DDecorator
    implements WordBubbleElement {
    /**
     * The distance that should be used when the text sizing mode === 'auto'.
     */
    public static readonly virtualDistance: number = 3;

    /**
     * The optional label for the file.
     */
    text3D: Text3D | null;

    private _game: Game;
    private _autoSizeMode: boolean;

    _oldLabel: any;

    constructor(file3D: AuxFile3D, game: Game) {
        super(file3D);
        this._game = game;
        this.text3D = null;
        this._autoSizeMode = false;
    }

    fileUpdated(calc: FileCalculationContext): void {
        let label = this.file3D.file.tags['aux.label'];

        if (label) {
            if (!this.text3D) {
                this.text3D = new Text3D();
                // Parent the labels directly to the file.
                // Labels do all kinds of weird stuff with their transforms, so this makes it easier to let them do that
                // without worrying about what the AuxFile3D scale is etc.
                this.file3D.add(this.text3D);
            }

            // Update label text content.
            if (isFormula(label)) {
                let calculatedValue = calculateFormattedFileValue(
                    calc,
                    this.file3D.file,
                    'aux.label'
                );
                this.text3D.setText(calculatedValue);
            } else {
                this.text3D.setText(<string>label);
            }

            // Update auto size mode.
            if (this.file3D.file.tags['aux.label.size.mode']) {
                let mode = calculateFileValue(
                    calc,
                    this.file3D.file,
                    'aux.label.size.mode'
                );
                this._autoSizeMode = mode === 'auto';
            } else {
                this._autoSizeMode = false;
            }

            this._updateLabelSize(calc);
            this._updateLabelAnchor(calc);
            this._updateLabelColor(calc);
            this.file3D.forceComputeBoundingObjects();

            this.text3D.setPositionForBounds(this.file3D.boundingBox);

            if (this._oldLabel === undefined) {
                this._oldLabel = label;
                this.text3D.setPositionForBounds(this.file3D.boundingBox);
            }
        } else {
            this.disposeText3D();
        }

        this._oldLabel = label;
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.text3D) {
            if (this._autoSizeMode) {
                this._updateLabelSize(calc);
                this.file3D.forceComputeBoundingObjects();
                this.text3D.setPositionForBounds(this.file3D.boundingBox);
            }
        }
    }

    dispose(): void {
        this.disposeText3D();
    }

    disposeText3D(): void {
        if (this.text3D) {
            this.text3D.dispose();
            this.file3D.remove(this.text3D);
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

    private _updateLabelSize(calc: FileCalculationContext) {
        let labelSize =
            calculateNumericalTagValue(
                calc,
                this.file3D.file,
                'aux.label.size',
                1
            ) * Text3D.defaultScale;

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

    private _updateLabelColor(calc: FileCalculationContext) {
        let labelColor = this.file3D.file.tags['aux.label.color'];
        if (labelColor) {
            if (isFormula(labelColor)) {
                let calculatedValue = calculateFormattedFileValue(
                    calc,
                    this.file3D.file,
                    'aux.label.color'
                );
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

    private _updateLabelAnchor(calc: FileCalculationContext) {
        let anchor = getFileLabelAnchor(calc, this.file3D.file);
        this.text3D.setAnchor(anchor);
    }
}
