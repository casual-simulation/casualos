import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateGridScale, getBuilderContextGrid, DEFAULT_WORKSPACE_GRID_SCALE } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";
import { calculateScale } from "../SceneUtils";

export class ScaleDecorator extends AuxFile3DDecorator {


    constructor(file3D: AuxFile3D) {
        super(file3D);
    }

    fileUpdated(calc: FileCalculationContext): void {
        const gridScale = calculateGridScale(calc, this.file3D.contextGroup ? this.file3D.contextGroup.file : null);
        const scale = calculateScale(calc, this.file3D.file, gridScale);
        this.file3D.display.scale.set(scale.x, scale.y, scale.z);
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
    }
    
}