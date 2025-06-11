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

import path from 'path';
import os from 'os';
import { sha256 } from 'hash.js';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { ZipReader, BlobReader, BlobWriter } from '@zip.js/zip.js';
import { promisify } from 'util';
import type { ChildProcess } from 'child_process';
import {
    spawn as spawnCallback,
    execFile as execFileCallback,
} from 'child_process';
const spawn = promisify(spawnCallback);
const execFile = promisify(execFileCallback);

/**
 * Downloads and unzips a file to a temporary directory if it hasn't been downloaded before.
 * @param url The URL of the file to download
 * @param checksum Optional SHA-256 checksum to validate the downloaded file
 * @returns The path to the directory containing the unzipped files
 */
export async function downloadAndUnzipIfNeeded(url: string): Promise<string> {
    const urlHash = sha256().update(url).digest('hex');

    const targetDir = path.join(os.tmpdir(), 'casualos-downloads', urlHash);

    if (existsSync(targetDir)) {
        return targetDir;
    }

    await mkdir(targetDir, { recursive: true });

    console.log(`Downloading ${url} to ${targetDir}...`);
    const resp = await fetch(url);
    const reader = new BlobReader(await resp.blob());
    const zip = new ZipReader(reader);

    const entries = await zip.getEntries();
    for (let entry of entries) {
        if (entry.getData && entry.directory === false) {
            const outputPath = path.join(targetDir, entry.filename);
            const blob = await entry.getData(
                new BlobWriter('application/octet-stream'),
                {}
            );

            await writeFile(
                outputPath,
                new Uint8Array(await blob.arrayBuffer()),
                { flag: 'wx' }
            );
        }
    }

    return targetDir;
}

export async function runTigerBeetle(label: string): Promise<{
    port: string | null;
    process: ChildProcess;
}> {
    let tbDir: string;
    let exePath: string;
    if (os.platform() === 'win32') {
        tbDir = await downloadAndUnzipIfNeeded(
            'https://github.com/tigerbeetle/tigerbeetle/releases/latest/download/tigerbeetle-x86_64-windows.zip'
        );
        exePath = path.join(tbDir, 'tigerbeetle.exe');
    } else if (os.platform() === 'darwin') {
        tbDir = await downloadAndUnzipIfNeeded(
            'https://github.com/tigerbeetle/tigerbeetle/releases/latest/download/tigerbeetle-universal-macos.zip'
        );
        exePath = path.join(tbDir, 'tigerbeetle');
    } else if (os.platform() === 'linux') {
        if (os.arch() === 'arm64') {
            tbDir = await downloadAndUnzipIfNeeded(
                'https://github.com/tigerbeetle/tigerbeetle/releases/latest/download/tigerbeetle-aarch64-linux.zip'
            );
        } else if (os.arch() === 'x64') {
            tbDir = await downloadAndUnzipIfNeeded(
                'https://github.com/tigerbeetle/tigerbeetle/releases/latest/download/tigerbeetle-x86_64-linux.zip'
            );
        }
        exePath = path.join(tbDir, 'tigerbeetle');
    }

    const tbFile = path.join(tbDir, `0_0.tigerbeetle.${label}`);

    await execFile(
        exePath,
        [
            'format',
            '--cluster=0',
            '--replica=0',
            '--replica-count=1',
            '--development',
            tbFile,
        ],
        {
            cwd: tbDir,
        }
    );

    const process = (await spawn(
        exePath,
        ['start', '--addresses=0', '--development', tbFile],
        {
            cwd: tbDir,
            detached: true,
            stdio: 'ignore',
        }
    )) as ChildProcess;

    // read first line from stdout to get the port
    const stdout = process.stdout;

    const linePromise = new Promise<string>((resolve, reject) => {
        let line = '';
        const dataListener = (data: Buffer) => {
            const chunk = data.toString();
            let newline = chunk.indexOf('\n');
            if (newline < 0) {
                line += chunk;
            } else {
                line += chunk.slice(0, newline);
                stdout.off('data', dataListener);
                resolve(line);
            }
        };
        stdout.on('data', dataListener);
    });

    const closePromise = new Promise<void>((resolve) => {
        process.on('close', () => {
            resolve();
        });
    });

    const line = await Promise.race([linePromise, closePromise.then(() => '')]);

    return {
        port: line !== '' ? line.trim() : null,
        process,
    };
}

// let _runTigerBeetlePromise: Promise<ChildProcess> | null = null;

// export async function ensureTigerBeetleIsRunning() {
//     if (!_runTigerBeetlePromise) {
//         _runTigerBeetlePromise = runTigerBeetle().catch((err) => {
//             console.error('Failed to start TigerBeetle:', err);
//             _runTigerBeetlePromise = null;
//             throw err;
//         });
//     }

//     return _runTigerBeetlePromise;
// }
