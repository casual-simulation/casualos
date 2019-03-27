import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { calculateNumericalTagValue, FileCalculationContext, File, calculateGridScale, file, objectsAtContextGridPosition, getFilePosition, getFileIndex, getContextDefaultHeight, getBuilderContextGrid, getFileRotation } from "@yeti-cgi/aux-common";
import { Vector3, Quaternion, Euler } from "three";
import { calculateGridTileLocalCenter } from "../grid/Grid";
import { sumBy } from "lodash";
import { ContextGroup3D } from "../ContextGroup3D";

/**
 * Defines an interface that contains possible options for ContextPositionDecorator objects.
 */
export interface ContextPositionDecoratorOptions {
    /**
     * Whether to linear interpolate between positions.
     */
    lerp?: boolean;
}

/**
 * Defines a AuxFile3D decorator that moves the file to its position inside a context.
 */
export class ContextPositionDecorator extends AuxFile3DDecorator {
    
    private _lerp: boolean;
    private _nextPos: Vector3;
    private _nextRot: { x: number, y: number, z: number };

    constructor(file3D: AuxFile3D, options: ContextPositionDecoratorOptions = {}) {
        super(file3D);
        this._lerp = !!options.lerp;
    }

    fileUpdated(calc: FileCalculationContext): void {
        const userContext = this.file3D.context;
        if (userContext) {
            const grid = getBuilderContextGrid(calc, this.file3D.contextGroup.file, this.file3D.domain);
            if (grid) {
                const scale = calculateGridScale(calc, this.file3D.contextGroup.file, this.file3D.domain);
                this._nextPos = calculateObjectPositionInGrid(calc, this.file3D, scale);
            } else {
                const scale = 1; // We dont have a grid, just use scale of 1.
                this._nextPos = calculateObjectPositionInGrid(calc, this.file3D, scale);
            }
            
            this._nextRot = getFileRotation(calc, this.file3D.file, this.file3D.context);
            if (!this._lerp) {
                this.file3D.display.position.copy(this._nextPos);
                this.file3D.display.rotation.set(this._nextRot.x, this._nextRot.z, this._nextRot.y);
            }
            
            // We must call this function so that child objects get their positions updated too.
            // Three render function does this automatically but there are functions in here that depend
            // on accurate positioning of child objects.
            this.file3D.updateMatrixWorld(true);
        }
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this._lerp && this._nextPos && this._nextRot) {
            this.file3D.display.position.lerp(this._nextPos, 0.1);
            const euler = new Euler(this._nextRot.x, this._nextRot.z, this._nextRot.y, 'XYZ');
            const q = new Quaternion().setFromEuler(euler);
            this.file3D.display.quaternion.slerp(q, 0.1);
        }
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