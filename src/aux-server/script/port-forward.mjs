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
import { spawn } from 'node:child_process';

const ports = [
    ['pod/minio', 9000],
    ['pod/minio', 9001],
    ['pod/valkey', 6379],
    ['pod/typesense', 8108],
    ['pod/livekit', 7880],
    ['pod/livekit', 7881],
];

/**
 * Port forward microk8s services for development.
 */
export async function portForward() {
    for (const [pod, port] of ports) {
        console.log('Port forwarding microk8s service:', pod, '->', port);
        const proc = spawn(
            `microk8s`,
            [
                `kubectl`,
                `port-forward`,
                `-n`,
                `casualos-dev`,
                `${pod}`,
                `${port}`,
            ],
            {}
        );

        await new Promise((resolve, reject) => {
            proc.stdout.on('data', () => {
                resolve();
            });
            proc.stderr.on('data', (data) => {
                console.error('error:', data.toString());
            });
        });
    }
}
