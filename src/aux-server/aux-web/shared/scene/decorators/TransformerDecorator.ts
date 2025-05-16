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
import { AuxBot3D } from '../AuxBot3D';
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import { hasValue, getBotTransformer } from '@casual-simulation/aux-common';

export class TransformerDecorator extends AuxBot3DDecoratorBase {
    private _setup: boolean;

    constructor(bot3D: AuxBot3D) {
        super(bot3D);
    }

    botUpdated(calc: BotCalculationContext): void {
        const transformer = getBotTransformer(calc, this.bot3D.bot);
        if (hasValue(transformer)) {
            const bots =
                this.bot3D.dimensionGroup.simulation3D.findBotsById(
                    transformer
                );

            if (bots.length > 0) {
                const parentBot = bots[0];
                if (parentBot instanceof AuxBot3D) {
                    if (parentBot === this.bot3D) {
                        this.bot3D.setParent(this.bot3D.dimensionGroup);
                    } else {
                        this.bot3D.setParent(parentBot);
                    }
                }
            }
        } else {
            if (!this.bot3D.isOnGrid) {
                this.bot3D.setParent(this.bot3D.dimensionGroup);
            }
        }

        if (!this._setup) {
            this._setup = true;

            // Update all the bots that have this set as their transformer
            const matches = calc.lookup.query(
                calc,
                ['transformer'],
                [this.bot3D.bot.id]
            );
            this.bot3D.dimensionGroup.simulation3D.ensureUpdate(
                matches.map((b) => b.id)
            );
        }
    }

    dispose(): void {
        for (let child of this.bot3D.transformContainer.children) {
            if (child instanceof AuxBot3D) {
                child.setParent(child.dimensionGroup);
                this.bot3D.dimensionGroup.simulation3D.ensureUpdate([
                    child.bot.id,
                ]);
            }
        }
    }
}
