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
