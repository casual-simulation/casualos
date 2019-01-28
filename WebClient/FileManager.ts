
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
} from 'common/Files';
import { 
  filterFilesBySelection, 
  createWorkspace, 
  FileCalculationContext,
  selectionIdForUser,
  updateFile,
  createCalculationContext,
  updateUserSelection,
  toggleFileSelection,
  calculateFormattedFileValue,
  createFile
} from 'common/Files/FileCalculations';
import {ChannelConnection} from 'common/channels-core';
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
  skip
} from 'rxjs/operators';
import * as Sentry from '@sentry/browser';
import uuid from 'uuid/v4';

import {AppManager, appManager} from './AppManager';
import {SocketManager} from './SocketManager';
import { SentryError } from '@sentry/core';

export interface SelectedFilesUpdatedEvent { files: Object[]; }

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

  private _subscriptions: SubscriptionLike[];
  private _status: string;
  private _initPromise: Promise<string>;
  private _fileDiscoveredObservable: ReplaySubject<File>;
  private _fileRemovedObservable: ReplaySubject<string>;
  private _fileUpdatedObservable: Subject<File>;
  private _selectedFilesUpdated: BehaviorSubject<SelectedFilesUpdatedEvent>;
  private _files: ChannelConnection<FilesState>;
  private _reconnectedObservable: Subject<MergedObject<FilesState>>;
  private _resyncedObservable: Subject<boolean>;
  private _syncFailedObservable: Subject<MergeStatus<FilesState>>;
  private _disconnectedObservable: Subject<FilesState>;
  private _mergeStatus: MergeStatus<FilesState> = null;
  private _id: string;

  get files(): File[] {
    return values(this._filesState);
  }

  /**
   * Gets all the files that represent an object.
   */
  get objects(): Object[] {
    return <any[]>this.files.filter(f => f.type === 'object' && !f.tags._destroyed);
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
  get fileDiscovered(): Observable<File> {
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
  get fileUpdated(): Observable<File> {
    return this._fileUpdatedObservable;
  }

  get selectedFilesUpdated(): Observable<SelectedFilesUpdatedEvent> {
    return this._selectedFilesUpdated;
  }

  get status(): string {
    return this._status;
  }

  get userFile(): Object {
    if (!this._appManager.user) {
      return;
    }
    var objs = this.objects.filter(o => o.id === this._appManager.user.username);
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
    return ['online', 'online-disconnected'].indexOf(this._files.state) >= 0;
  }

  /**
   * Gets whether the app is synced to the server.
   */
  get isSynced(): boolean {
    return this._files.state === 'online';
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

  private get _filesState() {
    return this._files.store.state();
  }

  constructor(app: AppManager, socket: SocketManager) {
    this._appManager = app;
    this._socketManager = socket;
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
  selectedFilesForUser(user: Object) {
    return filterFilesBySelection(this.objects, user.tags._selection);
  }

  /**
   * Selects the given file for the current user.
   * @param file The file to select.
   */
  selectFile(file: Object) {
    this._selectFileForUser(file, this.userFile);
  }

  /**
   * Clears the selection for the current user.
   */
  clearSelection() {
    this._clearSelectionForUser(this.userFile);
  }

  /**
   * Calculates the nicely formatted value for the given file and tag.
   * @param file The file to calculate the value for.
   * @param tag The tag to calculate the value for.
   */
  calculateFormattedFileValue(file: Object, tag: string): string {
    return calculateFormattedFileValue(this._createContext(), file, tag);
  }

  /**
   * Removes the given file.
   * @param file The file to remove.
   */
  async removeFile(file: File) {
    console.log('[FileManager] Remove File', file.id);
    this._files.emit(fileRemoved(file.id));
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: File, newData: PartialFile) {
    updateFile(file, newData, () => this._createContext());
    this._files.emit(fileUpdated(file.id, newData));
  }

  async createFile(id?: string, tags?: Object['tags']) {
    console.log('[FileManager] Create File');

    this._files.emit(fileAdded(createFile(id, tags)));
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = createWorkspace();

    this._files.emit(fileAdded(workspace));
  }

  async action(sender: File, receiver: File, eventName: string) {
    console.log('[FileManager] Run event:', eventName, 'on files:', sender, receiver);

    // Calculate the events on a single client and then run them in a transaction to make sure the order is right.
    const actionData = action(sender.id, receiver.id, eventName);
    const events = calculateActionEvents(this._files.store.state(), actionData);
    this._files.emit(transaction(events));
  }

  // TODO: This seems like a pretty dangerous function to keep around,
  // but we'll add a config option to prevent this from happening on real sites.
  deleteEverything() {
    console.warn('[FileManager] Delete Everything!');
    const deleteOps = this.files.map(f => fileRemoved(f.id));
    this._files.emit(transaction(deleteOps));
    setTimeout(() => {
      appManager.logout();
      location.reload();
    }, 200);
  }

  /**
   * Resolves the given conflicts into the current merge status.
   * @param resolved 
   */
  resolveConflicts(resolved: ResolvedConflict[]) {
    if (this._mergeStatus &&  this._mergeStatus.remainingConflicts.length > 0) {
      const result = resolveConflicts(this._mergeStatus.merge, resolved);
      if (result.success) {
        this._publishMergeResults(result);
      } else {
        this._mergeStatus = {
          merge: result,
          remainingConflicts: difference(this._mergeStatus.remainingConflicts, resolved.map(r => r.details)),
          resolvedConflicts: [...this._mergeStatus.resolvedConflicts, ...resolved]
        };
      }
    }
  }

  /**
   * Reports the merge results to the server.
   * This will update the server state to match the state that was determined from the merge result.
   * Upon becomming reconnected to the server, this function MUST be called in order for the user's local changes
   * to be synced to the server and for their future changes to be pushed to the server.
   * @param results The merge results.
   */
  private _publishMergeResults(results: MergedObject<FilesState>) {
    this._setStatus('Merged and reconnected!');
    this._mergeStatus = null;
    const didReSync = results.final;
    this._offlineServerState = null;
    if (results.final) {
      const event = addState(results.final);
      this._files.reconnect();
      this._files.emit(event);
    } else {
      this._files.reconnect();
    }
    this._resyncedObservable.next(didReSync);
  }

  /**
   * Clears the selection that the given user has.
   * @param user The file for the user to clear the selection of.
   */
  private _clearSelectionForUser(user: Object) {
    console.log('[FileManager] Clear selection for', user.id);
    const update = updateUserSelection(null);
    this.updateFile(user, update);
  }

  private _selectFileForUser(file: Object, user: Object) {
    console.log('[FileManager] Select File:', file.id);
    
    const {id, newId} = selectionIdForUser(user);
    if (newId) {
      const update = updateUserSelection(newId);
      this.updateFile(user, update);
    }
    if (id) {
      const update = toggleFileSelection(file, id);
      this.updateFile(file, update);
    }
  }

  private _createContext(): FileCalculationContext {
    return createCalculationContext(this.objects);
  }

  private async _init(id: string) {
    this._setStatus('Starting...');

    this._id = id;

    this._subscriptions = [];
    this._fileDiscoveredObservable = new ReplaySubject<File>();
    this._fileRemovedObservable = new ReplaySubject<string>();
    this._fileUpdatedObservable = new Subject<File>();
    this._selectedFilesUpdated =
        new BehaviorSubject<SelectedFilesUpdatedEvent>({files: []});
    this._disconnectedObservable = new Subject<FilesState>();
    this._reconnectedObservable = new Subject<MergedObject<FilesState>>();
    this._resyncedObservable = new Subject<boolean>();
    this._syncFailedObservable = new Subject<MergeStatus<FilesState>>();
    this._files = await this._socketManager.getFilesChannel(this._id);

    this._setupOffline();
    await this._initUserFile();

    // Replay the existing files for the components that need it this way
    const filesState = this._files.store.state();
    const existingFiles = values(filesState);
    const orderedFiles = sortBy(existingFiles, f => f.type === 'object');
    const existingFilesObservable = from(orderedFiles);

    const { fileAdded, fileRemoved, fileUpdated } = fileChangeObservables(this._files);

    const allFilesAdded = mergeObservables(fileAdded, existingFilesObservable);

    this._subscriptions.push(allFilesAdded.subscribe(this._fileDiscoveredObservable));
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
        _workspace: null
      });
    }
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }

  private get _offlineServerState(): FilesState {
    const json = localStorage.getItem(`offline_server_state_${this._id}`);
    if (json) {
      return JSON.parse(json);
    } else {
      return null;
    }
  }

  private set _offlineServerState(state: FilesState) {
    if (state !== null && typeof state !== 'undefined') {
      localStorage.setItem(`offline_server_state_${this._id}`, JSON.stringify(state));
    } else {
      localStorage.setItem(`offline_server_state_${this._id}`, null);
    }
  }

  private _setupOffline() {
    this._subscriptions.push(this._files.connectionStates.subscribe(async state => {
      try {
        if (state.mode === 'offline') {
          this._disconnected(state.lastKnownServerState);
        } else if(state.mode === 'online-disconnected') {
          await this._reconnected(state.lastKnownServerState);
        }
      } catch(ex) {
        Sentry.captureException(ex);
        console.error(ex);
      }
    }));
  }

  private async _reconnected(state: FilesState) {
    Sentry.addBreadcrumb({
      message: 'Reconnected to server',
      category: 'net',
      level: Sentry.Severity.Warning,
      type: 'default'
    });
    this._setStatus('Reconnected!');

    // get the old server state
    const offline = this._offlineServerState;
    const newState = state;
    const localState = this._filesState;

    const mergeReport = mergeFiles(offline, localState, newState, {
      
    });

    this._reconnectedObservable.next(mergeReport);

    if (mergeReport.success) {
      console.log('[FileManager] Merge success!');
      this._publishMergeResults(mergeReport);
    } else {
      const { fixed, notFixable, automaticallyFixed } = await this._resolveConflicts(mergeReport);

      if (notFixable.length > 0) {
          console.log('[App] Merge has conflicts that are not automatically fixable!');
          this._mergeStatus = {
            merge: automaticallyFixed,
            remainingConflicts: notFixable,
            resolvedConflicts: fixed
          };

          this._syncFailedObservable.next(this._mergeStatus);
      } else {
          this._publishMergeResults(automaticallyFixed);
      }
    }
  }

  private _disconnected(state: FilesState) {
    Sentry.addBreadcrumb({
      message: 'Disconnected from server',
      category: 'net',
      level: Sentry.Severity.Warning,
      type: 'default'
    });
    this._setStatus('Disconnected :(');
    
    // only save if we have resolved any previous merge conflicts
    if (!this._offlineServerState) {
      // save the current state to persistent storage
      this._offlineServerState = state;
    }
    this._disconnectedObservable.next(state);
  }

  private async _resolveConflicts(merge: MergedObject<FilesState>) {
      console.error('[App] Merge Failed! Conflicts:', merge.conflicts);
      const conflicts = listMergeConflicts(merge);

      return await this._fixAutomaticConflicts(conflicts, merge);
  }

  private async _fixAutomaticConflicts(conflicts: ConflictDetails[], merge: MergedObject<FilesState>) {
      // TODO: This is probably a stupid idea, but might actually be worth it
      // to cut down on how many conflicts a user sees.
      const automaticallyFixable = conflicts.map(details => {
        let value;
        let fixable = false;
        if (some(details.path, p => p === '_position')) {
          fixable = true;
          value = details.conflict[second]; // Take the server path for new _position data
        }

        return {
          fixable: fixable,
          details: details,
          value: value
        };
      }).filter(r => r.fixable);

      const notFixable = difference(conflicts, automaticallyFixable.map(f => f.details));
      const automaticallyFixed = await resolveConflicts(merge, automaticallyFixable);

      return {
          fixed: automaticallyFixable,
          notFixable,
          automaticallyFixed
      };
  }

  public dispose() {
    this._setStatus('Dispose');
    this._initPromise = null;
    this._subscriptions.forEach(s => s.unsubscribe());
  }
}