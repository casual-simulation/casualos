const Octokit = require('@octokit/rest');
const program = require('commander');
const childProcess = require('child_process');

program
    .command('release')
    .option('-o, --owner <owner>', 'The owner of the repo.')
    .option('-r, --repo <repo>', 'The name of the repo.')
    .option('-t, --text <text>', 'The release text')
    .option('-a, --auth <auth>', 'The authorization token to use.')
    .action(cmd => {
        const { auth, text, owner, repo } = cmd;
        const github = new Octokit({
            auth,
        });

        const latestTag = childProcess
            .execSync('git describe --abbrev=0 --tags')
            .toString()
            .trim();

        console.log(`Creating release for ${latestTag}...`);

        github.repos
            .createRelease({
                owner: owner,
                repo: repo,
                tag_name: latestTag,
                name: latestTag,
                body: text,
            })
            .then(result => {
                console.log(`Release created at: ${result.data.html_url}`);
            })
            .catch(err => {
                console.error(err);
            });
    });

program.parse(process.argv);
