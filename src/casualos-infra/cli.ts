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

import { Command } from 'commander';
import path from 'node:path';
import type { ChildProcess } from 'node:child_process';
import { spawn, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

const program = new Command();

program
    .name('casualos-infra')
    .description('CLI for managing CasualOS infrastructure')
    .version('1.0.0');

program
    .command('check-tools')
    .description('Check that required tools are installed')
    .action(async () => {
        console.log('Checking tools...');

        const checks: [string, string[], RegExp][] = [
            ['tofu', ['version'], /\d+\.\d+\.\d+/gi],
            ['microk8s', ['status'], /^microk8s is running/gi],
        ];

        let good = true;
        for (let [tool, args, successRegex] of checks) {
            try {
                const { stdout, stderr } = await execAsync(
                    `${tool} ${args.join(' ')}`
                );

                if (successRegex.test(stdout.trim())) {
                    console.log(`- ${tool}: OK ✅`);
                } else {
                    good = false;
                    console.error(`- ${tool}: NOT OK ❌`);
                }
            } catch (err) {
                good = false;
                console.error(`- ${tool}: NOT OK ❌`);
            }
        }

        process.exit(good ? 0 : 1);
    });

program
    .command('dev')
    .description('Apply the development Kubernetes configuration')
    .option('--destroy', 'Destroy the development Kubernetes configuration')
    .option('--auto-approve', 'Auto-approve the changes')
    .option(
        '--no-port-forward',
        'Do not port forward microk8s services after applying the configuration'
    )
    .action(async (options) => {
        console.log('Applying development Kubernetes configuration...');

        const devDir = path.resolve(__dirname, '..', 'dev');
        const args = [];
        if (options.autoApprove) {
            args.unshift('-auto-approve');
        }

        if (options.destroy) {
            args.unshift('-destroy');
        }

        try {
            const proc = spawn(`tofu`, ['apply', ...args], {
                cwd: devDir,
                stdio: 'inherit',
            });

            await new Promise<void>((resolve, reject) => {
                proc.on('exit', () => {
                    if (proc.exitCode !== 0) {
                        console.error(
                            'Failed to apply development Kubernetes configuration.'
                        );
                        reject();
                        // process.exit(proc.exitCode || 1);
                    }
                    console.log(
                        'Development Kubernetes configuration applied successfully.'
                    );
                    resolve();
                });
            });
        } catch (err) {
            console.error(
                'Failed to apply development Kubernetes configuration:',
                err
            );
            process.exit(1);
        }

        if (options.portForward) {
            const { kill, promise } = portForward();

            process.on('SIGTERM', () => {
                kill();
            });

            await promise;
        }
    });

async function main() {
    try {
        await program.parseAsync(process.argv);
    } catch (err) {
        console.error(err);
    }
}

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
export function portForward(): {
    promise: Promise<unknown>;
    kill: () => void;
} {
    const processes: ChildProcess[] = [];
    const promises: Promise<void>[] = [];
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
            {
                stdio: 'inherit',
            }
        );

        processes.push(proc);

        promises.push(
            new Promise((resolve, reject) => {
                proc.on('exit', () => {
                    resolve();
                });
            })
        );
    }

    return {
        promise: Promise.all(promises),
        kill: () => {
            for (const proc of processes) {
                proc.kill();
            }
        },
    };
}

main();
