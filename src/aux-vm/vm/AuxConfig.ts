import { AuxUser } from '../AuxUser';

/**
 * Defines the possible configuration options for a simulation.
 */
export interface AuxConfig {
    user: AuxUser;
    id: string;
    host: string;
    treeName: string;
    config: { isBuilder: boolean; isPlayer: boolean };
}
