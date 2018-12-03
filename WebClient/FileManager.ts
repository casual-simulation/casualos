
import {SubscriptionLike, Observable} from 'rxjs';
import {
  filter,
  map,
  shareReplay,
} from 'rxjs/operators';

import {
  flatMap,
  sortBy,
  keys,
  merge,
  uniq,
} from 'lodash';

import {AppManager, appManager} from './AppManager';
import { 
  FileDiscoveredEvent,
  CommitAddedEvent,
  fileDiscovered,
  FileRemovedEvent,
  fileRemoved,
  fileUpdated
} from './Core/Event';
import {GitManager, gitManager} from './GitManager';
import {File, PartialData} from './Core/File';
import {FileData} from './Core/FileData';

/**
 * Defines a class that interfaces with the AppManager and GitManager
 * to reactively edit files.
 */
export class FileManager {
  private _gitManager: GitManager;
  private _appManager: AppManager;
  private _files: File[];
  private _status: string;
  private _initPromise: Promise<void>;
  private _fileDiscoveredObservable: Observable<File>;
  private _fileRemovedObservable: Observable<File>;
  private _fileUpdatedObservable: Observable<File>;

  // TODO: Dispose of the subscription
  private _sub: SubscriptionLike;

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
  get fileRemoved(): Observable<File> {
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

  constructor(app: AppManager, git: GitManager) {
    this._appManager = app;
    this._gitManager = git;
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
      if(f.data.type === 'file') {
        const data: FileData = <FileData>f.data;
        return keys(data.tags);
      }
      return [];
    }));
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: File, newData: PartialData) {
    file.data = merge({}, file.data, newData);
    // await this._gitManager.saveFile(file);
    this._appManager.events.next(fileUpdated(file));
  }

  /**
   * Updates the local files with files from the server.
   */
  async pull() {
    await this.init();

    // this._setStatus('Checking for project...');
    // if(!(await gitManager.isProjectCloned())) {
    //     this._setStatus('Cloning project...');
    //     await gitManager.cloneProject();
    // } else {
    //     this._setStatus('Updating project...');
    //     await gitManager.updateProject();
    // }

    // this._setStatus("Grabbing files...");
    // const currentFiles = await this._gitManager.listFiles();
    // this._updateFiles(currentFiles);
    
    this._setStatus('Waiting for input...');
  }

  /**
   * Gets whether the files can be saved.
   */
  get canSave(): boolean {
    // return gitManager.canCommit();
    return false;
  }

  /**
   * Saves the changes that the local user has made.
   */
  async save() {
    await this.init();

    // this._setStatus('Saving files...');
    // await Promise.all(this._files.map(file => {
    //   return gitManager.saveFile(file);
    // }));

    
    // if(await gitManager.canCommit()) {
    //   await gitManager.commit("Save files");
    //   await gitManager.pushIfNeeded(gitManager.localUserBranch);
    // } else {
    //   this._setStatus('No changes. Commit & push skipped.');
    // }
  }

  async createFile() {
    console.log('[FileManager] Create File');

    const file = this._gitManager.createNewFile();
    // await this._gitManager.saveFile(file);

    this._appManager.events.next(fileDiscovered(file));
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const file = this._gitManager.createNewWorkspace();
    // await this._gitManager.saveFile(file);

    this._appManager.events.next(fileDiscovered(file));
  }

  private async _init() {
    this._setStatus("Starting...");

    this._sub = this._appManager.events.subscribe(event => {
      if(event.type === 'file_discovered') {
        this._fileDiscovered(event);
      } else if(event.type === 'file_removed') {
        this._fileRemoved(event);
      } else if(event.type === 'commit_added') {
        this._commitAdded(event);
      }
    });

    this._fileDiscoveredObservable = this._appManager.events.pipe(
      filter(event => event.type === 'file_discovered'),
      map((event: FileDiscoveredEvent) => event.file),
      shareReplay()
    );

    this._fileRemovedObservable = this._appManager.events.pipe(
      filter(event => event.type === 'file_removed'),
      map((event: FileRemovedEvent) => event.file),
      shareReplay()
    );

    this._fileUpdatedObservable = this._appManager.events.pipe(
      filter(event => event.type === 'file_updated'),
      map((event: FileRemovedEvent) => event.file)
    );

    // await gitManager.startIfNeeded();

    this._setStatus("Initialized.");
  }

  private _updateFiles(currentFiles: File[]) {

    let newFiles: File[] = [];
    let removedFiles: File[] = [];

    let old: {
      [id: string]: File
    } = {};
    this._files.forEach(f => {
      old[f.id] = f;
    });

    let current: {
      [id: string]: File
    } = {};

    currentFiles.forEach(f => {
      current[f.id] = f;
      if(!old[f.id]) {
        newFiles.push(f);
      }
    });

    this._files.forEach(f => {
      if(!current[f.id]) {
        removedFiles.push(f);
      }
    });
    
    newFiles = sortBy(newFiles, f => f.data.type === 'file');
    removedFiles = sortBy(removedFiles, f => f.data.type === 'file');

    newFiles.forEach(file => {
      this._appManager.events.next(fileDiscovered(file));
    });

    removedFiles.forEach(file => {
      this._appManager.events.next(fileRemoved(file));
    });

    currentFiles.forEach(file => {
      if (old[file.id]) {
        console.log(`Updating file: '${file.id}'...`);
        // Only notify of files that weren't added or removed.
        this._appManager.events.next(fileUpdated(file));
      }
    })
  }

  private async _fileDiscovered(event: FileDiscoveredEvent) {
    this._files.push(event.file);
    this._files = sortBy(this._files, f => f.id);
  }

  private _fileRemoved(event: FileRemovedEvent) {
    const index = this._files.indexOf(event.file);
    if(index >= 0) {
      this._files.splice(index, 1);
    }
  }

  private async _commitAdded(event: CommitAddedEvent) {
    this._setStatus(`Commit ${event.hash} added on ${event.branch}.`);
    if (!this.canSave) {
      await this.pull();
    }
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}

export const fileManager = new FileManager(appManager, gitManager);