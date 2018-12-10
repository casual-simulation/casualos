
import {
  File, 
  fileAdded, 
  FileAddedEvent, 
  FileEvent, 
  fileRemoved, 
  FileRemovedEvent, 
  FilesState, 
  fileUpdated, 
  FileUpdatedEvent, 
  Object, 
  PartialFile, 
  Workspace
} from 'common';
import {ChannelConnection} from 'common/channels-core';
import {
  findIndex, 
  flatMap, 
  intersection, 
  keys, 
  merge, 
  sortBy, 
  union, 
  uniq, 
  values,
  difference
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
import {filter, map, shareReplay,} from 'rxjs/operators';
import * as uuid from 'uuid/v4';

import {AppManager, appManager} from './AppManager';
import {SocketManager} from './SocketManager';

export interface SelectedFilesUpdatedEvent { files: File[]; }

/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager {
  private _appManager: AppManager;
  private _socketManager: SocketManager;

  private _status: string;
  private _initPromise: Promise<void>;
  private _fileDiscoveredObservable: ReplaySubject<File>;
  private _fileRemovedObservable: ReplaySubject<string>;
  private _fileUpdatedObservable: Subject<File>;
  private _selectedFilesUpdated: BehaviorSubject<SelectedFilesUpdatedEvent>;
  private _files: ChannelConnection<FilesState>;

  // TODO: Dispose of the subscription
  private _sub: SubscriptionLike;

  get files(): File[] {
    return values(this._filesState);
  }


  /**
   * Gets all the files that represent an object.
   */
  get objects(): Object[] {
    return <any[]>this.files.filter(f => f.type === 'object');
  }

  /**
   * Gets all the selected files that represent an object.
   */
  get selectedObjects(): File[] {
    return this.objects.filter(
        f => f.tags._selected && f.tags._selected[this._appManager.user.username]);
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

  private get _filesState() {
    return this._files.store.state();
  }

  constructor(app: AppManager, socket: SocketManager) {
    this._appManager = app;
    this._socketManager = socket;

    this._fileDiscoveredObservable = new ReplaySubject<File>();
    this._fileRemovedObservable = new ReplaySubject<string>();
    this._fileUpdatedObservable = new Subject<File>();
    this._selectedFilesUpdated =
        new BehaviorSubject<SelectedFilesUpdatedEvent>({files: []});
  }

  init(): Promise<void> {
    if (this._initPromise) {
      return this._initPromise;
    } else {
      return this._initPromise = this._init();
    }
  }

  /**
   * Gets a list of tags that the given files contain.
   *
   * @param files The array of files that the list of tags should be retrieved
   * for.
   * @param currentTags The current array of tags that is being displayed.
   *                    The new list will try to preserve the order of the tags
   * in this list.
   * @param extraTags The list of tags that should not be removed from the
   * output list.
   */
  fileTags(files: File[], currentTags: string[], extraTags: string[], hiddenTags: string[]) {
    const fileTags = flatMap(files, f => {
      if (f.type === 'object') {
        return keys(f.tags);
      }
      return [];
    });
    const tagsToKeep = union(fileTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);
    const onlyTagsToKeep = difference(intersection(allTags, tagsToKeep), hiddenTags);

    return onlyTagsToKeep;
  }

  selectFile(file: Object) {
    console.log('[FileManager] Select File:', file.id);
    this.updateFile(file, {
      tags: {
          _selected: {
              [this._appManager.user.username]: !(file.tags._selected && file.tags._selected[this._appManager.user.username])
          }
      }
    });
  }

  clearSelection() {
    console.log('[FileManager] Clear selection.');
    this.selectedObjects.forEach(file => {
      this.updateFile(file, {
        tags: {
            _selected: {
                [this._appManager.user.username]: false
            }
        }
      });
    });
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: File, newData: PartialFile) {
    if (newData.tags) {
      for (let property in newData.tags) {
        let value = newData.tags[property];
        if (!value) {
          newData.tags[property] = null;
        }
      }
    }

    this._files.emit(fileUpdated(file.id, newData));
  }

  async createFile() {
    console.log('[FileManager] Create File');

    const file: Object =
        {id: uuid(), type: 'object', position: null, workspace: null, tags: {}};

    this._files.emit(fileAdded(file));
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = {
      id: uuid(),
      type: 'workspace',
      position: {x: 0, y: 0, z: 0},
    };

    this._files.emit(fileAdded(workspace));
  }

  private async _init() {
    this._setStatus('Starting...');

    this._files = await this._socketManager.getFilesChannel();

    // Replay the existing files for the components that need it this way
    const filesState = this._files.store.state();
    const existingFiles = values(filesState);
    const orderedFiles = sortBy(existingFiles, f => f.type === 'object');
    const existingFilesObservable = from(orderedFiles);

    const fileAdded = this._files.events.pipe(
        filter(event => event.type === 'file_added'),
        map((event: FileAddedEvent) => event.file));

    const allFilesAdded = mergeObservables(fileAdded, existingFilesObservable);

    const fileRemoved = this._files.events.pipe(
        filter(event => event.type === 'file_removed'),
        map((event: FileRemovedEvent) => event.id));

    const fileUpdated = this._files.events.pipe(
        filter(event => event.type === 'file_updated'),
        map((event: FileUpdatedEvent) => this._filesState[event.id]));

    allFilesAdded.subscribe(this._fileDiscoveredObservable);
    fileRemoved.subscribe(this._fileRemovedObservable);
    fileUpdated.subscribe(this._fileUpdatedObservable);
    const alreadySelected = this.selectedObjects;
    const alreadySelectedObservable = from(alreadySelected);

    const allFilesSelected = mergeObservables(fileUpdated, alreadySelectedObservable);

    const allFilesSelectedUpdatedAddedAndRemoved = mergeObservables(
        allFilesSelected, fileAdded.pipe(map(f => f.id)),
        fileUpdated.pipe(map(f => f.id)), fileRemoved);

    const allSelectedFilesUpdated =
        allFilesSelectedUpdatedAddedAndRemoved.pipe(map(file => {
          const selectedFiles = this.selectedObjects;
          return {files: selectedFiles};
        }));

    allSelectedFilesUpdated.subscribe(this._selectedFilesUpdated);

    this._setStatus('Initialized.');
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}