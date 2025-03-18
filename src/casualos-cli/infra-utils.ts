export function getRepoName(path: string) {
    return path.replace(/^(?:\w:|~)?[./\\]*/g, '').replace(/[/\\]/g, '-');
}
