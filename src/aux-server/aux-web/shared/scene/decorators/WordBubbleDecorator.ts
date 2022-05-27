import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    getBotLabelAnchor,
} from '@casual-simulation/aux-common';
import { WordBubble3D } from '../WordBubble3D';
import { WordBubbleElement } from '../WordBubbleElement';
import { setLayer, convertToBox2 } from '../SceneUtils';
import { Scene, Box3, Vector3, Color } from '@casual-simulation/three';

export class WordBubbleDecorator extends AuxBot3DDecoratorBase {
    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;

    private _elements: WordBubbleElement[];

    constructor(bot3D: AuxBot3D, ...elements: WordBubbleElement[]) {
        super(bot3D);
        this._elements = elements;

        this.wordBubble = new WordBubble3D();
        this.wordBubble.visible = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateWorldBubble(calc);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._elements) {
            for (let i = 0; i < this._elements.length; i++) {
                if (this._elements[i].shouldUpdateWorldBubbleThisFrame()) {
                    this._updateWorldBubble(calc);
                    return;
                }
            }
        }
    }

    dispose(): void {
        this.wordBubble.dispose();
        this.bot3D.remove(this.wordBubble);
    }

    private _updateWorldBubble(calc: BotCalculationContext): void {
        let anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        const wasVisible = this.wordBubble.visible;

        const hasBubble = (this.wordBubble.visible = anchor === 'floating');
        if (wasVisible && !this.wordBubble.visible) {
            this.bot3D.remove(this.wordBubble);
        } else if (!wasVisible && this.wordBubble.visible) {
            this.bot3D.add(this.wordBubble);
            this.wordBubble.updateMatrixWorld(true);
        }

        if (!hasBubble) {
            return;
        }

        let botBoundingBox = this.bot3D.boundingBox;
        if (!botBoundingBox) {
            this.bot3D.remove(this.wordBubble);
            this.wordBubble.visible = false;
            return;
        }

        let arrowPoint = this.bot3D.position.clone();

        let size = new Vector3();
        botBoundingBox.getSize(size);
        arrowPoint.z += size.z;

        let elementsBoundingBox: Box3 = null;

        this._elements.forEach((e) => {
            let elementBox = e.getBoundingBox();
            if (elementBox) {
                if (elementsBoundingBox === null) {
                    elementsBoundingBox = new Box3(
                        elementBox.min,
                        elementBox.max
                    );
                } else {
                    elementsBoundingBox.union(elementBox);
                }
            }
        });

        if (elementsBoundingBox) {
            this.wordBubble.update(
                convertToBox2(elementsBoundingBox),
                arrowPoint
            );
        }
    }
}
