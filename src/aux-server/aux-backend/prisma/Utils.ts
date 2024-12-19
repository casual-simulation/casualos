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

export function convertModelDateToMillis<
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
