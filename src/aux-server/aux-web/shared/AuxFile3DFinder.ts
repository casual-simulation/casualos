import { AuxFile3D } from './scene/AuxFile3D';

/**
 * Defines an interface for objects that can find AuxFile3D instances.
 */
export interface AuxFile3DFinder {
    /**
     * Finds the list of file visualizers for the given file ID.
     * First tries to match files that have an exact match to the given ID.
     * If no files are found, then it will search again but this time searching for files
     * that have IDs that start with the given ID.
     * @param id The ID of the file to find.
     */
    findFilesById(id: string): AuxFile3D[];
}
