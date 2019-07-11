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
import { DebugObjectManager } from '../debugobjectmanager/DebugObjectManager';
import { Wall3D } from '../Wall3D';

export class LineToDecorator extends AuxFile3DDecorator {
    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];
    walls: Wall3D[];

    private _arrows: Map<AuxFile3D, Arrow3D>;
    private _walls: Map<AuxFile3D, Wall3D>;
    private _finder: AuxFile3DFinder;
    private _lineColor: Color;
    private _lineColorValue: any;

    constructor(file3D: AuxFile3D, fileFinder: AuxFile3DFinder) {
        super(file3D);
        this._finder = fileFinder;
        this._arrows = new Map();
        this._walls = new Map();
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

        if (this.walls) {
            this.walls.forEach(a => {
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

            let lineColorValue = calculateFileValue(
                calc,
                this.file3D.file,
                'aux.line.color'
            );

            if (lineColorValue !== this._lineColorValue) {
                this._lineColorValue = lineColorValue;

                if (lineColorValue) {
                    this._lineColor = new Color(lineColorValue);
                } else {
                    this._lineColor = new Color();
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
                                this._lineColor
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
                            this._lineColor
                        );
                    }
                }
            } else {
                if (isArray(lineTo)) {
                    // Array of strings.
                    parseArray(<string>lineTo).forEach(s => {
                        this._trySetupLines(
                            calc,
                            s,
                            validLineIds,
                            this._lineColor
                        );
                    });
                } else {
                    // Single string.
                    this._trySetupLines(
                        calc,
                        <string>lineTo,
                        validLineIds,
                        this._lineColor
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

        if (this.walls) {
            // Filter out lines that are no longer being used.
            this.walls = this.walls.filter(a => {
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

        let style = this.file3D.file.tags['aux.line.style'];

        if (style === 'wall') {
            // Initialize arrows array if needed.
            if (!this.walls) this.walls = [];

            //if (!this.arrows) this.arrows = [];
            let targetWall: Wall3D = this._walls.get(targetFile);

            if (!targetWall) {
                // Create arrow for target.
                let sourceFile = this.file3D;
                targetWall = new Wall3D(sourceFile, targetFile);
                this.file3D.add(targetWall);
                this.walls.push(targetWall);
                this._walls.set(targetFile, targetWall);
            }

            if (targetWall) {
                targetWall.setColor(color);
                targetWall.update(calc);
                // Add the target file id to the valid ids list.
                validLineIds.push(targetFile.id);
            }
        } else {
            // Initialize arrows array if needed.
            if (!this.arrows) this.arrows = [];

            let hasArrowTip =
                style === 'arrow' || style === '' || style === undefined;

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
                targetArrow.setTipState(hasArrowTip);
                targetArrow.update(calc);
                // Add the target file id to the valid ids list.
                validLineIds.push(targetFile.id);
            }
        }
    }
}
