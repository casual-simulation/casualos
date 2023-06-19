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
