import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";

export class LabelDecorator implements AuxFile3DDecorator {    

    /**
     * The optional label for the file.
     */
    label: Text3D | null;

    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {

        // if (this._gameView) {
        //     this.label = createLabel(this._gameView, this);
        //     this.label.setLayer(LayersHelper.Layer_UIWorld);
        // }
    }

    frameUpdate(): void {
        // if (this.label && this._gameView) {
        //     // update label scale

        //     let labelMode = this.file.tags['label.size.mode'];
        //     if (labelMode) {
        //         this._updateLabelSize();
        //         this.label.setPositionForObject(this.cube);
        //         this._updateWorldBubble();
        //     }
        // }
    }

    dispose(): void {
    }
    

    // private _tagUpdateLabel(): void {
    //     if (!this.label) {
    //         return;
    //     }

    //     let label = this.file.tags.label;

    //     if (label) {

    //         if (isFormula(label)) {
    //             let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label');
    //             this.label.setText(calculatedValue);
    //         } else {
    //             this.label.setText(label);
    //         }
            
    //         this._updateLabelSize();
    //         this.label.setPositionForObject(this.cube);
    //         this._updateWorldBubble();

    //         let labelColor = this.file.tags['label.color'];
    //         if (labelColor) {

    //             if (isFormula(labelColor)) {
    //                 let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'label.color');
    //                 this.label.setColor(this._getColor(calculatedValue));
    //             } else {
    //                 this.label.setColor(this._getColor(labelColor));
    //             }
    //         }

    //     } else {
    //         this.label.setText("");
    //     }
    // }

    // private _updateLabelSize() {
    //     let labelSize = calculateNumericalTagValue(this._context, this.file, 'label.size', 1) * Text3D.defaultScale;
    //     if (this.file.tags['label.size.mode']) {
    //         let mode = appManager.fileManager.calculateFileValue(this.file, 'label.size.mode');
    //         if (mode === 'auto') {
    //             const distanceToCamera = this._gameView.mainCamera.position.distanceTo(this.label.getWorldPosition());
    //             const extraScale = distanceToCamera / Text3D.virtualDistance;
    //             const finalScale = labelSize * extraScale;
    //             this.label.setScale(finalScale);
    //             return;
    //         }
    //     }
    //     this.label.setScale(labelSize);
    // }
}