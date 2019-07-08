import * as Sentry from '@sentry/browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, using, SubscriptionLike } from 'rxjs';
import { flatMap, map, scan } from 'rxjs/operators';
import { downloadAuxState, readFileJson } from '../aux-projector/download';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import {
    StoredCausalTree,
    storedTree,
    ProgressStatus,
    LoadingProgressCallback,
} from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    AuxCausalTree,
    lerp,
    auxCausalTreeFactory,
    AuxObject,
    normalizeAUXFileURL,
    getFilesStateFromStoredTree,
} from '@casual-simulation/aux-common';
import Dexie from 'dexie';
import { difference } from 'lodash';
import uuid from 'uuid/v4';
import { WebConfig } from '../../shared/WebConfig';
import { LoadingProgress } from '@casual-simulation/aux-common/LoadingProgress';
import { SimulationManager, AuxVM, AuxUser } from '@casual-simulation/aux-vm';
import {
    FileManager,
    BrowserSimulation,
} from '@casual-simulation/aux-vm-browser';
import { fromByteArray } from 'base64-js';

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

    constructor() {
        super('Aux');

        this.version(1).stores({
            keyval: 'key',
        });
    }
}

export enum AppType {
    Builder = 'builder',
    Player = 'player',
}

export class AppManager {
    public appType: AppType;

    /**
     * This is the app level loading progress object.
     * Change the values of this objects in order to trigger and modify the contents of the app's loading screen.
     */
    public loadingProgress: LoadingProgress = null;

    private _db: AppDatabase;
    private _userSubject: BehaviorSubject<AuxUser>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _simulationManager: SimulationManager<FileManager>;
    private _initPromise: Promise<void>;
    private _user: AuxUser;
    private _config: WebConfig;

    constructor() {
        this.loadingProgress = new LoadingProgress();
        this._initOffline();
        this._simulationManager = new SimulationManager(id => {
            return new FileManager(this._user, id, this._config);
        });
        this._userSubject = new BehaviorSubject<AuxUser>(null);
        this._db = new AppDatabase();
        this._initPromise = this._init();
    }

    get initPromise() {
        return this._initPromise;
    }

    get simulationManager(): SimulationManager<FileManager> {
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
        setTimeout(() => {
            OfflinePluginRuntime.update();
        }, 1000);
    }

    /**
     * Downloads the current local application state to a file.
     */
    async downloadState(): Promise<void> {
        const stored = await this.simulationManager.primary.exportTree();
        let tree = new AuxCausalTree(stored);
        await tree.import(stored);
        downloadAuxState(
            tree,
            `${this.user.name}-${this.user.channelId || 'default'}`
        );
    }

    /**
     * Uploads the given file to the local state.
     * @param file The file to upload.
     */
    async uploadState(file: File): Promise<void> {
        const json = await readFileJson(file);
        const stored: StoredCausalTree<AuxOp> = JSON.parse(json);
        const value = await getFilesStateFromStoredTree(stored);
        await this.simulationManager.primary.helper.addState(value);
    }

    /**
     * Loads a .aux file from the given URL.
     * @param url The url to load.
     */
    async loadAUX(url: string): Promise<StoredCausalTree<AuxOp>> {
        const normalized = normalizeAUXFileURL(url);
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
            fileManager: BrowserSimulation
        ) => SubscriptionLike[]
    ): SubscriptionLike {
        return this.userObservable
            .pipe(
                scan((subs: SubscriptionLike[], user: AuxUser, index) => {
                    if (subs) {
                        subs.forEach(s => s.unsubscribe());
                    }
                    if (user) {
                        return setup(user, this.simulationManager.primary);
                    } else {
                        return null;
                    }
                }, null)
            )
            .subscribe();
    }

    private async _init() {
        console.log('[AppManager] Starting init...');
        this.loadingProgress.show = true;
        this.loadingProgress.set(0, 'Fetching configuration...', null);
        await this._initConfig();
        this._initSentry();
        this.loadingProgress.status = 'Initializing user...';
        await this._initUser();
        this.loadingProgress.show = false;
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

        OfflinePluginRuntime.install({
            onUpdating: () => {
                console.log('[ServiceWorker]: Updating...');
                Sentry.addBreadcrumb({
                    message: 'Updating service worker.',
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default',
                });
            },
            onUpdateReady: () => {
                console.log('[ServiceWorker]: Update Ready.');
                OfflinePluginRuntime.applyUpdate();
            },
            onUpdated: () => {
                console.log('[ServiceWorker]: Updated.');
                Sentry.addBreadcrumb({
                    message: 'Updated service worker.',
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default',
                });
                this._updateAvailable.next(true);
            },
            onUpdateFailed: () => {
                console.log('[ServiceWorker]: Update failed.');
                Sentry.captureMessage(
                    'Service Worker update failed',
                    Sentry.Severity.Error
                );
            },
            onInstalled: () => {
                console.log('[ServiceWorker]: Installed.');
                Sentry.addBreadcrumb({
                    message: 'Installed service worker.',
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default',
                });
            },
        });
    }

    private async _initUser() {
        console.log('[AppManager] Initalizing user...');
        this._user = null;
        this._userSubject.subscribe(user => {
            Sentry.configureScope(scope => {
                if (user) {
                    scope.setUser(this._userSubject);
                } else {
                    scope.clear();
                }
            });
        });

        let userJson = sessionStorage.getItem('user');
        let user: AuxUser;
        if (userJson) {
            user = JSON.parse(userJson);
        } else {
            const storedUser: StoredValue<AuxUser> = await this._db.keyval.get(
                'user'
            );
            if (storedUser) {
                user = storedUser.value;
            }
        }

        if (user) {
            if (user.id) {
                this._user = user;

                if (this._user.name.includes('guest_')) {
                    this._user.name = 'Guest';
                    this._user.isGuest = true;
                }

                // Always give the user a new ID.
                this._user.id = uuid();

                if (!this._user.token) {
                    this._user.token = this._generateRandomKey();
                }

                const onFileManagerInitProgress = (
                    progress: ProgressStatus
                ) => {
                    const start = this.loadingProgress.progress;
                    this.loadingProgress.set(
                        lerp(start, 95, progress.progressPercent),
                        progress.message,
                        progress.error
                    );
                };

                this._user.channelId = this._user.channelId || 'default';

                await this.simulationManager.clear();
                await this.simulationManager.setPrimary(
                    this._user.channelId,
                    onFileManagerInitProgress
                );
                // await this.simulationManager.init(
                //     this._user.channelId,
                //     false,
                //     onFileManagerInitProgress,
                //     this.config
                // );
                this.loadingProgress.status = 'Saving user...';
                await this._saveUser();
                this._userSubject.next(this._user);
            } else {
                this.loadingProgress.status = 'Saving user...';
                this._user = null;
                await this._saveUser();
            }
        }
    }

    private async _saveUser() {
        if (this.user) {
            sessionStorage.setItem('user', JSON.stringify(this.user));
            await this._db.keyval.put({ key: 'user', value: this.user });
        } else {
            sessionStorage.removeItem('user');
            await this._db.keyval.delete('user');
        }
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
            // this._fileManager.dispose();
            this._user = null;
            this._userSubject.next(null);
            this._saveUser();
        }
    }

    async loginOrCreateUser(
        email: string,
        channelId?: string
    ): Promise<boolean> {
        this.loadingProgress.show = true;
        this.loadingProgress.set(0, 'Checking current user...', null);

        if (this.user && this.user.channelId === channelId) {
            this.loadingProgress.set(100, 'Complete!', null);
            return true;
        }

        channelId = channelId ? channelId.trim() : null;

        try {
            this.loadingProgress.set(10, 'Creating user...', null);

            let username: string;
            if (email.indexOf('@') >= 0) {
                username = email.split('@')[0];
            } else {
                username = email;
            }

            this._user = {
                email: email,
                username: username,
                name: username,
                token: this._generateRandomKey(),
                isGuest: false,
                channelId: channelId || 'default',
                id: uuid(),
            };

            // Sentry.addBreadcrumb({
            //     message: 'Login Success!',
            //     category: 'auth',
            //     level: Sentry.Severity.Info,
            //     type: 'default',
            // });
            // this.loadingProgress.set(
            //     20,
            //     'Recieved user from server.',
            //     null
            // );
            // console.log('[AppManager] Login Success!', result);

            if (this._user.name.includes('guest_')) {
                this._user.name = 'Guest';
                this._user.isGuest = true;
            }

            this.loadingProgress.set(40, 'Loading Files...', null);

            const onFileManagerInitProgress: LoadingProgressCallback = (
                progress: ProgressStatus
            ) => {
                this.loadingProgress.set(
                    lerp(40, 95, progress.progressPercent),
                    progress.message,
                    progress.error
                );
            };

            await this.simulationManager.clear();
            await this.simulationManager.setPrimary(
                this._user.channelId,
                onFileManagerInitProgress
            );
            // await this._fileManager.init(
            //     channelId,
            //     true,
            //     onFileManagerInitProgress,
            //     this.config
            // );

            this._userSubject.next(this._user);
            this.loadingProgress.set(95, 'Saving user...', null);
            await this._saveUser();

            this.loadingProgress.set(100, 'Complete!', null);
            this.loadingProgress.show = false;

            return true;
        } catch (ex) {
            Sentry.captureException(ex);
            console.error(ex);

            this.loadingProgress.set(
                0,
                'Exception occured while logging in.',
                ex.message
            );
            return false;
        }
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
        const path = location.pathname.slice(1);
        const result = await Axios.get<WebConfig>(`/api/${path}/config`);
        if (result.status === 200) {
            return result.data;
        } else {
            return null;
        }
    }

    private async _saveConfig() {
        if (this.config) {
            await this._db.keyval.put({ key: 'config', value: this.config });
        } else {
            await this._db.keyval.delete('config');
        }
    }

    private async _fetchConfigFromLocalStorage(): Promise<WebConfig> {
        const val = await this._db.keyval.get('config');
        if (val) {
            return val.value;
        } else {
            return null;
        }
    }

    private _generateRandomKey(): string {
        console.log('[AppManager] Generating new login key...');
        let arr = new Uint8Array(128);
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
