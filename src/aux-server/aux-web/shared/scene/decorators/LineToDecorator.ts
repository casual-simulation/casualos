import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import {
    FileCalculationContext,
    AuxFile,
    isFormula,
    calculateFormattedFileValue,
    calculateFileValue,
    isArray,
    parseArray,
} from '@casual-simulation/aux-common';
import { Arrow3D } from '../Arrow3D';
import { Color } from 'three';
import { AuxFile3DFinder } from '../../../shared/AuxFile3DFinder';
import { find } from 'lodash';

export class LineToDecorator extends AuxFile3DDecorator {
    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];

    private _arrows: Map<AuxFile3D, Arrow3D>;
    private _finder: AuxFile3DFinder;

    constructor(file3D: AuxFile3D, fileFinder: AuxFile3DFinder) {
        super(file3D);
        this._finder = fileFinder;
        this._arrows = new Map();
    }

    fileUpdated(calc: FileCalculationContext): void {}

    frameUpdate(calc: FileCalculationContext): void {
        this._tagUpdateLine(calc);
    }

    dispose(): void {
        if (this.arrows) {
            this.arrows.forEach(a => {
                a.dispose();
            });
        }
    }

    private _tagUpdateLine(calc: FileCalculationContext): void {
        if (!this._finder) {
            return;
        }

        let lineTo = this.file3D.file.tags['aux.line.to'];
        let validLineIds: number[];

        if (lineTo) {
            validLineIds = [];

            // Local function for setting up a line. Will add the targetFileId to the validLineIds array if successful.

            let lineColorTagValue = this.file3D.file.tags['aux.line.color'];
            let lineColor: Color;

            if (lineColorTagValue) {
                if (isFormula(lineColorTagValue)) {
                    let calculatedValue = calculateFormattedFileValue(
                        calc,
                        this.file3D.file,
                        'aux.line.color'
                    );
                    lineColor = new Color(calculatedValue);
                } else {
                    lineColor = new Color(<string>lineColorTagValue);
                }
            }

            // Parse the line.to tag.
            // It can either be a formula or a handtyped string.
            if (isFormula(lineTo)) {
                let calculatedValue = calculateFileValue(
                    calc,
                    this.file3D.file,
                    'aux.line.to'
                );

                if (Array.isArray(calculatedValue)) {
                    // Array of objects.
                    calculatedValue.forEach(o => {
                        if (o) {
                            this._trySetupLines(
                                calc,
                                o.id,
                                validLineIds,
                                lineColor
                            );
                        }
                    });
                } else {
                    // Single object.
                    if (calculatedValue) {
                        this._trySetupLines(
                            calc,
                            calculatedValue.id,
                            validLineIds,
                            lineColor
                        );
                    }
                }
            } else {
                if (isArray(lineTo)) {
                    // Array of strings.
                    parseArray(<string>lineTo).forEach(s => {
                        this._trySetupLines(calc, s, validLineIds, lineColor);
                    });
                } else {
                    // Single string.
                    this._trySetupLines(
                        calc,
                        <string>lineTo,
                        validLineIds,
                        lineColor
                    );
                }
            }
        }

        if (this.arrows) {
            // Filter out lines that are no longer being used.
            this.arrows = this.arrows.filter(a => {
                if (a && a.targetFile3d) {
                    if (
                        validLineIds &&
                        validLineIds.indexOf(a.targetFile3d.id) >= 0
                    ) {
                        // This line is active, keep it in.
                        return true;
                    }
                }
                // This line is no longer used, filter it out.
                this.file3D.remove(a);
                a.dispose();
                return false;
            });
        }
    }

    private _trySetupLines(
        calc: FileCalculationContext,
        targetFileId: string,
        validLineIds: number[],
        color?: Color
    ) {
        // Undefined target filed id.
        if (!targetFileId) return;

        // Can't create line to self.
        // TODO: Make it so you can make lines to other visualizations of this
        if (this.file3D.file.id === targetFileId) return;

        const files = this._finder.findFilesById(targetFileId);
        files.forEach(f => this._trySetupLine(calc, f, validLineIds, color));
    }

    private _trySetupLine(
        calc: FileCalculationContext,
        targetFile: AuxFile3D,
        validLineIds: number[],
        color?: Color
    ) {
        if (!targetFile) {
            // No file found.
            return;
        }

        // Initialize arrows array if needed.
        if (!this.arrows) this.arrows = [];

        let targetArrow: Arrow3D = this._arrows.get(targetFile);
        if (!targetArrow) {
            // Create arrow for target.
            let sourceFile = this.file3D;
            targetArrow = new Arrow3D(sourceFile, targetFile);
            this.file3D.add(targetArrow);
            this.arrows.push(targetArrow);
            this._arrows.set(targetFile, targetArrow);
        }

        if (targetArrow) {
            targetArrow.setColor(color);
            targetArrow.update(calc);
            // Add the target file id to the valid ids list.
            validLineIds.push(targetFile.id);
        }
    }
}
