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
import type { AuxFileSystem } from '../../aux-common/bots/AuxFileSystem';
import LightningFS from '@isomorphic-git/lightning-fs';

export class AuxFSLightningFS implements AuxFileSystem {
    constructor(private _fs: LightningFS = new LightningFS('fs')) {}
    readFile(path: string, opts?: any): Promise<string> {
        return this._fs.promises.readFile(path, opts ?? { encoding: 'utf8' });
    }
    writeFile(path: string, content: string, opts?: any): Promise<void> {
        return this._fs.promises.writeFile(path, content, opts);
    }
    unlink(path: string, opts?: any): Promise<void> {
        return this._fs.promises.unlink(path, opts);
    }
    async exists(path: string): Promise<boolean> {
        try {
            await this._fs.promises.stat(path);
            return true;
        } catch {
            return false;
        }
    }
    async ls(path: string): Promise<string[]> {
        try {
            return await this._fs.promises.readdir(path);
        } catch {
            return [];
        }
    }
    async mkdir(path: string): Promise<void> {
        await this._fs.promises.mkdir(path);
    }
    async rmdir(path: string): Promise<void> {
        await this._fs.promises.rmdir(path);
    }
    async readdir(path: string): Promise<string[]> {
        return this._fs.promises.readdir(path);
    }
    async stat(path: string): Promise<any> {
        return this._fs.promises.stat(path);
    }
    async lstat(path: string): Promise<any> {
        return this._fs.promises.lstat(path);
    }
}
