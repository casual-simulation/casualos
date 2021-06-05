import Component from 'vue-class-component';
import { Inject, Prop } from 'vue-property-decorator';

import PlayerApp from '../PlayerApp/PlayerApp';
import { IGameView } from '../../shared/vue-components/IGameView';
import MenuBot from '../MenuBot/MenuBot';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { PlayerGame } from '../scene/PlayerGame';
import { Game } from '../../shared/scene/Game';
import { map, tap, combineLatest } from 'rxjs/operators';
import { DimensionItem } from '../DimensionItem';
import { MenuPortal } from '../MenuPortal';
import { appManager } from '../../shared/AppManager';
import CircleWipe from '../../shared/vue-components/CircleWipe/CircleWipe';
import {
    DEFAULT_MAP_PORTAL_BASEMAP,
    hasValue,
} from '@casual-simulation/aux-common';
import type EsriSceneView from 'esri/views/SceneView';
import type EsriExternalRenderers from 'esri/views/3d/externalRenderers';
import type EsriSpatialReference from 'esri/geometry/SpatialReference';
import type EsriMap from 'esri/Map';
import type EsriWebMercatorUtils from 'esri/geometry/support/webMercatorUtils';
import { loadModules as loadEsriModules } from 'esri-loader';
import {
    Config,
    ExternalRenderers,
    GeoMap,
    loadMapModules,
    SceneView,
    SpatialReference,
    WebMercatorUtils,
    Basemap,
    Projection,
} from '../MapUtils';
import { Matrix4, Vector3 } from '@casual-simulation/three';

@Component({
    components: {
        'menu-bot': MenuBot,
        'circle-wipe': CircleWipe,
    },
})
export default class PlayerGameView extends BaseGameView implements IGameView {
    _game: PlayerGame = null;
    menuExpanded: boolean = false;
    showMiniPortalCameraHome: boolean = false;
    miniViewportStyle: any = {};
    mainViewportStyle: any = {};

    hasMainViewport: boolean = false;
    hasMiniViewport: boolean = false;
    hasMap: boolean = false;
    menu: DimensionItem[] = [];
    extraMenuStyle: Partial<HTMLElement['style']> = {};
    menuStyle: Partial<HTMLElement['style']> = {};

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];

    lastMenuCount: number = null;
    private _mapView: EsriSceneView;
    private _coordinateTransformer: (pos: {
        x: number;
        y: number;
        z: number;
    }) => Matrix4;
    private _inverseCoordinateTransformer: (pos: {
        x: number;
        y: number;
        z: number;
    }) => Matrix4;

    constructor() {
        super();
    }

    get mapViewId() {
        return 'map-portal';
    }

    get mapView(): HTMLElement {
        return <HTMLElement>this.$refs.mapView;
    }

    get finalMenuStyle() {
        return {
            ...this.menuStyle,
            ...this.extraMenuStyle,
        };
    }

    protected createGame(): Game {
        return new PlayerGame(this);
    }

    getMapView() {
        return this._mapView;
    }

    /**
     * Gets the matrix that should be used to transform AUX coordinates into Three.js coordinates
     * for the map view.
     *
     * See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#renderCoordinateTransformAt
     */
    getMapCoordinateTransformer() {
        return this._coordinateTransformer;
    }

    /**
     * Gets the matrix that should be used to transform three.js coordinates into AUX coordinates
     * for the map view.
     *
     * See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#renderCoordinateTransformAt
     */
    getMapInverseCoordinateTransformer() {
        return this._inverseCoordinateTransformer;
    }

    getWebMercatorUtils() {
        return WebMercatorUtils;
    }

    setBasemap(basemapId: string) {
        if (this._mapView) {
            const basemap = Basemap.fromId(basemapId);
            if (basemap && this._mapView) {
                if (this._mapView.map.basemap.id !== basemap.id) {
                    this._mapView.map.basemap = basemap;
                }
            }
        }
    }

    moveTouch(e: TouchEvent) {
        e.preventDefault();
    }

    setupCore() {
        this.menu = [];
        this.menuStyle = {};
        this.extraMenuStyle = {};
        this._subscriptions.push(
            this._game
                .watchCameraRigDistanceSquared(this._game.miniCameraRig)
                .pipe(
                    map((distSqr) => distSqr >= 500),
                    tap((visible) => (this.showMiniPortalCameraHome = visible))
                )
                .subscribe()
        );

        let menuContext = new MenuPortal(appManager.simulationManager, [
            'menuPortal',
        ]);
        this._subscriptions.push(menuContext);
        this._subscriptions.push(
            menuContext.itemsUpdated.subscribe((items) => (this.menu = items)),
            menuContext.configUpdated.subscribe(() => {
                this.extraMenuStyle = menuContext.extraStyle as any;
                if (
                    hasValue(this.extraMenuStyle.width) &&
                    !hasValue(this.extraMenuStyle.left) &&
                    !hasValue(this.extraMenuStyle.right)
                ) {
                    const width = this.extraMenuStyle.width;
                    if (typeof width === 'string' && width.endsWith('%')) {
                        const percent = parseFloat(
                            width.slice(0, width.length - 1)
                        );
                        const left = (100 - percent) / 2;
                        if (isFinite(left)) {
                            this.extraMenuStyle.left = `${left}%`;
                        }
                    }
                }
            })
        );

        if (this._game.miniViewport) {
            this.hasMiniViewport = true;

            let style = {
                bottom: this._game.miniViewport.y + 'px',
                left: this._game.miniViewport.x + 'px',
                width: this._game.miniViewport.width + 'px',
                height: this._game.miniViewport.height + 'px',
            };

            this.miniViewportStyle = style;

            this._subscriptions.push(
                this._game.miniViewport.onUpdated
                    .pipe(
                        map((viewport) => ({
                            bottom: viewport.y + 'px',
                            left: viewport.x + 'px',
                            width: viewport.width + 'px',
                            height: viewport.height + 'px',
                        })),
                        tap((style) => {
                            this.miniViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }

        if (this._game.mainViewport && this._game.miniViewport) {
            this.hasMainViewport = true;
            this._subscriptions.push(
                this._game.mainViewport.onUpdated
                    .pipe(
                        combineLatest(
                            this._game.miniViewport.onUpdated,
                            (first, second) => ({
                                main: first,
                                mini: second,
                            })
                        ),
                        map(({ main, mini }) => ({
                            bottom: mini.height + 'px',
                            left: main.x + 'px',
                            width: main.width + 'px',
                            height: main.height - mini.height + 'px',
                        })),
                        tap((style) => {
                            this.mainViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }
    }

    centerMiniCamera() {
        this._game.onCenterCamera(this._game.miniCameraRig);
    }

    setMenuStyle(style: Partial<HTMLElement['style']>) {
        this.menuStyle = style;
    }

    /**
     * Enables and displays the map view.
     * Optionally adds the given external renderer to the view.
     * @param externalRenderer The external renderer that should be used to integrate with the map's rendering system.
     */
    async enableMapView(externalRenderer?: __esri.ExternalRenderer) {
        await loadMapModules();

        console.log('[PlayerGameView] Enable Map');
        if (hasValue(appManager.config.arcGisApiKey)) {
            Config.apiKey = appManager.config.arcGisApiKey;
        }

        const map = new GeoMap({
            basemap: DEFAULT_MAP_PORTAL_BASEMAP,
        });

        this._mapView = new SceneView({
            map: map,
            container: this.mapViewId,
        });

        try {
            // wait for the map to load
            await this._mapView.when();
            this.hasMap = true;
            if (externalRenderer) {
                this._coordinateTransformer = (pos) => {
                    const matrix = new Matrix4();
                    ExternalRenderers.renderCoordinateTransformAt(
                        this._mapView,
                        [pos.x, pos.y, pos.z],
                        SpatialReference.WGS84,
                        matrix.elements
                    );
                    return matrix;
                };
                this._inverseCoordinateTransformer = (pos) => {
                    const [
                        lon,
                        lat,
                        elevation,
                    ] = ExternalRenderers.fromRenderCoordinates(
                        this._mapView,
                        [pos.x, pos.y, pos.z],
                        0,
                        [0, 0, 0],
                        0,
                        SpatialReference.WGS84,
                        1
                    );

                    const matrix = this._coordinateTransformer({
                        x: lon,
                        y: lat,
                        z: elevation,
                    });

                    // 33179 -> 85.17 // lon
                    const renderedPosition = new Vector3().setFromMatrixPosition(
                        matrix
                    );

                    const offset = new Matrix4().makeTranslation(
                        lon - renderedPosition.x * 2,
                        lat - renderedPosition.y * 2,
                        elevation - renderedPosition.z * 2
                    );

                    matrix.premultiply(offset);

                    return matrix;

                    // const matrix = new Matrix4();
                    // console.log(Projection);
                    // (<any>Projection).computeLinearTransformation(
                    //     (<any>this._mapView).renderCoordsHelper.spatialReference,
                    //     [pos.x, pos.y, pos.z],
                    //     matrix.elements,
                    //     SpatialReference.WGS84,
                    // );
                    // return matrix;

                    // const matrix = new Matrix4();
                    // ExternalRenderers.renderCoordinateTransformAt(
                    //     this._mapView,
                    //     coords,
                    //     SpatialReference.WGS84,
                    //     matrix.elements
                    // );

                    // matrix.invert();
                    // matrix.premultiply(offset);
                    // return matrix;
                };

                ExternalRenderers.add(this._mapView, {
                    setup: (context) => {
                        externalRenderer.setup(context);
                        context.resetWebGLState();
                    },
                    render: (context) => {
                        externalRenderer.render(context);
                        ExternalRenderers.requestRender(this._mapView);
                        context.resetWebGLState();
                    },
                    dispose: (context) => externalRenderer.dispose(context),
                });
            }
        } catch (err) {
            console.warn('[PlayerGameView] Failed to load the map view.', err);
            this.hasMap = false;
        }
    }

    /**
     * Disables and destroys the map view.
     */
    disableMapView() {
        // TODO:
    }

    protected setWidthAndHeightCore(width: number, height: number) {
        this.mapView.style.height = this._game.getRenderer().domElement.style.height;
        this.mapView.style.width = this._game.getRenderer().domElement.style.width;
    }
}
