import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, AuxFile, calculateFileValue, isFormula, calculateFormattedFileValue, calculateNumericalTagValue, hasValue, getFileLabelAnchor } from "@casual-simulation/aux-common";
import { Text3D } from "../Text3D";
import { setLayer, findParentScene } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { Color, Camera, Object3D, Mesh, Vector3, Scene, Box3 } from "three";
import { FileShapeDecorator } from "./FileShapeDecorator";
import { WordBubbleElement } from "../WordBubbleElement";
import { appManager } from "../../../shared/AppManager";
import { IGameView } from "aux-web/shared/IGameView";

export class LabelDecorator extends AuxFile3DDecorator implements WordBubbleElement {    

    /**
     * The optional label for the file.
     */
    label: Text3D | null;

    private _gameView: IGameView;

    constructor(file3D: AuxFile3D, gameView: IGameView) {
        super(file3D);
        this._gameView = gameView;

        this.label = new Text3D();
        setLayer(this.label, LayersHelper.Layer_UIWorld, true);

        // Parent the labels directly to the file.
        // Labels do all kinds of weird stuff with their transforms, so this makes it easier to let them do that
        // without worrying about what the AuxFile3D scale is etc.
        this.file3D.add(this.label);
    }

    fileUpdated(calc: FileCalculationContext): void {
        let label = this.file3D.file.tags['aux.label'];

        if (label) {

            if (isFormula(label)) {
                let calculatedValue = calculateFormattedFileValue(calc, this.file3D.file, 'aux.label');
                this.label.setText(calculatedValue);
            } else {
                this.label.setText(<string>label);
            }
            
            this._updateLabelSize(calc);
            this._updateLabelAnchor(calc);
            this.file3D.computeBoundingObjects();
            this.label.setPositionForBounds(this.file3D.boundingBox);

            this._updateLabelColor(calc);

        } else {
            this.label.setText("");
        }
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this.label) {
            // update label scale
            let labelMode = calculateFileValue(calc, this.file3D.file, 'aux.label.size.mode');
            if (labelMode) {
                this._updateLabelSize(calc);
                this.file3D.computeBoundingObjects();
                this.label.setPositionForBounds(this.file3D.boundingBox);
            }
        }
    }

    dispose(): void {
        this.label.dispose();
        this.file3D.remove(this.label);
    }

    getBoundingBox(): Box3 {
        return this.label.boundingBox;
    }

    shouldUpdateWorldBubbleThisFrame(): boolean {
        // Should update word bubble every frame if the label is in auto size mode.
        return this._isInAutoSizeMode();
    }

    private _isInAutoSizeMode(calc?: FileCalculationContext): boolean {
        if (this.file3D.file.tags['aux.label.size.mode']) {
            let fileCalc = calc ? calc : appManager.fileManager.createContext();
            let mode = calculateFileValue(fileCalc, this.file3D.file, 'aux.label.size.mode');
            return mode === 'auto';
        }
        return false;
    }

    private _updateLabelSize(calc: FileCalculationContext) {
        let labelSize = calculateNumericalTagValue(calc, this.file3D.file, 'aux.label.size', 1) * Text3D.defaultScale;
        if (this._isInAutoSizeMode(calc)) {
            let labelWorldPos = new Vector3();
            this.label.getWorldPosition(labelWorldPos);
            const mainCamera = this._gameView.getMainCamera();
            const distanceToCamera = mainCamera.position.distanceTo(labelWorldPos);
            const extraScale = distanceToCamera / Text3D.virtualDistance;
            const finalScale = labelSize * extraScale;
            this.label.setScale(finalScale);
            return;
        }
        this.label.setScale(labelSize);
    }

    private _updateLabelColor(calc: FileCalculationContext) {
        let labelColor = this.file3D.file.tags['aux.label.color'];
        if (labelColor) {
            if (isFormula(labelColor)) {
                let calculatedValue = calculateFormattedFileValue(calc, this.file3D.file, 'aux.label.color');
                this.label.setColor(new Color(calculatedValue));
            }
            else {
                this.label.setColor(new Color(<string>labelColor));
            }
        }
    }

    private _updateLabelAnchor(calc: FileCalculationContext) {
        let anchor = getFileLabelAnchor(calc, this.file3D.file);
        this.label.setAnchor(anchor);
    }
}