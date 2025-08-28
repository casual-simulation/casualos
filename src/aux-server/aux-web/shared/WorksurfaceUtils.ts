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
import type { BotCalculationContext } from '@casual-simulation/aux-common';
import {
    isDimension,
    getDimensionVisualizeMode,
    getDimensionPosition,
    getDimensionScale,
    getDimensionSize,
} from '@casual-simulation/aux-common';
import {
    hexesInRadius,
    realPosToGridPos,
    Axial,
    posToKey,
    hexRing,
} from './scene/hex';
import { Vector2 } from '@casual-simulation/three';

export function nextAvailableWorkspacePosition(calc: BotCalculationContext) {
    const visibleWorkspacePositions = calc.objects
        .filter(
            (f) =>
                isDimension(calc, f) &&
                getDimensionVisualizeMode(calc, f) === 'surface'
        )
        .flatMap((f) => {
            const position = getDimensionPosition(calc, f);
            const scale = getDimensionScale(calc, f);
            const positions = hexesInRadius(getDimensionSize(calc, f));
            const centerPosition = realPosToGridPos(
                new Vector2(position.x, position.y),
                scale
            );

            return positions.map((hex) => {
                return new Axial(
                    hex.q + centerPosition.q,
                    hex.r + centerPosition.r
                );
            });
        });

    const mappedPositions = new Map<string, Axial>();

    for (let pos of visibleWorkspacePositions) {
        mappedPositions.set(posToKey(pos), pos);
    }

    let radius = 1;
    let nextPosition: Axial = null;
    while (!nextPosition) {
        const positions = hexRing(radius);
        for (let i = 0; i < positions.length; i++) {
            const pos = positions[i];
            if (!mappedPositions.has(posToKey(pos))) {
                nextPosition = pos;
                break;
            }
        }

        radius += 1;
    }

    return nextPosition;
}
