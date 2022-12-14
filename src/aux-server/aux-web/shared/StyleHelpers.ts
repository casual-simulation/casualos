import Vue from 'vue';
import { Color } from '@casual-simulation/three';

let cursorColors = document.createElement('style');
document.body.appendChild(cursorColors);

let availableColors = new Map<string, string>();
let availableBackgroundColors = new Map<string, string>();
let availableBorderColors = new Map<string, string>();
let availableHintLabels = new Map<string, HTMLStyleElement>();
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

function createBackgroundColorClass(
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
    }`,
    ];
}

function createBorderColorClass(
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
            border: solid 1px rgba(${bRed}, ${bGreen}, ${bBlue}, ${alpha});
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

function createFontClass(
    name: string,
    backgroundColor: Color,
    foregroundColor: Color,
    backgroundAlpha: number,
    foregroundAlpha: number
): string {
    let properties = '';

    if (backgroundColor) {
        const bRed = backgroundColor.r * 255;
        const bGreen = backgroundColor.g * 255;
        const bBlue = backgroundColor.b * 255;
        properties += `\nbackground-color: rgba(${bRed}, ${bGreen}, ${bBlue}, ${backgroundAlpha});`;
    }

    if (foregroundColor) {
        const fRed = foregroundColor.r * 255;
        const fGreen = foregroundColor.g * 255;
        const fBlue = foregroundColor.b * 255;
        properties += `\ncolor: rgba(${fRed}, ${fGreen}, ${fBlue}, ${foregroundAlpha});`;
    }

    return `.${name} { ${properties} }`;
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

/**
 * Gets or creates a CSS class that uses the given color and alpha for a Monaco editor hint.
 * @param prefix The CSS class name prefix.
 * @param color The color.
 * @param alpha The alpha.
 */
export function getHintColorClass(
    prefix: string,
    color: string,
    alpha: number = 0.5
): string {
    const c = new Color(color);
    const hex = c.getHexString();
    const name = prefix + hex;
    if (availableBackgroundColors.has(name)) {
        return availableBackgroundColors.get(name);
    } else {
        const [colorClass, colorStyle] = createBackgroundColorClass(
            name,
            c,
            alpha
        );
        stylesheet += '\n' + colorStyle;
        cursorColors.innerHTML = stylesheet;
        availableBackgroundColors.set(name, colorClass);

        return colorClass;
    }
}

/**
 * Gets or creates a CSS class that uses the given color and alpha for a Monaco editor hint stroke.
 * @param prefix The CSS class name prefix.
 * @param color The color.
 * @param alpha The alpha.
 */
export function getHintStrokeClass(
    prefix: string,
    color: string,
    alpha: number = 0.5
): string {
    const c = new Color(color);
    const hex = c.getHexString();
    const name = prefix + hex;
    if (availableBorderColors.has(name)) {
        return availableBorderColors.get(name);
    } else {
        const [colorClass, colorStyle] = createBorderColorClass(name, c, alpha);
        stylesheet += '\n' + colorStyle;
        cursorColors.innerHTML = stylesheet;
        availableBorderColors.set(name, colorClass);

        return colorClass;
    }
}

function getCursorLabelStyle(name: string): HTMLStyleElement {
    if (availableLabels.has(name)) {
        return availableLabels.get(name);
    } else {
        const style = document.createElement('style');
        document.body.appendChild(style);
        availableLabels.set(name, style);
        return style;
    }
}

function getHintLabelStyle(name: string): HTMLStyleElement {
    if (availableHintLabels.has(name)) {
        return availableHintLabels.get(name);
    } else {
        const style = document.createElement('style');
        document.body.appendChild(style);
        availableHintLabels.set(name, style);
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
    const styleElement = getCursorLabelStyle(name);

    const style = createHoverClass(name, background, foreground, label);
    if (styleElement.innerHTML !== style) {
        styleElement.innerHTML = style;
    }

    return name;
}

export function getHintLabelClass(
    prefix: string,
    id: string,
    foregroundColor: string,
    backgroundColor: string
): string {
    const foreground = foregroundColor ? new Color(foregroundColor) : null;
    const background = backgroundColor ? new Color(backgroundColor) : null;
    const name = prefix + id;
    const styleElement = getHintLabelStyle(name);

    const style = createFontClass(name, background, foreground, 0.1, 0.6);
    if (styleElement.innerHTML !== style) {
        styleElement.innerHTML = style;
    }

    return name;
}

export function getSystemTheme(): 'dark' | 'light' {
    const isDark =
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (isDark) {
        return 'dark';
    }

    return 'light';
}

/**
 * Sets the Theme that Vue should use to the specified option.
 * @param theme
 */
export function setTheme(theme: 'auto' | 'light' | 'dark') {
    const theming = (Vue as any).material.theming;
    if (theme === 'light' && theming.theme !== 'default') {
        theming.theme = 'default';
    } else if (theme === 'dark' && theming.theme !== 'dark') {
        theming.theme = 'dark';
    } else if (theme === 'auto') {
        setTheme(getSystemTheme());
    }
}
