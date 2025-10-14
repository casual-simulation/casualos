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
import Axios from 'axios';
import type { Observable, Subject, SubscriptionLike } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import { filter, first, scan, tap } from 'rxjs/operators';
import { downloadAuxState, readFileText } from './DownloadHelpers';
import type {
    BotsState,
    ConnectionIndicator,
    ProgressMessage,
} from '@casual-simulation/aux-common';
import { getUploadState } from '@casual-simulation/aux-common';
import type { StoredAux, PrivacyFeatures } from '@casual-simulation/aux-common';
import {
    hasValue,
    KNOWN_PORTALS,
    getBotsStateFromStoredAux,
    isStoredVersion2,
} from '@casual-simulation/aux-common';
import { v4 as uuid } from 'uuid';
import type { WebConfig } from '@casual-simulation/aux-common/common/WebConfig';
import type {
    AuxConfig,
    SimulationOrigin,
    AuthHelperInterface,
} from '@casual-simulation/aux-vm';
import { SimulationManager } from '@casual-simulation/aux-vm';
import type { BrowserSimulation } from '@casual-simulation/aux-vm-browser';
import {
    AuthCoordinator,
    AuthHelper,
    BotManager,
    SystemPortalCoordinator,
} from '@casual-simulation/aux-vm-browser';
import AuxVMImpl from '@casual-simulation/aux-vm-browser/vm/AuxVMImpl';
import bootstrap from './ab1/ab-1.bootstrap.json';
import { registerSW } from 'virtual:pwa-register';
import { openIDB, getItem, getItems, putItem, deleteItem } from './IDB';
import { merge } from 'es-toolkit/compat';
import { addStoredAuxV2ToSimulation } from './SharedUtils';
import { generateV1ConnectionToken } from '@casual-simulation/aux-common';
import type { GetPlayerConfigSuccess } from '@casual-simulation/aux-records';
import { tryParseJson } from '@casual-simulation/aux-common';
import type { AuxDevice } from '@casual-simulation/aux-runtime';
import { getSimulationId } from '../../shared/SimulationHelpers';

/**
 * Defines an interface that contains version information about the app.
 */
export interface VersionInfo {
    /**
     * The git commit hash that this app version was built from.
     */
    gitCommit: string;

    /**
     * The most recent annotated git tag that this app version was built from.
     * These version numbers are a lot more human readable but might be upated less frequently.
     */
    latestTaggedVersion: string;
}

interface StoredValue<T> {
    key: string;
    value: T;
}

export enum AppType {
    Builder = 'builder',
    Player = 'player',
}

interface StoredInst {
    id: string;
    origin: SimulationOrigin;
    isStatic: boolean;
    version?: VersionInfo;
    vmOrigin: string;
}

declare function sa_event(
    name: string,
    metadata: any,
    callback: () => void
): void;
declare function sa_event(name: string, callback: () => void): void;

const SAVE_CONFIG_TIMEOUT_MILISECONDS = 5000;

const INIT_OFFLINE_TIMEOUT_MILISECONDS = 5000;

const STATIC_INSTS_STORE = 'staticInsts';
const INSTS_STORE = 'publicInsts';

/**
 * The owner
 */
export const PLAYER_OWNER = 'player';

/**
 *
 */
export const PUBLIC_OWNER = 'public';

export class AppManager {
    public appType: AppType;
    private _updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
    private _arSupported: boolean;
    private _vrSupported: boolean;
    private _domSupported: boolean;
    private _ab1BootstrapUrl: string;
    private _comId: string;
    private _comIdConfig: GetPlayerConfigSuccess;

    get loadingProgress(): Observable<ProgressMessage> {
        return this._progress;
    }

    get authCoordinator() {
        return this._authCoordinator;
    }

    get auth() {
        return this._auth;
    }

    get comIdConfig() {
        return this._comIdConfig;
    }

    private _initPromise: Promise<void>;
    private _initIndexedDBPromise: Promise<void>;
    private _auth: AuthHelper;
    private _progress: BehaviorSubject<ProgressMessage>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _simulationManager: SimulationManager<BotManager>;
    private _config: WebConfig;
    private _primaryPromise: Promise<BotManager>;
    private _registration: ServiceWorkerRegistration;
    private _systemPortal: SystemPortalCoordinator<BotManager>;
    private _authCoordinator: AuthCoordinator<BotManager>;
    private _db: IDBDatabase;
    private _primarySimulationAvailableSubject: Subject<boolean> =
        new BehaviorSubject(false);
    private _startLoadTime: number = Date.now();
    private _defaultStudioId: string;
    private _defaultPrivacyFeatures: PrivacyFeatures;

    private _simulationFactory: (
        id: string,
        origin: SimulationOrigin,
        config: AuxConfig['config'],
        isStatic: boolean
    ) => Promise<BotManager>;

    get systemPortal() {
        return this._systemPortal;
    }

    constructor() {
        this._progress = new BehaviorSubject<ProgressMessage>(null);
        this._updateAvailable = new BehaviorSubject<boolean>(false);
        this._simulationFactory = async (id, origin, config, isStatic) => {
            const configBotId = uuid();

            if (isStatic && (await this.checkPendingCleanup(id))) {
                console.log(
                    `[AppManager] Executing pending cleanup for inst: ${id}`
                );

                await this.clearPendingCleanup(id);

                const dbNames = [`/${id}/default`, `/${id}/shared`];

                console.log(
                    `[AppManager] Attempting to delete databases:`,
                    dbNames
                );

                if (!config.vmOrigin || config.vmOrigin === location.origin) {
                    let deletedAny = false;

                    for (const dbName of dbNames) {
                        try {
                            const deleteReq = indexedDB.deleteDatabase(dbName);
                            await new Promise((resolve, reject) => {
                                deleteReq.onsuccess = () => {
                                    console.log(
                                        `[AppManager] Deleted database: ${dbName}`
                                    );
                                    deletedAny = true;
                                    resolve('success');
                                };
                                deleteReq.onerror = () => {
                                    console.warn(
                                        `[AppManager] Failed to delete database: ${dbName}`
                                    );
                                    resolve('error');
                                };
                                deleteReq.onblocked = () => {
                                    console.warn(
                                        `[AppManager] Database deletion blocked: ${dbName}`
                                    );
                                    setTimeout(() => resolve('blocked'), 1000);
                                };
                            });
                        } catch (err) {
                            console.error(
                                `[AppManager] Error deleting ${dbName}:`,
                                err
                            );
                        }
                    }

                    if (deletedAny) {
                        console.log(
                            `[AppManager] Successfully cleaned up inst: ${id}`
                        );
                    }

                    throw new Error(
                        `Static inst ${id} was deleted and cleaned up`
                    );
                }
                throw new Error(`Static inst ${id} was deleted and cleaned up`);
            }
            let initialState: BotsState = undefined;
            if (import.meta.env.MODE === 'static') {
                const injectedAux = document.querySelector(
                    'script[type="text/aux"]'
                )?.textContent;
                if (injectedAux) {
                    console.log('[AppManager] Injecting AUX.');
                    const parseResult = tryParseJson(injectedAux.trim());
                    if (parseResult.success) {
                        initialState = getUploadState(parseResult.value);
                        console.log(
                            '[AppManager] Initial State:',
                            initialState
                        );
                    }
                }

                config.staticRepoLocalPersistence = false;
            }

            const partitions = isStatic
                ? BotManager.createStaticPartitions(
                      id,
                      configBotId,
                      origin,
                      config,
                      initialState
                  )
                : BotManager.createPartitions(id, configBotId, origin, config);

            const storedInst = this._db
                ? await getItem<StoredInst>(
                      this._db,
                      isStatic ? STATIC_INSTS_STORE : INSTS_STORE,
                      id
                  )
                : null;

            let relaxOrigin = false;
            let vmOrigin: string | null = config.vmOrigin;
            if (isStatic && storedInst && vmOrigin !== storedInst.vmOrigin) {
                console.log(
                    `[AppManager] old static inst already exists for "${id}". Relaxing origin and using stored inst origin.`
                );
                relaxOrigin = true;
                vmOrigin = storedInst.vmOrigin ?? location.origin;
            }

            if (this._db) {
                putItem<StoredInst>(
                    this._db,
                    isStatic ? STATIC_INSTS_STORE : INSTS_STORE,
                    {
                        id: id,
                        origin,
                        isStatic: isStatic,
                        vmOrigin: vmOrigin,
                        version: storedInst ? storedInst.version : this.version,
                    }
                );
            }

            return new BotManager(
                origin,
                config,
                new AuxVMImpl(
                    id,
                    origin,
                    {
                        configBotId: configBotId,
                        config: {
                            ...config,
                            vmOrigin,
                        },
                        partitions,
                    },
                    relaxOrigin
                ),
                this._auth
            );
        };
        this._simulationManager = new SimulationManager(async (id, config) => {
            const params = new URLSearchParams(location.search);
            const forceSignedScripts =
                params.get('forceSignedScripts') === 'true';
            if (forceSignedScripts) {
                console.log('[AppManager] Forcing signed scripts for ' + id);
            }
            const { isStatic, ...origin } = config;
            return await this._simulationFactory(
                id,
                { ...origin, isStatic: !!isStatic },
                this.createSimulationConfig({ forceSignedScripts, isStatic }),
                isStatic
            );
        });
        this._systemPortal = new SystemPortalCoordinator(
            this._simulationManager
        );
        this._authCoordinator = new AuthCoordinator(this._simulationManager);
    }

    createSimulationConfig(options: {
        forceSignedScripts: boolean;
        isStatic: boolean;
    }): AuxConfig['config'] {
        const device = this._calculateDeviceConfig(options.isStatic);
        return {
            version: this.version.latestTaggedVersion,
            versionHash: this.version.gitCommit,
            device: device,
            bootstrapState: bootstrap,
            forceSignedScripts: options.forceSignedScripts,
            causalRepoConnectionProtocol:
                this._config.causalRepoConnectionProtocol,
            causalRepoConnectionUrl:
                this._config.causalRepoConnectionUrl ?? location.origin,
            collaborativeRepLocalPersistence:
                this._config.collaborativeRepoLocalPersistence,
            staticRepoLocalPersistence: this._config.staticRepoLocalPersistence,
            sharedPartitionsVersion: this._config.sharedPartitionsVersion,
            vmOrigin: this._config.vmOrigin,
            authOrigin: this._config.authOrigin,
            recordsOrigin: this._config.recordsOrigin,
            builtinPortals: KNOWN_PORTALS,
            timesync: device.isCollaborative
                ? {
                      host:
                          this._config.causalRepoConnectionUrl ??
                          location.origin,
                      connectionProtocol:
                          this._config.causalRepoConnectionProtocol,
                  }
                : null,
            playerMode: this._config.playerMode,
            requirePrivoLogin: this._config.requirePrivoLogin,
            comId: this._comId,
            enableDom: this._config.enableDom,
            debug: this._config.debug,
        };
    }

    get simulationManager(): SimulationManager<BotManager> {
        return this._simulationManager;
    }

    get config(): WebConfig {
        return this._config;
    }

    get version(): VersionInfo {
        return {
            gitCommit: GIT_HASH,
            latestTaggedVersion: GIT_TAG,
        };
    }

    /**
     * Gets an observable that resolves with true once an application update is available.
     */
    get updateAvailableObservable(): Observable<boolean> {
        return this._updateAvailable;
    }

    get simulationFactory() {
        return this._simulationFactory;
    }

    set simulationFactory(
        factory: (
            id: string,
            origin: SimulationOrigin,
            config: AuxConfig['config'],
            isStatic: boolean
        ) => Promise<BotManager>
    ) {
        this._simulationFactory = factory;
    }

    get defaultPlayerId() {
        return this._defaultStudioId;
    }

    /**
     * Gets the privacy features that are set by default.
     */
    get defaultPrivacyFeatures() {
        return this._defaultPrivacyFeatures;
    }

    /**
     * Instructs the app manager to check for new updates online.
     */
    checkForUpdates() {
        setTimeout(() => {
            if (this._registration) {
                this._registration.update();
            }
        }, 1000);
    }

    /**
     * Downloads the current local application state to a bot.
     */
    async downloadState(): Promise<void> {
        const stored = await this.simulationManager.primary.export();
        const serverId = this._simulationManager.primary.id;
        downloadAuxState(stored, `${serverId || 'default'}`);
    }

    /**
     * Uploads the given file to the local state.
     * @param file The file to upload.
     */
    async uploadState(file: File): Promise<void> {
        const json = await readFileText(file);
        const stored: StoredAux = JSON.parse(json);
        if (isStoredVersion2(stored)) {
            await addStoredAuxV2ToSimulation(
                this.simulationManager.primary,
                stored
            );
        } else {
            const value = getBotsStateFromStoredAux(stored);
            await this.simulationManager.primary.helper.addState(value);
        }
    }

    /**
     * Loads a .aux bot from the given URL.
     * @param url The url to load.
     */
    async loadAUX(url: string): Promise<StoredAux> {
        const result = await Axios.get(url);
        return result.data;
    }

    /**
     * Helper function that ensures services are only running while the user is logged in.
     * The provided setup function will be run once the user logs in or if they are already logged in
     * and the returned subscriptions will be unsubscribed once the user logs out.
     * @param setup
     */
    whileLoggedIn(
        setup: (botManager: BrowserSimulation) => SubscriptionLike[]
    ): SubscriptionLike {
        return this._primarySimulationAvailableSubject
            .pipe(
                filter((available) => available),
                scan((subs: SubscriptionLike[]) => {
                    if (subs) {
                        subs.forEach((s) => s.unsubscribe());
                    }
                    if (this.simulationManager.primary) {
                        return setup(this.simulationManager.primary);
                    } else {
                        return null;
                    }
                }, null)
            )
            .subscribe();
    }

    init(): Promise<void> {
        if (!this._initPromise) {
            this._initPromise = this._initCore();
        }
        return this._initPromise;
    }

    private async _initCore() {
        console.log('[AppManager] Starting init...');
        this._reportTime('Time to start', 'start');
        console.log(
            '[AppManager] CasualOS Version:',
            this.version.latestTaggedVersion,
            this.version.gitCommit
        );
        await this._initIndexedDB();
        this._sendProgress('Running aux...', 0);
        await this._initConfig();
        this._reportTime('Time to config', 'config');
        await Promise.all([
            this._loadDeviceInfo().then(() => {
                this._reportTime('Time to device info', 'device_info');
            }),
            this._initAuth().then(() => {
                this._reportTime('Time to auth', 'auth');
            }),
        ]);
        await this._initComId();
        this._reportTime('Time to init', 'init');
        this._sendProgress('Initialized.', 1, true);
    }

    private _reportTime(
        message: string,
        timeKind: string,
        basis: number = this._startLoadTime
    ) {
        const time = Date.now() - basis;
        console.log(`[AppManager] ${message}: ${time}ms`);

        if (typeof sa_event === 'function') {
            sa_event(
                `time_${timeKind}`,
                {
                    time,
                    message,
                },
                () => {}
            );
        }
    }

    getSessionKeyFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('sessionKey')) {
            return params.get('sessionKey');
        } else {
            return null;
        }
    }

    getConnectionKeyFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('connectionKey')) {
            return params.get('connectionKey');
        } else {
            return null;
        }
    }

    private async _initAuth() {
        let factory: (
            primaryAuthOrigin: string,
            recordsAuthOrigin: string,
            sessionKey?: string,
            connectionKey?: string
        ) => AuthHelperInterface;

        const sessionKey = this.getSessionKeyFromUrl();
        const connectionKey = this.getConnectionKeyFromUrl();

        this._auth = new AuthHelper(
            this.config.authOrigin,
            this.config.recordsOrigin,
            factory,
            this.config.requirePrivoLogin,
            sessionKey,
            connectionKey
        );
        this._authCoordinator.authHelper = this._auth;
        console.log('[AppManager] Authenticating user in background...');
        const authData = await this._auth.primary.authenticateInBackground();

        if (authData) {
            console.log('[AppManager] User is authenticated.');
            this._defaultStudioId = authData.userId;
        } else {
            console.log('[AppManager] User is not authenticated.');
            this._defaultStudioId = null;
        }

        if (this._config.requirePrivoLogin) {
            this._defaultPrivacyFeatures = {
                allowPublicData: false,
                publishData: false,
                allowAI: false,
                allowPublicInsts: false,
            };
        } else {
            this._defaultPrivacyFeatures = {
                allowPublicData: true,
                publishData: true,
                allowAI: true,
                allowPublicInsts: true,
            };
        }
        console.log(`[AppManager] defaultPlayerId: ${this._defaultStudioId}`);
        console.log(
            `[AppManager] defaultPrivacyFeatures: `,
            this._defaultPrivacyFeatures
        );

        this._auth.primary.loginStatus.subscribe((status) => {
            if (status.authData) {
                this._defaultStudioId = status.authData.userId;
            }

            if (status?.authData?.privacyFeatures) {
                console.log(
                    'App Manager: New privacy features',
                    status.authData.privacyFeatures
                );
            }
        });
    }

    private async _initIndexedDB() {
        if (!this._initIndexedDBPromise) {
            this._initIndexedDBPromise = this._initIndexedDBCore();
        }
        return this._initIndexedDBPromise;
    }

    private async _initIndexedDBCore() {
        try {
            this._db = await openIDB('Aux', 21, (db, oldVersion) => {
                if (oldVersion < 20) {
                    let keyval = db.createObjectStore('keyval', {
                        keyPath: 'key',
                    });
                    let users = db.createObjectStore('users', {
                        keyPath: 'username',
                    });
                }
                if (oldVersion < 21) {
                    let staticInsts = db.createObjectStore(STATIC_INSTS_STORE, {
                        keyPath: 'id',
                    });
                    let insts = db.createObjectStore(INSTS_STORE, {
                        keyPath: 'id',
                    });
                }
            });
        } catch (err) {
            console.error('Error opening indexedDB', err);
            this._db = null;
        }
    }

    private async _loadDeviceInfo() {
        console.log('[AppManager] Initializing Device Config');
        const nav: any = navigator;
        let arSupported = false;
        if (nav.xr) {
            arSupported = await nav.xr
                .isSessionSupported('immersive-ar')
                .catch(() => false);
        }

        let vrSupported = false;
        if (nav.xr) {
            vrSupported = await nav.xr
                .isSessionSupported('immersive-vr')
                .catch(() => false);
        }

        let ab1Bootstrap: string;
        if (hasValue(this._config.ab1BootstrapURL)) {
            console.log('[AppManager] Using configured AB-1');
            ab1Bootstrap = this._config.ab1BootstrapURL;
        } else {
            console.log('[AppManager] Using built-in AB-1');
            ab1Bootstrap = new URL('ab1/prod/ab1.aux', location.href).href;
        }

        this._arSupported = arSupported;
        this._vrSupported = vrSupported;
        this._ab1BootstrapUrl = ab1Bootstrap;
        this._domSupported = this._config.enableDom ?? false;

        console.log('[AppManager] AB-1 URL: ' + ab1Bootstrap);
    }

    private _calculateDeviceConfig(isStatic: boolean): AuxDevice {
        return {
            supportsAR: this._arSupported,
            supportsVR: this._vrSupported,
            supportsDOM: this._domSupported,
            isCollaborative: !isStatic,
            allowCollaborationUpgrade: false,
            ab1BootstrapUrl: this._ab1BootstrapUrl,
        };
    }

    private _sendProgress(message: string, progress: number, done?: boolean) {
        this._progress.next({
            type: 'progress',
            message: message,
            progress: progress,
            done: done,
        });
    }

    private async _initConfig() {
        console.log('[AppManager] Fetching config...');
        this._config = await this._getBaseConfig();
        await this._saveBaseConfig();
        if (!this._config) {
            console.warn(
                '[AppManager] Config not able to be fetched from the server or local storage.'
            );
        }
    }

    getComIdFromUrl(): string {
        const params = new URLSearchParams(location.search);
        if (params.has('comId') || params.has('comID')) {
            return params.get('comId') ?? params.get('comID');
        } else {
            return null;
        }
    }

    private async _initComId() {
        this._comId = this.getComIdFromUrl();
        if (this._comId) {
            console.log('[AppManager] Using comId:', this._comId);
            const config = await this._getComIdConfig();
            this._saveComIdConfig(config.comId);
            if (config && config.playerConfig) {
                console.log(
                    '[AppManager] Updating player config with comId config',
                    config.playerConfig
                );
                this._config = {
                    ...this._config,
                    ...config.playerConfig,
                };

                if (hasValue(this._config.ab1BootstrapURL)) {
                    this._ab1BootstrapUrl = this._config.ab1BootstrapURL;
                }
            }
        }
    }

    initOffline() {
        if (import.meta.env.MODE === 'static') {
            return;
        }
        if ('serviceWorker' in navigator && !this._updateServiceWorker) {
            console.log('[AppManager] Registering Service Worker');
            this._updateServiceWorker = registerSW({
                immediate: true,
                onNeedRefresh: () => {
                    console.log('[ServiceWorker]: Updated.');
                    this._updateAvailable.next(true);
                },
                onOfflineReady: () => {
                    console.log('[ServiceWorker] Registered.');
                },
            });
        }
    }

    updateServiceWorker() {
        if (import.meta.env.MODE === 'static') {
            return;
        }
        if (this._updateServiceWorker) {
            this._updateServiceWorker(true);
        }
    }

    /**
     * Gets the name of the record that the given owner should be loaded from.
     * @param owner The owner of the record.
     */
    getRecordName(owner: string): { recordName: string; owner: string } {
        if (owner === PLAYER_OWNER) {
            return {
                owner,
                recordName:
                    this.auth?.primary?.currentLoginStatus?.authData?.userId ??
                    null,
            };
        } else if (owner === PUBLIC_OWNER) {
            return {
                owner,
                recordName: null,
            };
        } else {
            return {
                owner: null,
                recordName: owner,
            };
        }
    }

    async setPrimarySimulation(
        recordName: string | null,
        inst: string,
        isStatic: boolean
    ) {
        const timeBasis = Date.now();
        const simulationId = getSimulationId(recordName, inst, isStatic);
        if (
            (this.simulationManager.primary &&
                this.simulationManager.primary.id === simulationId) ||
            this.simulationManager.primaryId === simulationId
        ) {
            return await this._primaryPromise;
        }
        this.simulationManager.primaryId = simulationId;
        this._primaryPromise = this._setPrimarySimulation(
            simulationId,
            recordName,
            inst,
            isStatic
        );

        this._primaryPromise.then((manager) => {
            this._reportTime(
                'Time to create primary simulation',
                'create_sim',
                timeBasis
            );
            manager.connection.syncStateChanged
                .pipe(
                    first((state) => state),
                    tap(() => {
                        this._reportTime(
                            'Time to first sync',
                            'first_sync',
                            timeBasis
                        );
                    })
                )
                .subscribe();
        });

        return await this._primaryPromise;
    }

    private async _setPrimarySimulation(
        id: string,
        recordName: string | null,
        inst: string,
        isStatic: boolean
    ) {
        this._sendProgress('Requesting inst...', 0.1);

        console.log(
            '[AppManager] Setting primary simulation:',
            recordName,
            inst
        );

        await this.simulationManager.clear();
        await this.simulationManager.setPrimary(id, {
            recordName,
            inst,
            isStatic,
        });
        this._primarySimulationAvailableSubject.next(true);

        const sim = this.simulationManager.primary;

        sim.progress.updates.subscribe({
            next: (m) => this._progress.next(m),
            error: (err) => console.error(err),
            complete: () => {
                console.log('[AppManager] Primary simulation is done.');
                this._progress.complete();
            },
        });

        this.loadingProgress.subscribe((p) => {
            if (p.done) {
                if (!this._updateServiceWorker) {
                    setTimeout(() => {
                        this.initOffline();
                    }, INIT_OFFLINE_TIMEOUT_MILISECONDS);
                }
            }
        });

        return sim;
    }

    async cleanupStaticInstData(inst: string): Promise<boolean> {
        console.log(
            `[AppManager] Attempting to cleanup all databases for inst: ${inst}`
        );

        const vmOrigin = this._config.vmOrigin || location.origin;

        if (vmOrigin === location.origin) {
            return await this._directCleanup(inst);
        }

        console.log(
            `[AppManager] Using iframe cleanup for cross-origin database deletion`
        );
        return await this._iframeCleanup(inst, vmOrigin);
    }

    private async _iframeCleanup(
        inst: string,
        vmOrigin: string
    ): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const cleanupUrl = `${vmOrigin}/cleanup-indexeddb.html?inst=${encodeURIComponent(
                inst
            )}`;

            console.log(`[AppManager] Loading cleanup iframe: ${cleanupUrl}`);

            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.src = cleanupUrl;
            iframe.sandbox = 'allow-scripts allow-same-origin';

            let timeoutId: NodeJS.Timeout;
            let messageHandler: (event: MessageEvent) => void;

            const cleanup = () => {
                if (timeoutId) clearTimeout(timeoutId);
                window.removeEventListener('message', messageHandler);
                if (iframe.parentNode) {
                    document.body.removeChild(iframe);
                }
            };

            messageHandler = (event: MessageEvent) => {
                if (event.origin !== vmOrigin) {
                    console.warn(
                        `[AppManager] Ignoring message from unexpected origin: ${event.origin}`
                    );
                    return;
                }

                console.log(
                    `[AppManager] Received cleanup message:`,
                    event.data
                );

                if (event.data.type === 'CLEANUP_COMPLETE') {
                    console.log(
                        `[AppManager] Cleanup complete for ${inst}:`,
                        event.data
                    );
                    cleanup();
                    resolve(event.data.success);
                } else if (event.data.type === 'CLEANUP_ERROR') {
                    console.error(
                        `[AppManager] Cleanup error for ${inst}:`,
                        event.data.error
                    );
                    cleanup();
                    resolve(false);
                }
            };
            window.addEventListener('message', messageHandler);
            iframe.onerror = (error) => {
                console.error(
                    `[AppManager] Failed to load cleanup iframe:`,
                    error
                );
                cleanup();
                resolve(false);
            };

            document.body.appendChild(iframe);

            timeoutId = setTimeout(() => {
                console.error(
                    `[AppManager] Cleanup iframe timeout for inst: ${inst}`
                );
                cleanup();
                resolve(false);
            }, 15000);
        });
    }

    private async _directCleanup(inst: string): Promise<boolean> {
        try {
            const dbNames = [`/${inst}/default`, `/${inst}/shared`];
            let deletedAny = false;

            for (const dbName of dbNames) {
                try {
                    await indexedDB.deleteDatabase(dbName);
                    console.log(`[AppManager] Deleted database: ${dbName}`);
                    deletedAny = true;
                } catch (err) {
                    console.warn(
                        `[AppManager] Could not delete ${dbName}:`,
                        err
                    );
                }
            }

            return deletedAny;
        } catch (err) {
            console.error(`[AppManager] Direct cleanup failed:`, err);
            return false;
        }
    }

    /**
     * Marks a static inst for cleanup on next load
     */
    async markInstForCleanup(inst: string): Promise<void> {
        if (!this._db) {
            console.error(
                '[AppManager] Cannot mark inst for cleanup - no DB connection'
            );
            return;
        }

        await putItem(this._db, 'keyval', {
            key: `pending_deletion_${inst}`,
            value: {
                inst,
                timestamp: Date.now(),
            },
        });
    }

    /**
     * Checks if an inst is marked for cleanup
     */
    async checkPendingCleanup(inst: string): Promise<boolean> {
        if (!this._db) {
            return false;
        }

        try {
            const pending = await getItem<
                StoredValue<{
                    inst: string;
                    timestamp: number;
                }>
            >(this._db, 'keyval', `pending_deletion_${inst}`);

            return !!pending;
        } catch (err) {
            console.error('[AppManager] Error checking pending cleanup:', err);
            return false;
        }
    }

    /**
     * Removes the pending cleanup marker for an inst
     */
    async clearPendingCleanup(inst: string): Promise<void> {
        if (!this._db) {
            return;
        }

        try {
            await deleteItem(this._db, 'keyval', `pending_deletion_${inst}`);
        } catch (err) {
            console.error('[AppManager] Error clearing pending cleanup:', err);
        }
    }

    async getConnectionIndicator(
        connectionId: string,
        recordName: string | null,
        inst: string,
        host: string
    ): Promise<ConnectionIndicator> {
        try {
            const endpoint = !host
                ? this._auth.primary
                : this._auth.getEndpoint(host);
            const key = await endpoint.getConnectionKey();
            if (key) {
                const token = generateV1ConnectionToken(
                    key,
                    connectionId,
                    recordName,
                    inst
                );
                return {
                    connectionToken: token,
                };
            } else {
                return {
                    connectionId,
                };
            }
        } catch (err) {
            console.log('Unable to get connection indicator from DB', err);
            return null;
        }
    }

    logout() {
        console.log('[AppManager] Logout');
        this.simulationManager.clear();
    }

    /**
     * Lists the static insts that have been created.
     */
    async listStaticInsts(): Promise<string[]> {
        if (!this._db) {
            return [];
        }
        const insts = await getItems<StoredInst>(this._db, STATIC_INSTS_STORE);
        return insts.map((i) => i.origin.inst);
    }

    async deleteStaticInst(inst: string) {
        if (!this._db) {
            console.error(
                '[AppManager] Could not connect db to delete inst',
                inst
            );
            return;
        }
        await deleteItem(this._db, STATIC_INSTS_STORE, inst);
        await this.clearPendingCleanup(inst);
    }

    private async _getComIdConfig(): Promise<GetPlayerConfigSuccess> {
        try {
            const config = await this._auth.primary.getComIdWebConfig(
                this._comId
            );

            if (config.success === true) {
                this._comIdConfig = config;
            }
            return this._comIdConfig;
        } catch (err) {
            console.error(
                '[AppManager] Unable to fetch config from server: ',
                err
            );
            return null;
        }
    }

    private async _getBaseConfig(): Promise<WebConfig> {
        if (import.meta.env.MODE === 'static' || import.meta.env.SSR) {
            return {
                version: null,
                causalRepoConnectionProtocol: 'websocket',
                disableCollaboration: true,
                staticRepoLocalPersistence: true,
            };
        } else {
            const serverConfig = await this._fetchConfigFromServer();
            if (serverConfig) {
                return serverConfig;
            } else {
                return await this._fetchConfigFromLocalStorage();
            }
        }
    }

    private async _fetchConfigFromServer(): Promise<WebConfig> {
        try {
            const result = await Axios.get<WebConfig>(`/api/config`);
            if (result.status === 200) {
                return result.data;
            } else {
                return null;
            }
        } catch (err) {
            console.error('Unable to fetch config from server: ', err);
            return null;
        }
    }

    private async _saveBaseConfig() {
        try {
            const completed = await Promise.race([
                new Promise<void>((resolve) =>
                    setTimeout(resolve, SAVE_CONFIG_TIMEOUT_MILISECONDS)
                ).then(() => false),
                this._saveBaseConfigCore().then(() => true),
            ]);

            if (!completed) {
                console.error(
                    '[AppManager] Unable to save config due to timeout.'
                );
            }
        } catch (err) {
            console.error('[AppManager] Unable to save config: ', err);
        }
    }

    private async _saveBaseConfigCore() {
        if (!this._db) {
            return;
        }
        if (this.config) {
            await putItem(this._db, 'keyval', {
                key: 'config',
                value: this.config,
            });
        } else {
            await deleteItem(this._db, 'keyval', 'config');
        }
    }

    private async _fetchConfigFromLocalStorage(): Promise<WebConfig> {
        try {
            if (!this._db) {
                return null;
            }
            const val = await getItem<StoredValue<WebConfig>>(
                this._db,
                'keyval',
                'config'
            );
            if (val) {
                return val.value;
            } else {
                return null;
            }
        } catch (err) {
            console.error('Unable to fetch config from storage', err);
            return null;
        }
    }

    private async _saveComIdConfig(comId: string) {
        try {
            const completed = await Promise.race([
                new Promise<void>((resolve) =>
                    setTimeout(resolve, SAVE_CONFIG_TIMEOUT_MILISECONDS)
                ).then(() => false),
                this._saveComIdConfigCore(comId).then(() => true),
            ]);

            if (!completed) {
                console.error(
                    '[AppManager] Unable to save config due to timeout.'
                );
            }
        } catch (err) {
            console.error('[AppManager] Unable to save config: ', err);
        }
    }

    private async _saveComIdConfigCore(comId: string) {
        if (!this._db) {
            return;
        }
        const key = `${comId ?? '(null)'}/config`;
        if (this.config) {
            await putItem(this._db, 'keyval', {
                key: key,
                value: this.comIdConfig,
            });
        } else {
            await deleteItem(this._db, 'keyval', key);
        }
    }

    async getStoredComId(comId: string) {
        await this._initIndexedDB();
        return await this._fetchComIdConfigFromLocalStorage(comId);
    }

    private async _fetchComIdConfigFromLocalStorage(
        comId: string
    ): Promise<GetPlayerConfigSuccess> {
        try {
            if (!this._db) {
                return null;
            }
            const val = await getItem<StoredValue<GetPlayerConfigSuccess>>(
                this._db,
                'keyval',
                `${comId ?? '(null)'}/config`
            );
            if (val) {
                return val.value;
            } else {
                return null;
            }
        } catch (err) {
            console.error('Unable to fetch config from storage', err);
            return null;
        }
    }
}

export const appManager = new AppManager();

if (hasValue(window)) {
    merge((<any>window).aux || {}, {
        getApp: () => appManager,
    });
}
