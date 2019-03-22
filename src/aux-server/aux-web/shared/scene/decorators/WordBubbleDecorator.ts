import { AuxFile3DDecorator } from "../AuxFile3DDecorator";
import { AuxFile3D } from "../AuxFile3D";
import { FileCalculationContext } from "@yeti-cgi/aux-common";
import { WordBubble3D } from "../WordBubble3D";
import { WordBubbleElement } from "../WordBubbleElement";
import { setLayer, convertToBox2 } from "../SceneUtils";
import { LayersHelper } from "../LayersHelper";
import { Scene, Box3, Vector3, Color } from "three";
import { DebugObjectManager } from "../DebugObjectManager";

export class WordBubbleDecorator extends AuxFile3DDecorator {    

    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;

    private _elements: WordBubbleElement[];

    constructor(file3D: AuxFile3D, ...elements: WordBubbleElement[]) {
        super(file3D);
        this._elements = elements;

        this.wordBubble = new WordBubble3D();
        setLayer(this.wordBubble, LayersHelper.Layer_UIWorld, true);
        this.file3D.add(this.wordBubble);
        this.wordBubble.visible = false;
    }

    fileUpdated(calc: FileCalculationContext): void {
        this._updateWorldBubble();
    }

    frameUpdate(calc: FileCalculationContext): void {
        if (this._elements) {
            for (let i = 0; i < this._elements.length; i++) {
                if (this._elements[i].shouldUpdateWorldBubbleThisFrame()) {
                    this._updateWorldBubble();
                    return;
                }
            }
        }
    }

    dispose(): void {
        this.wordBubble.dispose();
        this.file3D.remove(this.wordBubble);
    }

    private _updateWorldBubble(): void {
        let fileBoundingBox = this.file3D.boundingBox;
        if (!fileBoundingBox) {
            this.wordBubble.visible = false;
            return;
        }

        this.wordBubble.visible = true;

        let arrowPoint = new Vector3();
        fileBoundingBox.getCenter(arrowPoint);

        let size = new Vector3();
        fileBoundingBox.getSize(size);
        arrowPoint.y += size.y / 2;
        
        let elementsBoundingBox:Box3 = null;

        this._elements.forEach((e) => {
            let elementBox = e.getBoundingBox();
            if (elementBox) {
                if (elementsBoundingBox === null) {
                    elementsBoundingBox = new Box3(elementBox.min, elementBox.max);
                } else {
                    elementsBoundingBox.union(elementBox);
                }
            }
        });

        if (elementsBoundingBox) {
            this.wordBubble.update(convertToBox2(elementsBoundingBox), arrowPoint);
        }
    }
}