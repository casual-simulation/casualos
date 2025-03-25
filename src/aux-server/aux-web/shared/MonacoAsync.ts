let loadedResolve: () => void;
let loadedReject: (err?: any) => void;

export const onMonacoLoaded = new Promise<void>((resolve, reject) => {
    loadedResolve = resolve;
    loadedReject = reject;
});

export function triggerMonacoLoaded() {
    loadedResolve();
}
