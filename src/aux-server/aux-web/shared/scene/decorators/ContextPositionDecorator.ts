import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { calculateNumericalTagValue, FileCalculationContext, File, calculateGridScale, file, objectsAtContextGridPosition, getFilePosition, getFileIndex } from "@yeti-cgi/aux-common";
import { Vector3 } from "three";
import { calculateGridTileLocalCenter } from "../grid/Grid";
import { sumBy } from "lodash";
import { ContextGroup3D } from "../ContextGroup3D";

export class ContextPositionDecorator extends AuxFile3DDecorator {
    
    constructor(file3D: AuxFile3D) {
        super(file3D);
    }

    fileUpdated(calc: FileCalculationContext): void {
        const userContext = this.file3D.context;
        if (userContext) {
            const scale = calculateGridScale(calc, this.file3D.contextGroup.file, this.file3D.domain);
            const localPosition = calculateObjectPositionInContext(calc, this.file3D, scale);
            this.file3D.position.set(localPosition.x, localPosition.y, localPosition.z);
            
            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            this.file3D.updateMatrixWorld(true);
        }
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
    }
}

/**
 * 
 * @param context The file calculation context to use to calculate forumula values.
 * @param file The file to calculate position for.
 * @param contextId The id of the context we want to get positional data for the given file.
 */
export function calculateObjectPositionInContext(context: FileCalculationContext, file: AuxFile3D, scale: number): Vector3 {
    const position = getFilePosition(context, file.file, file.context);
    const objectsAtPosition = objectsAtContextGridPosition(context, file.context, position);
    
    const index = getFileIndex(context, file.file, file.context);
    const objectsBelowThis = objectsAtPosition.slice(0, index);
    const totalScales = sumBy(objectsBelowThis, obj => calculateNumericalTagValue(context, obj, 'scale.z', 1));
    const indexOffset = new Vector3(0, totalScales * scale, 0);
    
    let localPosition = calculateGridTileLocalCenter(
        position.x,
        position.y,
        position.z,
        scale);

    localPosition.add(indexOffset);
    return localPosition;
}