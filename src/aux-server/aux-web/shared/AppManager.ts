import * as Sentry from '@sentry/browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, using, SubscriptionLike } from 'rxjs';
import { FileManager } from './FileManager';
import { SocketManager } from './SocketManager';
import { flatMap, map, scan } from 'rxjs/operators';
import { downloadAuxState, readFileJson } from '../aux-projector/download';
import { CausalTreeManager } from '@casual-simulation/causal-tree-client-socketio';
import { StoredCausalTree } from '@casual-simulation/causal-trees';
import {
    AuxOp,
    FilesState,
    AuxCausalTree,
    lerp,
    auxCausalTreeFactory,
} from '@casual-simulation/aux-common';
import Dexie from 'dexie';
import { difference } from 'lodash';
import uuid from 'uuid/v4';
import { WebConfig } from '../../shared/WebConfig';
import {
    LoadingProgress,
    LoadingProgressCallback,
} from '@casual-simulation/aux-common/LoadingProgress';

export interface User {
    id: string;
    email: string;
    username: string;
    name: string;
    isGuest: boolean;
    channelId: string;
}

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
    private _userSubject: BehaviorSubject<User>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _fileManager: FileManager;
    private _socketManager: SocketManager;
    private _treeManager: CausalTreeManager;
    private _initPromise: Promise<void>;
    private _user: User;
    private _config: WebConfig;

    constructor() {
        this.loadingProgress = new LoadingProgress();
        this._initSentry();
        this._initOffline();
        this._socketManager = new SocketManager();
        this._treeManager = new CausalTreeManager(
            this._socketManager.socket,
            auxCausalTreeFactory()
        );
        this._fileManager = new FileManager(this, this._treeManager);
        this._userSubject = new BehaviorSubject<User>(null);
        this._db = new AppDatabase();
        this._initPromise = this._init();
    }

    get initPromise() {
        return this._initPromise;
    }

    get socketManager() {
        return this._socketManager;
    }

    get treeManager() {
        return this._treeManager;
    }

    get fileManager() {
        if (this.user) {
            return this._fileManager;
        }
    }

    get userObservable(): Observable<User> {
        return this._userSubject;
    }

    get user(): User {
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
    downloadState(): void {
        downloadAuxState(
            this.fileManager.aux.tree,
            `${this.user.name}-${this.user.channelId || 'default'}`
        );
    }

    /**
     * Uploads the given file to the local state.
     * @param file The file to upload.
     */
    async uploadState(file: File): Promise<void> {
        const json = await readFileJson(file);
        const state: StoredCausalTree<AuxOp> = JSON.parse(json);
        let value: FilesState;
        if (state.site && state.knownSites && state.weave) {
            console.log('[AppManager] Importing Weave.');

            // Don't try to import the tree because it's like trying to
            // import an unrelated Git repo. Git handles this by allowing
            // multiple root nodes but we dont allow multiple roots.
            const tree = <AuxCausalTree>(
                this._treeManager.factory.create('aux', state)
            );
            await tree.import(state);
            value = tree.value;
        } else {
            console.log('[AppManager] Old file detected, adding state.');
            value = <FilesState>(<unknown>state);
        }

        await this.fileManager.addState(value);
    }

    /**
     * Helper function that ensures services are only running while the user is logged in.
     * The provided setup function will be run once the user logs in or if they are already logged in
     * and the returned subscriptions will be unsubscribed once the user logs out.
     * @param setup
     */
    whileLoggedIn(
        setup: (user: User, fileManager: FileManager) => SubscriptionLike[]
    ): SubscriptionLike {
        return this.userObservable
            .pipe(
                scan((subs: SubscriptionLike[], user: User, index) => {
                    console.log('user', user, index);
                    if (subs) {
                        subs.forEach(s => s.unsubscribe());
                    }
                    if (user) {
                        return setup(user, this.fileManager);
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

        if (SENTRY_DSN) {
            Sentry.init({
                dsn: SENTRY_DSN,
                integrations: [new Sentry.Integrations.Vue({ Vue: Vue })],
                release: GIT_HASH,
                environment: sentryEnv,
                enabled: ENABLE_SENTRY,
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
        let user: User;
        let session: boolean = false;
        if (userJson) {
            user = JSON.parse(userJson);
            session = true;
        } else {
            const storedUser: StoredValue<User> = await this._db.keyval.get(
                'user'
            );
            if (storedUser) {
                user = storedUser.value;
                session = false;
            }
        }

        if (user) {
            if (user.id) {
                this._user = user;

                if (this._user.name.includes('guest_')) {
                    this._user.name = 'Guest';
                    this._user.isGuest = true;
                }

                if (!session) {
                    this._user.id = uuid();
                }

                const onFileManagerInitProgress: LoadingProgressCallback = (
                    progress: LoadingProgress
                ) => {
                    const start = this.loadingProgress.progress;
                    this.loadingProgress.set(
                        lerp(start, 95, progress.progress / 100),
                        progress.status,
                        progress.error
                    );
                };
                await this._fileManager.init(
                    this._user.channelId,
                    false,
                    onFileManagerInitProgress,
                    this.config
                );
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

            this._fileManager.dispose();
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
            this.loadingProgress.set(10, 'Getting user from server...', null);
            const result = await Axios.post('/api/users', {
                email: email,
            });

            if (result.status === 200) {
                Sentry.addBreadcrumb({
                    message: 'Login Success!',
                    category: 'auth',
                    level: Sentry.Severity.Info,
                    type: 'default',
                });
                this.loadingProgress.set(
                    20,
                    'Recieved user from server.',
                    null
                );
                console.log('[AppManager] Login Success!', result);

                this._user = result.data;
                this._user.channelId = channelId;

                if (this._user.name.includes('guest_')) {
                    this._user.name = 'Guest';
                    this._user.isGuest = true;
                }

                this.loadingProgress.set(40, 'Loading Files...', null);

                const onFileManagerInitProgress: LoadingProgressCallback = (
                    progress: LoadingProgress
                ) => {
                    this.loadingProgress.set(
                        lerp(40, 95, progress.progress / 100),
                        progress.status,
                        progress.error
                    );
                };
                await this._fileManager.init(
                    channelId,
                    true,
                    onFileManagerInitProgress,
                    this.config
                );

                this._userSubject.next(this._user);
                this.loadingProgress.set(95, 'Saving user...', null);
                await this._saveUser();

                this.loadingProgress.set(100, 'Complete!', null);
                this.loadingProgress.show = false;

                return true;
            } else {
                Sentry.addBreadcrumb({
                    message: 'Login failure',
                    category: 'auth',
                    level: Sentry.Severity.Error,
                    type: 'error',
                });
                console.error(result);

                this.loadingProgress.set(
                    0,
                    'Error occured while logging in.',
                    result.statusText
                );
                return false;
            }
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
        const result = await Axios.get<WebConfig>('/api/config');
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
}

export const appManager = new AppManager();
