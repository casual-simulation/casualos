import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { calculateNumericalTagValue, FileCalculationContext, File, calculateGridScale, file, objectsAtContextGridPosition, getFilePosition, getFileIndex, getContextDefaultHeight, getContextGrid, getFileRotation } from "@yeti-cgi/aux-common";
import { Vector3 } from "three";
import { calculateGridTileLocalCenter } from "../grid/Grid";
import { sumBy } from "lodash";
import { ContextGroup3D } from "../ContextGroup3D";

export class ContextPositionDecorator implements AuxFile3DDecorator {
    
    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
        const userContext = file3D.context;
        if (userContext) {
            const grid = getContextGrid(calc, file3D.contextGroup.file, file3D.domain);
            if (grid) {
                const scale = calculateGridScale(calc, file3D.contextGroup.file, file3D.domain);
                const localPosition = calculateObjectPositionInGrid(calc, file3D, scale);
                file3D.display.position.set(localPosition.x, localPosition.y, localPosition.z);
            } else {
                const position = getFilePosition(calc, file3D.file, file3D.context);
                file3D.display.position.set(position.x, position.z, position.y);
            }

            const rotation = getFileRotation(calc, file3D.file, file3D.context);
            file3D.display.rotation.set(rotation.x, rotation.z, rotation.y);
            
            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            file3D.updateMatrixWorld(true);
        }
    }

    frameUpdate(): void {
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
export function calculateObjectPositionInGrid(context: FileCalculationContext, file: AuxFile3D, scale: number): Vector3 {
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