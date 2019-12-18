export async function writeTextToClipboard(text: string) {
    if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
    }
}
