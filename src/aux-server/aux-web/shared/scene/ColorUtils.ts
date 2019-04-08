import { getHashBuffer } from '@yeti-cgi/aux-common/causal-trees/Hash';

/**
 * Converts colors from the Hue, Saturation, and Value color space to the Red, Green, Blue color space.
 * @param h The hue.
 * @param s The saturation.
 * @param v The value.
 */
export function hsvToRgb(h: number, s: number, v: number): { r: number, g: number, b: number } {
    let hInt = Math.trunc(h*6);
    let hFrac = (h*6) - hInt;
    let p = v * (1 - s);
    let q = v * (1 - hFrac * s);
    let t = v * (1 - (1 - hFrac) * s);
    let r: number;
    let g: number;
    let b: number;
    if (hInt === 0) {
        r = v;
        g = t;
        b = p;
    } else if (hInt === 1) {
        r = q;
        g = v;
        b = p;
    } else if (hInt === 2) {
        r = p;
        g = v;
        b = t;
    } else if (hInt === 3) {
        r = p;
        g = q;
        b = v;
    } else if (hInt === 4) {
        r = t;
        g = p;
        b = v;
    } else if (hInt === 5) {
        r = v;
        g = p;
        b = q;
    }

    return {
        r: r * 256,
        g: g * 256,
        b: b * 256
    };
}

/**
 * Converts the given RGB components into hex.
 * @param r The red component.
 * @param g The green component.
 * @param b The blue component.
 */
export function rgbToHex(r: number, g: number, b: number): string {
    let red = Math.trunc(r).toString(16);
    let green = Math.trunc(g).toString(16);
    let blue = Math.trunc(b).toString(16);
    return `#${red}${green}${blue}`;
}

/**
 * Gets the hex color that should be used to display the given tags.
 * @param tags The tags to display.
 */
export function getColorForTags(tags: string[]) {
    let hash = getHashBuffer(tags);
    let int = hash.readUInt32BE(0);
    let frac = int / 0xFFFFFFFF;
    let { r, g, b } = hsvToRgb(frac, 0.5, 0.95);
    return rgbToHex(r, g, b);
}