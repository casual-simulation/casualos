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
import { LabelDecorator } from './LabelDecorator';

export class WordBubbleDecorator extends AuxBot3DDecoratorBase {
    /**
     * The world bubble for the cube.
     */
    wordBubble: WordBubble3D;

    private _label: LabelDecorator;

    constructor(bot3D: AuxBot3D, label: LabelDecorator) {
        super(bot3D);
        this._label = label;

        this.wordBubble = new WordBubble3D();
        this.wordBubble.visible = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateWorldBubble(calc);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._label) {
            if (this._label.shouldUpdateWorldBubbleThisFrame()) {
                this._updateWorldBubble(calc);
                return;
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

        arrowPoint.z += this.bot3D.gridScale;

        let elementsBoundingBox: Vector2 = this._label.getSize();
        let labelPosition: Vector3 = this._label.text3D.position;
        if (elementsBoundingBox) {
            console.log('size', elementsBoundingBox, arrowPoint, labelPosition);
            this.wordBubble.update(
                arrowPoint,
                labelPosition,
                elementsBoundingBox
            );
        }
    }
}
