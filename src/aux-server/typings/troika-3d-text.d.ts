declare module 'troika-three-text' {
    import { Color, Material, Mesh } from '@casual-simulation/three';

    /**
     * Defines a class that is able to render some text as a Three.js mesh.
     */
    export class Text extends Mesh {
        /**
         * The text rendered by the mesh.
         */
        text: string;

        /**
         * This is a shortcut for setting the color of the text's material. You can use this if you don't want to specify a whole custom material and just want to change its color.
         *
         * Use the material property if you want to control aspects of the material other than its color.
         *
         * Default: none - uses the color of the material
         */
        color: number | Color;

        /**
         * This is a shortcut for setting the material's polygonOffset and related properties, which can be useful in preventing z-fighting when this text is laid on top of another plane in the scene. Positive numbers are further from the camera, negatives closer.
         *
         * Be aware that while this can help with z-fighting, it does not affect the rendering order; if the text renders before the content behind it, you may see antialiasing pixels that appear too dark or light. You may need to also change the text mesh's renderOrder, or set its z position a fraction closer to the camera, to ensure the text renders after background objects.
         *
         * Defaults to 0.
         */
        depthOffset: number;

        /**
         * Defines the horizontal position in the text block that should line up with the local origin. Can be specified as a numeric x position in local units, a string percentage of the total text block width e.g. '25%', or one of the following keyword strings: 'left', 'center', or 'right'.
         *
         * Default 0.
         */
        anchorX: number | 'left' | 'center' | 'right';

        /**
         * Defines the vertical position in the text block that should line up with the local origin. Can be specified as a numeric y position in local units (note: down is negative y), a string percentage of the total text block height e.g. '25%', or one of the following keyword strings: 'top', 'top-baseline', 'middle', 'bottom-baseline', or 'bottom'.
         *
         * Defaults to 0.
         */
        anchorY:
            | number
            | 'top'
            | 'top-baseline'
            | 'middle'
            | 'bottom-baseline'
            | 'bottom';

        /**
         * If specified, defines the [minX, minY, maxX, maxY] of a rectangle outside of which all pixels will be discarded. This can be used for example to clip overflowing text when whiteSpace='nowrap'.
         */
        clipRect: [number, number, number, number];

        /**
         * The URL of the font to use.
         *
         * Defaults to loading Roboto from Google Fonts.
         */
        font: string;

        /**
         * The em-height at which to render the font, in local world units.
         *
         * Defaults to 0.1.
         */
        fontSize: number;

        /**
         * The uniform adjustment of spacing between letters after kerning is applied, in local world units.
         *
         * Positive numbers increase spacing and negative numbers decrease it.
         *
         * Defaults to 0.
         */
        letterSpacing: number;

        /**
         * The line height of each line of text. Can either be 'normal' which chooses a reasonable height based on the chosen font's
         * ascender/descender metrics or a number that is interpreted as a multiple of the font size.
         *
         * Defaults to normal.
         */
        lineHeight: number | 'normal';

        /**
         * Defines a Three.js Material instance to be used as a base when rendering the text. This material will be automatically replaced with a new material derived from it, that adds shader code to decrease the alpha for each fragment (pixel) outside the text glyphs, with antialiasing.
         *
         * By default it will derive from a simple white `MeshBasicMaterial, but you can use any of the other mesh materials to gain other features like lighting, texture maps, etc.
         * Also see the color shortcut property.
         *
         * Default: a MeshBasicMaterial instance
         */
        material: Material;

        /**
         * The maximum width of the text block, above which text may start wrapping according to the whiteSpace and overflowWrap properties.
         *
         * Defaults to Infinity.
         */
        maxWidth: number;

        /**
         * Defines how text wraps if the whiteSpace property is 'normal'. Can be either 'normal' to break at whitespace characters, or 'break-word' to allow breaking within words.
         *
         * Defaults to normal.
         */
        overflowWrap: 'normal' | 'break-word';

        /**
         * The horizontal alignment of each line of text within the overall text bounding box. Can be one of 'left', 'right', 'center', or 'justify'.
         *
         * Defaults to left.
         */
        textAlign: 'left' | 'right' | 'center' | 'justify';

        /**
         * Defines whether text should wrap when a line reaches the maxWidth. Can be either 'normal', to allow wrapping according to the overflowWrap property, or 'nowrap' to prevent wrapping.
         * Note that 'normal' in this context does honor newline characters to manually break lines, making it behave more like 'pre-wrap' does in CSS.
         *
         * Defaults to normal.
         */
        whiteSpace: 'normal' | 'nowrap';

        /**
         * Updates the mesh with the correct font  color, and more.
         */
        sync(callback?: Function): void;

        /**
         * Disposes the 3D text.
         */
        dispose(): void;
    }
}
