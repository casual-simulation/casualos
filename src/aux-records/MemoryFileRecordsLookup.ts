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
import { sortBy } from 'es-toolkit/compat';
import type {
    AddFileResult,
    EraseFileStoreResult,
    FileRecord,
    FileRecordsLookup,
    ListAllFilesFilter,
    ListAllFilesResult,
    ListFilesLookupResult,
    MarkFileRecordAsUploadedResult,
    UpdateFileResult,
} from './FileRecordsStore';

export class MemoryFileRecordsLookup implements FileRecordsLookup {
    private _files: Map<string, StoredFile> = new Map();

    async getFileRecord(
        recordName: string,
        fileName: string
    ): Promise<FileRecord> {
        let file = this._files.get(fileName);

        if (file) {
            return {
                fileName: file.fileName,
                recordName: file.recordName,
                publisherId: file.publisherId,
                subjectId: file.subjectId,
                sizeInBytes: file.sizeInBytes,
                uploaded: file.uploaded,
                description: file.description,
                bucket: file.bucket,
                markers: file.markers,
            };
        } else {
            return null;
        }
    }

    async listUploadedFiles(
        recordName: string,
        fileName: string
    ): Promise<ListFilesLookupResult> {
        let files = sortBy(
            [...this._files.values()].filter(
                (f) => f.recordName === recordName && f.uploaded
            ),
            (f) => f.fileName
        );

        const count = files.length;

        if (fileName) {
            files = files.filter((f) => f.fileName > fileName);
        }

        return {
            success: true,
            files: files.slice(0, 10).map((f) => ({
                fileName: f.fileName,
                sizeInBytes: f.sizeInBytes,
                uploaded: f.uploaded,
                markers: f.markers,
                bucket: f.bucket,
                description: f.description,
            })),
            totalCount: count,
        };
    }

    async listAllUploadedFilesMatching(
        filter: ListAllFilesFilter
    ): Promise<ListAllFilesResult> {
        let files = sortBy(
            [...this._files.values()].filter((f) => f.uploaded),
            (f) => f.fileName
        );

        if (filter.fileExtensions) {
            files = files.filter((f) => {
                return filter.fileExtensions.some((ext) =>
                    f.fileName.endsWith(ext)
                );
            });
        }

        return {
            success: true,
            files: files.slice(0, 10).map((f) => ({
                recordName: f.recordName,
                fileName: f.fileName,
                bucket: f.bucket,
            })),
        };
    }

    async addFileRecord(
        recordName: string,
        fileName: string,
        publisherId: string,
        subjectId: string,
        sizeInBytes: number,
        description: string,
        bucket: string | null,
        markers: string[]
    ): Promise<AddFileResult> {
        if (this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_already_exists',
                errorMessage: 'The file already exists in the store.',
            };
        }

        let file: StoredFile = {
            fileName: fileName,
            recordName: recordName,
            publisherId,
            subjectId,
            sizeInBytes,
            description,
            markers,
            bucket,
            uploaded: false,
        };

        this._files.set(fileName, file);

        return {
            success: true,
        };
    }

    async updateFileRecord(
        recordName: string,
        fileName: string,
        markers: string[]
    ): Promise<UpdateFileResult> {
        if (!this._files.has(fileName)) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        let file = this._files.get(fileName);

        this._files.set(fileName, {
            ...file,
            markers: markers.slice(),
        });

        return {
            success: true,
        };
    }

    async setFileRecordAsUploaded(
        recordName: string,
        fileName: string
    ): Promise<MarkFileRecordAsUploadedResult> {
        let file = this._files.get(fileName);

        if (!file) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        file.uploaded = true;
        return {
            success: true,
        };
    }

    async eraseFileRecord(
        recordName: string,
        fileName: string
    ): Promise<EraseFileStoreResult> {
        const deleted = this._files.delete(fileName);
        if (!deleted) {
            return {
                success: false,
                errorCode: 'file_not_found',
                errorMessage: 'The file was not found in the store.',
            };
        }

        return {
            success: true,
        };
    }
}

interface StoredFile {
    fileName: string;
    recordName: string;
    publisherId: string;
    subjectId: string;
    sizeInBytes: number;
    uploaded: boolean;
    description: string;
    bucket: string;
    markers: string[];
}
