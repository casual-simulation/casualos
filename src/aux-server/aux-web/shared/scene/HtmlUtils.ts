import {
    WebGLRenderer,
    PerspectiveCamera,
    OrthographicCamera,
    Vector2,
} from '@casual-simulation/three';
import { HtmlMixer } from './HtmlMixer';
import Bowser from 'bowser';

export function createHtmlMixerContext(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera | OrthographicCamera,
    parentElement: HTMLElement
): HtmlMixer.Context {
    let mixerContext = new HtmlMixer.Context(renderer, camera);

    // Set the size of the css renderer to match the size of the webgl renderer.
    let rendererSize = new Vector2();
    renderer.getSize(rendererSize);
    mixerContext.rendererCss.setSize(rendererSize.x, rendererSize.y);

    //
    // Configure mixer context and dom attachment.
    //

    // Setup rendererCss
    var rendererCss = mixerContext.rendererCss;
    // Setup rendererWebgl
    var rendererWebgl = mixerContext.rendererWebgl;

    var css3dElement = rendererCss.domElement;
    css3dElement.style.position = 'absolute';
    css3dElement.style.top = '0px';
    css3dElement.style.width = '100%';
    css3dElement.style.height = '100%';
    parentElement.appendChild(css3dElement);

    var webglCanvas = rendererWebgl.domElement;
    webglCanvas.style.position = 'absolute';
    webglCanvas.style.top = '0px';
    webglCanvas.style.width = '100%';
    webglCanvas.style.height = '100%';
    webglCanvas.style.pointerEvents = 'none';

    const browser = Bowser.getParser(navigator.userAgent);
    const isIOS14OrNewer = browser.satisfies({
        mobile: {
            safari: '>=14',
        },
        macos: {
            safari: '>=14',
        },
        safari: '>=14',
    });
    if (!isIOS14OrNewer) {
        css3dElement.appendChild(webglCanvas);
    }

    return mixerContext;
}

export function disposeHtmlMixerContext(
    mixerContext: HtmlMixer.Context,
    parentElement: HTMLElement
) {
    parentElement.removeChild(mixerContext.rendererCss.domElement);
}
