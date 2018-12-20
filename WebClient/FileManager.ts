
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
  mapValues,
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
import { Sandbox, SandboxInterface, FilterFunction } from './Formulas/Sandbox';

export interface SelectedFilesUpdatedEvent { files: Object[]; }

class InterfaceImpl implements SandboxInterface {
  private _fileManager: FileManager;

  constructor(fileManager: FileManager) {
    this._fileManager = fileManager;
  }

  listTagValues(tag: string, filter?: FilterFunction) {
    const tags = flatMap(this.objects.map(o => this._calculateValue(o, o.tags[tag])).filter(t => t));
    const filtered = this._filterValues(tags, filter);
    if (filtered.length === 1) {
      return filtered[0];
    } else {
      return filtered;
    }
  }

  listObjectsWithTag(tag: string, filter?: FilterFunction) {
    const objs = this.objects.filter(o => this._calculateValue(o, o.tags[tag]))
      .map(o => this._fileManager.convertToFormulaObject(o));
    const filtered = this._filterObjects(objs, filter, tag);
    if (filtered.length === 1) {
      return filtered[0];
    } else {
      return filtered;
    }
  }

  private _filterValues(values: any[], filter: FilterFunction) {
    if (filter) {
      if(typeof filter === 'function') {
        return values.filter(filter);
      } else {
        return values.filter(t => t === filter);
      }
    } else {
      return values;
    }
  }

  private _filterObjects(objs: any[], filter: FilterFunction, tag: string) {
    if (filter) {
      if(typeof filter === 'function') {
        return objs.filter(o => filter(this._calculateValue(o, o[tag])));
      } else {
        return objs.filter(o => this._calculateValue(o, o[tag]) === filter);
      }
    } else {
      return objs;
    }
  }

  private get objects(): Object[] {
    return this._fileManager.objects;
  }

  private _calculateValue(object: Object, value: any) {
    return this._fileManager.calculateValue(object, value);
  }
}

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
  private _sandbox: Sandbox;

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

  get userFile(): Object {
    var objs = this.objects.filter(o => o.id === this._appManager.user.username);
    if (objs.length > 0) {
      return objs[0];
    }
    return null;
  }

  private get _filesState() {
    return this._files.store.state();
  }

  constructor(app: AppManager, socket: SocketManager) {
    this._appManager = app;
    this._socketManager = socket;

    this._sandbox = new Sandbox(new InterfaceImpl(this));

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
    this.selectFileForUser(file, this._appManager.user.username);
  }

  selectFileForUser(file: Object, username: string) {
    console.log('[FileManager] Select File:', file.id);
    this.updateFile(file, {
      tags: {
          _selected: {
              [username]: !(file.tags._selected && file.tags._selected[username])
          }
      }
    });
  }

  clearSelection() {
    this.clearSelectionForUser(this._appManager.user.username);
  }

  clearSelectionForUser(username: string) {
    console.log('[FileManager] Clear selection for', username);
    this.selectedObjects.forEach(file => {
      this.updateFile(file, {
        tags: {
            _selected: {
                [username]: false
            }
        }
      });
    });
  }

  calculateFileValue(file: Object, tag: string) {
    const formula = file.tags[tag];
    return this.calculateValue(file, formula);
  }

  calculateFormattedFileValue(file: Object, tag: string): string {
    const value = this.calculateFileValue(file, tag);
    if(typeof value === 'object') {
      return JSON.stringify(value);
    } else if(typeof value !== 'undefined' && value !== null) {
      return value.toString();
    } else {
      return value;
    }
  }

  calculateValue(object: any, formula: string): any {
    const isString = typeof formula === 'string';
    if (this.isFormula(formula)) {
      return this.calculateFormulaValue(object, formula);
    } else if(this.isArray(formula)) {
      const split = formula.split(',');
      return split.map(s => this.calculateValue(object, s.trim()));
    } else if(this.isNumber(formula)) {
      return parseFloat(formula);
    } else if(formula === 'true') {
      return true;
    } else if(formula === 'false') {
      return false;
    } else {
      return formula;
    }
  }

  /**
   * Determines if the given value represents a formula.
   */
  isFormula(value: string): boolean {
    return typeof value === 'string' && value.indexOf('=') === 0;
  }

  /**
   * Determines if the given string value represents an array.
   */
  isArray(value: string): boolean {
    return typeof value === 'string' && value.indexOf(',') >= 0;
  }

  isNumber(value: string): boolean {
    return (/^-?\d+\.?\d*$/).test(value) || (typeof value === 'string' && 'infinity' === value.toLowerCase());
  }

  calculateFormulaValue(object: any, formula: string) {
    return this._sandbox.run(formula, formula, this.convertToFormulaObject(object));
  }

  /**
   * Creates a new object that contains the tags that the given object has
   * and is usable in a formula.
   */
  convertToFormulaObject(object: any) {
    if (object._converted) {
      return object;
    }
    let converted: {
      [tag: string]: any
    } = {
      _converted: true,
      id: object.id
    };
    for(let key in object.tags) {
      if (typeof converted[key] === 'undefined') {
        const val = object.tags[key];
        if(this.isFormula(val)) {
          Object.defineProperty(converted, key, {
            get: () => this.calculateValue(object, val)
          });
        } else {
          converted[key] = this.calculateValue(object, val);
        }
      }
    }
    return converted;
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

  async createFile(id = uuid()) {
    console.log('[FileManager] Create File');

    const file: Object =
        {id: id, type: 'object', position: null, workspace: null, tags: {}};

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

    allSelectedFilesUpdated.subscribe(this._selectedFilesUpdated);

    this._setStatus('Getting user file...');

    let userFile = this.userFile;
    if (!userFile) {
      await this.createFile(this._appManager.user.username);
    }

    this._setStatus('Initialized.');
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}