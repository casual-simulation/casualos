import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { WordBubble3D } from "../WordBubble3D";

export class WordBubbleDecorator extends AuxFile3DDecorator {    

    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;

    constructor(file3D: AuxFile3D) {
        super(file3D);
    }

    fileUpdated(calc: FileCalculationContext): void {

        // this.wordBubble = new WordBubble3D({cornerRadius: 0});
        // setLayer(this.wordBubble, LayersHelper.Layer_UIWorld, true);
        // this.add(this.wordBubble);
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
    }

    // private _updateWorldBubble(): void {
    //     let cubeBoundingBox = new Box3().setFromObject(this.cube);
    //     let arrowPoint = new Vector3();
    //     cubeBoundingBox.getCenter(arrowPoint);

    //     let size = new Vector3();
    //     cubeBoundingBox.getSize(size);
    //     arrowPoint.y += size.y / 2;
        
    //     this.wordBubble.update(convertToBox2(this.label.boundingBox), arrowPoint);
    // }
}