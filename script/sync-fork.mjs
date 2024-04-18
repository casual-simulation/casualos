import { Octokit } from '@octokit/rest';
import { Command } from 'commander';
import { simpleGit } from 'simple-git';

const program = new Command();

program
    .command('sync-fork')
    .argument('<current>', 'The full name of the current repo.')
    .argument('<upstream>', 'The upstream repo to sync from.')
    .requiredOption('-a, --auth <auth>', 'The authorization token to use.')
    .requiredOption('-s, --secret <secret>', 'The secret to use for Git.')
    .option('--no-merge', 'Dont automatically merge the pull request.')
    .option('--label <label>', 'The label to apply to the pull request.', 'fork:sync')
    .option('--merge-method <mergeMethod>', 'The method to use for merging the pull request.', 'merge')
    .option('--merge-attempt-count <mergeAttemptCount>', 'The number of times to attempt to merge the pull request.', 10)
    .action(async (current, upstream, options) => {
        const { 
            auth,
            secret,
            merge,
            label,
            mergeMethod,
            mergeAttemptCount
        } = options;

        const [ currentOwner, currentRepo ] = current.split('/');
        const [ owner, repo ] = upstream.split('/');

        console.log(`Syncing fork for ${owner}/${repo}...`);

        const github = new Octokit({
            auth,
        });

        const githubRepo = await github.rest.repos.get({
            owner,
            repo,
        });

        const upstreamCloneUrl = githubRepo.data.clone_url;

        console.log(`Upstream URL: ${upstreamCloneUrl}`);

        const git = simpleGit({
            baseDir: process.cwd(),
            binary: 'git',
        });

        const status = await git.status();
        const currentBranch = status.current;

        console.log(`Current Branch: ${currentBranch}`);

        await addAndSetRemote(git, 'upstream', upstreamCloneUrl);
        const fetchResult = await git.fetch('upstream', currentBranch, { 
            '--depth': 1000,
            '--no-tags': null
        });

        const downstreamUrl = `https://x-access-token:${ secret }@github.com/${current}`;
        await addAndSetRemote(git, 'downstream', downstreamUrl);

        const now = new Date();
        const syncBranchName = `sync/${now.getDate()}-${now.getMonth()}-${now.getFullYear()}@${now.getHours()}-${now.getMinutes()}-${now.getSeconds()}.${now.getMilliseconds()}`;
        await git.branch([syncBranchName, `upstream/${currentBranch}`]);
        await git.push('downstream', syncBranchName);

        console.log(`Pushed sync branch: ${syncBranchName}`);

        const pr = await github.rest.pulls.create({
            owner: currentOwner,
            repo: currentRepo,
            title: `Sync with ${owner}/${repo}`,
            head: syncBranchName,
            base: currentBranch,
            body: `PR to automatically sync [${owner}/${repo}](${githubRepo.data.html_url}):[${currentBranch}](${githubRepo.data.html_url + '/blob/' + currentBranch}) into this repository.`
        });
        await github.rest.issues.update({
            owner: currentOwner,
            repo: currentRepo,
            issue_number: pr.data.number,
            labels: [label],
        });

        console.log(`Pull request #${pr.data.number} created.`);
        
        if (merge) {
            console.log(`Merging pull request with method: ${mergeMethod}`);
            let counter = 0;
            let merged = false;
            while (counter < mergeAttemptCount) {
                // wait 5 extra seconds for each attempt, up to 20 seconds
                const seconds = Math.min(counter * 5, 20);
                await wait(seconds * 1000);
                
                const mergablePr = await github.rest.pulls.get({
                    owner: currentOwner,
                    repo: currentRepo,
                    pull_number: pr.data.number,
                });

                if (mergablePr.data.mergeable) {
                    console.log(`Merging pull request #${pr.data.number}`);
                    const merge = await github.rest.pulls.merge({
                        owner: currentOwner,
                        repo: currentRepo,
                        pull_number: pr.data.number,
                        merge_method: mergeMethod,
                    });
                    merged = true;

                    if (merge.data.merged) {
                        console.log(`Pull request #${pr.data.number} merged successfully.\n${merge.data.sha.slice(0, 7)}: ${merge.data.message}`);

                        console.log('Cleaning up...');
                        await github.rest.git.deleteRef({
                            owner: currentOwner,
                            repo: currentRepo,
                            ref: `heads/${syncBranchName}`,
                        });
                    }
                    break;
                } else if (mergablePr.data.mergeable === false) {
                    console.log(`Pull request #${pr.data.number} is not able to be merged. Skipping merge.`);
                    break;
                }

                counter += 1;
            }

            if (!merged) {
                console.error(`Failed to merge pull request #${pr.data.number} after ${counter} attempts.`);
                process.exit(1);
            }

            console.log('Done.');
        } else {
            console.log('Skipping automatic merge.');
        }
    });

program.parseAsync(process.argv);

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function addAndSetRemote(git, name, url) {
    const remotes = await git.getRemotes();
    if (remotes.some(r => r.name === name)) {
        await git.remote([
            'set-url',
            name,
            url,
        ]);
    } else {
        await git.addRemote(name, url);
        await git.remote([
            'set-url',
            name,
            url,
        ]);
    }
}