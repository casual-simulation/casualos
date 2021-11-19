import ansiStyles from './ansi-styles';
import { stringReplaceAll, stringEncaseCRLFWithFirstIndex } from './util.js';

const GENERATOR = Symbol('GENERATOR');
const STYLER = Symbol('STYLER');
const IS_EMPTY = Symbol('IS_EMPTY');

// `supportsColor.level` → `ansiStyles.color[name]` mapping
const levelMapping = ['ansi', 'ansi', 'ansi256', 'ansi16m'];

const styles = Object.create(null);

/**
Basic foreground colors.

[More colors here.](https://github.com/chalk/chalk/blob/main/readme.md#256-and-truecolor-color-support)
*/
export type ForegroundColor =
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white'
    | 'gray'
    | 'grey'
    | 'blackBright'
    | 'redBright'
    | 'greenBright'
    | 'yellowBright'
    | 'blueBright'
    | 'magentaBright'
    | 'cyanBright'
    | 'whiteBright';

/**
Basic background colors.

[More colors here.](https://github.com/chalk/chalk/blob/main/readme.md#256-and-truecolor-color-support)
*/
export type BackgroundColor =
    | 'bgBlack'
    | 'bgRed'
    | 'bgGreen'
    | 'bgYellow'
    | 'bgBlue'
    | 'bgMagenta'
    | 'bgCyan'
    | 'bgWhite'
    | 'bgGray'
    | 'bgGrey'
    | 'bgBlackBright'
    | 'bgRedBright'
    | 'bgGreenBright'
    | 'bgYellowBright'
    | 'bgBlueBright'
    | 'bgMagentaBright'
    | 'bgCyanBright'
    | 'bgWhiteBright';

/**
Basic colors.

[More colors here.](https://github.com/chalk/chalk/blob/main/readme.md#256-and-truecolor-color-support)
*/
export type Color = ForegroundColor | BackgroundColor;

export type Modifiers =
    | 'reset'
    | 'bold'
    | 'dim'
    | 'italic'
    | 'underline'
    | 'overline'
    | 'inverse'
    | 'hidden'
    | 'strikethrough'
    | 'visible';

/**
Levels:
- `0` - All colors disabled.
- `1` - Basic 16 colors support.
- `2` - ANSI 256 colors support.
- `3` - Truecolor 16 million colors support.
*/
export type ColorSupportLevel = 0 | 1 | 2 | 3;

export interface Options {
    /**
	Specify the color support for Chalk.

	By default, color support is automatically detected based on the environment.

	Levels:
	- `0` - All colors disabled.
	- `1` - Basic 16 colors support.
	- `2` - ANSI 256 colors support.
	- `3` - Truecolor 16 million colors support.
	*/
    readonly level?: ColorSupportLevel;
}

/**
Detect whether the terminal supports color.
*/
export interface ColorSupport {
    /**
	The color level used by Chalk.
	*/
    level: ColorSupportLevel;

    /**
	Return whether Chalk supports basic 16 colors.
	*/
    hasBasic: boolean;

    /**
	Return whether Chalk supports ANSI 256 colors.
	*/
    has256: boolean;

    /**
	Return whether Chalk supports Truecolor 16 million colors.
	*/
    has16m: boolean;
}

export interface ChalkInstance {
    (...text: unknown[]): string;

    /**
	The color support for Chalk.

	By default, color support is automatically detected based on the environment.

	Levels:
	- `0` - All colors disabled.
	- `1` - Basic 16 colors support.
	- `2` - ANSI 256 colors support.
	- `3` - Truecolor 16 million colors support.
	*/
    level: ColorSupportLevel;

    /**
	Use RGB values to set text color.

	@example
	```
	import chalk from 'chalk';

	chalk.rgb(222, 173, 237);
	```
	*/
    rgb: (red: number, green: number, blue: number) => this;

    /**
	Use HEX value to set text color.

	@param color - Hexadecimal value representing the desired color.

	@example
	```
	import chalk from 'chalk';

	chalk.hex('#DEADED');
	```
	*/
    hex: (color: string) => this;

    /**
	Use an [8-bit unsigned number](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) to set text color.

	@example
	```
	import chalk from 'chalk';

	chalk.ansi256(201);
	```
	*/
    ansi256: (index: number) => this;

    /**
	Use RGB values to set background color.

	@example
	```
	import chalk from 'chalk';

	chalk.bgRgb(222, 173, 237);
	```
	*/
    bgRgb: (red: number, green: number, blue: number) => this;

    /**
	Use HEX value to set background color.

	@param color - Hexadecimal value representing the desired color.

	@example
	```
	import chalk from 'chalk';

	chalk.bgHex('#DEADED');
	```
	*/
    bgHex: (color: string) => this;

    /**
	Use a [8-bit unsigned number](https://en.wikipedia.org/wiki/ANSI_escape_code#8-bit) to set background color.

	@example
	```
	import chalk from 'chalk';

	chalk.bgAnsi256(201);
	```
	*/
    bgAnsi256: (index: number) => this;

    /**
	Modifier: Reset the current style.
	*/
    readonly reset: this;

    /**
	Modifier: Make the text bold.
	*/
    readonly bold: this;

    /**
	Modifier: Make the text have lower opacity.
	*/
    readonly dim: this;

    /**
	Modifier: Make the text italic. *(Not widely supported)*
	*/
    readonly italic: this;

    /**
	Modifier: Put a horizontal line below the text. *(Not widely supported)*
	*/
    readonly underline: this;

    /**
	Modifier: Put a horizontal line above the text. *(Not widely supported)*
	*/
    readonly overline: this;

    /**
	Modifier: Invert background and foreground colors.
	*/
    readonly inverse: this;

    /**
	Modifier: Print the text but make it invisible.
	*/
    readonly hidden: this;

    /**
	Modifier: Puts a horizontal line through the center of the text. *(Not widely supported)*
	*/
    readonly strikethrough: this;

    /**
	Modifier: Print the text only when Chalk has a color level above zero.

	Can be useful for things that are purely cosmetic.
	*/
    readonly visible: this;

    readonly black: this;
    readonly red: this;
    readonly green: this;
    readonly yellow: this;
    readonly blue: this;
    readonly magenta: this;
    readonly cyan: this;
    readonly white: this;

    /*
	Alias for `blackBright`.
	*/
    readonly gray: this;

    /*
	Alias for `blackBright`.
	*/
    readonly grey: this;

    readonly blackBright: this;
    readonly redBright: this;
    readonly greenBright: this;
    readonly yellowBright: this;
    readonly blueBright: this;
    readonly magentaBright: this;
    readonly cyanBright: this;
    readonly whiteBright: this;

    readonly bgBlack: this;
    readonly bgRed: this;
    readonly bgGreen: this;
    readonly bgYellow: this;
    readonly bgBlue: this;
    readonly bgMagenta: this;
    readonly bgCyan: this;
    readonly bgWhite: this;

    /*
	Alias for `bgBlackBright`.
	*/
    readonly bgGray: this;

    /*
	Alias for `bgBlackBright`.
	*/
    readonly bgGrey: this;

    readonly bgBlackBright: this;
    readonly bgRedBright: this;
    readonly bgGreenBright: this;
    readonly bgYellowBright: this;
    readonly bgBlueBright: this;
    readonly bgMagentaBright: this;
    readonly bgCyanBright: this;
    readonly bgWhiteBright: this;
}

/**
Main Chalk object that allows to chain styles together.

Call the last one as a method with a string argument.

Order doesn't matter, and later styles take precedent in case of a conflict.

This simply means that `chalk.red.yellow.green` is equivalent to `chalk.green`.
*/
// declare const chalk: ChalkInstance;

// export const supportsColor: ColorSupport | false;

// export const chalkStderr: typeof chalk;
// export const supportsColorStderr: typeof supportsColor;

// export default chalk;

const applyOptions = (object, options: Options = {}) => {
    if (
        options.level &&
        !(
            Number.isInteger(options.level) &&
            options.level >= 0 &&
            options.level <= 3
        )
    ) {
        throw new Error('The `level` option should be an integer from 0 to 3');
    }

    // Detect level if not set manually
    const colorLevel = 0;
    object.level = options.level === undefined ? colorLevel : options.level;
};

export class Chalk {
    constructor(options: Options) {
        // eslint-disable-next-line no-constructor-return
        return chalkFactory(options);
    }
}

const chalkFactory = (options: Options) => {
    const chalk = (...strings: string[]) => strings.join(' ');
    applyOptions(chalk, options);

    Object.setPrototypeOf(chalk, createChalk.prototype);

    return chalk as ChalkInstance;
};

function createChalk(options?: Options): ChalkInstance {
    return chalkFactory(options);
}

Object.setPrototypeOf(createChalk.prototype, Function.prototype);

for (const [styleName, style] of Object.entries(ansiStyles)) {
    styles[styleName] = {
        get() {
            const builder = createBuilder(
                this,
                createStyler(style.open, style.close, this[STYLER]),
                this[IS_EMPTY]
            );
            Object.defineProperty(this, styleName, { value: builder });
            return builder;
        },
    };
}

styles.visible = {
    get() {
        const builder = createBuilder(this, this[STYLER], true);
        Object.defineProperty(this, 'visible', { value: builder });
        return builder;
    },
};

const getModelAnsi = (model, level, type, ...arguments_: any[]) => {
    if (model === 'rgb') {
        if (level === 'ansi16m') {
            return ansiStyles[type].ansi16m(...arguments_);
        }

        if (level === 'ansi256') {
            return ansiStyles[type].ansi256(
                // @ts-ignore
                ansiStyles.rgbToAnsi256(...arguments_)
            );
        }

        // @ts-ignore
        return ansiStyles[type].ansi(ansiStyles.rgbToAnsi(...arguments_));
    }

    if (model === 'hex') {
        return getModelAnsi(
            'rgb',
            level,
            type,
            // @ts-ignore
            ...ansiStyles.hexToRgb(...arguments_)
        );
    }

    return ansiStyles[type][model](...arguments_);
};

const usedModels = ['rgb', 'hex', 'ansi256'];

for (const model of usedModels) {
    styles[model] = {
        get() {
            const { level } = this;
            return function (...arguments_) {
                const styler = createStyler(
                    getModelAnsi(
                        model,
                        levelMapping[level],
                        'color',
                        ...arguments_
                    ),
                    ansiStyles.color.close,
                    this[STYLER]
                );
                return createBuilder(this, styler, this[IS_EMPTY]);
            };
        },
    };

    const bgModel = 'bg' + model[0].toUpperCase() + model.slice(1);
    styles[bgModel] = {
        get() {
            const { level } = this;
            return function (...arguments_) {
                const styler = createStyler(
                    getModelAnsi(
                        model,
                        levelMapping[level],
                        'bgColor',
                        ...arguments_
                    ),
                    ansiStyles.bgColor.close,
                    this[STYLER]
                );
                return createBuilder(this, styler, this[IS_EMPTY]);
            };
        },
    };
}

const proto = Object.defineProperties(() => {}, {
    ...styles,
    level: {
        enumerable: true,
        get() {
            return this[GENERATOR].level;
        },
        set(level) {
            this[GENERATOR].level = level;
        },
    },
});

const createStyler = (open, close, parent) => {
    let openAll;
    let closeAll;
    if (parent === undefined) {
        openAll = open;
        closeAll = close;
    } else {
        openAll = parent.openAll + open;
        closeAll = close + parent.closeAll;
    }

    return {
        open,
        close,
        openAll,
        closeAll,
        parent,
    };
};

const createBuilder = (self, _styler, _isEmpty) => {
    // Single argument is hot path, implicit coercion is faster than anything
    // eslint-disable-next-line no-implicit-coercion
    const builder = (...arguments_) =>
        applyStyle(
            builder,
            arguments_.length === 1 ? '' + arguments_[0] : arguments_.join(' ')
        );

    // We alter the prototype because we must return a function, but there is
    // no way to create a function with a different prototype
    Object.setPrototypeOf(builder, proto);

    builder[GENERATOR] = self;
    builder[STYLER] = _styler;
    builder[IS_EMPTY] = _isEmpty;

    return builder;
};

const applyStyle = (self, string) => {
    if (self.level <= 0 || !string) {
        return self[IS_EMPTY] ? '' : string;
    }

    let styler = self[STYLER];

    if (styler === undefined) {
        return string;
    }

    const { openAll, closeAll } = styler;
    if (string.includes('\u001B')) {
        while (styler !== undefined) {
            // Replace any instances already present with a re-opening code
            // otherwise only the part of the string until said closing code
            // will be colored, and the rest will simply be 'plain'.
            string = stringReplaceAll(string, styler.close, styler.open);

            styler = styler.parent;
        }
    }

    // We can move both next actions out of loop, because remaining actions in loop won't have
    // any/visible effect on parts we add here. Close the styling before a linebreak and reopen
    // after next line to fix a bleed issue on macOS: https://github.com/chalk/chalk/pull/92
    const lfIndex = string.indexOf('\n');
    if (lfIndex !== -1) {
        string = stringEncaseCRLFWithFirstIndex(
            string,
            closeAll,
            openAll,
            lfIndex
        );
    }

    return openAll + string + closeAll;
};

Object.defineProperties(createChalk.prototype, styles);

const chalk = createChalk();
export const chalkStderr = createChalk({ level: 0 });

export default chalk;
