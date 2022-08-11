import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import {
    BotCalculationContext,
    getBotLabelAnchor,
} from '@casual-simulation/aux-common';
import { WordBubble3D } from '../WordBubble3D';
import { WordBubbleElement } from '../WordBubbleElement';
import {
    setLayer,
    convertToBox2,
    objectUpwardRay,
    objectWorldDirectionRay,
} from '../SceneUtils';
import {
    Scene,
    Box3,
    Vector3,
    Color,
    Box2,
    Vector2,
    Quaternion,
} from '@casual-simulation/three';

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
        this.bot3D.container.remove(this.wordBubble);
    }

    private _updateWorldBubble(calc: BotCalculationContext): void {
        let anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        const wasVisible = this.wordBubble.visible;

        const hasBubble = (this.wordBubble.visible = anchor === 'floating');
        if (wasVisible && !this.wordBubble.visible) {
            this.bot3D.container.remove(this.wordBubble);
        } else if (!wasVisible && this.wordBubble.visible) {
            this.bot3D.container.add(this.wordBubble);
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

        let arrowPoint = new Vector3(0, 0, 0);

        const tempPos = new Vector3();
        const tempRot = new Quaternion();
        const worldScale = new Vector3();
        this.bot3D.scaleContainer.matrixWorld.decompose(
            tempPos,
            tempRot,
            worldScale
        );

        arrowPoint.z += worldScale.z;

        let elementsBoundingBox: Vector2 = null;

        this._elements.forEach((e) => {
            let elementBox = e.getSize();
            if (elementBox) {
                if (elementsBoundingBox === null) {
                    elementsBoundingBox = new Vector2(
                        elementBox.x,
                        elementBox.y
                    );
                } else {
                    elementsBoundingBox = new Vector2(
                        Math.max(elementsBoundingBox.x, elementBox.x),
                        Math.max(elementsBoundingBox.y, elementBox.y)
                    );
                }
            }
        });

        if (elementsBoundingBox) {
            this.wordBubble.update(elementsBoundingBox, arrowPoint);
        }
    }
}
