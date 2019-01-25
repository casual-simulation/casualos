declare module 'three-bmfont-text' {

    import { BufferGeometry } from "three";
    import { TextLayout, LayoutOptions } from "layout-bmfont-text";

    export default function createTextGeometry(opt: TextGeometryOptions | string): TextGeometry;

    class TextGeometry extends BufferGeometry {

        public visibleGlyphs: any[]
        public layout: TextLayout;

        public update(opt: TextGeometryOptions | string): void;
    }

    interface TextGeometryOptions extends LayoutOptions {

        /** whether the texture will be Y-flipped (default true) */
        flipY?: boolean;

        /** whether to construct this geometry with an extra buffer containing page IDs. This is necessary for multi-texture fonts (default false) */
        multipage?: boolean;

    }

}