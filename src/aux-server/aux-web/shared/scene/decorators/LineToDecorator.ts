import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { Arrow3D } from "../Arrow3D";

export class LineToDecorator implements AuxFile3DDecorator {    

    /**
     * The optional arrows for the file.
     */
    arrows: Arrow3D[];

    fileUpdated(file3D: AuxFile3D, calc: FileCalculationContext): void {
    }

    frameUpdate(): void {
    }

    dispose(): void {
        if (this.arrows) {
            this.arrows.forEach((a) => {
                a.dispose();
            })
        }
    }
    

    // private _tagUpdateLine(): void {

    //     if(!this._gameView) {
    //         return;
    //     }

    //     // Only draw lines in the Builder client.
    //     if (appManager.appType !== AppType.Builder) {
    //         return;
    //     }

    //     let lineTo = this.file.tags['line.to'];
    //     let validLineIds: string[];

    //     if (lineTo) {

    //         let files: Object[];
    //         validLineIds = [];

    //         // Local function for setting up a line. Will add the targetFileId to the validLineIds array if successful.
    //         let trySetupLine = (targetFileId: string, color?: Color): void => {
                
    //             // Undefined target filed id.
    //             if (!targetFileId) return;
    //             // Can't create line to self.
    //             if (this.file.id === targetFileId) return;
                
    //             // let targetFile = this._gameView.getFile(targetFileId);
    //             // if (!targetFile) {

    //             //     // If not matching file is found on first try then it may be a short id.
    //             //     // Lets try searching for it.

    //             //     if (!files) {
    //             //         // Init the searchable files list from file manager.
    //             //         files = appManager.fileManager.objects;
    //             //     }

    //             //     let file = fileFromShortId(files, targetFileId);
    //             //     if (file) {
    //             //         // Found file with short id.
    //             //         // targetFile = this._gameView.getFile(file.id);
    //             //     } else {
    //             //         // Not file found for short id.
    //             //         return;
    //             //     }

    //             // }

    //             // Initialize arrows array if needed.
    //             if (!this.arrows) this.arrows = [];

    //             // let targetArrow: Arrow3D = find(this.arrows, (a: Arrow3D) => { return a.targetFile3d === targetFile });
    //             // if (!targetArrow) {
    //             //     // Create arrow for target.
    //             //     // let sourceFile = this._gameView.getFile(this.file.id);
    //             //     // targetArrow = new Arrow3D(this._gameView, sourceFile, targetFile);
    //             //     // this.arrows.push(targetArrow);
    //             // }

    //             // if (targetArrow) {
    //             //     targetArrow.setColor(color);
    //             //     targetArrow.update();
    //             //     // Add the target file id to the valid ids list.
    //             //     // validLineIds.push(targetFile.file.id);
    //             // }
    //         }

    //         let lineColorTagValue = this.file.tags['line.color'];
    //         let lineColor: Color;

    //         if (lineColorTagValue) {
    //             if (isFormula(lineColorTagValue)) {
    //                 let calculatedValue = appManager.fileManager.calculateFormattedFileValue(this.file, 'line.color');
    //                 lineColor = this._getColor(calculatedValue);
    //             } else {
    //                 lineColor = this._getColor(lineColorTagValue);
    //             }
    //         }

    //         // Parse the line.to tag.
    //         // It can either be a formula or a handtyped string.
    //         if (isFormula(lineTo)) {
    //             let calculatedValue = appManager.fileManager.calculateFileValue(this.file, 'line.to');
                
    //             if (Array.isArray(calculatedValue)) { 
    //                 // Array of objects.
    //                 calculatedValue.forEach((o) => { if (o) { trySetupLine(o.id, lineColor); } });
    //             } else {
    //                 // Single object.
    //                 if (calculatedValue) { trySetupLine(calculatedValue.id, lineColor); }
    //             }
    //         } else {
    //             if (isArray(lineTo)) {
    //                 // Array of strings.
    //                 parseArray(lineTo).forEach((s) => { trySetupLine(s, lineColor); });
    //             } else {
    //                 // Single string.
    //                 trySetupLine(lineTo, lineColor);
    //             }
    //         }
    //     }
        
    //     if (this.arrows) {
    //         // Filter out lines that are no longer being used.
    //         this.arrows = this.arrows.filter((a) => {
    //             if (a && a.targetFile3d) {
    //                 if (validLineIds && validLineIds.indexOf(a.targetFile3d.file.id) >= 0) {
    //                     // This line is active, keep it in.
    //                     return true;
    //                 }
    //             }
    //             // This line is no longer used, filter it out.
    //             a.dispose();
    //             return false;
    //         });
    //     }
    // }
}