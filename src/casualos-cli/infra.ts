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
import type { Command } from 'commander';
import type { CliConfig } from './config';
import { z } from 'zod';
import prompts from 'prompts';
import { resolve } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit } from 'octokit';
import simpleGit from 'simple-git';
import { exec as nodeExec } from 'child_process';
import { existsSync } from 'fs';
import { v4 as uuid } from 'uuid';
import { promisify } from 'util';
import { getRepoName } from './infra-utils';

const exec = promisify(nodeExec);

export function setupInfraCommands(program: Command, config: CliConfig) {
    // new infra repo
    program
        .command('new [name]')
        .description('Create a new infrastructure project')
        .action(async (name: string) => {
            console.log('Creating a new repository for storing infrastructure');

            if (!name) {
                const res = await prompts({
                    type: 'text',
                    name: 'name',
                    message: 'Enter the name of the repository',
                });
                name = res.name;
            }

            if (!name) {
                console.error('No repository name provided');
                process.exit(1);
                return;
            }

            const fullPath = getRepoPath(name);

            if (existsSync(fullPath)) {
                console.error('Directory already exists:', fullPath);
                process.exit(1);
                return;
            }

            console.log('Creating repository in:', fullPath);

            await mkdir(fullPath, { recursive: true });

            const git = simpleGit(fullPath);
            await git.init();

            console.log('Local Git Repository created:', fullPath);

            const { createGithub } = await prompts({
                type: 'confirm',
                name: 'createGithub',
                message: 'Create a GitHub repository for the project?',
            });

            const repoName = getRepoName(name);

            if (createGithub) {
                const kit = await getOctokit(fullPath, config);

                const orgs = (
                    await kit.rest.apps.listInstallationsForAuthenticatedUser(
                        {}
                    )
                ).data.installations.filter(
                    (i: any) => i.target_type === 'Organization'
                );

                const { org } = await prompts({
                    type: 'autocomplete',
                    name: 'org',
                    message:
                        'Select the organization to create the repository in',
                    choices: orgs.map((org: any) => ({
                        title: (org.account as any).login,
                        value: (org.account as any).login,
                    })),
                });

                if (!org) {
                    console.error('No organization selected');
                    process.exit(1);
                    return;
                }

                const { enteredName } = await prompts({
                    type: 'text',
                    name: 'enteredName',
                    message: 'Enter the name of the repository',
                    initial: repoName,
                });

                if (!enteredName) {
                    console.error('No repository name provided');
                    process.exit(1);
                    return;
                }

                const repo = await kit.rest.repos.createInOrg({
                    org: org,
                    name: enteredName,
                    visibility: 'private',
                });

                console.log('GitHub Repository created:', repo.data.html_url);

                await git.addRemote('origin', repo.data.ssh_url);
            }

            const projectId = uuid();

            const projectMeta: InfraMetadata = {
                id: projectId,
                name: repoName,
            };

            await git.checkoutLocalBranch('main');

            await writeFile(
                resolve(fullPath, '.infra.json'),
                JSON.stringify(projectMeta, null, 2)
            );
            // const casualOsPath = require.resolve('casualos');
            // const templatePath = resolve(casualOsPath, 'templates');

            // await cp(templatePath, fullPath, { recursive: true })
            await git.add('.');
            await git.commit('Initial commit');

            if (createGithub) {
                await git.push('origin', 'main', ['--set-upstream']);
            }

            await exec('pulumi login file://' + getLoginPath(fullPath));

            await git.add('.');
            await git.commit('Add Pulumi Metadata');

            if (createGithub) {
                await git.push('origin', 'main', ['--set-upstream']);
            }

            console.log('Repository setup complete!');
        });

    program
        .command('clone [url]')
        .description('Clone an infrastructure project')
        .action(async (url: string) => {
            if (!url) {
                const res = await prompts({
                    type: 'text',
                    name: 'url',
                    message: 'Enter the url of the repository',
                });
                url = res.url;
            }

            const regex = /\/([\w-.\s]+)\.git$/;
            const match = regex.exec(url);

            if (!match) {
                console.error('Invalid repository URL');
                process.exit(1);
                return;
            }

            const repoName = match[1];

            const fullPath = getRepoPath(repoName);

            if (existsSync(fullPath)) {
                console.error('Directory already exists:', fullPath);
                process.exit(1);
                return;
            }

            console.log('Cloning repository:', url);
            await simpleGit().clone(url, fullPath);

            await exec('pulumi login file://' + getLoginPath(fullPath));

            console.log('Done.');
        });

    program
        .command('switch <name>')
        .description('Switch to a different infrastructure project')
        .action(async (name: string) => {
            const fullPath = getRepoPath(name);
            await exec('pulumi login file://' + getLoginPath(fullPath));
        });

    program
        .command('status <name>')
        .description('Get info about a infrastructure project')
        .action(async (name: string) => {
            const fullPath = getRepoPath(name);

            const git = simpleGit(fullPath);
            const status = await git.status();

            console.log('Project Info:');
            console.log('Path:', fullPath);
            console.log('Status:', status.isClean() ? 'Clean' : 'Dirty');

            if (!status.isClean()) {
                console.log('Changes:');
                console.log(status.files.map((f) => f.path).join('\n'));
            }
        });

    program
        .command('save <name>')
        .description('Get info about a infrastructure project')
        .option('-m, --message <message>', 'Commit message')
        .action(async (name: string, options: any) => {
            const fullPath = getRepoPath(name);

            const git = simpleGit(fullPath);
            await git.add('.');

            const message = options.message || 'Save changes';
            await git.commit(message);

            console.log('Changes saved');

            const { push } = await prompts({
                type: 'confirm',
                name: 'push',
                message: 'Push changes to remote?',
                initial: true,
            });

            if (push) {
                await git.push();
            }
        });
}

export interface InfraMetadata {
    id: string;
    name: string;
}

const INFRA_CONFIG_SCHEMA = z.object({
    githubToken: z
        .object({
            token: z.string(),
            refreshToken: z.string().optional().nullable(),
            expiresAt: z.coerce.date(),
        })
        .optional()
        .nullable(),
});

export type InfraConfig = z.infer<typeof INFRA_CONFIG_SCHEMA>;

async function getOctokit(cwd: string, config: CliConfig) {
    const token = await getOrRequestGithubToken(cwd, config);
    const kit = new Octokit({
        auth: token.token,
    });

    return kit;
}

const CLIENT_ID = 'Iv23li10jiTgXpOGRrWJ';

async function getOrRequestGithubToken(cwd: string, config: CliConfig) {
    const infra = getInfraConfig(cwd, config);

    if (!infra.githubToken || infra.githubToken.expiresAt < new Date()) {
        if (infra.githubToken && infra.githubToken.expiresAt < new Date()) {
            console.log('Token expired, refreshing');
        }
        const token = await requestGithubToken();
        config.set(`infra.githubToken`, token);
        return token;
    }

    return infra.githubToken;
}

async function requestGithubToken() {
    const auth = createOAuthDeviceAuth({
        clientType: 'github-app',
        clientId: CLIENT_ID,
        onVerification: (verification) => {
            console.log('\nVerification required.\n');
            console.log('Open this URL:', verification.verification_uri);
            console.log('Enter code:', verification.user_code);
        },
    });

    const token = await auth({
        type: 'oauth',
    });

    console.log('Token:', token);
    return token;
}

function getInfraConfig(cwd: string, config: CliConfig) {
    return INFRA_CONFIG_SCHEMA.parse({
        githubToken: config.get(`infra.githubToken`),
    });
}

// async function getAndSaveSshKey(
//     cwd: string,
//     config: CliConfig,
//     infra: InfraConfig
// ) {
//     const sshKey = await getInfraSshKey(cwd, infra);
//     config.set(`${cwd}.infra.sshKey`, sshKey);
//     return sshKey;
// }

// async function getInfraSshKey(cwd: string, config: InfraConfig) {
//     if (!config.sshKey) {
//         const home = homedir();
//         const sshDir = resolve(home, '.ssh');

//         // get list of files in .ssh directory
//         let sshFiles: string[] = [];

//         try {
//             sshFiles = await readdir(sshDir);
//         } catch (e) {
//             // ignore
//             console.warn('Unable to read .ssh directory:');
//         }

//         const { selectOrEnter } = await prompts({
//             type: 'autocomplete',
//             name: 'selectOrEnter',
//             message: `Select an SSH key for the repository`,
//             choices: [
//                 { title: 'None', value: 'none' },
//                 { title: 'Enter SSH Key Path', value: 'enter' },
//                 ...sshFiles.map((file) => ({ title: file, value: file })),
//             ],
//         });

//         if (selectOrEnter === 'none') {
//             return null;
//         } else if (selectOrEnter === 'enter') {
//             const { path } = await prompts({
//                 type: 'text',
//                 name: 'path',
//                 message: 'Enter the path to the SSH key file',
//             });

//             return resolve(cwd, path);
//         } else {
//             return resolve(sshDir, selectOrEnter);
//         }
//     }

//     return config.sshKey;
// }

export function getRepoPath(name: string) {
    return resolve(name);
}

export function getLoginPath(name: string) {
    return resolve(name, '.state');
}
