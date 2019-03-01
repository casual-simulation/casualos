
import {
  File, 
  fileAdded, 
  FileAddedEvent, 
  FileEvent, 
  FileRemovedEvent, 
  FilesState, 
  fileUpdated, 
  FileUpdatedEvent, 
  Object, 
  PartialFile, 
  Workspace,
  action,
  calculateStateDiff,
  fileChangeObservables,
  calculateActionEvents,
  transaction,
  mergeFiles,
  applyMerge,
  FileTransactionEvent,
  fileRemoved,
  objDiff,
  addState,
  first,
  MergedObject,
  listMergeConflicts,
  ConflictDetails,
  resolveConflicts,
  second,
  ResolvedConflict,
  DEFAULT_USER_MODE,
  DEFAULT_SCENE_BACKGROUND_COLOR,
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
  isDestroyed,
  getActiveObjects,
  ChannelConnection,
  AuxCausalTree,
  AuxFile,
  AuxObject
} from '@yeti-cgi/aux-common';
import {
  findIndex, 
  flatMap, 
  intersection, 
  keys, 
  mapValues,
  merge, 
  sortBy, 
  union, 
  uniq, 
  values,
  difference,
  some,
  assign
} from 'lodash';
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
  shareReplay, 
  scan, 
  pairwise,
  flatMap as rxFlatMap,
  skip,
  startWith,
  first as rxFirst
} from 'rxjs/operators';
import * as Sentry from '@sentry/browser';
import uuid from 'uuid/v4';

import {AppManager, appManager} from './AppManager';
import {SocketManager} from './SocketManager';
import { SentryError } from '@sentry/core';
import { CausalTreeManager } from './causal-trees/CausalTreeManager';
import { RealtimeCausalTree } from '@yeti-cgi/aux-common/causal-trees';

export interface SelectedFilesUpdatedEvent { 
    files: AuxObject[];
}

/**
 * Defines an interface for an object that tracks the status of a merge.
 * Contains the current state, what conflcits have been resolved, and what conflicts are remaining.
 */
export interface MergeStatus<T> {
  merge: MergedObject<T>;
  resolvedConflicts: ResolvedConflict[];
  remainingConflicts: ConflictDetails[];
}

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager {
  private _appManager: AppManager;
  private _socketManager: SocketManager;
  private _treeManager: CausalTreeManager;

  private _subscriptions: SubscriptionLike[];
  private _status: string;
  private _initPromise: Promise<string>;
  private _fileDiscoveredObservable: ReplaySubject<AuxFile>;
  private _fileRemovedObservable: ReplaySubject<string>;
  private _fileUpdatedObservable: Subject<AuxFile>;
  private _selectedFilesUpdated: BehaviorSubject<SelectedFilesUpdatedEvent>;
  private _reconnectedObservable: Subject<MergedObject<FilesState>>;
  private _resyncedObservable: Subject<boolean>;
  private _syncFailedObservable: Subject<MergeStatus<FilesState>>;
  private _disconnectedObservable: Subject<FilesState>;
  private _mergeStatus: MergeStatus<FilesState> = null;
  private _id: string;
  private _aux: RealtimeCausalTree<AuxCausalTree>;

  private get _allFiles(): File[] {
    return values(this.filesState);
  }

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
  get fileDiscovered(): Observable<AuxFile> {
    return this._fileDiscoveredObservable;
  }

  /**
   * Gets an observable that resolves whenever a file is removed.
   * That is, it was deleted from the working directory either by checking out a
   * branch that does not contain the file or by deleting it.
   */
  get fileRemoved(): Observable<string> {
    return this._fileRemovedObservable;
  }

  /**
   * Gets an observable that resolves whenever a file is updated.
   */
  get fileUpdated(): Observable<AuxFile> {
    return this._fileUpdatedObservable;
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
    var objs = this.objects.filter(o => o.id === this._appManager.user.username);
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
   * Gets the observable that resolves when the browser becomes disconnected from
   * the server.
   */
  get disconnected(): Observable<FilesState> {
    return this._disconnectedObservable;
  }

  /**
   * Gets the observable that resolves when the browser becomes reconnected to the server.
   * Contains the merge report that attempts to sync the remote state with the local state.
   * Note that being reconnected to the server does not mean that we are synced with the server.
   * It only means that we have the capability to communicate with the server.
   */
  get reconnected(): Observable<MergedObject<FilesState>> {
    return this._reconnectedObservable;
  }

  /**
   * Gets the observable that resolves when the app has reconnected to the server but is unable to
   * resolve all the merge conflicts automatically. Contains the current merge state along with what conflicts are remaining and what needs to be done.
   */
  get syncFailed(): Observable<MergeStatus<FilesState>> {
    return this._syncFailedObservable;
  }

  /**
   * Gets the observable that resolves when the app becomes synced with the server after
   * being disconnected. This means that our state is up to date with the server.
   * 
   * Resolves with whether the sync required a merge or if the local data was already up-to-date.
   */
  get resynced(): Observable<boolean> {
    return this._resyncedObservable;
  }

  /**
   * Gets the current merge status.
   * Null if no merge conflicts exist.
   */
  get mergeStatus(): MergeStatus<FilesState> {
    return this._mergeStatus;
  }

  /**
   * Gets the current local file state.
   */
  get filesState() {
    return this._aux.tree.value;
  }

  constructor(app: AppManager, treeManager: CausalTreeManager) {
    this._appManager = app;
    this._treeManager = treeManager;
  }

  /**
   * Initializes the file manager to connect to the session with the given ID.
   * @param id The ID of the session to connect to.
   */
  init(id: string): Promise<string> {
    if (this._initPromise) {
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
  selectFile(file: AuxObject) {
    this._selectFileForUser(file, this.userFile);
  }

  /**
   * Clears the selection for the current user.
   */
  clearSelection() {
    this._clearSelectionForUser(this.userFile);
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
        this._aux.tree.delete(file.metadata.ref.atom);
    } else {
        console.warn('[FileManager] Tree is not loaded yet. Invalid Operation!');
    }
    // this._files.emit(fileRemoved(file.id));
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: AuxFile, newData: PartialFile) {
    updateFile(file, this.userFile.id, newData, () => this.createContext());

    this._aux.tree.updateFile(file, newData);
  }

  async createFile(id?: string, tags?: Object['tags']) {
    console.log('[FileManager] Create File');

    const file = createFile(id, tags);
    this._aux.tree.addFile(file);
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = createWorkspace();
    this._aux.tree.addFile(workspace);
  }

  async action(sender: File, receiver: File, eventName: string) {
    console.log('[FileManager] Run event:', eventName, 'on files:', sender, receiver);

    // Calculate the events on a single client and then run them in a transaction to make sure the order is right.
    const actionData = action(sender.id, receiver.id, eventName);
    const result = calculateActionEvents(this._aux.tree.value, actionData);

    this._aux.tree.addEvents(result.events);
  }

  transaction(...events: FileEvent[]) {
    this._aux.tree.addEvents(events);
  }

  /**
   * Adds the given state to the session.
   * @param state The state to add.
   */
  addState(state: FilesState) {
      this._aux.tree.addEvents([addState(state)]);
  }

  // TODO: This seems like a pretty dangerous function to keep around,
  // but we'll add a config option to prevent this from happening on real sites.
  deleteEverything() {
    console.warn('[FileManager] Delete Everything!');
    // const deleteOps = this._allFiles.map(f => fileRemoved(f.id));
    // this._files.emit(transaction(deleteOps));
    setTimeout(() => {
      appManager.logout();
      location.reload();
    }, 200);
  }

  /**
   * Creates an observable that resolves whenever the given file changes.
   * @param file The file to watch.
   */
  fileChanged(file: File): Observable<File> {
    return this.fileUpdated.pipe(
      filter(f => f.id === file.id),
      startWith(file)
    );
  }

  /**
   * Clears the selection that the given user has.
   * @param user The file for the user to clear the selection of.
   */
  private _clearSelectionForUser(user: AuxObject) {
    console.log('[FileManager] Clear selection for', user.id);
    const update = updateUserSelection(null, null);
    this.updateFile(user, update);
  }

  private _selectFileForUser(file: AuxObject, user: AuxObject) {
    console.log('[FileManager] Select File:', file.id);
    
    const {id, newId} = selectionIdForUser(user);
    if (newId) {
      const update = updateUserSelection(newId, file.id);
      this.updateFile(user, update);
    }
    if (id) {
      const update = toggleFileSelection(file, id, user.id);
      this.updateFile(file, update);
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

  private async _init(id: string) {
    this._setStatus('Starting...');

    this._id = id ? `aux-${id}` : 'aux-default';

    this._subscriptions = [];
    this._fileDiscoveredObservable = new ReplaySubject<AuxFile>();
    this._fileRemovedObservable = new ReplaySubject<string>();
    this._fileUpdatedObservable = new Subject<AuxFile>();
    this._selectedFilesUpdated =
        new BehaviorSubject<SelectedFilesUpdatedEvent>({files: []});
    this._disconnectedObservable = new Subject<FilesState>();
    this._reconnectedObservable = new Subject<MergedObject<FilesState>>();
    this._resyncedObservable = new Subject<boolean>();
    this._syncFailedObservable = new Subject<MergeStatus<FilesState>>();
    
    await this._treeManager.init();

    this._aux = await this._treeManager.getTree<AuxCausalTree>({
        id: this._id,
        type: 'aux'
    });
    this._subscriptions.push(this._aux.onError.subscribe(err => console.error(err)));

    await this._aux.init();
    await this._aux.onUpdated.pipe(rxFirst()).toPromise();

    await this._initUserFile();
    await this._initGlobalsFile();

    const { fileAdded, fileRemoved, fileUpdated } = fileChangeObservables(this._aux);

    this._subscriptions.push(fileAdded.subscribe(this._fileDiscoveredObservable));
    this._subscriptions.push(fileRemoved.subscribe(this._fileRemovedObservable));
    this._subscriptions.push(fileUpdated.subscribe(this._fileUpdatedObservable));
    const alreadySelected = this.selectedObjects;
    const alreadySelectedObservable = from(alreadySelected);

    const allFilesSelected = alreadySelectedObservable;

    const allFilesSelectedUpdatedAddedAndRemoved = mergeObservables(
        allFilesSelected, 
        fileAdded.pipe(map(f => f.id)),
        fileUpdated.pipe(map(f => f.id)), 
        fileRemoved);

    const allSelectedFilesUpdated =
        allFilesSelectedUpdatedAddedAndRemoved.pipe(map(file => {
          const selectedFiles = this.selectedObjects;
          return {files: selectedFiles};
        }));

    this._subscriptions.push(allSelectedFilesUpdated.subscribe(this._selectedFilesUpdated));

    this._setStatus('Initialized.');

    return this._id;
  }

  private async _initUserFile() {
    this._setStatus('Updating user file...');
    let userFile = this.userFile;
    if (!userFile) {
      await this.createFile(this._appManager.user.username, {
        _hidden: true,
        _user: this._appManager.user.username,
        _position: { x: 0, y: 0, z: 0},
        _mode: DEFAULT_USER_MODE,
        _workspace: null
      });
    }
  }

  private async _initGlobalsFile() {
    this._setStatus('Updating globals file...');
    let globalsFile = this.globalsFile;
    if (!globalsFile) {
      await this.createFile('globals', {
        _hidden: true,
        _workspace: null,
        _position: { x:0, y: 0, z: 0}
      });
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