export async function writeTextToClipboard(text: string) {
    if (!navigator.clipboard) {
        throw new Error('[Clipboard] Not supported.');
    }
    try {
        await navigator.clipboard.writeText(text);
        console.log('[Clipboard] Copied to clipboard!');
    } catch (ex) {
        console.error('[Clipboard] Could not write to clipboard: ', ex);
        throw ex;
    }
}
