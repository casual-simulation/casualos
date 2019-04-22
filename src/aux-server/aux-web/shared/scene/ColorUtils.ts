import { getHashBuffer } from '@casual-simulation/aux-common/causal-trees/Hash';
import { padZero, byteToHex } from '../SharedUtils';

/**
 * Converts colors from the Hue, Saturation, and Value color space to the Red, Green, Blue color space.
 * @param h The hue.
 * @param s The saturation.
 * @param v The value.
 */
export function hsvToRgb(
    h: number,
    s: number,
    v: number
): { r: number; g: number; b: number } {
    let hInt = Math.trunc(h * 6);
    let hFrac = h * 6 - hInt;
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
        b: b * 256,
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
    let frac = int / 0xffffffff;
    let { r, g, b } = hsvToRgb(frac, 0.5, 0.95);
    return rgbToHex(r, g, b);
}

/**
 * Inverts the given color. If the useBlackAndWhite option is set, then the output color will always be black or white.
 * @param hex The hex value of the color to use.
 * @param useBlackAndWhite Whether the output color should be black or white instead of the actual inverse of the input color.
 * From https://stackoverflow.com/a/35970186/1832856
 */
export function invertColor(hex: string, useBlackAndWhite?: boolean): string {
    if (hex.indexOf('#') === 0) {
        hex = hex.slice(1);
    }
    // convert 3-digit hex to 6-digits.
    if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) {
        throw new Error('Invalid HEX color.');
    }
    var r = parseInt(hex.slice(0, 2), 16),
        g = parseInt(hex.slice(2, 4), 16),
        b = parseInt(hex.slice(4, 6), 16);
    if (useBlackAndWhite) {
        // http://stackoverflow.com/a/3943023/112731
        return r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#FFFFFF';
    }
    // invert color components
    r = 255 - r;
    g = 255 - g;
    b = 255 - b;
    // pad each with zeros and return
    return (
        '#' +
        padZero(r.toString(16)) +
        padZero(g.toString(16)) +
        padZero(b.toString(16))
    );
}

/**
 * Defines a class that can convert between different color formats.
 */
export class ColorConvert {
    private _canvas: any;
    private _context: any;

    /**
     * Creates a new instance of the ColorConvert class.
     */
    constructor() {
        this._canvas = document.createElement('canvas');
        this._canvas.height = 1;
        this._canvas.width = 1;
        this._context = this._canvas.getContext('2d');
    }

    /**
     * Turns any valid canvas fill style into an rgba() string. Returns
     * 'rgba(0,0,0,0)' for invalid colors. Examples:
     * color_convert.to_rgba('red')  # 'rgba(255,0,0,1)'
     * color_convert.to_rgba('#f00')  # 'rgba(255,0,0,1)'
     * color_convert.to_rgba('garbagey')  # 'rgba(0,0,0,0)'
     * color_convert.to_rgba(some_pattern)  # Depends on the pattern
     *
     * @param color  A string, pattern, or gradient
     * @return  A valid rgba CSS color string
     */
    toRgba(color: string) {
        var a = this.toRgbaArray(color);
        return (
            'rgba(' + a[0] + ',' + a[1] + ',' + a[2] + ',' + a[3] / 255 + ')'
        );
    }

    /**
     * Turns any valid canvas fill style into a hex triple. Returns
     * '#000000' for invalid colors. Examples:
     * color_convert.to_hex('red')  # '#ff0000'
     * color_convert.to_hex('rgba(255,0,0,1)')  # '#ff0000'
     * color_convert.to_hex('garbagey')  # '#000000'
     * color_convert.to_hex(some_pattern)  # Depends on the pattern
     *
     * @param color  A string, pattern, or gradient
     * @return  A valid rgba CSS color string
     */
    toHex(color: string) {
        var a = this.toRgbaArray(color);
        // Sigh, you can't map() typed arrays
        var hex = [0, 1, 2]
            .map(function(i) {
                return byteToHex(a[i]);
            })
            .join('');
        return '#' + hex;
    }

    /**
     * Turns any valid canvas fillStyle into a 4-element Uint8ClampedArray with bytes
     * for R, G, B, and A. Invalid styles will return [0, 0, 0, 0]. Examples:
     * color_convert.to_rgb_array('red')  # [255, 0, 0, 255]
     * color_convert.to_rgb_array('#ff0000')  # [255, 0, 0, 255]
     * color_convert.to_rgb_array('garbagey')  # [0, 0, 0, 0]
     */
    toRgbaArray(color: string) {
        // Setting an invalid fillStyle leaves this unchanged
        this._context.fillStyle = 'rgba(0, 0, 0, 0)';
        // We're reusing the canvas, so fill it with something predictable
        this._context.clearRect(0, 0, 1, 1);
        this._context.fillStyle = color;
        this._context.fillRect(0, 0, 1, 1);
        return this._context.getImageData(0, 0, 1, 1).data;
    }
}
