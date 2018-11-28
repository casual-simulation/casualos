
import {SubscriptionLike, Observable} from 'rxjs';
import {
  filter,
  map,
  shareReplay,
} from 'rxjs/operators';

import {AppManager, appManager} from './AppManager';
import {
  CreateFileEvent, 
  FileCreatedEvent, 
  FileDiscoveredEvent, 
  fileCreated, 
  fileDiscovered,
  FileRemovedEvent,
  fileRemoved
} from './Core/Event';
import {GitManager, gitManager} from './GitManager';
import {File} from './Core/File';

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

  // TODO: Dispose of the subscription
  private _sub: SubscriptionLike;

  /**
   * Gets the list of files that are stored.
   */
  get files(): File[] {
    return this._files;
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
  get fileRemoved(): Observable<File> {
    return this._fileRemovedObservable;
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
   * Updates the local files with files from the server.
   */
  async pull() {
    await this.init();

    this._setStatus('Checking for project...');
    if(!(await gitManager.isProjectCloned())) {
        this._setStatus('Cloning project...');
        await gitManager.cloneProject();
    } else {
        this._setStatus('Updating project...');
        await gitManager.updateProject();
    }

    this._setStatus("Grabbing files...");
    const currentFiles = await this._gitManager.listFiles();
    this._updateFiles(currentFiles);
    
    this._setStatus('Waiting for input...');
  }

  /**
   * Gets whether the files can be saved.
   */
  canSave(): boolean {
    return gitManager.canCommit();
  }

  /**
   * Saves the changes that the local user has made.
   */
  async save() {
    await this.init();

    this._setStatus('Saving files...');
    await Promise.all(this.files.map(file => {
      return gitManager.saveFile(file);
    }));

    if(await gitManager.canCommit()) {
      await gitManager.commit("Save files");

      await gitManager.pushIfNeeded(gitManager.localUserBranch);
    } else {
      this._setStatus('No changes. Commit & push skipped.');
    }
  }

  private async _init() {
    this._setStatus("Starting...");

    this._sub = this._appManager.events.subscribe(event => {
      if (event.type === 'create_file') {
        this._createFile(event);
      } else if(event.type === 'file_created') {
        this._fileCreated(event);
      } else if(event.type === 'file_discovered') {
        this._fileDiscovered(event);
      } else if(event.type === 'file_removed') {
        this._fileRemoved(event);
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

    await gitManager.startIfNeeded();

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
    

    newFiles.forEach(file => {
      this._appManager.events.next(fileDiscovered(file));
    });

    removedFiles.forEach(file => {
      this._appManager.events.next(fileRemoved(file));
    });
  }

  private async _createFile(event: CreateFileEvent) {
    console.log('[FileManager] Create File');

    const file = this._gitManager.createNewFile();
    await this._gitManager.saveFile(file);

    this._appManager.events.next(fileCreated(file));
  }

  private async _fileCreated(event: FileCreatedEvent) {
    this._appManager.events.next(fileDiscovered(event.file));
  }

  private async _fileDiscovered(event: FileDiscoveredEvent) {
    this._files.push(event.file);
  }

  private _fileRemoved(event: FileRemovedEvent) {
    const index = this._files.indexOf(event.file);
    if(index >= 0) {
      this._files.splice(index, 1);
    }
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}

export const fileManager = new FileManager(appManager, gitManager);