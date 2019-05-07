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
import { HtmlMixer } from 'threex-htmlmixer';
import { HtmlMixerHelpers } from 'threex-htmlmixerhelpers';
import { DebugObjectManager } from '../DebugObjectManager';

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
                    console.log('[HtmlMixerPlaneDecorator] create plane');
                    // Create the mixer plane.
                    let mixerContext = this._gameView.getHtmlMixerContext();
                    let domElement = HtmlMixerHelpers.createIframeDomElement(
                        'https://casualsimulation.com/'
                    );

                    this.mixerPlane = new HtmlMixer.Plane(
                        mixerContext,
                        domElement
                    );
                    this.mixerPlane.object3d.scale.multiplyScalar(4.0);
                    this.file3D.display.add(this.mixerPlane.object3d);

                    // Debug axes helper.
                    let worldPoint = new Vector3();
                    this.mixerPlane.object3d.getWorldPosition(worldPoint);
                }

                HtmlMixerHelpers.setIframeSrc(this.mixerPlane, this.url);

                // let domElement = HtmlMixerHelpers.createIframeDomElement(this.url);
                // this.mixerPlane.setDomElement(domElement);
            } else {
                if (!!this.mixerPlane) {
                    console.log('[HtmlMixerPlaneDecorator] remove plane');
                    // Remove the mixer plane.
                    this.file3D.display.remove(this.mixerPlane.object3d);
                    this.mixerPlane = null;
                }
            }
        }
    }

    axesHelper: AxesHelper;

    frameUpdate(calc: FileCalculationContext) {
        if (this.mixerPlane) {
            if (!this.axesHelper) {
                console.log('create axes helper');
                this.axesHelper = new AxesHelper(2);
                this._gameView.getScene().add(this.axesHelper);
            }

            let worldPoint = new Vector3();
            this.mixerPlane.object3d.getWorldPosition(worldPoint);
            this.axesHelper.position.copy(worldPoint);
        } else {
            if (this.axesHelper) {
                console.log('remove axes helper');
                this._gameView.getScene().remove(this.axesHelper);
                this.axesHelper = null;
            }
        }
    }

    dispose() {}
}
