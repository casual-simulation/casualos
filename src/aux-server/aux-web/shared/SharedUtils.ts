/**
 * Copies the given text to the user's clipboard by creating a textarea, selecting it, and then
 * running the 'copy' command. Likely will only work as a response to a user click or key event.
 * @param text The text to copy to the user's clipboard.
 */
export function copyToClipboard(text: string) {
    const el = document.createElement('textarea');  // Create a <textarea> element
    el.value = text;                                 // Set its value to the string that you want copied
    el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
    el.style.position = 'absolute';
    el.style.left = '-9999px';                      // Move outside the screen to make it invisible
    document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
    const selected =
        document.getSelection().rangeCount > 0        // Check if there is any content selected previously
            ? document.getSelection().getRangeAt(0)     // Store selection if found
            : false;                                    // Mark as false to know no selection existed before
    el.select();                                    // Select the <textarea> content
    document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el);                  // Remove the <textarea> element
    if (selected) {                                 // If a selection existed before copying
        document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
        document.getSelection().addRange(selected);   // Restore the original selection
    }
}

export function getOptionalValue(obj: any, defaultValue: any): any {
    return (obj !== undefined && obj !== null) ? obj : defaultValue;
}