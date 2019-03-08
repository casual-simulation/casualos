import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, AuxFile, calculateFileValue, isFormula, calculateFormattedFileValue, calculateNumericalTagValue } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";
import { createLabel } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { Color } from "three";

export class LabelDecorator implements AuxFile3DDecorator {    

    /**
     * The optional label for the file.
     */
    label: Text3D | null;

    /**
     * The file that this decorator is for.
     */
    file: AuxFile3D;

    constructor(file: AuxFile3D) {
        this.file = file;
    }

    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        if (!this.label) {
            this.label = createLabel();
            this.label.setLayer(LayersHelper.Layer_UIWorld);
            file3D.display.add(this.label);
        }

        this._tagUpdateLabel(calc);
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.label) {
            // update label scale

            let labelMode = calculateFileValue(calc, this.file.file, 'label.size.mode');
            if (labelMode) {
                this._updateLabelSize(calc);
                this.label.setPositionForObject(this.file.display);
                // this._updateWorldBubble();
            }
        }
    }

    dispose(): void {
    }

    private _tagUpdateLabel(calc: FileCalculationContext): void {
        if (!this.label) {
            return;
        }

        let label = this.file.file.tags.label;

        if (label) {

            if (isFormula(label)) {
                let calculatedValue = calculateFormattedFileValue(calc, this.file.file, 'label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(label);
            }
            
            // this._updateLabelSize();
            this.label.setPositionForObject(this.file.display);
            // this._updateWorldBubble();

            let labelColor = this.file.file.tags['label.color'];
            if (labelColor) {

                if (isFormula(labelColor)) {
                    let calculatedValue = calculateFormattedFileValue(calc, this.file.file, 'label.color');
                    this.label.setColor(new Color(calculatedValue));
                } else {
                    this.label.setColor(new Color(labelColor));
                }
            }

        } else {
            this.label.setText("");
        }
    }

    private _updateLabelSize(calc: FileCalculationContext) {
        let labelSize = calculateNumericalTagValue(calc, this.file.file, 'label.size', 1) * Text3D.defaultScale;
        if (this.file.file.tags['label.size.mode']) {
            let mode = calculateFileValue(calc, this.file.file, 'label.size.mode');
            if (mode === 'auto') {
                // TODO: Find some way to get the camera position
                // const distanceToCamera = this._gameView.mainCamera.position.distanceTo(this.label.getWorldPosition());
                // const extraScale = distanceToCamera / Text3D.virtualDistance;
                // const finalScale = labelSize * extraScale;
                // this.label.setScale(finalScale);
                // return;
            }
        }
        this.label.setScale(labelSize);
    }
}