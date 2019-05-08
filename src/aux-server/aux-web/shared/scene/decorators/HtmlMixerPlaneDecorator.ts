import {
    Math as ThreeMath,
    MeshBasicMaterial,
    Texture,
    MeshToonMaterial,
    MeshStandardMaterial,
    SpriteMaterial,
    Plane,
    Vector3,
    AxesHelper,
} from 'three';
import {
    FileCalculationContext,
    calculateFileValue,
    hasValue,
} from '@casual-simulation/aux-common';
import { AuxFile3DDecorator } from '../AuxFile3DDecorator';
import { AuxFile3D } from '../AuxFile3D';
import { EventBus } from '../../EventBus';
import { IGameView } from '../../IGameView';
import { HtmlMixer, HtmlMixerHelpers } from '../../../shared/scene/HtmlMixer';

export class HtmlMixerPlaneDecorator extends AuxFile3DDecorator {
    /**
     * The src url for the iframe.
     */
    url: string = null;

    /**
     * The 3d plane object used to display the html page.
     */
    mixerPlane: HtmlMixer.Plane;

    private _gameView: IGameView = null;

    constructor(file3D: AuxFile3D, gameView: IGameView) {
        super(file3D);
        this._gameView = gameView;
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
            console.log(
                '[HtmlMixerPlaneDecorator] iframe value changed:',
                this.url
            );

            if (hasValue(this.url)) {
                if (!this.mixerPlane) {
                    // Create the mixer plane.
                    console.log('[HtmlMixerPlaneDecorator] create plane');
                    let mixerContext = this._gameView.getHtmlMixerContext();
                    let domElement = HtmlMixerHelpers.createIframeDomElement(
                        'https://casualsimulation.com'
                    );

                    this.mixerPlane = new HtmlMixer.Plane(
                        mixerContext,
                        domElement
                    );
                    this.file3D.display.add(this.mixerPlane.object3d);
                    this.mixerPlane.object3d.translateY(2.0);
                    // this.mixerPlane.object3d.scale.multiplyScalar(4.0);
                }

                HtmlMixerHelpers.setIframeSrc(this.mixerPlane, this.url);

                // let domElement = HtmlMixerHelpers.createIframeDomElement(this.url);
                // this.mixerPlane.setDomElement(domElement);
            } else {
                if (!!this.mixerPlane) {
                    // Remove the mixer plane.
                    console.log('[HtmlMixerPlaneDecorator] remove plane');
                    this.file3D.display.remove(this.mixerPlane.object3d);
                    this.mixerPlane = null;
                }
            }
        }
    }

    frameUpdate(calc: FileCalculationContext) {}

    dispose() {
        if (!!this.mixerPlane) {
            this.file3D.display.remove(this.mixerPlane.object3d);
            this.mixerPlane.dispose();
        }
    }
}
