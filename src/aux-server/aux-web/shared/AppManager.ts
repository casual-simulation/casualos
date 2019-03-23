import * as Sentry from '@sentry/browser';
import * as OfflinePluginRuntime from 'offline-plugin/runtime';
import Axios from 'axios';
import Vue from 'vue';
import { BehaviorSubject, Observable, using, SubscriptionLike } from 'rxjs';
import { FileManager } from './FileManager';
import { SocketManager } from './SocketManager';
import { flatMap, map, scan } from 'rxjs/operators';
import { downloadAuxState, readFileJson } from '../aux-projector/download';
import { CausalTreeManager } from './causal-trees/CausalTreeManager';
import { StoredCausalTree } from '@yeti-cgi/aux-common/causal-trees';
import { AuxOp, FilesState, AuxCausalTree } from '@yeti-cgi/aux-common';
import Dexie from 'dexie';
import { difference } from 'lodash';
import uuid from 'uuid/v4';

export interface User {
    id: string;
    email: string;
    username: string;
    name: string;

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
            'keyval': 'key'
        });
    }
}

export enum AppType {
    Builder = 'builder',
    Player = 'player'
}

export class AppManager {    
    public appType: AppType;

    private _db: AppDatabase;
    private _userSubject: BehaviorSubject<User>;
    private _updateAvailable: BehaviorSubject<boolean>;
    private _fileManager: FileManager;
    private _socketManager: SocketManager;
    private _treeManager: CausalTreeManager;
    private _initPromise: Promise<void>;
    private _user: User;

    constructor() {
        this._initSentry();
        this._initOffline();
        this._socketManager = new SocketManager();
        this._treeManager = new CausalTreeManager(this._socketManager.socket);
        this._fileManager = new FileManager(this, this._treeManager);
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

    get version(): VersionInfo {
        return {
            gitCommit: GIT_HASH,
            latestTaggedVersion: GIT_TAG
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
        downloadAuxState(this.fileManager.aux.tree, `${this.user.name}-${this.user.channelId || 'default'}`);
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
            const tree = <AuxCausalTree>this._treeManager.factory.create('aux', state);
            value = tree.value;
        } else {
            console.log('[AppManager] Old file detected, adding state.');
            value = <FilesState><unknown>state;
        }
        
        this.fileManager.addState(value);
    }

    /**
     * Helper function that ensures services are only running while the user is logged in.
     * The provided setup function will be run once the user logs in or if they are already logged in
     * and the returned subscriptions will be unsubscribed once the user logs out.
     * @param setup 
     */
    whileLoggedIn(setup: (user: User, fileManager: FileManager) => SubscriptionLike[]): SubscriptionLike {
        return this.userObservable.pipe(
            scan((subs: SubscriptionLike[], user: User, index) => {
                if (subs) {
                    subs.forEach(s => s.unsubscribe());
                }
                if (user) {   
                    return setup(user, this.fileManager);
                } else {
                    return null;
                }
            }, null)
        ).subscribe();
    }

    private async _init() {
        await this._initUser();
    }

    private _initSentry() {
        const sentryEnv = PRODUCTION ? 'prod' : 'dev';

        if (SENTRY_DSN) {
            Sentry.init({
                dsn: SENTRY_DSN,
                integrations: [new Sentry.Integrations.Vue({ Vue: Vue })],
                release: GIT_HASH,
                environment: sentryEnv,
                enabled: ENABLE_SENTRY
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
                    type: 'default'
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
                    type: 'default'
                });
                this._updateAvailable.next(true);
            },
            onUpdateFailed: () => {
                console.log('[ServiceWorker]: Update failed.');
                Sentry.captureMessage('Service Worker update failed', Sentry.Severity.Error);
            },
            onInstalled: () => {
                console.log('[ServiceWorker]: Installed.');
                Sentry.addBreadcrumb({
                    message: 'Installed service worker.',
                    level: Sentry.Severity.Info,
                    category: 'app',
                    type: 'default'
                });
            }
        });
    }

    private async _initUser() {
        this._user = null;
        this._userSubject = new BehaviorSubject<User>(null);
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
            const storedUser: StoredValue<User> = await this._db.keyval.get('user');
            if (storedUser) {
                user = storedUser.value;
                session = false;
            }
        }

        if (user) {
            if (user.id) {
                this._user = user;
                if (!session) {
                    this._user.id = uuid();
                }
                await this._fileManager.init(this._user.channelId);
                await this._saveUser();
                this._userSubject.next(this._user);
            } else {
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
            console.log("[AppManager] Logout");

            this._fileManager.dispose();
            this._user = null;
            this._userSubject.next(null);
            this._saveUser();
        }
    }

    async loginOrCreateUser(email: string, channelId?: string): Promise<boolean> {
        if (this.user && this.user.channelId === channelId)
            return true;

        channelId = channelId ? channelId.trim() : null;

        try {
            const result = await Axios.post('/api/users', {
                email: email
            });

            if (result.status === 200) {
                Sentry.addBreadcrumb({
                    message: 'Login Success!',
                    category: 'auth',
                    level: Sentry.Severity.Info,
                    type: 'default'
                });
                console.log('[AppManager] Login Success!', result);

                this._user = result.data;
                this._user.channelId = channelId;
                await this._fileManager.init(channelId);
                this._userSubject.next(this._user);
                await this._saveUser();
                return true;
            } else {
                Sentry.addBreadcrumb({
                    message: 'Login failure',
                    category: 'auth',
                    level: Sentry.Severity.Error,
                    type: 'error'
                });
                console.error(result);
                return false;
            }
        } catch (ex) {
            Sentry.captureException(ex);
            console.error(ex);
            return false;
        }
    }
}

export const appManager = new AppManager();