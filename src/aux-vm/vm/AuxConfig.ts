/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    id: string;
    host: string;
    treeName: string;
    config: { isBuilder: boolean; isPlayer: boolean };
}
