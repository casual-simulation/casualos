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
