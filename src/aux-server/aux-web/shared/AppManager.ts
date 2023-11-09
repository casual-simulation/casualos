import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, Subject, SubscriptionLike } from 'rxjs';
import { filter, map, scan } from 'rxjs/operators';
import { downloadAuxState, readFileText } from './DownloadHelpers';
import {
    ConnectionIndicator,
    ProgressMessage,
    remapProgressPercent,
    remote,
} from '@casual-simulation/aux-common';
import {
    hasValue,
    KNOWN_PORTALS,
    normalizeAUXBotURL,
    StoredAux,
    getBotsStateFromStoredAux,
    applyUpdatesToInst,
    isStoredVersion2,
} from '@casual-simulation/aux-common';
import { v4 as uuid } from 'uuid';
import { WebConfig } from '../../shared/WebConfig';
import {
    SimulationManager,
    AuxConfig,
    parseVersionNumber,
    SimulationOrigin,
    AuthHelperInterface,
} from '@casual-simulation/aux-vm';
import {
    AuthCoordinator,
    AuthHelper,
    AuxVMImpl,
    BotManager,
    BrowserSimulation,
    SystemPortalCoordinator,
} from '@casual-simulation/aux-vm-browser';
import { fromByteArray } from 'base64-js';
import bootstrap from './ab1/ab-1.bootstrap.json';
import { registerSW } from 'virtual:pwa-register';
import { openIDB, getItem, getItems, putItem, deleteItem } from './IDB';
import { merge } from 'lodash';
import { addStoredAuxV2ToSimulation } from './SharedUtils';
import { generateV1ConnectionToken } from '@casual-simulation/aux-records/AuthUtils';
import { PrivoAuthHelper } from './privo/PrivoAuthHelper';
import { PrivacyFeatures } from '@casual-simulation/aux-records';

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

const SAVE_CONFIG_TIMEOUT_MILISECONDS = 5000;

export class AppManager {
    public appType: AppType;
    private _updateServiceWorker: (reloadPage?: boolean) => Promise<void>;

    get loadingProgress(): Observable<ProgressMessage> {
        return this._progress;
    }

    get authCoordinator() {
        return this._authCoordinator;
    }

    private _auth: AuthHelper;
    private _progress: BehaviorSubject<ProgressMessage>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _simulationManager: SimulationManager<BotManager>;
    private _config: WebConfig;
    private _deviceConfig: AuxConfig['config']['device'];
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
        config: AuxConfig['config']
    ) => Promise<BotManager>;

    get systemPortal() {
        return this._systemPortal;
    }

    constructor() {
        this._progress = new BehaviorSubject<ProgressMessage>(null);
        this._updateAvailable = new BehaviorSubject<boolean>(false);
        this._simulationFactory = async (id, origin, config) => {
            const configBotId = uuid();
            // const indicator = await this.getConnectionIndicator(
            //     configBotId,
            //     origin.recordName,
            //     origin.inst,
            //     origin.host
            // );
            const partitions = BotManager.createPartitions(
                id,
                configBotId,
                origin,
                config,
                this._config.causalRepoConnectionUrl
            );
            return new BotManager(
                origin,
                config,
                new AuxVMImpl(id, {
                    configBotId: configBotId,
                    config,
                    partitions,
                }),
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
            const { ...origin } = config;
            return await this._simulationFactory(
                id,
                origin,
                this.createSimulationConfig({ forceSignedScripts })
            );
        });
        this._systemPortal = new SystemPortalCoordinator(
            this._simulationManager
        );
        this._authCoordinator = new AuthCoordinator(this._simulationManager);
    }

    createSimulationConfig(options: {
        forceSignedScripts: boolean;
    }): AuxConfig['config'] {
        return {
            version: this.version.latestTaggedVersion,
            versionHash: this.version.gitCommit,
            device: this._deviceConfig,
            bootstrapState: bootstrap,
            forceSignedScripts: options.forceSignedScripts,
            causalRepoConnectionProtocol:
                this._config.causalRepoConnectionProtocol,
            causalRepoConnectionUrl: this._config.causalRepoConnectionUrl,
            sharedPartitionsVersion: this._config.sharedPartitionsVersion,
            vmOrigin: this._config.vmOrigin,
            authOrigin: this._config.authOrigin,
            recordsOrigin: this._config.recordsOrigin,
            builtinPortals: KNOWN_PORTALS,
            timesync: this._deviceConfig.isCollaborative
                ? {
                      host:
                          this._config.causalRepoConnectionUrl ??
                          location.origin,
                      connectionProtocol:
                          this._config.causalRepoConnectionProtocol,
                  }
                : null,
            playerMode: this._config.playerMode,
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
            config: AuxConfig['config']
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

    async init() {
        console.log('[AppManager] Starting init...');
        this._reportTime('Time to start');
        console.log(
            '[AppManager] CasualOS Version:',
            this.version.latestTaggedVersion,
            this.version.gitCommit
        );
        await this._initIndexedDB();
        this._sendProgress('Running aux...', 0);
        await this._initConfig();
        this._reportTime('Time to config');
        await Promise.all([
            this._initDeviceConfig().then(() => {
                this._reportTime('Time to device config');
            }),
            this._initAuth().then(() => {
                this._reportTime('Time to auth');
            }),
        ]);
        this._reportTime('Time to init');
        this._sendProgress('Initialized.', 1, true);
    }

    private _reportTime(message: string) {
        console.log(
            `[AppManager] ${message}: ${Date.now() - this._startLoadTime}ms`
        );
    }

    private async _initAuth() {
        let factory: (
            primaryAuthOrigin: string,
            recordsAuthOrigin: string
        ) => AuthHelperInterface;

        // const primaryAuthOrigin = this._config.authOrigin;
        // const recordsAuthOrigin = this._config.recordsOrigin;
        // if (this._config.requirePrivoAgeVerification) {
        //     factory = (authOrigin, recordsOrigin) => {
        //         if (
        //             primaryAuthOrigin !== authOrigin ||
        //             recordsOrigin !== recordsAuthOrigin
        //         ) {
        //             return null;
        //         }

        //         return new PrivoAuthHelper(
        //             authOrigin,
        //             recordsOrigin,
        //             this._config
        //         );
        //     };
        // }

        this._auth = new AuthHelper(
            this.config.authOrigin,
            this.config.recordsOrigin,
            factory
        );
        console.log('[AppManager] Authenticating user in background...');
        const authData = await this._auth.primary.authenticateInBackground();
        if (authData) {
            console.log('[AppManager] User is authenticated.');
            this._defaultStudioId = authData.userId;
        } else {
            console.log('[AppManager] User is not authenticated.');
            this._defaultStudioId = null;
            if (this._config.requirePrivoLogin) {
                this._defaultPrivacyFeatures = {
                    allowPublicData: false,
                    publishData: false,
                };
            }
        }
        console.log(`[AppManager] defaultPlayerId: ${this._defaultStudioId}`);
    }

    private async _initIndexedDB() {
        this._db = await openIDB('Aux', 20, (db, oldVersion) => {
            if (oldVersion < 20) {
                let keyval = db.createObjectStore('keyval', { keyPath: 'key' });
                let users = db.createObjectStore('users', {
                    keyPath: 'username',
                });
            }
        });
    }

    private async _initDeviceConfig() {
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
            const version = parseVersionNumber(
                this.version.latestTaggedVersion
            );
            if (version.alpha) {
                console.log('[AppManager] Using alpha AB-1');
                ab1Bootstrap = new URL('ab1/staging/ab1.aux', location.href)
                    .href;
            } else {
                console.log('[AppManager] Using production AB-1');
                ab1Bootstrap = new URL('ab1/prod/ab1.aux', location.href).href;
            }
        }

        console.log('[AppManager] AB-1 URL: ' + ab1Bootstrap);

        let disableCollaboration = this._config.disableCollaboration;
        let requirePrivo = !!this._config.requirePrivoLogin;

        let isCollaborative = disableCollaboration ? false : !requirePrivo;
        let allowCollaborationUpgrade = !disableCollaboration;

        this._deviceConfig = {
            supportsAR: arSupported,
            supportsVR: vrSupported,
            isCollaborative: isCollaborative,
            allowCollaborationUpgrade: allowCollaborationUpgrade,
            ab1BootstrapUrl: ab1Bootstrap,
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
        this._config = await this._getConfig();
        await this._saveConfig();
        if (!this._config) {
            console.warn(
                '[AppManager] Config not able to be fetched from the server or local storage.'
            );
        }
    }

    private _initOffline() {
        if ('serviceWorker' in navigator) {
            console.log('[AppManager] Registering Service Worker');
            this._updateServiceWorker = registerSW({
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
        if (this._updateServiceWorker) {
            this._updateServiceWorker(true);
        }
    }

    async setPrimarySimulation(recordName: string | null, inst: string) {
        const simulationId = getSimulationId(recordName, inst);
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
            inst
        );

        return await this._primaryPromise;
    }

    private async _setPrimarySimulation(
        id: string,
        recordName: string | null,
        inst: string
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
        });

        this._initOffline();
        this._reportTime('Time to primary simulation');
        this._primarySimulationAvailableSubject.next(true);

        const sim = this.simulationManager.primary;

        sim.progress.updates.pipe(map(remapProgressPercent(0.1, 1))).subscribe(
            (m: ProgressMessage) => {
                this._progress.next(m);
                if (m.error) {
                    this._progress.complete();
                }
            },
            (err) => console.error(err),
            () => {
                this._progress.next({
                    type: 'progress',
                    message: 'Done.',
                    progress: 1,
                    done: true,
                });
                this._progress.complete();
            }
        );

        return sim;
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

    // private async _getConnectionKey(): Promise<string> {
    //     try {
    //         return await getItem<string>(this._db, 'users', 'connectionKey');
    //     } catch (err) {
    //         console.log('Unable to get connectionKey from DB', err);
    //         return null;
    //     }
    // }

    // private async _saveConnectionKey(key: string) {
    //     try {
    //         await putItem(this._db, 'users', 'connectionKey');
    //         // await this._db.users.put(user);
    //     } catch (err) {
    //         console.log('Unable to save connectionKey to DB', err);
    //     }
    // }

    logout() {
        console.log('[AppManager] Logout');
        this.simulationManager.clear();
    }

    private async _getConfig(): Promise<WebConfig> {
        const serverConfig = await this._fetchConfigFromServer();
        if (serverConfig) {
            return serverConfig;
        } else {
            return await this._fetchConfigFromLocalStorage();
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

    private async _saveConfig() {
        try {
            const completed = await Promise.race([
                new Promise<void>((resolve) =>
                    setTimeout(resolve, SAVE_CONFIG_TIMEOUT_MILISECONDS)
                ).then(() => false),
                this._saveConfigCore().then(() => true),
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

    private async _saveConfigCore() {
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
}

/**
 * Gets the ID for a simulation with the given origin.
 * @param recordName The name of the record for the simulation.
 * @param inst The name of the inst for the simulation.
 */
export function getSimulationId(
    recordName: string | null,
    inst: string
): string {
    if (recordName) {
        return `${recordName ?? ''}/${inst}`;
    } else {
        return inst;
    }
}

export const appManager = new AppManager();

if (hasValue(window)) {
    merge((<any>window).aux || {}, {
        getApp: () => appManager,
    });
}
