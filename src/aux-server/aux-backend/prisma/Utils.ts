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
export function convertToDate(timeMs: number | null | undefined): Date | null {
    if (!timeMs) {
        return null;
    }
    return new Date(timeMs);
}

export function convertToMillis(time: Date | null): number | null {
    if (!time) {
        return null;
    }
    return Number(time);
}

export function convertMarkers(markers: string[]): string[] | null {
    return markers && markers.length > 0 ? markers : null;
}

/**
 * Converts a model with createdAt and updatedAt fields to a model with createdAtMs and updatedAtMs fields.
 * @param model The model to convert. (Object with createdAt and updatedAt fields)
 */
export function convertDateToDateMS<
    M extends { createdAt: Date; updatedAt: Date }
>(
    model: M
): Omit<M, 'createdAt' | 'updatedAt'> & {
    createdAtMs: number | null;
    updatedAtMs: number | null;
} {
    const { createdAt, updatedAt, ...modelPart } = model;
    return {
        ...modelPart,
        createdAtMs: convertToMillis(createdAt),
        updatedAtMs: convertToMillis(updatedAt),
    };
}

/**
 * A helper function that runs the given function and returns null if an error occurs.
 * @param fn The function to run.
 * @param onErr A function that will be called with the error as a parameter should one occur (or null).
 * * Useful for prisma database operations that may fail due to invalid input.
 * * Still be wary of cases where invalid input could be malicious as this could hide errors.
 */
export async function noThrowNull<Fn extends (...args: any[]) => any>(
    fn: Fn,
    onErr: (error: any) => any | null = null,
    ...args: Parameters<Fn>
): Promise<ReturnType<Fn> | null> {
    try {
        return await fn(...args);
    } catch (error) {
        console.warn(error);
        if (onErr) onErr(error);
        return null;
    }
}
