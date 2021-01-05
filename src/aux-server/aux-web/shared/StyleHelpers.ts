import { Color } from 'three';

let cursorColors = document.createElement('style');
document.body.appendChild(cursorColors);

let availableColors = new Map<string, string>();
let availableLabels = new Map<string, HTMLStyleElement>();
let stylesheet = '';

function createColorClass(
    name: string,
    backgroundColor: Color,
    alpha: number
): [string, string] {
    const bRed = backgroundColor.r * 255;
    const bGreen = backgroundColor.g * 255;
    const bBlue = backgroundColor.b * 255;
    return [
        name,
        `.${name} {
        background-color: rgba(${bRed}, ${bGreen}, ${bBlue}, ${alpha});
    }
    
    .${name}::after {
        border-color: rgba(${bRed}, ${bGreen}, ${bBlue}, ${alpha});
    }`,
    ];
}

function createHoverClass(
    name: string,
    backgroundColor: Color,
    foregroundColor: Color,
    label: string
): string {
    const bRed = backgroundColor.r * 255;
    const bGreen = backgroundColor.g * 255;
    const bBlue = backgroundColor.b * 255;
    const fRed = foregroundColor.r * 255;
    const fGreen = foregroundColor.g * 255;
    const fBlue = foregroundColor.b * 255;
    return `.${name}:hover::after {
        content: '${label}';
        background-color: rgb(${bRed}, ${bGreen}, ${bBlue});
        color: rgb(${fRed}, ${fGreen}, ${fBlue});
        border-width: 0;
        border-radius: 0;
        font-size: 12px;
        line-height: 12px;
        padding: 1px;
        left: -2px;
        top: -13px;
        overflow: hidden;
        width: auto;
        height: auto;
    }`;
}

/**
 * Gets or creates a CSS class that uses the given color and alpha for a Monaco editor cursor.
 * @param prefix The CSS class name prefix.
 * @param color The color.
 * @param alpha The alpha.
 */
export function getCursorColorClass(
    prefix: string,
    color: string,
    alpha: number = 0.5
): string {
    const c = new Color(color);
    const hex = c.getHexString();
    const name = prefix + hex;
    if (availableColors.has(name)) {
        return availableColors.get(name);
    } else {
        const [colorClass, colorStyle] = createColorClass(name, c, alpha);
        stylesheet += '\n' + colorStyle;
        cursorColors.innerHTML = stylesheet;
        availableColors.set(name, colorClass);

        return colorClass;
    }
}

function getLabelStyle(name: string): HTMLStyleElement {
    if (availableLabels.has(name)) {
        return availableLabels.get(name);
    } else {
        const style = document.createElement('style');
        document.body.appendChild(style);
        availableLabels.set(name, style);
        return style;
    }
}

/**
 * Gets or creates a CSS class that uses the given foreground color, background color, and label text for a Monaco editor cursor label.
 * @param prefix The css class name prefix.
 * @param id The ID of this instance of the class.
 * @param foregroundColor The foreground color.
 * @param backgroundColor The background color.
 * @param label The label text.
 */
export function getCursorLabelClass(
    prefix: string,
    id: string,
    foregroundColor: string,
    backgroundColor: string,
    label: string
): string {
    const foreground = new Color(foregroundColor);
    const background = new Color(backgroundColor);
    const name = prefix + id;
    const styleElement = getLabelStyle(name);

    const style = createHoverClass(name, background, foreground, label);
    if (styleElement.innerHTML !== style) {
        styleElement.innerHTML = style;
    }

    return name;
}
