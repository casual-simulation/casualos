declare module 'layout-bmfont-text' {

    export default function createLayout (opt: LayoutOptions): TextLayout;

    class TextLayout {

        /**
         * An array of laid out glyphs that can be used for rendering. Each glyph looks like this:
         * @interface index: Number,    //the index of this glyph into the string
         * @interface data: {...},      //the BMFont "char" object for this glyph
         * @interface position: [x, y], //the baseline position to render this glyph
         * @interface line: Number      //the line index this glyph appears in
         */
        public glyphs: any[];

        /** The width of the text box, or the width provided in constructor. */
        public width: number;

        /** The height of the text box; from baseline to the top of the ascender. */
        public height: number;

        public update(opt: LayoutOptions): void;
    }

    interface LayoutOptions {

        /** the BMFont definition which holds chars, kernings, etc */
        font: any;

        /** the text to layout. Newline characters (\n) will cause line breaks */
        text?: string;

        /** the desired width of the text box, causes word-wrapping and clipping in "pre" mode. 
         * Leave as undefined to remove word-wrapping (default behaviour) */
        width?: number;

        /** a mode for word-wrapper; can be 'pre' (maintain spacing), or 'nowrap' (collapse whitespace but only break on newline characters),
         * otherwise assumes normal word-wrap behaviour (collapse whitespace, break at width or newlines) */
        mode?: string;

        /** can be "left", "center" or "right" (default: left) */
        align?: string;

        /** the letter spacing in pixels (default: 0) */
        letterSpacing?: number;

        /** the line height in pixels (default to font.common.lineHeight) */
        lineHeight?: number;

        /** the number of spaces to use in a single tab (default 4) */
        tabSize?: number;

        /** the starting index into the text to layout (default 0) */
        start?: number;

        /** the ending index (exclusive) into the text to layout (default text.length) */
        end?: number; 

    }
}