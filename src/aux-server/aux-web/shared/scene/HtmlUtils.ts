/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import type {
    WebGLRenderer,
    PerspectiveCamera,
    OrthographicCamera,
} from '@casual-simulation/three';
import { Vector2 } from '@casual-simulation/three';
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
    let rendererCss = mixerContext.rendererCss;
    // Setup rendererWebgl
    let rendererWebgl = mixerContext.rendererWebgl;

    let css3dElement = rendererCss.domElement;
    css3dElement.style.position = 'absolute';
    css3dElement.style.top = '0px';
    css3dElement.style.width = '100%';
    css3dElement.style.height = '100%';
    parentElement.appendChild(css3dElement);

    let webglCanvas = rendererWebgl.domElement;
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
