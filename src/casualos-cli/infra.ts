import { Command } from 'commander';
import { CliConfig } from './config';
import { z } from 'zod';
import prompts from 'prompts';
import { homedir } from 'os';
import { resolve } from 'path';
import { readdir, mkdir } from 'fs/promises';
import { createOAuthDeviceAuth } from '@octokit/auth-oauth-device';
import { Octokit, App } from 'octokit';
import simpleGit from 'simple-git';

export function setupInfraCommands(program: Command, config: CliConfig) {
    const kit = new Octokit({
        authStrategy: createOAuthDeviceAuth,
        auth: {
            clientType: 'github-app',
            clientId: 'lv1.Iv23li10jiTgXpOGRrWJ.',
            onVerification: (verification: any) => {
                console.log('Open this URL:', verification.verification_uri);
                console.log('Enter code:', verification.user_code);
            },
        },
    });

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

            console.log('Creating repository in:', fullPath);

            await mkdir(fullPath, { recursive: true });

            const git = simpleGit(fullPath);
            await git.init();

            console.log('Git Repository created:', fullPath);

            const { createGithub } = await prompts({
                type: 'confirm',
                name: 'createGithub',
                message: 'Create a GitHub repository for the infrastructure?',
            });

            if (createGithub) {
                const { org } = await prompts({
                    type: 'autocomplete',
                    name: 'org',
                    choices: (
                        await kit.rest.orgs.listForAuthenticatedUser()
                    ).data.map((org) => ({
                        title: org.description,
                        value: org.id,
                    })),
                });

                if (!org) {
                    console.error('No organization selected');
                    process.exit(1);
                    return;
                }

                await kit.rest.repos.createInOrg({
                    org: org,
                    name: name,
                });

                console.log('GitHub Repository created:', name);

                await getAndSaveSshKey(
                    fullPath,
                    config,
                    getInfraConfig(fullPath, config)
                );
            }
        });
}

const INFRA_CONFIG_SCHEMA = z.object({
    sshKey: z.coerce.string().nullable().optional(),
});

export type InfraConfig = z.infer<typeof INFRA_CONFIG_SCHEMA>;

function getInfraConfig(cwd: string, config: CliConfig) {
    return INFRA_CONFIG_SCHEMA.parse({
        sshKey: config.get(`${cwd}.infra.sshKey`),
    });
}

async function getAndSaveSshKey(
    cwd: string,
    config: CliConfig,
    infra: InfraConfig
) {
    const sshKey = await getInfraSshKey(cwd, infra);
    config.set(`${cwd}.infra.sshKey`, sshKey);
    return sshKey;
}

async function getInfraSshKey(cwd: string, config: InfraConfig) {
    if (!config.sshKey) {
        const home = homedir();
        const sshDir = resolve(home, '.ssh');

        // get list of files in .ssh directory
        let sshFiles: string[] = [];

        try {
            sshFiles = await readdir(sshDir);
        } catch (e) {
            // ignore
            console.warn('Unable to read .ssh directory:');
        }

        const { selectOrEnter } = await prompts({
            type: 'autocomplete',
            name: 'selectOrEnter',
            message: `Select an SSH key for the repository`,
            choices: [
                { title: 'None', value: 'none' },
                { title: 'Enter SSH Key Path', value: 'enter' },
                ...sshFiles.map((file) => ({ title: file, value: file })),
            ],
        });

        if (selectOrEnter === 'none') {
            return null;
        } else if (selectOrEnter === 'enter') {
            const { path } = await prompts({
                type: 'text',
                name: 'path',
                message: 'Enter the path to the SSH key file',
            });

            return resolve(cwd, path);
        } else {
            return resolve(sshDir, selectOrEnter);
        }
    }

    return config.sshKey;
}
