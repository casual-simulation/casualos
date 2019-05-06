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
     * The src url for the iframe.
     */
    url: string = null;

    private _gameView: IGameView = null;

    constructor(file3D: AuxFile3D, gameView: IGameView) {
        super(file3D);
        this._gameView = gameView;

        let mixerContext = new HtmlMixer.Context(
            this._gameView.getRenderer(),
            this._gameView.getScene(),
            this._gameView.getMainCamera()
        );
        console.log('[HtmlMixerDecorator] mixerContext:', mixerContext);
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
