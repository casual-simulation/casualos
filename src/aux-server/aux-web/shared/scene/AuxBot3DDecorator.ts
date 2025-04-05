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
import type { AuxBot3D } from './AuxBot3D';
import type {
    BotCalculationContext,
    LocalActions,
} from '@casual-simulation/aux-common';

export interface AuxBot3DDecorator {
    bot3D: AuxBot3D;

    botUpdated(calc: BotCalculationContext): void;
    botRemoved(calc: BotCalculationContext): void;
    frameUpdate?(calc: BotCalculationContext): void;
    localEvent?(event: LocalActions, calc: BotCalculationContext): void;
    dispose(): void;
}

export abstract class AuxBot3DDecoratorBase implements AuxBot3DDecorator {
    /**
     * The aux bot 3d that this decorator belongs to.
     */
    bot3D: AuxBot3D;

    constructor(bot3D: AuxBot3D) {
        this.bot3D = bot3D;
    }

    botRemoved(calc: BotCalculationContext): void {}
    abstract botUpdated(calc: BotCalculationContext): void;
    abstract dispose(): void;
}
