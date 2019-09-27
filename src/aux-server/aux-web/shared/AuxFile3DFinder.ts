import { AuxFile3D } from './scene/AuxFile3D';

/**
 * Defines an interface for objects that can find AuxFile3D instances.
 */
export interface AuxFile3DFinder {
    /**
     * Finds the list of bot visualizers for the given bot ID.
     * First tries to match bots that have an exact match to the given ID.
     * If no bots are found, then it will search again but this time searching for bots
     * that have IDs that start with the given ID.
     * @param id The ID of the bot to find.
     */
    findFilesById(id: string): AuxFile3D[];
}
