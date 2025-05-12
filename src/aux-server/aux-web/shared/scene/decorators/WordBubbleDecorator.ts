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
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import {
    calculateBotValue,
    getBotLabelAnchor,
    isFloatingAnchor,
} from '@casual-simulation/aux-common';
import { WordBubble3D } from '../WordBubble3D';
import { setColor } from '../SceneUtils';
import type { Vector2 } from '@casual-simulation/three';
import { Vector3 } from '@casual-simulation/three';
import type { LabelDecorator } from './LabelDecorator';

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

        const hasBubble = (this.wordBubble.visible = isFloatingAnchor(anchor));
        if (wasVisible && !this.wordBubble.visible) {
            this.wordBubble.parent?.remove(this.wordBubble);
        } else if (!wasVisible && this.wordBubble.visible) {
            if (anchor === 'floatingBillboard') {
                this._label.text3D.add(this.wordBubble);
                this.wordBubble.updateMatrixWorld(true);
            } else {
                this.bot3D.container.add(this.wordBubble);
                this.wordBubble.updateMatrixWorld(true);
            }
        }

        if (!hasBubble || !this._label || !this._label.text3D) {
            return;
        }

        let botBoundingBox = this.bot3D.boundingBox;
        if (!botBoundingBox) {
            this.bot3D.remove(this.wordBubble);
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

        if (anchor !== 'floatingBillboard') {
            arrowPoint = new Vector3(0, 0, 0);
            arrowPoint.z += this.bot3D.boundingBox.max.z;
        }

        let elementsBoundingBox: Vector2 = this._label.getSize();
        let labelPosition: Vector3 =
            anchor === 'floatingBillboard'
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
