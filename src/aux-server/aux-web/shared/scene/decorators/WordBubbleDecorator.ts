import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { WordBubble3D } from "../WordBubble3D";
import { WordBubbleElement } from "../WordBubbleElement";
import { setLayer, convertToBox2 } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { Scene, Box3, Vector3 } from "three";
import { DebugObjectManager } from "../DebugObjectManager";

export class WordBubbleDecorator extends AuxFile3DDecorator {    

    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;

    private _scene: Scene;
    private _elements: WordBubbleElement[];

    constructor(file3D: AuxFile3D, scene: Scene, ...elements: WordBubbleElement[]) {
        super(file3D);
        // this._scene = scene;
        // this._elements = elements;

        // this.wordBubble = new WordBubble3D({cornerRadius: 0});
        // setLayer(this.wordBubble, LayersHelper.Layer_UIWorld, true);
        // this._scene.add(this.wordBubble);
        // this.wordBubble.visible = false;
    }

    fileUpdated(calc: FileCalculationContext): void {
        this._updateWorldBubble();
    }

    frameUpdate(calc: FileCalculationContext): void {
    }

    dispose(): void {
    }

    private _updateWorldBubble(): void {
        // let fileBoundingBox = this.file3D.boundingBox;
        // if (!fileBoundingBox) {
        //     this.wordBubble.visible = false;
        //     return;
        // }

        // this.wordBubble.visible = true;

        // let arrowPoint = new Vector3();
        // fileBoundingBox.getCenter(arrowPoint);

        // let size = new Vector3();
        // fileBoundingBox.getSize(size);
        // arrowPoint.y += size.y / 2;
        
        // let elementsBoundingBox:Box3 = null;

        // this._elements.forEach((e) => {
        //     let elementBox = e.getBoundingBox();
        //     if (elementBox) {
        //         if (elementsBoundingBox === null) {
        //             elementsBoundingBox = new Box3(elementBox.min, elementBox.max);
        //         } else {
        //             elementsBoundingBox.union(elementBox);
        //         }
        //     }
        // });

        // if (elementsBoundingBox) {
        //     // DebugObjectManager.remove(`WordBubbleElements_${this.file3D.id}`);
        //     // DebugObjectManager.debugBox3(`WordBubbleElements_${this.file3D.id}`, elementsBoundingBox, null, null, false);
            
        //     this.wordBubble.update(convertToBox2(elementsBoundingBox), arrowPoint);
        // }
    }
}