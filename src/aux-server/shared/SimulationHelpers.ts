/**
 * Gets the ID for a simulation with the given origin.
 * @param recordName The name of the record for the simulation.
 * @param inst The name of the inst for the simulation.
 * @param isStatic whether the simulation is static.
 */
export function getSimulationId(
    recordName: string | null,
    inst: string,
    isStatic: boolean
): string {
    if (!isStatic) {
        return `${recordName ?? 'null'}/${inst}`;
    } else {
        return inst;
    }
}
