import { Command } from 'commander';
import { CliConfig } from './config';
import { z } from 'zod';
import prompts from 'prompts';
import { homedir } from 'os';
import { resolve } from 'path';
import { readdir, mkdir, writeFile } from 'fs/promises';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit, App } from 'octokit';
import simpleGit from 'simple-git';
import { exec } from 'child_process';
import { existsSync } from 'fs';
import { v4 as uuid } from 'uuid';

export function setupInfraCommands(program: Command, config: CliConfig) {
    program
        .command('status')
        .description('Get the status of the infrastructure for this project')
        .action(async () => {
            const cwd = process.cwd();
            const infra = getInfraConfig(cwd, config);

            console.log('Infra Status:');
            console.log('  sshKey:', infra.sshKey ?? '<not set>');
        });

    // program.command('login')
    //     .description('Sets the authentication information needed for the infrastructure repository')
    //     .action(async () => {
    //         const cwd = process.cwd();
    //         const infra = getInfraConfig(cwd, config);

    //         const sshKey = await getAndSaveSshKey(cwd, config, infra);

    //         console.log('SSH Key set:', sshKey);
    //     });

    // new infra repo
    program
        .command('new [name]')
        .description('Create a new repository for storing infrastructure')
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

            const fullPath = resolve(name);

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
                message: 'Create a GitHub repository for the infrastructure?',
            });

            if (createGithub) {
                const kit = await getOctokit(fullPath, config);

                const orgs = (
                    await kit.rest.apps.listInstallationsForAuthenticatedUser(
                        {}
                    )
                ).data.installations.filter(
                    (i) => i.target_type === 'Organization'
                );

                const { org } = await prompts({
                    type: 'autocomplete',
                    name: 'org',
                    message:
                        'Select the organization to create the repository in',
                    choices: orgs.map((org) => ({
                        title: (org.account as any).login,
                        value: (org.account as any).login,
                    })),
                });

                if (!org) {
                    console.error('No organization selected');
                    process.exit(1);
                    return;
                }

                const repoName = getRepoName(name);

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

            // const projectId = uuid();

            // const projectMeta: InfraMetadata = {
            //     id: projectId
            // };

            // await writeFile(resolve(fullPath, '.infra.json'), JSON.stringify(projectMeta, null, 2));

            // await git.add('.infra.json');

            console.log('Repository setup complete!');
        });
}

export interface InfraMetadata {
    id: string;
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
        sshKey: config.get(`${cwd}.infra.sshKey`),
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

export function getRepoName(path: string) {
    return path.replace(/^(?:\w:|~)?[\.\/\\]*/g, '').replace(/[\/\\]/g, '-');
}
