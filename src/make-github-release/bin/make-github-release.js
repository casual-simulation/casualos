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

/* eslint-disable @typescript-eslint/no-require-imports */
const Octokit = require('@octokit/rest');
const program = require('commander');
const childProcess = require('child_process');

program
    .command('release')
    .requiredOption('-o, --owner <owner>', 'The owner of the repo.')
    .requiredOption('-r, --repo <repo>', 'The name of the repo.')
    .requiredOption('-t, --text <text>', 'The release text')
    .requiredOption('-a, --auth <auth>', 'The authorization token to use.')
    .action((cmd) => {
        const { auth, text, owner, repo } = cmd;
        const github = new Octokit({
            auth,
        });

        const latestTag = childProcess
            .execSync('git describe --abbrev=0 --tags')
            .toString()
            .trim();

        const isPrerelease = latestTag.indexOf('alpha') >= 0;

        if (isPrerelease) {
            console.log(`Creating alpha release for ${latestTag}...`);
        } else {
            console.log(`Creating release for ${latestTag}...`);
        }

        github.repos
            .createRelease({
                owner: owner,
                repo: repo,
                tag_name: latestTag,
                name: latestTag,
                body: text,
                prerelease: isPrerelease,
            })
            .then((result) => {
                console.log(`Release created at: ${result.data.html_url}`);
            })
            .catch((err) => {
                console.error(err);
            });
    });

program.parse(process.argv);
