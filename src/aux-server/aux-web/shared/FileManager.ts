import {
    File,
    FileEvent,
    FilesState,
    Object,
    PartialFile,
    Workspace,
    action,
    fileChangeObservables,
    calculateActionEvents,
    addState,
    DEFAULT_USER_MODE,
    FileCalculationContext,
    AuxCausalTree,
    AuxFile,
    AuxObject,
    fileRemoved,
    UserMode,
    lerp,
} from '@casual-simulation/aux-common';
import { keys, union, values } from 'lodash';
import {
    BehaviorSubject,
    from,
    merge as mergeObservables,
    Observable,
    ReplaySubject,
    Subject,
    SubscriptionLike,
} from 'rxjs';
import {
    filter,
    map,
    startWith,
    first as rxFirst,
    flatMap,
} from 'rxjs/operators';

import { AppManager, appManager } from './AppManager';
import { SocketManager } from './SocketManager';
import { CausalTreeManager } from './causal-trees/CausalTreeManager';
import { RealtimeCausalTree } from '@casual-simulation/causal-trees';
import { getOptionalValue } from './SharedUtils';
import {
    LoadingProgress,
    LoadingProgressCallback,
} from '@casual-simulation/aux-common/LoadingProgress';
import { FileHelper } from './FileHelper';
import SelectionManager from './SelectionManager';
import { RecentFilesManager } from './RecentFilesManager';
import { ProgressStatus } from '@casual-simulation/causal-trees';
import FileWatcher from './FileWatcher';
import FilePanelManager from './FilePanelManager';

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager {
    private _appManager: AppManager;
    private _treeManager: CausalTreeManager;
    private _helper: FileHelper;
    private _selection: SelectionManager;
    private _recent: RecentFilesManager;
    private _watcher: FileWatcher;
    private _filePanel: FilePanelManager;

    private _subscriptions: SubscriptionLike[];
    private _status: string;
    private _initPromise: Promise<string>;
    private _id: string;
    private _aux: RealtimeCausalTree<AuxCausalTree>;
    _errored: boolean;

    /**
     * Gets the ID of the simulation that is currently being used.
     */
    get id() {
        return this._id;
    }

    /**
     * Gets all the files that represent an object.
     */
    get objects(): AuxObject[] {
        return this._helper.objects;
    }

    /**
     * Gets all of the available tags.
     */
    get tags(): string[] {
        return union(...this.objects.map(o => keys(o.tags)));
    }

    /**
     * Gets all the selected files that represent an object.
     */
    get selectedObjects(): File[] {
        return this.selection.getSelectedFilesForUser(this.userFile);
    }

    /**
     * Gets an observable that resolves whenever a new file is discovered.
     * That is, it was created or added by another user.
     */
    get filesDiscovered(): Observable<AuxFile[]> {
        return this._watcher.filesDiscovered;
    }

    /**
     * Gets an observable that resolves whenever a file is removed.
     * That is, it was deleted from the working directory either by checking out a
     * branch that does not contain the file or by deleting it.
     */
    get filesRemoved(): Observable<string[]> {
        return this._watcher.filesRemoved;
    }

    /**
     * Gets an observable that resolves whenever a file is updated.
     */
    get filesUpdated(): Observable<AuxFile[]> {
        return this._watcher.filesUpdated;
    }

    get status(): string {
        return this._status;
    }

    /**
     * Gets the file for the current user.
     */
    get userFile(): AuxObject {
        if (!this._appManager.user) {
            return;
        }
        return this._helper.userFile;
    }

    /**
     * Gets the globals file.
     */
    get globalsFile(): AuxObject {
        let objs = this.objects.filter(o => o.id === 'globals');
        if (objs.length > 0) {
            return objs[0];
        }
        return null;
    }

    /**
     * Gets whether the app is connected to the server but may
     * or may not be synced to the serer.
     */
    get isOnline(): boolean {
        return this._aux.channel.isConnected;
    }

    /**
     * Gets whether the app is synced to the server.
     */
    get isSynced(): boolean {
        return this.isOnline;
    }

    /**
     * Gets the observable that resolves whenever the connection state changes.
     */
    get connectionStateChanged(): Observable<boolean> {
        return this._aux.channel.connectionStateChanged;
    }

    /**
     * Gets the current local file state.
     */
    get filesState() {
        return this._aux.tree.value;
    }

    /**
     * Gets the realtime causal tree that the file manager is using.
     */
    get aux() {
        return this._aux;
    }

    /**
     * Gets the file helper.
     */
    get helper() {
        return this._helper;
    }

    /**
     * Gets the selection manager.
     */
    get selection() {
        return this._selection;
    }

    /**
     * Gets the recent files manager.
     */
    get recent() {
        return this._recent;
    }

    /**
     * Gets the file watcher.
     */
    get watcher() {
        return this._watcher;
    }

    /**
     * Gets the files panel manager.
     */
    get filePanel() {
        return this._filePanel;
    }

    constructor(app: AppManager, treeManager: CausalTreeManager) {
        this._appManager = app;
        this._treeManager = treeManager;
    }

    /**
     * Initializes the file manager to connect to the session with the given ID.
     * @param id The ID of the session to connect to.
     */
    init(
        id: string,
        force: boolean,
        loadingCallback: LoadingProgressCallback,
        config: { isBuilder: boolean; isPlayer: boolean }
    ): Promise<string> {
        console.log('[FileManager] init id:', id, 'force:', force);
        force = getOptionalValue(force, false);
        if (this._initPromise && !force) {
            return this._initPromise;
        } else {
            if (this._initPromise) {
                this.dispose();
            }
            return (this._initPromise = this._init(
                id,
                loadingCallback,
                config
            ));
        }
    }

    /**
     * Sets the file mode that the user should be in.
     * @param mode The mode that the user should use.
     */
    setUserMode(mode: UserMode) {
        return this.updateFile(this.userFile, {
            tags: {
                _mode: mode,
            },
        });
    }

    /**
     * Sets the file that is currently being edited by the current user.
     * @param file The file.
     */
    setEditedFile(file: AuxObject) {
        this._setEditedFileForUser(file, this.userFile);
    }

    /**
     * Calculates the nicely formatted value for the given file and tag.
     * @param file The file to calculate the value for.
     * @param tag The tag to calculate the value for.
     */
    calculateFormattedFileValue(file: Object, tag: string): string {
        return this._helper.calculateFormattedFileValue(file, tag);
    }

    calculateFileValue(file: Object, tag: string) {
        return this._helper.calculateFileValue(file, tag);
    }

    /**
     * Removes the given file.
     * @param file The file to remove.
     */
    async removeFile(file: AuxFile) {
        if (this._aux.tree) {
            console.log('[FileManager] Remove File', file.id);
            await this._aux.tree.delete(file.metadata.ref);
        } else {
            console.warn(
                '[FileManager] Tree is not loaded yet. Invalid Operation!'
            );
        }
    }

    /**
     * Updates the given file with the given data.
     */
    updateFile(file: AuxFile, newData: PartialFile) {
        return this._helper.updateFile(file, newData);
    }

    createFile(id?: string, tags?: Object['tags']) {
        return this._helper.createFile(id, tags);
    }

    createWorkspace(builderContextId?: string, contextType?: unknown) {
        return this._helper.createWorkspace(builderContextId, contextType);
    }

    action(eventName: string, files: File[], arg?: any) {
        return this._helper.action(eventName, files, arg);
    }

    transaction(...events: FileEvent[]) {
        return this._helper.transaction(...events);
    }

    /**
     * Adds the given state to the session.
     * @param state The state to add.
     */
    addState(state: FilesState) {
        return this._helper.addState(state);
    }

    // TODO: This seems like a pretty dangerous function to keep around,
    // but we'll add a config option to prevent this from happening on real sites.
    async deleteEverything() {
        console.warn('[FileManager] Delete Everything!');
        const state = this.filesState;
        const fileIds = keys(state);
        const files = fileIds.map(id => state[id]);
        const nonUserOrGlobalFiles = files.filter(
            f => !f.tags._user && f.id !== 'globals'
        );
        const deleteOps = nonUserOrGlobalFiles.map(f => fileRemoved(f.id));
        await this.transaction(...deleteOps);

        // setTimeout(() => {
        //   appManager.logout();
        //   location.reload();
        // }, 200);
    }

    /**
     * Creates an observable that resolves whenever the given file changes.
     * @param file The file to watch.
     */
    fileChanged(file: File): Observable<File> {
        return this.filesUpdated.pipe(
            flatMap(files => files),
            filter(f => f.id === file.id),
            startWith(file)
        );
    }

    private _setEditedFileForUser(file: AuxObject, user: AuxObject) {
        if (file.id !== user.tags._editingFile) {
            console.log('[FileManager] Edit File:', file.id);

            this.updateFile(user, {
                tags: {
                    _editingFile: file.id,
                },
            });
        }
    }

    /**
     * Creates a new FileCalculationContext from the current state.
     */
    createContext(): FileCalculationContext {
        return this._helper.createContext();
    }

    /**
     * Forks the current session's aux into the given session ID.
     * @param forkName The ID of the new session.
     */
    async forkAux(forkName: string) {
        const id = this._getTreeName(forkName);
        console.log('[FileManager] Making fork', forkName);
        const forked = await this._treeManager.forkTree(this.aux, id);
    }

    private _getTreeName(id: string) {
        return id ? `aux-${id}` : 'aux-default';
    }

    private async _init(
        id: string,
        loadingCallback: LoadingProgressCallback,
        config: { isBuilder: boolean; isPlayer: boolean }
    ) {
        const loadingProgress = new LoadingProgress();
        if (loadingCallback) {
            loadingProgress.onChanged.addListener(() => {
                loadingCallback(loadingProgress);
            });
        }

        if (this._errored) {
            loadingProgress.set(
                0,
                'File manager failed to initalize.',
                'File manager failed to initialize'
            );
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }
            return;
        }
        try {
            this._setStatus('Starting...');

            this._id = this._getTreeName(id);

            this._subscriptions = [];

            loadingProgress.set(10, 'Initializing causal tree manager..', null);
            await this._treeManager.init();

            this._aux = await this._treeManager.getTree<AuxCausalTree>(
                {
                    id: this._id,
                    type: 'aux',
                },
                {
                    garbageCollect: true,

                    // TODO: Allow reusing site IDs without causing multiple tabs to try and
                    //       be the same site.
                    alwaysRequestNewSiteId: true,
                }
            );

            this._subscriptions.push(this._aux);
            this._subscriptions.push(
                this._aux.onError.subscribe(err => console.error(err))
            );
            this._subscriptions.push(
                this._aux.onRejected.subscribe(rejected => {
                    rejected.forEach(r => {
                        console.warn('[FileManager] Atom Rejected', r);
                    });
                })
            );

            loadingProgress.set(20, 'Loading tree from server...', null);
            const onTreeInitProgress: LoadingProgressCallback = (
                status: ProgressStatus
            ) => {
                let percent = status.progressPercent
                    ? lerp(20, 70, status.progressPercent)
                    : loadingProgress.progress;
                let message = status.message
                    ? status.message
                    : loadingProgress.status;
                let error = status.error ? status.error : loadingProgress.error;

                loadingProgress.set(percent, message, error);
            };
            await this._aux.init(onTreeInitProgress);
            await this._aux.waitToGetTreeFromServer();

            console.log('[FileManager] Got Tree:', this._aux.tree.site.id);

            this._helper = new FileHelper(
                this._aux.tree,
                appManager.user.id,
                config
            );
            this._selection = new SelectionManager(this._helper);
            this._recent = new RecentFilesManager(this._helper);

            loadingProgress.set(70, 'Initalize user file...', null);
            await this._initUserFile();
            loadingProgress.set(80, 'Initalize globals file...', null);
            await this._initGlobalsFile();

            const {
                filesAdded,
                filesRemoved,
                filesUpdated,
            } = fileChangeObservables(this._aux);
            this._watcher = new FileWatcher(
                this._helper,
                this._selection,
                filesAdded,
                filesRemoved,
                filesUpdated
            );
            this._filePanel = new FilePanelManager();

            this._setStatus('Initialized.');
            loadingProgress.set(100, 'File manager initialized.', null);
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }

            return this._id;
        } catch (ex) {
            this._errored = true;
            console.error(ex);
            loadingProgress.set(
                0,
                'Error occured while initializing file manager.',
                ex.message
            );
            if (loadingCallback) {
                loadingProgress.onChanged.removeAllListeners();
            }
        }
    }

    /**
     * Adds the root atom to the tree if it has not been added by the server.
     */
    private async _addRootAtom() {
        if (this._aux.tree.weave.atoms.length === 0) {
            this._setStatus('Adding root atom...');
            await this._aux.tree.root();
        }
    }

    private async _initUserFile() {
        this._setStatus('Updating user file...');
        let userFile = this.userFile;
        const userContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }`;
        const userInventoryContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }_inventory`;
        const userMenuContext = `_user_${appManager.user.username}_${
            this._aux.tree.site.id
        }_menu`;
        if (!userFile) {
            await this.createFile(this._appManager.user.id, {
                [userContext]: true,
                [`${userContext}.config`]: true,
                _user: this._appManager.user.username,
                _userInventoryContext: userInventoryContext,
                _userMenuContext: userMenuContext,
                _mode: DEFAULT_USER_MODE,
            });
        } else {
            if (!userFile.tags._userMenuContext) {
                await this.updateFile(userFile, {
                    tags: {
                        _userMenuContext: userMenuContext,
                    },
                });
            }
            if (!userFile.tags._userInventoryContext) {
                await this.updateFile(userFile, {
                    tags: {
                        _userInventoryContext: userInventoryContext,
                    },
                });
            }
        }
    }

    private async _initGlobalsFile() {
        this._setStatus('Updating globals file...');
        let globalsFile = this.globalsFile;
        if (!globalsFile) {
            await this.createFile('globals', {});
        }
    }

    private _setStatus(status: string) {
        this._status = status;
        console.log('[FileManager] Status:', status);
    }

    public dispose() {
        this._setStatus('Dispose');
        this._initPromise = null;
        this._subscriptions.forEach(s => s.unsubscribe());
    }
}
