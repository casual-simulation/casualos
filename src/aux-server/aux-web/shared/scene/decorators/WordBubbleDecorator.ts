/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import type { AuxBot3D } from '../AuxBot3D';
import type { BotCalculationContext, BotLabelAnchor } from '@casual-simulation/aux-common';
import {
    calculateBotValue,
    calculateFormattedBotValue,
    getBotLabelAnchor,
    isFloatingAnchor,
} from '@casual-simulation/aux-common';
import { WordBubble3D } from '../WordBubble3D';
import { setColor } from '../SceneUtils';
import type { Vector2 } from '@casual-simulation/three';
import { Vector3 } from '@casual-simulation/three';
import type { LabelDecorator } from './LabelDecorator';

export class WordBubbleDecorator extends AuxBot3DDecoratorBase {
    wordBubble: WordBubble3D;

    private _label: LabelDecorator;
    private _anchor: BotLabelAnchor;
    private _labelText: string;

    constructor(bot3D: AuxBot3D, label: LabelDecorator) {
        super(bot3D);
        this._label = label;

        this.wordBubble = new WordBubble3D();
        this.wordBubble.visible = false;
    }

    botUpdated(calc: BotCalculationContext): void {
        this._updateWordBubble(calc);
    }

    frameUpdate(calc: BotCalculationContext): void {
        if (this._label) {
            if (this._label.shouldUpdateWordBubbleThisFrame()) {
                this._updateWordBubble(calc);
                return;
            }
        }
    }

    dispose(): void {
        this.wordBubble.dispose();
        this.wordBubble.removeFromParent();
    }

    private _updateWordBubble(calc: BotCalculationContext): void {
        const prevLabelText = this._labelText;
        this._labelText = calculateFormattedBotValue(
            calc,
            this.bot3D.bot,
            'auxLabel'
        );

        const prevAnchor = this._anchor;
        this._anchor = getBotLabelAnchor(calc, this.bot3D.bot);
        
        // Update word bubble parenting.
        if (prevAnchor !== this._anchor || // Case 1: Label anchor changed
            (prevLabelText && !this._labelText) || // Case 2: Label has become empty
            (!prevLabelText && this._labelText) // Case 3: Label has become filled
        ) {
            // label anchor has changed
            this.wordBubble.removeFromParent();
            this.wordBubble.visible = false;

            if (isFloatingAnchor(this._anchor) && this._labelText) {
                this.wordBubble.visible = true;
                
                if (this._anchor === 'floatingBillboard') {
                    this._label.text3D.add(this.wordBubble);
                } else {
                    this.bot3D.container.add(this.wordBubble);
                }

                this.wordBubble.updateMatrixWorld(true);
            }
        }

        if (!this.wordBubble.visible || !this._label || !this._label.text3D) {
            return;
        }

        if (!this.bot3D.boundingBox) {
            this.wordBubble.removeFromParent();
            this.wordBubble.visible = false;
            return;
        }

        const color = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxLabelFloatingBackgroundColor'
        );
        setColor(this.wordBubble.mesh, color);

        let arrowPoint: Vector3 | null;

        if (this._anchor !== 'floatingBillboard') {
            arrowPoint = new Vector3(0, 0, 0);
            arrowPoint.z += this.bot3D.scaleContainer.scale.z;
        }

        let elementsBoundingBox: Vector2 = this._label.getSize();

        let labelPosition: Vector3 =
            this._anchor === 'floatingBillboard'
                ? new Vector3()
                : this._label.text3D.position;

        if (elementsBoundingBox) {
            this.wordBubble.update(
                arrowPoint,
                labelPosition,
                elementsBoundingBox
            );
        }
    }
}
