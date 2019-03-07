import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext, calculateGridScale } from "@yeti-cgi/aux-common";
import { Text3D } from "../Text3D";
import { calculateScale } from "../SceneUtils";

export class ScaleDecorator implements AuxFile3DDecorator {


    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        const gridScale = calculateGridScale(calc, file3D.contextGroup.file, file3D.domain);
        const scale = calculateScale(calc, file3D.file, gridScale);
        file3D.display.scale.set(scale.x, scale.y, scale.z);
    }

    frameUpdate(): void {
    }

    dispose(): void {
    }
    
}