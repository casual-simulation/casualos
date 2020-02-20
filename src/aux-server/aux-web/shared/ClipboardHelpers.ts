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

export async function readTextFromClipboard(): Promise<string> {
    if (!navigator.clipboard) {
        throw new Error('[Clipboard] Not supported.');
    }
    try {
        const text = await navigator.clipboard.readText();
        console.log('[Clipboard] Read Clipboard!');
        return text;
    } catch (ex) {
        console.error('[Clipboard] Could not read from clipboard: ', ex);
        throw ex;
    }
}
