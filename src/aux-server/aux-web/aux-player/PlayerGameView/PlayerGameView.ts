import Component from 'vue-class-component';
import { Inject, Prop } from 'vue-property-decorator';

import PlayerApp from '../PlayerApp/PlayerApp';
import { IGameView } from '../../shared/vue-components/IGameView';
import MenuBot from '../MenuBot/MenuBot';
import BaseGameView from '../../shared/vue-components/BaseGameView';
import { PlayerGame } from '../scene/PlayerGame';
import { Game } from '../../shared/scene/Game';
import { map, tap, combineLatestWith } from 'rxjs/operators';
import { DimensionItem } from '../DimensionItem';
import { MenuPortal } from '../MenuPortal';
import { appManager } from '../../shared/AppManager';
import CircleWipe from '../../shared/vue-components/CircleWipe/CircleWipe';
import {
    DEFAULT_MAP_PORTAL_BASEMAP,
    DEFAULT_MAP_PORTAL_LATITUDE,
    DEFAULT_MAP_PORTAL_LONGITUDE,
    DEFAULT_MAP_PORTAL_ZOOM,
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
    miniMapViewportStyle: any = {};

    hasMainViewport: boolean = false;
    hasMiniViewport: boolean = false;
    hasMap: boolean = false;
    hasMiniMap: boolean = false;
    menu: DimensionItem[] = [];
    extraMenuStyle: Partial<HTMLElement['style']> = {};

    @Inject() addSidebarItem: PlayerApp['addSidebarItem'];
    @Inject() removeSidebarItem: PlayerApp['removeSidebarItem'];
    @Inject() removeSidebarGroup: PlayerApp['removeSidebarGroup'];

    lastMenuCount: number = null;
    private _mapView: EsriSceneView;
    private _miniMapView: EsriSceneView;
    private _coordinateTransformer: (pos: {
        x: number;
        y: number;
        z: number;
    }) => Matrix4;

    private _miniMapCoordinateTransformer: (pos: {
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

    get miniMapViewId() {
        return 'mini-map-portal';
    }

    get mapView(): HTMLElement {
        return <HTMLElement>this.$refs.mapView;
    }

    get miniMapView(): HTMLElement {
        return <HTMLElement>this.$refs.miniMapView;
    }

    getMiniMapViewportTarget(): HTMLElement {
        return this.miniMapView.querySelector(
            '.esri-view-root > .esri-view-surface'
        );
    }

    get finalMenuStyle() {
        return {
            ...this.extraMenuStyle,
        };
    }

    protected createGame(): Game {
        return new PlayerGame(this);
    }

    getMapView() {
        return this._mapView;
    }

    getMiniMapView() {
        return this._miniMapView;
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
     * Gets the matrix that should be used to transform AUX coordinates into Three.js coordinates
     * for the map view.
     *
     * See https://developers.arcgis.com/javascript/latest/api-reference/esri-views-3d-externalRenderers.html#renderCoordinateTransformAt
     */
    getMiniMapCoordinateTransformer() {
        return this._miniMapCoordinateTransformer;
    }

    getWebMercatorUtils() {
        return WebMercatorUtils;
    }

    setBasemap(basemapId: string) {
        this._setBasemap(this._mapView, basemapId);
    }

    setMiniMapBasemap(basemapId: string) {
        this._setBasemap(this._miniMapView, basemapId);
    }

    private _setBasemap(view: EsriSceneView, basemapId: string) {
        if (view) {
            const basemap = Basemap.fromId(basemapId);
            if (basemap && view) {
                if (view.map.basemap.id !== basemap.id) {
                    view.map.basemap = basemap;
                }
            }
        }
    }

    moveTouch(e: TouchEvent) {
        e.preventDefault();
    }

    setupCore() {
        this.menu = [];
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
                        combineLatestWith(this._game.miniViewport.onUpdated),
                        map(([main, mini]) => ({
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

        if (this._game.mainViewport && this._game.miniMapViewport) {
            let style = {
                bottom: this._game.miniMapViewport.y + 'px',
                left: this._game.miniMapViewport.x + 'px',
                width: this._game.miniMapViewport.width + 'px',
                height: this._game.miniMapViewport.height + 'px',
            };

            this.miniMapViewportStyle = style;

            this._subscriptions.push(
                this._game.miniMapViewport.onUpdated
                    .pipe(
                        map((viewport) => ({
                            bottom: viewport.y + 'px',
                            left: viewport.x + 'px',
                            width: viewport.width + 'px',
                            height: viewport.height + 'px',
                        })),
                        tap((style) => {
                            this.miniMapViewportStyle = style;
                        })
                    )
                    .subscribe()
            );
        }
    }

    centerMiniCamera() {
        this._game.onCenterCamera(this._game.miniCameraRig);
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
            center: [DEFAULT_MAP_PORTAL_LONGITUDE, DEFAULT_MAP_PORTAL_LATITUDE],
            zoom: DEFAULT_MAP_PORTAL_ZOOM,
            container: this.mapViewId,
        });

        try {
            // wait for the map to load
            await this._mapView.when();
            this._mapView.ui.components = [];
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

    async enableMiniMapView(externalRenderer?: __esri.ExternalRenderer) {
        await loadMapModules();

        console.log('[PlayerGameView] Enable Mini Map');
        if (hasValue(appManager.config.arcGisApiKey)) {
            Config.apiKey = appManager.config.arcGisApiKey;
        }

        const map = new GeoMap({
            basemap: DEFAULT_MAP_PORTAL_BASEMAP,
        });

        this._miniMapView = new SceneView({
            map: map,
            center: [DEFAULT_MAP_PORTAL_LONGITUDE, DEFAULT_MAP_PORTAL_LATITUDE],
            zoom: DEFAULT_MAP_PORTAL_ZOOM,
            container: this.miniMapViewId,
            ui: {
                components: [],
            },
        });

        try {
            // wait for the map to load
            await this._miniMapView.when();
            this.hasMiniMap = true;
            if (externalRenderer) {
                this._miniMapCoordinateTransformer = (pos) => {
                    const matrix = new Matrix4();
                    ExternalRenderers.renderCoordinateTransformAt(
                        this._miniMapView,
                        [pos.x, pos.y, pos.z],
                        SpatialReference.WGS84,
                        matrix.elements
                    );
                    return matrix;
                };
                ExternalRenderers.add(this._miniMapView, {
                    setup: (context) => {
                        externalRenderer.setup(context);
                        context.resetWebGLState();
                    },
                    render: (context) => {
                        externalRenderer.render(context);
                        ExternalRenderers.requestRender(this._miniMapView);
                        context.resetWebGLState();
                    },
                    dispose: (context) => externalRenderer.dispose(context),
                });
            }
        } catch (err) {
            console.warn('[PlayerGameView] Failed to load the map view.', err);
            this.hasMiniMap = false;
        }
    }

    /**
     * Disables and destroys the map view.
     */
    disableMapView() {
        console.log('[PlayerGameView] Disable Map');
        try {
            if (this._mapView) {
                this._mapView.destroy();
                this._mapView = null;
            }
            this.hasMap = false;
        } catch (err) {
            console.warn(
                '[PlayerGameView] Failed to destroy the map view.',
                err
            );
        }
    }

    /**
     * Disables and destroys the map view.
     */
    disableMiniMapView() {
        console.log('[PlayerGameView] Disable Mini Map');
        try {
            if (this._miniMapView) {
                this._miniMapView.destroy();
                this._miniMapView = null;
            }
            this.hasMiniMap = false;
        } catch (err) {
            console.warn(
                '[PlayerGameView] Failed to destroy the mini map view.',
                err
            );
        }
    }

    protected setWidthAndHeightCore(width: number, height: number) {
        this.mapView.style.height =
            this._game.getRenderer().domElement.style.height;
        this.mapView.style.width =
            this._game.getRenderer().domElement.style.width;
    }
}
