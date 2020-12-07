import * as Sentry from '@sentry/browser';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, SubscriptionLike } from 'rxjs';
import { map, scan } from 'rxjs/operators';
import { downloadAuxState, readFileText } from './DownloadHelpers';
import {
    ProgressMessage,
    remapProgressPercent,
} from '@casual-simulation/causal-trees';
import { normalizeAUXBotURL } from '@casual-simulation/aux-common';
import Dexie from 'dexie';
import uuid from 'uuid/v4';
import { WebConfig } from '../../shared/WebConfig';
import {
    SimulationManager,
    AuxUser,
    StoredAux,
    getBotsStateFromStoredAux,
    AuxConfig,
} from '@casual-simulation/aux-vm';
import {
    BotManager,
    BrowserSimulation,
} from '@casual-simulation/aux-vm-browser';
import { fromByteArray } from 'base64-js';
import builder from './builder/builder.v1.json';
import bootstrap from './builder/ab-1.bootstrap.json';

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

class AppDatabase extends Dexie {
    keyval: Dexie.Table<StoredValue<any>, string>;
    users: Dexie.Table<AuxUser, string>;

    constructor() {
        super('Aux');

        this.version(1).stores({
            keyval: 'key',
        });

        this.version(2).stores({
            keyval: 'key',
            users: 'username',
        });
    }
}

export enum AppType {
    Builder = 'builder',
    Player = 'player',
}

export class AppManager {
    public appType: AppType;

    get loadingProgress(): Observable<ProgressMessage> {
        return this._progress;
    }

    private _progress: BehaviorSubject<ProgressMessage>;
    private _db: AppDatabase;
    private _userSubject: BehaviorSubject<AuxUser>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _simulationManager: SimulationManager<BotManager>;
    private _user: AuxUser;
    private _config: WebConfig;
    private _deviceConfig: AuxConfig['config']['device'];
    private _primaryPromise: Promise<BotManager>;

    constructor() {
        this._progress = new BehaviorSubject<ProgressMessage>(null);
        this._initOffline();
        this._simulationManager = new SimulationManager((id) => {
            const params = new URLSearchParams(location.search);
            const forceSignedScripts =
                params.get('forceSignedScripts') === 'true';
            if (forceSignedScripts) {
                console.log('[AppManager] Forcing signed scripts for ' + id);
            }
            return new BotManager(this._user, id, {
                version: this.version.latestTaggedVersion,
                versionHash: this.version.gitCommit,
                device: this._deviceConfig,
                builder: JSON.stringify(builder),
                bootstrapState: bootstrap,
                forceSignedScripts,
                causalRepoConnectionProtocol: this._config
                    .causalRepoConnectionProtocol,
                causalRepoConnectionUrl: this._config.causalRepoConnectionUrl,
            });
        });
        this._userSubject = new BehaviorSubject<AuxUser>(null);
        this._db = new AppDatabase();
    }

    get simulationManager(): SimulationManager<BotManager> {
        return this._simulationManager;
    }

    get userObservable(): Observable<AuxUser> {
        return this._userSubject;
    }

    get user(): AuxUser {
        return this._user;
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

    /**
     * Instructs the app manager to check for new updates online.
     */
    checkForUpdates() {
        // setTimeout(() => {
        //     // if ('serviceWorker' in navigator) {
        //     // }
        //     // OfflinePluginRuntime.update();
        // }, 1000);
    }

    /**
     * Downloads the current local application state to a bot.
     */
    async downloadState(): Promise<void> {
        const stored = await this.simulationManager.primary.export();
        const channelId = this._simulationManager.primary.id;
        downloadAuxState(stored, `${this.user.name}-${channelId || 'default'}`);
    }

    /**
     * Uploads the given file to the local state.
     * @param file The file to upload.
     */
    async uploadState(file: File): Promise<void> {
        const json = await readFileText(file);
        const stored: StoredAux = JSON.parse(json);
        const value = getBotsStateFromStoredAux(stored);
        await this.simulationManager.primary.helper.addState(value);
    }

    /**
     * Loads a .aux bot from the given URL.
     * @param url The url to load.
     */
    async loadAUX(url: string): Promise<StoredAux> {
        const normalized = normalizeAUXBotURL(url);
        const result = await Axios.get(normalized);
        return result.data;
    }

    /**
     * Helper function that ensures services are only running while the user is logged in.
     * The provided setup function will be run once the user logs in or if they are already logged in
     * and the returned subscriptions will be unsubscribed once the user logs out.
     * @param setup
     */
    whileLoggedIn(
        setup: (
            user: AuxUser,
            botManager: BrowserSimulation
        ) => SubscriptionLike[]
    ): SubscriptionLike {
        return this.userObservable
            .pipe(
                scan((subs: SubscriptionLike[], user: AuxUser, index) => {
                    if (subs) {
                        subs.forEach((s) => s.unsubscribe());
                    }
                    if (user && this.simulationManager.primary) {
                        return setup(user, this.simulationManager.primary);
                    } else {
                        return null;
                    }
                }, null)
            )
            .subscribe();
    }

    async init() {
        console.log('[AppManager] Starting init...');
        this._sendProgress('Running aux...', 0);
        await this._initConfig();
        this._initSentry();
        await this._initDeviceConfig();
        this._sendProgress('Initialized.', 1, true);
    }

    private async _initDeviceConfig() {
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

        this._deviceConfig = {
            supportsAR: arSupported,
            supportsVR: vrSupported,
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

    private _initSentry() {
        const sentryEnv = PRODUCTION ? 'prod' : 'dev';

        if (this._config && this._config.sentryDsn) {
            Sentry.init({
                dsn: this._config.sentryDsn,
                integrations: [new Sentry.Integrations.Vue({ Vue: Vue })],
                release: GIT_HASH,
                environment: sentryEnv,
            });
        } else {
            console.log('Skipping Sentry Initialization');
        }
    }

    private _initOffline() {
        this._updateAvailable = new BehaviorSubject<boolean>(false);

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((registration) => {
                    console.log('[ServiceWorker] Registered.');
                })
                .catch((err) => {
                    console.error('[ServiceWorker] Registration Failed.', err);
                });
        }
        // OfflinePluginRuntime.install({
        //     onUpdating: () => {
        //         console.log('[ServiceWorker]: Updating...');
        //         Sentry.addBreadcrumb({
        //             message: 'Updating service worker.',
        //             level: Sentry.Severity.Info,
        //             category: 'app',
        //             type: 'default',
        //         });
        //     },
        //     onUpdateReady: () => {
        //         console.log('[ServiceWorker]: Update Ready.');
        //         OfflinePluginRuntime.applyUpdate();
        //     },
        //     onUpdated: () => {
        //         console.log('[ServiceWorker]: Updated.');
        //         Sentry.addBreadcrumb({
        //             message: 'Updated service worker.',
        //             level: Sentry.Severity.Info,
        //             category: 'app',
        //             type: 'default',
        //         });
        //         this._updateAvailable.next(true);
        //     },
        //     onUpdateFailed: () => {
        //         console.log('[ServiceWorker]: Update failed.');
        //         Sentry.captureMessage(
        //             'Service Worker update failed',
        //             Sentry.Severity.Error
        //         );
        //     },
        //     onInstalled: () => {
        //         console.log('[ServiceWorker]: Installed.');
        //         Sentry.addBreadcrumb({
        //             message: 'Installed service worker.',
        //             level: Sentry.Severity.Info,
        //             category: 'app',
        //             type: 'default',
        //         });
        //     },
        // });
    }

    async setPrimarySimulation(channelId: string) {
        channelId = channelId || 'default';
        if (
            (this.simulationManager.primary &&
                this.simulationManager.primary.id === channelId) ||
            this.simulationManager.primaryId === channelId
        ) {
            return await this._primaryPromise;
        }
        this.simulationManager.primaryId = channelId;
        this._primaryPromise = this._setPrimarySimulation(channelId);

        return await this._primaryPromise;
    }

    private async _setPrimarySimulation(channelId: string) {
        this._sendProgress('Requesting channel...', 0.1);

        console.log('[AppManager] Setting primary simulation:', channelId);

        const user = await this._getCurrentUserOrGuest();
        this._user = user;
        // Always give the user a new ID.
        this._user.id = uuid();

        await this._setCurrentUser(user);
        await this.simulationManager.clear();
        await this.simulationManager.setPrimary(channelId);

        this._userSubject.next(this._user);

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

    private async _getUser(username: string): Promise<AuxUser> {
        try {
            return await this._db.users.get(username);
        } catch (err) {
            console.log('Unable to get user from DB', err);
            return null;
        }
    }

    private async _saveUser(user: AuxUser) {
        try {
            await this._db.users.put(user);
        } catch (err) {
            console.log('Unable to save user to DB', err);
        }
    }

    /**
     * Gets the username that is currently being used.
     */
    private async _getCurrentUsername(): Promise<string> {
        try {
            const stored = await this._db.keyval.get('username');
            if (stored) {
                return stored.value;
            }
            return null;
        } catch (err) {
            console.error('Unable to get Username', err);
            return null;
        }
    }

    /**
     * Sets the username that is currently being used.
     */
    private async _setCurrentUsername(username: string) {
        try {
            await this._db.keyval.put({
                key: 'username',
                value: username,
            });
        } catch (err) {
            console.error('Unable to save username', err);
        }
    }

    private async _getCurrentUser(): Promise<AuxUser> {
        const currentUsername = await this._getCurrentUsername();
        if (currentUsername) {
            return this._getUser(currentUsername);
        }
        return null;
    }

    private async _setCurrentUser(user: AuxUser): Promise<void> {
        if (user) {
            await this._saveUser(user);
            await this._setCurrentUsername(user.username);
        } else {
            await this._setCurrentUsername(null);
        }
    }

    private async _getCurrentUserOrGuest(): Promise<AuxUser> {
        const current = await this._getCurrentUser();
        if (!current) {
            return this._createUser(`guest_${uuid()}`);
        }
        return current;
    }

    private async _getOrCreateUser(username: string): Promise<AuxUser> {
        let user = await this._getUser(username);
        if (!user) {
            user = this._createUser(username);
            await this._saveUser(user);
        }
        return user;
    }

    logout() {
        if (this.user) {
            Sentry.addBreadcrumb({
                message: 'Logout',
                category: 'auth',
                type: 'default',
                level: Sentry.Severity.Info,
            });
            console.log('[AppManager] Logout');

            this.simulationManager.clear();
            this._user = null;
            this._setCurrentUsername(null);
            this._userSubject.next(null);
        }
    }

    getUsers(): Promise<AuxUser[]> {
        return this._db.users.toCollection().toArray();
    }

    getUser(username: string): Promise<AuxUser> {
        return this._getOrCreateUser(username);
    }

    removeUser(username: string): Promise<void> {
        try {
            return this._db.users.delete(username);
        } catch (err) {
            console.log('Unable to remove user', err);
        }
    }

    async setCurrentUser(user: AuxUser): Promise<void> {
        await this._setCurrentUser(user);
        this._user = user;
        this._userSubject.next(user);
    }

    // async loginOrCreateUser(
    //     username: string,
    //     channelId?: string,
    //     grant?: string
    // ): Promise<void> {
    //     this.loadingProgress.set(0, 'Checking current user...', null);
    //     this.loadingProgress.show = true;

    //     if (this._simulationManager.simulations.has(channelId)) {
    //         this.loadingProgress.set(100, 'Complete!', null);
    //         return null;
    //     }

    //     channelId = channelId ? channelId.trim() : null;

    //     try {
    //         this.loadingProgress.set(10, 'Creating user...', null);

    //         this._user =
    //             (await this._getUser(username)) ||
    //             this._createUser(username, grant);

    //         await this._setCurrentUser(this._user);

    //         channelId = channelId || 'default';

    //         this.loadingProgress.set(40, 'Loading Bots...', null);

    //         return await this._setPrimarySimulation(channelId);
    //     } catch (ex) {
    //         Sentry.captureException(ex);
    //         console.error(ex);

    //         this.loadingProgress.set(
    //             0,
    //             'Exception occured while logging in.',
    //             this._exceptionMessage(ex)
    //         );
    //         this.loadingProgress.show = false;
    //         this._user = null;
    //         await this._setCurrentUsername(null);
    //     }
    // }

    private _createUser(username: string) {
        let user: AuxUser = {
            username: username,
            name: username,
            token: this._generateRandomKey(),
            id: uuid(),
        };

        if (user.name.includes('guest_')) {
            user.name = 'Guest';
        }

        return user;
    }

    private _exceptionMessage(ex: unknown) {
        if (ex instanceof Error) {
            return ex.message;
        }

        return 'General Error';
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
            if (this.config) {
                await this._db.keyval.put({
                    key: 'config',
                    value: this.config,
                });
            } else {
                await this._db.keyval.delete('config');
            }
        } catch (err) {
            console.error('Unable to save config: ', err);
        }
    }

    private async _fetchConfigFromLocalStorage(): Promise<WebConfig> {
        try {
            const val = await this._db.keyval.get('config');
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

    private _generateRandomKey(): string {
        console.log('[AppManager] Generating new login key...');
        let arr = new Uint8Array(16);
        if (window.crypto) {
            window.crypto.getRandomValues(arr);
        } else {
            console.warn(
                '[AppManager] Generating login key using Math.random.'
            );

            for (let i = 0; i < arr.length; i++) {
                arr[i] = this._getRandomInt(0, 256);
            }
        }
        return fromByteArray(arr);
    }

    private _getRandomInt(min: number, max: number) {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min)) + min; //The maximum is exclusive and the minimum is inclusive
    }
}

export const appManager = new AppManager();
