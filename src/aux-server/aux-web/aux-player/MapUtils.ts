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
import type EsriConfig from 'esri/config';
import type EsriSceneView from 'esri/views/SceneView';
import type EsriExternalRenderers from 'esri/views/3d/externalRenderers';
import type EsriSpatialReference from 'esri/geometry/SpatialReference';
import type EsriMap from 'esri/Map';
import type EsriBasemap from 'esri/Basemap';
import type EsriWebMercatorUtils from 'esri/geometry/support/webMercatorUtils';
import type EsriProjection from 'esri/geometry/projection';
import type EsriWebTileLayer from 'esri/layers/WebTileLayer';
import { loadModules as loadEsriModules } from 'esri-loader';

let GeoMap: typeof EsriMap;
let SceneView: typeof EsriSceneView;
let ExternalRenderers: typeof EsriExternalRenderers;
let SpatialReference: typeof EsriSpatialReference;
let WebMercatorUtils: typeof EsriWebMercatorUtils;
let Basemap: typeof EsriBasemap;
let Config: typeof EsriConfig;
let Projection: typeof EsriProjection;
let WebTileLayer: typeof EsriWebTileLayer;
let mapLibrariesLoaded = false;

export async function loadMapModules() {
    if (mapLibrariesLoaded) {
        return;
    }
    const [
        config,
        map,
        basemap,
        sceneView,
        externalRenderers,
        spatialReference,
        webMercatorUtils,
        projection,
        webTileLayer,
    ] = await (loadEsriModules([
        'esri/config',
        'esri/Map',
        'esri/Basemap',
        'esri/views/SceneView',
        'esri/views/3d/externalRenderers',
        'esri/geometry/SpatialReference',
        'esri/geometry/support/webMercatorUtils',
        'esri/geometry/projection',
        'esri/layers/WebTileLayer',
    ]) as Promise<
        [
            typeof EsriConfig,
            typeof EsriMap,
            typeof EsriBasemap,
            typeof EsriSceneView,
            typeof EsriExternalRenderers,
            typeof EsriSpatialReference,
            typeof EsriWebMercatorUtils,
            typeof EsriProjection,
            typeof EsriWebTileLayer
        ]
    >);
    mapLibrariesLoaded = true;
    Config = config;
    GeoMap = map;
    Basemap = basemap;
    SceneView = sceneView;
    ExternalRenderers = externalRenderers;
    SpatialReference = spatialReference;
    WebMercatorUtils = webMercatorUtils;
    Projection = projection;
    WebTileLayer = webTileLayer;
}

export {
    Config,
    GeoMap,
    Basemap,
    SceneView,
    SpatialReference,
    WebMercatorUtils,
    mapLibrariesLoaded,
    ExternalRenderers,
    Projection,
    WebTileLayer,
};
