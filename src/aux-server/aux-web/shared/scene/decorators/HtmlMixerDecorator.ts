import {
    Math as ThreeMath,
    MeshBasicMaterial,
    Texture,
    MeshToonMaterial,
    MeshStandardMaterial,
    SpriteMaterial,
    Plane,
} from 'three';
import {
    FileCalculationContext,
    calculateFileValue,
    hasValue,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { EventBus } from '../../../shared/EventBus';
import { IGameView } from '../../../shared/IGameView';
import { HtmlMixer } from 'threex-htmlmixer';
import { HtmlMixerHelpers } from 'threex-htmlmixerhelpers';

// Need this include so that the CSS3DRenderer gets run for its side effects (being included in the THREE namespace).
// CSS3DREnderer is required by the THREEx.HtmlMixer
require('three/examples/js/renderers/CSS3DRenderer');

export class HtmlMixerDecorator extends AuxFile3DDecorator {
    /**
     * The global html mixer context used by all html mixer decorators.
     */
    static mixerContext: HtmlMixer.Context;

    /**
     * The src url for the iframe.
     */
    url: string = null;

    private _gameView: IGameView = null;

    constructor(file3D: AuxFile3D, gameView: IGameView) {
        super(file3D);
        this._gameView = gameView;

        if (!HtmlMixerDecorator.mixerContext) {
            //
            // Create mixer context.
            //

            HtmlMixerDecorator.mixerContext = new HtmlMixer.Context(
                this._gameView.getRenderer(),
                this._gameView.getScene(),
                this._gameView.getMainCamera()
            );

            HtmlMixerDecorator.mixerContext.rendererCss.setSize(
                window.innerWidth,
                window.innerHeight
            );

            // Handle window resize for mixer context.
            window.addEventListener(
                'resize',
                function() {
                    HtmlMixerDecorator.mixerContext.rendererCss.setSize(
                        window.innerWidth,
                        window.innerHeight
                    );
                },
                false
            );

            //
            // Configure mixer context and dom attachment.
            //

            // Setup rendererCss
            var rendererCss = HtmlMixerDecorator.mixerContext.rendererCss;
            // Setup rendererWebgl
            var rendererWebgl = HtmlMixerDecorator.mixerContext.rendererWebgl;

            var css3dElement = rendererCss.domElement;
            css3dElement.style.position = 'absolute';
            css3dElement.style.top = '0px';
            css3dElement.style.width = '100%';
            css3dElement.style.height = '100%';
            document.body.appendChild(css3dElement);

            var webglCanvas = rendererWebgl.domElement;
            webglCanvas.style.position = 'absolute';
            webglCanvas.style.top = '0px';
            webglCanvas.style.width = '100%';
            webglCanvas.style.height = '100%';
            webglCanvas.style.pointerEvents = 'none';
            css3dElement.appendChild(webglCanvas);

            console.log(
                '[HtmlMixerDecorator] mixerContext:',
                HtmlMixerDecorator.mixerContext
            );
        }
    }

    fileUpdated(calc: FileCalculationContext): void {
        let iframeValueChanged = false;

        // Get value of iframe tag.
        const iframeValue = calculateFileValue(
            calc,
            this.file3D.file,
            'aux.iframe'
        );

        if (hasValue(iframeValue)) {
            if (this.url !== iframeValue) {
                this.url = iframeValue;
                iframeValueChanged = true;
            }
        } else {
            if (this.url !== null && this.url !== undefined) {
                this.url = null;
                iframeValueChanged = true;
            }
        }

        if (iframeValueChanged) {
        }
    }

    frameUpdate(calc: FileCalculationContext) {}

    dispose() {}
}
