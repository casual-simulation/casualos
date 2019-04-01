
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
  filterFilesBySelection, 
  createWorkspace, 
  FileCalculationContext,
  selectionIdForUser,
  updateFile,
  createCalculationContext,
  updateUserSelection,
  toggleFileSelection,
  calculateFormattedFileValue,
  calculateFileValue,
  createFile,
  getActiveObjects,
  AuxCausalTree,
  AuxFile,
  AuxObject,
  fileRemoved
} from '@yeti-cgi/aux-common';
import {
  keys, 
  union, 
  values} from 'lodash';
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
  flatMap
} from 'rxjs/operators';

import {AppManager, appManager} from './AppManager';
import {SocketManager} from './SocketManager';
import { CausalTreeManager } from './causal-trees/CausalTreeManager';
import { RealtimeCausalTree } from '@yeti-cgi/aux-common/causal-trees';

export interface SelectedFilesUpdatedEvent { 
    files: AuxObject[];
}

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager {
  private _appManager: AppManager;
  private _treeManager: CausalTreeManager;

  private _subscriptions: SubscriptionLike[];
  private _status: string;
  private _initPromise: Promise<string>;
  private _filesDiscoveredObservable: ReplaySubject<AuxFile[]>;
  private _filesRemovedObservable: ReplaySubject<string[]>;
  private _filesUpdatedObservable: Subject<AuxFile[]>;
  private _selectedFilesUpdated: BehaviorSubject<SelectedFilesUpdatedEvent>;
  private _id: string;
  private _aux: RealtimeCausalTree<AuxCausalTree>;
    _errored: boolean;


  /**
   * Gets all the files that represent an object.
   */
  get objects(): AuxObject[] {
    return <AuxObject[]>getActiveObjects(this.filesState);
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
    return this.selectedFilesForUser(this.userFile);
  }

  /**
   * Gets an observable that resolves whenever a new file is discovered.
   * That is, it was created or added by another user.
   */
  get filesDiscovered(): Observable<AuxFile[]> {
    return this._filesDiscoveredObservable;
  }

  /**
   * Gets an observable that resolves whenever a file is removed.
   * That is, it was deleted from the working directory either by checking out a
   * branch that does not contain the file or by deleting it.
   */
  get filesRemoved(): Observable<string[]> {
    return this._filesRemovedObservable;
  }

  /**
   * Gets an observable that resolves whenever a file is updated.
   */
  get filesUpdated(): Observable<AuxFile[]> {
    return this._filesUpdatedObservable;
  }

  get selectedFilesUpdated(): Observable<SelectedFilesUpdatedEvent> {
    return this._selectedFilesUpdated;
  }

  get status(): string {
    return this._status;
  }

  get userFile(): AuxObject {
    if (!this._appManager.user) {
      return;
    }
    var objs = this.objects.filter(o => o.id === this._appManager.user.id);
    if (objs.length > 0) {
      return objs[0];
    }
    return null;
  }

  get globalsFile(): AuxObject {
    let objs = this.objects.filter((o => o.id === 'globals'));
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

  constructor(app: AppManager, treeManager: CausalTreeManager) {
    this._appManager = app;
    this._treeManager = treeManager;
  }

  /**
   * Initializes the file manager to connect to the session with the given ID.
   * @param id The ID of the session to connect to.
   */
  init(id: string, force: boolean = false): Promise<string> {
    if (this._initPromise && !force) {
      return this._initPromise;
    } else {
      return this._initPromise = this._init(id);
    }
  }

  /**
   * Gets a list of files that the given user has selected.
   * @param user The file of the user.
   */
  selectedFilesForUser(user: AuxObject) {
    return filterFilesBySelection(this.objects, user.tags._selection);
  }

  /**
   * Selects the given file for the current user.
   * @param file The file to select.
   */
  async selectFile(file: AuxObject) {
    await this._selectFileForUser(file, this.userFile);
  }

  /**
   * Clears the selection for the current user.
   */
  async clearSelection() {
    await this._clearSelectionForUser(this.userFile);
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
    return calculateFormattedFileValue(this.createContext(), file, tag);
  }

  calculateFileValue(file: Object, tag: string) {
    return calculateFileValue(this.createContext(), file, tag);
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
        console.warn('[FileManager] Tree is not loaded yet. Invalid Operation!');
    }
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: AuxFile, newData: PartialFile) {
    updateFile(file, this.userFile.id, newData, () => this.createContext());

    await this._aux.tree.updateFile(file, newData);
  }

  async createFile(id?: string, tags?: Object['tags']) {
    console.log('[FileManager] Create File');

    const file = createFile(id, tags);
    await this._aux.tree.addFile(file);
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = createWorkspace();
    await this._aux.tree.addFile(workspace);
  }

  async action(eventName: string, files: File[]) {
    console.log('[FileManager] Run event:', eventName, 'on files:', files);

    // Calculate the events on a single client and then run them in a transaction to make sure the order is right.
    const fileIds = files.map(f => f.id);
    const actionData = action(eventName, fileIds);
    const result = calculateActionEvents(this._aux.tree.value, actionData);
    console.log('  result: ', result);

    await this._aux.tree.addEvents(result.events);
  }

  async transaction(...events: FileEvent[]) {
    await this._aux.tree.addEvents(events);
  }

  /**
   * Adds the given state to the session.
   * @param state The state to add.
   */
  async addState(state: FilesState) {
      await this._aux.tree.addEvents([addState(state)]);
  }

  // TODO: This seems like a pretty dangerous function to keep around,
  // but we'll add a config option to prevent this from happening on real sites.
  async deleteEverything() {
    console.warn('[FileManager] Delete Everything!');
    const state = this.filesState;
    const fileIds = keys(state);
    const files = fileIds.map(id => state[id]);
    const nonUserOrGlobalFiles = files.filter(f => !f.tags._user && f.id !== 'globals');
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

  /**
   * Clears the selection that the given user has.
   * @param user The file for the user to clear the selection of.
   */
  private async _clearSelectionForUser(user: AuxObject) {
    console.log('[FileManager] Clear selection for', user.id);
    const update = updateUserSelection(null, null);
    await this.updateFile(user, update);
  }

  private async _selectFileForUser(file: AuxObject, user: AuxObject) {
    console.log('[FileManager] Select File:', file.id);
    
    const {id, newId} = selectionIdForUser(user);
    if (newId) {
      const update = updateUserSelection(newId, file.id);
      await this.updateFile(user, update);
    }
    if (id) {
      const update = toggleFileSelection(file, id, user.id);
      await this.updateFile(file, update);
    }
  }

  private _setEditedFileForUser(file: AuxObject, user: AuxObject) {
    if (file.id !== user.tags._editingFile) {
      console.log('[FileManager] Edit File:', file.id);
      
      this.updateFile(user, {
        tags: {
          _editingFile: file.id
        }
      });
    }
  }

  /**
   * Creates a new FileCalculationContext from the current state.
   */
  createContext(): FileCalculationContext {
    return createCalculationContext(this.objects);
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

  private async _init(id: string) {
    if(this._errored) {
        return;
    }
    try {
        this._setStatus('Starting...');

        this._id = this._getTreeName(id);

        this._subscriptions = [];
        this._filesDiscoveredObservable = new ReplaySubject<AuxFile[]>();
        this._filesRemovedObservable = new ReplaySubject<string[]>();
        this._filesUpdatedObservable = new Subject<AuxFile[]>();
        this._selectedFilesUpdated =
            new BehaviorSubject<SelectedFilesUpdatedEvent>({files: []});
        
        await this._treeManager.init();

        this._aux = await this._treeManager.getTree<AuxCausalTree>({
            id: this._id,
            type: 'aux'
        }, { garbageCollect: true, alwaysRequestNewSiteId: false });

        this._subscriptions.push(this._aux.onError.subscribe(err => console.error(err)));
        this._subscriptions.push(this._aux.onRejected.subscribe(rejected => {
            rejected.forEach(r => {
                console.warn('[FileManager] Atom Rejected', r);
            });
        }));

        await this._aux.init();
        await this._aux.waitToGetTreeFromServer();

        console.log('[FileManager] Got Tree:', this._aux.tree.site.id);

        await this._initUserFile();
        await this._initGlobalsFile();

        const { filesAdded, filesRemoved, filesUpdated } = fileChangeObservables(this._aux);

        this._subscriptions.push(filesAdded.subscribe(this._filesDiscoveredObservable));
        this._subscriptions.push(filesRemoved.subscribe(this._filesRemovedObservable));
        this._subscriptions.push(filesUpdated.subscribe(this._filesUpdatedObservable));
        const alreadySelected = this.selectedObjects;
        const alreadySelectedObservable = from(alreadySelected);

        const allFilesSelected = alreadySelectedObservable;

        const allFilesSelectedUpdatedAddedAndRemoved = mergeObservables(
            allFilesSelected, 
            filesAdded.pipe(flatMap(files => files), map(f => f.id)),
            filesUpdated.pipe(flatMap(files => files), map(f => f.id)), 
            filesRemoved);

        const allSelectedFilesUpdated =
            allFilesSelectedUpdatedAddedAndRemoved.pipe(map(() => {
            const selectedFiles = this.selectedObjects;
            return {files: selectedFiles};
            }));

        this._subscriptions.push(allSelectedFilesUpdated.subscribe(this._selectedFilesUpdated));

        this._setStatus('Initialized.');

        return this._id;
    } catch(ex) {
        this._errored = true;
        console.error(ex);
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
    const userContext = `_user_${appManager.user.username}_${this._aux.tree.site.id}`;
    const userInventoryContext = `_user_${appManager.user.username}_${this._aux.tree.site.id}_inventory`;
    if (!userFile) {
      await this.createFile(this._appManager.user.id, {
        [userContext]: true,
        ['aux.builder.context']: userContext,
        _user: this._appManager.user.username,
        _userInventoryContext: userInventoryContext,
        _mode: DEFAULT_USER_MODE,
      });
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