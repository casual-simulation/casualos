/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import type {
    BranchRecordWithInst,
    CurrentUpdates,
    LoadedPackage,
    BranchRecord,
} from './InstRecordsStore';
import type { LockStore } from '../LockStore';

/**
 * Defines an interface for a store that keeps track of temporary inst records.
 *
 * A key feature of temporary records stores is that they act like a cache.
 * As a result, it may evict data based on configuration or other factors (like memory pressure).
 */
export interface TemporaryInstRecordsStore extends LockStore {
    /**
     * Gets info for the given branch.
     * @param branchKey The key for the branch.
     */
    getBranchByName(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<(TempBranchInfo & { branchSizeInBytes: number }) | null>;

    /**
     * Saves the branch info to the temporary store.
     * @param branch
     */
    saveBranchInfo(branch: TempBranchInfo): Promise<void>;

    /**
     * Deletes all the branches that are associated with the given inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    deleteAllInstBranchInfo(
        recordName: string | null,
        inst: string
    ): Promise<void>;

    /**
     * Gets the updates that are stored in this temporary store.
     * Returns null if no updates are stored.
     * @param branchKey The key for the branch.
     */
    getUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<BranchUpdates | null>;

    /**
     * Adds the given updates to this temporary store.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param updates The updates that should be added.
     * @param sizeInBytes The size of the updates in bytes.
     */
    addUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        updates: string[],
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Gets the size of the inst in bytes.
     * Returns null if no size is stored.
     *
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    getInstSize(
        recordName: string | null,
        inst: string
    ): Promise<number | null>;

    /**
     * Sets the size of the inst in bytes.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param sizeInBytes The size of the inst in bytes.
     */
    setInstSize(
        recordName: string | null,
        inst: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Adds the given amount to the size of the inst.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param sizeInBytes The size.
     */
    addInstSize(
        recordName: string | null,
        inst: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Deletes the inst size.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     */
    deleteInstSize(recordName: string | null, inst: string): Promise<void>;

    /**
     * Gets the size of the branch in bytes.
     * Returns null if no size is stored.
     *
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    getBranchSize(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<number | null>;

    /**
     * Sets the size of the branch in bytes.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param sizeInBytes The size of the inst in bytes.
     */
    setBranchSize(
        recordName: string | null,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Adds the given amount to the size of the branch.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param sizeInBytes The size.
     */
    addBranchSize(
        recordName: string | null,
        inst: string,
        branch: string,
        sizeInBytes: number
    ): Promise<void>;

    /**
     * Deletes the branch size.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    deleteBranchSize(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<void>;

    /**
     * Deletes the given number of updates from the beginning of the updates list.
     * May also set the branch to expire.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     * @param numToDelete The number of updates that should be deleted from the beginning of the list.
     */
    trimUpdates(
        recordName: string | null,
        inst: string,
        branch: string,
        numToDelete: number
    ): Promise<void>;

    /**
     * Gets the number of updates that are currently stored in the given branch.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    countBranchUpdates(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<number>;

    /**
     * Deletes all the info that the branch has stored.
     * @param recordName The name of the record.
     * @param inst The name of the inst.
     * @param branch The name of the branch.
     */
    deleteBranch(
        recordName: string | null,
        inst: string,
        branch: string
    ): Promise<void>;

    /**
     * Sets the current generation that dirty branches should be recorded in.
     * @param generation The generation of dirty branches.
     */
    setDirtyBranchGeneration(generation: string): Promise<void>;

    /**
     * Gets the current generation that dirty branches should be recorded in.
     */
    getDirtyBranchGeneration(): Promise<string>;

    /**
     * Marks the given branch as dirty in the current generation.
     * @param branch The branch that should be marked.
     */
    markBranchAsDirty(branch: BranchName): Promise<void>;

    /**
     * Gets the list of branches that are dirty.
     * @param generation The generation that the branches should be in.
     */
    listDirtyBranches(generation?: string): Promise<BranchName[]>;

    /**
     * Removes given generation of dirty branches.
     * @param string The generation that should be removed.
     */
    clearDirtyBranches(generation: string): Promise<void>;

    /**
     * Saves the given loaded package.
     * @param loadedPackage The package that should be saved.
     */
    saveLoadedPackage(loadedPackage: LoadedPackage): Promise<void>;

    /**
     * Gets the list of loaded packages for the given record and inst.
     * @param recordName The name of the record.
     * @param inst The inst.
     */
    listLoadedPackages(
        recordName: string | null,
        inst: string
    ): Promise<LoadedPackage[]>;

    /**
     * Determines whether the package with the given ID is loaded into the given inst.
     * @param recordName The name of the record that the inst is in.
     * @param inst The inst.
     * @param packageId The ID of the package.
     */
    isPackageLoaded(
        recordName: string | null,
        inst: string,
        packageId: string
    ): Promise<LoadedPackage | null>;
}

export interface BranchUpdates extends CurrentUpdates {
    branchSizeInBytes: number;
}

export interface TempBranchInfo extends BranchRecordWithInst {}

export interface BranchName {
    /**
     * The name of the record that the branch is stored in.
     */
    recordName: string | null;

    /**
     * The name of the inst that the branch is stored in.
     */
    inst: string;

    /**
     * The name of the branch.
     */
    branch: string;
}
