
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
        return (r * 0.299 + g * 0.587 + b * 0.114) > 186
            ? '#000000'
            : '#FFFFFF';
    }
    // invert color components
    r = (255 - r);
    g = (255 - g);
    b = (255 - b);
    // pad each with zeros and return
    return "#" + padZero(r.toString(16)) + padZero(g.toString(16)) + padZero(b.toString(16));
}

/**
 * Pads the given string with zeros up to the given length.
 */
export function padZero(str: string, len: number = 2) {
    var zeros = new Array(len).join('0');
    return (zeros + str).slice(-len);
}

export function byteToHex(byte: number) {
    // Turns a number (0-255) into a 2-character hex number (00-ff)
    return ('0'+byte.toString(16)).slice(-2);
}

export class ColorConvert {
    private _canvas: any;
    private _context: any;

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
      return 'rgba('+a[0]+','+a[1]+','+a[2]+','+(a[3]/255)+')';
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
      var hex = [0,1,2].map(function(i) { return byteToHex(a[i]) }).join('');
      return '#'+hex;
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

export const colorConvert = new ColorConvert();