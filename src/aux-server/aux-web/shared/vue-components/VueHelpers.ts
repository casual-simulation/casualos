/**
 * Determines if the given element is focused.
 */
export function isFocused(el: HTMLElement) {
    if (el && document.activeElement) {
        return el.contains(document.activeElement);
    }
    return false;
}
