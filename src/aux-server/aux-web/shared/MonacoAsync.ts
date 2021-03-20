let loadedResolve: Function;
let loadedReject: Function;

export const onMonacoLoaded = new Promise<void>((resolve, reject) => {
    loadedResolve = resolve;
    loadedReject = reject;
});

export function triggerMonacoLoaded() {
    loadedResolve();
}
