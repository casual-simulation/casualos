import { MathUtils as ThreeMath, Vector3, Vector2 } from 'three';
import {
    BotCalculationContext,
    calculateBotValue,
    hasValue,
    calculateNumericalTagValue,
} from '@casual-simulation/aux-common';
import { AuxBot3DDecorator, AuxBot3DDecoratorBase } from '../AuxBot3DDecorator';
import { AuxBot3D } from '../AuxBot3D';
import { HtmlMixer, HtmlMixerHelpers } from '../HtmlMixer';
import { Game } from '../Game';
import { isValidURL } from '../../../shared/SharedUtils';

const DEFAULT_IFRAME_PLANE_SIZE = new Vector2(1, 3 / 4);
const DEFAULT_IFRAME_PLANE_SCALE = 1;
const DEFAULT_IFRAME_ELEMENT_WIDTH = 768;
const DEFAULT_IFRAME_LOCAL_POSITION = new Vector3(0, 1.0, 0);
const DEFUALT_IFRAME_LOCAL_ROTATION = new Vector3(0, 0, 0);

export class IFramePlaneDecorator extends AuxBot3DDecoratorBase {
    /**
     * The src url for the iframe.
     */
    url: string = null;

    /**
     * The 3d plane object used to display the html page.
     */
    mixerPlane: HtmlMixer.Plane;

    private _game: Game = null;

    private _localPosition: Vector3 = DEFAULT_IFRAME_LOCAL_POSITION;
    private _localRotation: Vector3 = DEFUALT_IFRAME_LOCAL_ROTATION;
    private _planeSize: Vector2 = DEFAULT_IFRAME_PLANE_SIZE;
    private _planeScale: number = DEFAULT_IFRAME_PLANE_SCALE;
    private _elementWidth: number = DEFAULT_IFRAME_ELEMENT_WIDTH;

    constructor(bot3D: AuxBot3D, game: Game) {
        super(bot3D);
        this._game = game;
    }

    botUpdated(calc: BotCalculationContext): void {
        // Get value of iframe plane position.
        this._localPosition = new Vector3(
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeX',
                DEFAULT_IFRAME_LOCAL_POSITION.x
            ),
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeY',
                DEFAULT_IFRAME_LOCAL_POSITION.y
            ),
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeZ',
                DEFAULT_IFRAME_LOCAL_POSITION.z
            )
        );

        // Get value of iframe plane rotation.
        this._localRotation = new Vector3(
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeRotationX',
                DEFUALT_IFRAME_LOCAL_ROTATION.x
            ),
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeRotationY',
                DEFUALT_IFRAME_LOCAL_ROTATION.y
            ),
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeRotationZ',
                DEFUALT_IFRAME_LOCAL_ROTATION.z
            )
        );

        // Get value of iframe plane scale.
        this._planeScale = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxIframeScale',
            DEFAULT_IFRAME_PLANE_SCALE
        );

        // Get value of iframe plane size.
        const iframeSizeValue = new Vector2(
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeSizeX',
                DEFAULT_IFRAME_PLANE_SIZE.x
            ),
            calculateNumericalTagValue(
                calc,
                this.bot3D.bot,
                'auxIframeSizeY',
                DEFAULT_IFRAME_PLANE_SIZE.y
            )
        );
        let iframeSizeValueChanged = false;

        if (!iframeSizeValue.equals(this._planeSize)) {
            this._planeSize = iframeSizeValue;
            iframeSizeValueChanged = true;
        }

        // Get value of iframe element width.
        const iframeElementWidthValue = calculateNumericalTagValue(
            calc,
            this.bot3D.bot,
            'auxIframeElementWidth',
            DEFAULT_IFRAME_ELEMENT_WIDTH
        );
        let iframeElementWidthValueChanged = false;

        if (iframeElementWidthValue !== this._elementWidth) {
            this._elementWidth = iframeElementWidthValue;
            iframeElementWidthValueChanged = true;
        }

        // Get value of iframe url.
        const iframeValue = calculateBotValue(
            calc,
            this.bot3D.bot,
            'auxIframe'
        );
        let iframeValueChanged = false;

        if (hasValue(iframeValue) && isValidURL(iframeValue)) {
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

        let allowSizeChangeThisUpdate = true;
        if (iframeValueChanged) {
            if (hasValue(this.url)) {
                if (!this.mixerPlane) {
                    // Create the mixer plane.
                    this.mixerPlane = this._createMixerPlane();
                    allowSizeChangeThisUpdate = false; // Don't need to update element or plane size since our current values are accurate here.
                }

                HtmlMixerHelpers.setIframeSrc(this.mixerPlane, this.url);
            } else {
                // Remove the mixer plane.
                this._destroyMixerPlane();
            }
        }

        if (allowSizeChangeThisUpdate && this.mixerPlane) {
            if (iframeElementWidthValueChanged || iframeSizeValueChanged) {
                // Recreate the mixer plane if element width or plane size changes ONLY if the mixer plane already exists and wasnt created this frame.
                this.mixerPlane = this._createMixerPlane();
                HtmlMixerHelpers.setIframeSrc(this.mixerPlane, this.url);
            }
        }

        this._updateMixerPlaneTransform();
    }

    private _createMixerPlane(): HtmlMixer.Plane {
        if (this.mixerPlane) {
            this._destroyMixerPlane();
        }

        const mixerContext = this._game.getHtmlMixerContext();
        const domElement = HtmlMixerHelpers.createIframeDomElement(
            'about:blank'
        );

        this.mixerPlane = new HtmlMixer.Plane(mixerContext, domElement, {
            elementW: this._elementWidth,
            planeW: this._planeSize.x,
            planeH: this._planeSize.y,
        });

        this.bot3D.add(this.mixerPlane.object3d);

        return this.mixerPlane;
    }

    private _destroyMixerPlane(): void {
        if (this.mixerPlane) {
            this.bot3D.remove(this.mixerPlane.object3d);
            this.mixerPlane = null;
        }
    }

    private _updateMixerPlaneTransform(): void {
        if (!this.mixerPlane) return;

        this.mixerPlane.object3d.position.set(
            this.bot3D.display.position.x + this._localPosition.x,
            this.bot3D.display.position.y + this._localPosition.y,
            this.bot3D.display.position.z + this._localPosition.z
        );

        this.mixerPlane.object3d.rotation.set(
            ThreeMath.degToRad(this._localRotation.x),
            ThreeMath.degToRad(this._localRotation.y),
            ThreeMath.degToRad(this._localRotation.z)
        );

        this.mixerPlane.object3d.scale.set(
            this._planeScale,
            this._planeScale,
            this._planeScale
        );
    }

    dispose() {
        this._destroyMixerPlane();
    }
}
