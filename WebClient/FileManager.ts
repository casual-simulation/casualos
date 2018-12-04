
import * as uuid from 'uuid/v4';
import {SubscriptionLike, Observable, from} from 'rxjs';
import {
  filter,
  map,
  shareReplay,
  merge as mergeObservables,
} from 'rxjs/operators';

import {
  flatMap,
  sortBy,
  keys,
  values,
  merge,
  uniq,
  findIndex,
} from 'lodash';

import {AppManager, appManager} from './AppManager';
import {socketManager} from './SocketManager';
import {
  fileAdded, 
  fileRemoved, 
  fileUpdated, 
  File, 
  Object, 
  Workspace,
  FileAddedEvent,
  FileRemovedEvent,
  FileUpdatedEvent,
  PartialFile,
} from 'common/FilesChannel';


/**
 * Defines a class that interfaces with the AppManager and SocketManager
 * to reactively edit files.
 */
export class FileManager {
  private _appManager: AppManager;
  private _files: File[];
  private _status: string;
  private _initPromise: Promise<void>;
  private _fileDiscoveredObservable: Observable<File>;
  private _fileRemovedObservable: Observable<string>;
  private _fileUpdatedObservable: Observable<File>;

  // TODO: Dispose of the subscription
  private _sub: SubscriptionLike;

  get files(): File[] {
    return values(socketManager.state);
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
   * That is, it was deleted from the working directory either by checking out a branch that
   * does not contain the file or by deleting it.
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

  get status(): string {
    return this._status;
  }

  constructor(app: AppManager) {
    this._appManager = app;
    this._files = [];
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
   */
  fileTags(files: File[]) {
    return uniq(flatMap(files, f => {
      if(f.type === 'object') {
        return keys(f.tags);
      }
      return [];
    }));
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: File, newData: PartialFile) {
    socketManager.emit(fileUpdated(file.id, newData));
  }

  async createFile() {
    console.log('[FileManager] Create File');

    const file: Object = {
      id: uuid(),
      type: 'object',
      position: {
        x: 0,
        y: 0
      },
      workspace: null,
      tags: {}
    };

    socketManager.emit(fileAdded(file));
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = {
      id: uuid(),
      type: 'workspace',
      position: {
        x: 0,
        y: 0,
        z: 0
      },
    };

    socketManager.emit(fileAdded(workspace));
  }

  private async _init() {
    this._setStatus("Starting...");

    this._sub = socketManager.events.subscribe(event => {
      if(event.type === 'file_added') {
        this._fileDiscovered(event);
      } else if(event.type === 'file_removed') {
        this._fileRemoved(event);
      }
    });

    // Replay the existing files for the components that need it this way
    const state = socketManager.state;
    const files = values(state);
    const ordered = sortBy(files, f => f.type === 'object');
    const newlyDiscovered = from(ordered);

    this._fileDiscoveredObservable = socketManager.events.pipe(
      filter(event => event.type === 'file_added'),
      map((event: FileAddedEvent) => event.file),
      mergeObservables(newlyDiscovered),
      shareReplay()
    );

    this._fileRemovedObservable = socketManager.events.pipe(
      filter(event => event.type === 'file_removed'),
      map((event: FileRemovedEvent) => event.id),
      shareReplay()
    );

    this._fileUpdatedObservable = socketManager.events.pipe(
      filter(event => event.type === 'file_updated'),
      map((event: FileUpdatedEvent) => socketManager.state[event.id])
    );

    this._setStatus("Initialized.");
  }

  // private _updateFiles(currentFiles: File[]) {

  //   let newFiles: File[] = [];
  //   let removedFiles: File[] = [];

  //   let old: {
  //     [id: string]: File
  //   } = {};
  //   this._files.forEach(f => {
  //     old[f.id] = f;
  //   });

  //   let current: {
  //     [id: string]: File
  //   } = {};

  //   currentFiles.forEach(f => {
  //     current[f.id] = f;
  //     if(!old[f.id]) {
  //       newFiles.push(f);
  //     }
  //   });

  //   this._files.forEach(f => {
  //     if(!current[f.id]) {
  //       removedFiles.push(f);
  //     }
  //   });
    
  //   newFiles = sortBy(newFiles, f => f.data.type === 'file');
  //   removedFiles = sortBy(removedFiles, f => f.data.type === 'file');

  //   newFiles.forEach(file => {
  //     this._appManager.events.next(fileDiscovered(file));
  //   });

  //   removedFiles.forEach(file => {
  //     this._appManager.events.next(fileRemoved(file));
  //   });

  //   currentFiles.forEach(file => {
  //     if (old[file.id]) {
  //       console.log(`Updating file: '${file.id}'...`);
  //       // Only notify of files that weren't added or removed.
  //       this._appManager.events.next(fileUpdated(file));
  //     }
  //   })
  // }

  private async _fileDiscovered(event: FileAddedEvent) {
    this._files.push(event.file);
    this._files = sortBy(this._files, f => f.id);
  }

  private _fileRemoved(event: FileRemovedEvent) {
    const index = findIndex(this._files, f => f.id === event.id);
    if(index >= 0) {
      this._files.splice(index, 1);
    }
  }

  // private async _commitAdded(event: CommitAddedEvent) {
  //   this._setStatus(`Commit ${event.hash} added on ${event.branch}.`);
  //   if (!this.canSave) {
  //     await this.pull();
  //   }
  // }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}

export const fileManager = new FileManager(appManager);