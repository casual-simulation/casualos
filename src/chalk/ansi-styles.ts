export interface CSPair {
    /**
	The ANSI terminal control sequence for starting this style.
	*/
    readonly open: string;

    /**
	The ANSI terminal control sequence for ending this style.
	*/
    readonly close: string;
}

export interface ColorBase {
    /**
	The ANSI terminal control sequence for ending this color.
	*/
    readonly close: string;

    ansi(code: number): string;

    ansi256(code: number): string;

    ansi16m(red: number, green: number, blue: number): string;
}

export interface Modifier {
    /**
	Resets the current color chain.
	*/
    readonly reset: CSPair;

    /**
	Make text bold.
	*/
    readonly bold: CSPair;

    /**
	Emitting only a small amount of light.
	*/
    readonly dim: CSPair;

    /**
	Make text italic. (Not widely supported)
	*/
    readonly italic: CSPair;

    /**
	Make text underline. (Not widely supported)
	*/
    readonly underline: CSPair;

    /**
	Make text overline.

	Supported on VTE-based terminals, the GNOME terminal, mintty, and Git Bash.
	*/
    readonly overline: CSPair;

    /**
	Inverse background and foreground colors.
	*/
    readonly inverse: CSPair;

    /**
	Prints the text, but makes it invisible.
	*/
    readonly hidden: CSPair;

    /**
	Puts a horizontal line through the center of the text. (Not widely supported)
	*/
    readonly strikethrough: CSPair;
}

export interface ForegroundColor {
    readonly black: CSPair;
    readonly red: CSPair;
    readonly green: CSPair;
    readonly yellow: CSPair;
    readonly blue: CSPair;
    readonly cyan: CSPair;
    readonly magenta: CSPair;
    readonly white: CSPair;

    /**
	Alias for `blackBright`.
	*/
    readonly gray: CSPair;

    /**
	Alias for `blackBright`.
	*/
    readonly grey: CSPair;

    readonly blackBright: CSPair;
    readonly redBright: CSPair;
    readonly greenBright: CSPair;
    readonly yellowBright: CSPair;
    readonly blueBright: CSPair;
    readonly cyanBright: CSPair;
    readonly magentaBright: CSPair;
    readonly whiteBright: CSPair;
}

export interface BackgroundColor {
    readonly bgBlack: CSPair;
    readonly bgRed: CSPair;
    readonly bgGreen: CSPair;
    readonly bgYellow: CSPair;
    readonly bgBlue: CSPair;
    readonly bgCyan: CSPair;
    readonly bgMagenta: CSPair;
    readonly bgWhite: CSPair;

    /**
	Alias for `bgBlackBright`.
	*/
    readonly bgGray: CSPair;

    /**
	Alias for `bgBlackBright`.
	*/
    readonly bgGrey: CSPair;

    readonly bgBlackBright: CSPair;
    readonly bgRedBright: CSPair;
    readonly bgGreenBright: CSPair;
    readonly bgYellowBright: CSPair;
    readonly bgBlueBright: CSPair;
    readonly bgCyanBright: CSPair;
    readonly bgMagentaBright: CSPair;
    readonly bgWhiteBright: CSPair;
}
export interface ConvertColor {
    /**
	Convert from the RGB color space to the ANSI 256 color space.

	@param red - (`0...255`)
	@param green - (`0...255`)
	@param blue - (`0...255`)
	*/
    rgbToAnsi256(red: number, green: number, blue: number): number;

    /**
	Convert from the RGB HEX color space to the RGB color space.

	@param hex - A hexadecimal string containing RGB data.
	*/
    hexToRgb(hex: string | number): [red: number, green: number, blue: number];

    /**
	Convert from the RGB HEX color space to the ANSI 256 color space.

	@param hex - A hexadecimal string containing RGB data.
	*/
    hexToAnsi256(hex: string): number;

    /**
	Convert from the ANSI 256 color space to the ANSI 16 color space.

	@param code - A number representing the ANSI 256 color.
	*/
    ansi256ToAnsi(code: number): number;

    /**
	Convert from the RGB color space to the ANSI 16 color space.

	@param red - (`0...255`)
	@param green - (`0...255`)
	@param blue - (`0...255`)
	*/
    rgbToAnsi(red: number, green: number, blue: number): number;

    /**
	Convert from the RGB HEX color space to the ANSI 16 color space.

	@param hex - A hexadecimal string containing RGB data.
	*/
    hexToAnsi(hex: string): number;
}

export type AnsiStyles = {
    readonly modifier: Modifier;
    readonly color: ColorBase & ForegroundColor;
    readonly bgColor: ColorBase & BackgroundColor;
    readonly codes: ReadonlyMap<number, number>;
} & ForegroundColor &
    BackgroundColor &
    Modifier &
    ConvertColor;

const ANSI_BACKGROUND_OFFSET = 10;

const wrapAnsi16 =
    (offset = 0) =>
    (code) =>
        `\u001B[${code + offset}m`;

const wrapAnsi256 =
    (offset = 0) =>
    (code) =>
        `\u001B[${38 + offset};5;${code}m`;

const wrapAnsi16m =
    (offset = 0) =>
    (red, green, blue) =>
        `\u001B[${38 + offset};2;${red};${green};${blue}m`;

function assembleStyles(): AnsiStyles {
    const codes = new Map();
    const styles = {
        modifier: {
            reset: [0, 0],
            // 21 isn't widely supported and 22 does the same thing
            bold: [1, 22],
            dim: [2, 22],
            italic: [3, 23],
            underline: [4, 24],
            overline: [53, 55],
            inverse: [7, 27],
            hidden: [8, 28],
            strikethrough: [9, 29],
        },
        color: {
            black: [30, 39],
            red: [31, 39],
            green: [32, 39],
            yellow: [33, 39],
            blue: [34, 39],
            magenta: [35, 39],
            cyan: [36, 39],
            white: [37, 39],

            // Bright color
            blackBright: [90, 39],
            redBright: [91, 39],
            greenBright: [92, 39],
            yellowBright: [93, 39],
            blueBright: [94, 39],
            magentaBright: [95, 39],
            cyanBright: [96, 39],
            whiteBright: [97, 39],
        },
        bgColor: {
            bgBlack: [40, 49],
            bgRed: [41, 49],
            bgGreen: [42, 49],
            bgYellow: [43, 49],
            bgBlue: [44, 49],
            bgMagenta: [45, 49],
            bgCyan: [46, 49],
            bgWhite: [47, 49],

            // Bright color
            bgBlackBright: [100, 49],
            bgRedBright: [101, 49],
            bgGreenBright: [102, 49],
            bgYellowBright: [103, 49],
            bgBlueBright: [104, 49],
            bgMagentaBright: [105, 49],
            bgCyanBright: [106, 49],
            bgWhiteBright: [107, 49],
        },
    } as any;

    // Alias bright black as gray (and grey)
    styles.color.gray = styles.color.blackBright;
    styles.bgColor.bgGray = styles.bgColor.bgBlackBright;
    styles.color.grey = styles.color.blackBright;
    styles.bgColor.bgGrey = styles.bgColor.bgBlackBright;

    for (const [groupName, group] of Object.entries(styles)) {
        for (const [styleName, style] of Object.entries(group)) {
            styles[styleName] = {
                open: `\u001B[${style[0]}m`,
                close: `\u001B[${style[1]}m`,
            };

            group[styleName] = styles[styleName];

            codes.set(style[0], style[1]);
        }

        Object.defineProperty(styles, groupName, {
            value: group,
            enumerable: false,
        });
    }

    Object.defineProperty(styles, 'codes', {
        value: codes,
        enumerable: false,
    });

    styles.color.close = '\u001B[39m';
    styles.bgColor.close = '\u001B[49m';

    styles.color.ansi = wrapAnsi16();
    styles.color.ansi256 = wrapAnsi256();
    styles.color.ansi16m = wrapAnsi16m();
    styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
    styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
    styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);

    // From https://github.com/Qix-/color-convert/blob/3f0e0d4e92e235796ccb17f6e85c72094a651f49/conversions.js
    Object.defineProperties(styles, {
        rgbToAnsi256: {
            value: (red: number, green: number, blue: number) => {
                // We use the extended greyscale palette here, with the exception of
                // black and white. normal palette only has 4 greyscale shades.
                if (red === green && green === blue) {
                    if (red < 8) {
                        return 16;
                    }

                    if (red > 248) {
                        return 231;
                    }

                    return Math.round(((red - 8) / 247) * 24) + 232;
                }

                return (
                    16 +
                    36 * Math.round((red / 255) * 5) +
                    6 * Math.round((green / 255) * 5) +
                    Math.round((blue / 255) * 5)
                );
            },
            enumerable: false,
        },
        hexToRgb: {
            value: (hex: string | number) => {
                const matches = /(?<colorString>[a-f\d]{6}|[a-f\d]{3})/i.exec(
                    hex.toString(16)
                );
                if (!matches) {
                    return [0, 0, 0];
                }

                let { colorString } = matches.groups;

                if (colorString.length === 3) {
                    colorString = colorString
                        .split('')
                        .map((character) => character + character)
                        .join('');
                }

                const integer = Number.parseInt(colorString, 16);

                return [
                    (integer >> 16) & 0xff,
                    (integer >> 8) & 0xff,
                    integer & 0xff,
                ];
            },
            enumerable: false,
        },
        hexToAnsi256: {
            value: (hex: string) =>
                styles.rgbToAnsi256(...styles.hexToRgb(hex)),
            enumerable: false,
        },
        ansi256ToAnsi: {
            value: (code: number) => {
                if (code < 8) {
                    return 30 + code;
                }

                if (code < 16) {
                    return 90 + (code - 8);
                }

                let red: number;
                let green: number;
                let blue: number;

                if (code >= 232) {
                    red = ((code - 232) * 10 + 8) / 255;
                    green = red;
                    blue = red;
                } else {
                    code -= 16;

                    const remainder = code % 36;

                    red = Math.floor(code / 36) / 5;
                    green = Math.floor(remainder / 6) / 5;
                    blue = (remainder % 6) / 5;
                }

                const value = Math.max(red, green, blue) * 2;

                if (value === 0) {
                    return 30;
                }

                let result =
                    30 +
                    ((Math.round(blue) << 2) |
                        (Math.round(green) << 1) |
                        Math.round(red));

                if (value === 2) {
                    result += 60;
                }

                return result;
            },
            enumerable: false,
        },
        rgbToAnsi: {
            value: (red: number, green: number, blue: number) =>
                styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
            enumerable: false,
        },
        hexToAnsi: {
            value: (hex: string) =>
                styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
            enumerable: false,
        },
    });

    return styles;
}

const ansiStyles = assembleStyles();

export default ansiStyles;
