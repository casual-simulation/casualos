import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, AuxFile, calculateFileValue, isFormula, calculateFormattedFileValue, calculateNumericalTagValue } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";
import { setLayer } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { Color, Camera } from "three";

export class LabelDecorator extends AuxFile3DDecorator {    

    /**
     * The optional label for the file.
     */
    label: Text3D | null;

    private _camera: Camera;

    constructor(file3D: AuxFile3D, camera: Camera) {
        super(file3D);
        this._camera = camera;

        this.label = new Text3D();
        setLayer(this.label, LayersHelper.Layer_UIWorld);
        this.file3D.display.add(this.label);
    }

    fileUpdated(calc: FileCalculationContext): void {
        let label = this.file3D.file.tags.label;

        if (label) {

            if (isFormula(label)) {
                let calculatedValue = calculateFormattedFileValue(calc, this.file3D.file, 'label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(label);
            }
            
            this._updateLabelSize(calc);
            this.label.setPositionForObject(this.file3D.display);

            let labelColor = this.file3D.file.tags['label.color'];
            if (labelColor) {

                if (isFormula(labelColor)) {
                    let calculatedValue = calculateFormattedFileValue(calc, this.file3D.file, 'label.color');
                    this.label.setColor(new Color(calculatedValue));
                } else {
                    this.label.setColor(new Color(labelColor));
                }
            }

        } else {
            this.label.setText("");
        }
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.label) {
            // update label scale
            let labelMode = calculateFileValue(calc, this.file3D.file, 'label.size.mode');
            if (labelMode) {
                this._updateLabelSize(calc);
                this.label.setPositionForObject(this.file3D.display);
            }
        }
    }

    dispose(): void {
    }

    private _updateLabelSize(calc: FileCalculationContext) {
        let labelSize = calculateNumericalTagValue(calc, this.file3D.file, 'label.size', 1) * Text3D.defaultScale;
        if (this.file3D.file.tags['label.size.mode']) {
            let mode = calculateFileValue(calc, this.file3D.file, 'label.size.mode');
            if (mode === 'auto') {
                const distanceToCamera = this._camera.position.distanceTo(this.label.getWorldPosition());
                const extraScale = distanceToCamera / Text3D.virtualDistance;
                const finalScale = labelSize * extraScale;
                this.label.setScale(finalScale);
                return;
            }
        }
        this.label.setScale(labelSize);
    }
}