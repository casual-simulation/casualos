/**
 * Defines a class that it able to manage multiple simulations that are loaded at the same time.
 * @param TSimulation The type of objects that represent a simulation.
 */
export class SimulationManager<TSimulation> {
    simulations: Map<string, TSimulation>;

    /**
     * Creates a new simulation manager using the given simulation factory.
     * @param factory A function that, given an simulation ID, creates a new simulation.
     */
    constructor(factory: (id: string) => TSimulation) {}
}
