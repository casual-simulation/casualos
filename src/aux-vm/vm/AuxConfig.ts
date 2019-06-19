import { User } from '../managers';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    user: User;
    id: string;
    host: string;
    treeName: string;
    config: { isBuilder: boolean; isPlayer: boolean };
}
