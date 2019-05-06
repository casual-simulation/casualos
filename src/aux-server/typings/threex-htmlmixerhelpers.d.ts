declare module 'threex-htmlmixerhelpers' {
    import { WebGLRenderer, Scene, Camera } from 'three';
    import { HtmlMixer } from 'threex-htmlmixer';

    namespace HtmlMixerHelpers {
        /**
         * create domElement for a iframe to insert in a THREEx.HtmlmixedPlane
         *
         * @param  {String} url  the url for the iframe
         */
        function createIframeDomElement(url: string): HTMLIFrameElement;

        /**
         * set the iframe.src in a mixerPlane.
         * - Usefull as it handle IOS specificite
         */
        function setIFrameSrc(mixerPlane: HtmlMixer.Plane, url: string): void;

        /**
         * create domElement for a image to insert in a THREEx.HtmlmixedPlane
         *
         * @param  {String} url  the url for the iframe
         */
        function createImageDomElement(url: string): HTMLImageElement;
    }
}
