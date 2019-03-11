import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateGridScale, getContextGrid } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";
import { calculateScale } from "../SceneUtils";

export class ScaleDecorator implements AuxFile3DDecorator {


    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        if (file3D.contextGroup) {
            const grid = getContextGrid(calc, file3D.contextGroup.file, file3D.domain);
            const gridScale = !!grid ? calculateGridScale(calc, file3D.contextGroup.file, file3D.domain) : 1;
            const scale = calculateScale(calc, file3D.file, gridScale);
            file3D.display.scale.set(scale.x, scale.y, scale.z);
        }
    }

    frameUpdate(): void {
    }

    dispose(): void {
    }
    
}