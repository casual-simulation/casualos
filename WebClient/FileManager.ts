
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
import {filter, map, shareReplay,} from 'rxjs/operators';
import * as uuid from 'uuid/v4';

import {AppManager, appManager} from './AppManager';
import {SocketManager} from './SocketManager';
import { Sandbox, SandboxInterface, FilterFunction } from './Formulas/Sandbox';

/**
 * Defines an interface for objects that represent assignment formula expressions.
 * Assignment formula expressions are formulas that are only evaluated once.
 * Internally we store them as objects in the tag and display the calculated result.
 * This way, we can preserve the formula value if needed.
 */
export interface Assignment {
  _assignment: boolean;
  editing: boolean;
  formula: string;
  value?: any;
}

export interface SelectedFilesUpdatedEvent { files: Object[]; }

class InterfaceImpl implements SandboxInterface {
  private _fileManager: FileManager;

  constructor(fileManager: FileManager) {
    this._fileManager = fileManager;
  }

  listTagValues(tag: string, filter?: FilterFunction, extras?: any) {
    const tags = flatMap(this.objects.map(o => this._calculateValue(o, tag)).filter(t => t));
    const filtered = this._filterValues(tags, filter);
    return filtered;
  }

  listObjectsWithTag(tag: string, filter?: FilterFunction, extras?: any) {
    const objs = this.objects.filter(o => this._calculateValue(o, tag))
      .map(o => this._fileManager.convertToFormulaObject(o));
    const filtered = this._filterObjects(objs, filter, tag);
    return filtered;
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
        return objs.filter(o => filter(this._calculateValue(o, tag)));
      } else {
        return objs.filter(o => this._calculateValue(o, tag) === filter);
      }
    } else {
      return objs;
    }
  }

  private get objects(): Object[] {
    return this._fileManager.objects;
  }

  private _calculateValue(object: any, tag: string) {
    return this._fileManager.calculateFileValue(object, tag);
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
  fileTags(files: File[], currentTags: string[], extraTags: string[]) {
    const fileTags = flatMap(files, f => {
      if (f.type === 'object') {
        return keys(f.tags);
      }
      return [];
    });
    // Only keep tags that don't start with an underscore (_)
    const nonHiddenTags = fileTags.filter(t => !(/^_/.test(t)))
    const tagsToKeep = union(nonHiddenTags, extraTags);
    const allTags = union(currentTags, tagsToKeep);

    const onlyTagsToKeep = intersection(allTags, tagsToKeep);

    return onlyTagsToKeep;
  }

  /**
   * Gets a list of files that the given user has selected.
   * @param user The file of the user.
   */
  selectedFilesForUser(user: Object) {
    return this.filterFilesBySelection(this.objects, user.tags._selection);
  }

  filterFilesBySelection(files: Object[], selectionId: string) {
    return files.filter(
      f => {
        for(let prop in f.tags) {
          const val = f.tags[prop];
          if (prop === selectionId && val) {
            return true;
          }
        }
        return false;
      });
  }

  selectFile(file: Object) {
    this.selectFileForUser(file, this._appManager.user.username);
  }

  selectFileForUser(file: Object, username: string) {
    console.log('[FileManager] Select File:', file.id);
    
    const {id, newId} = this.selectionIdForUser(this.userFile);
    if (newId) {
      this.setUserSelection(this.userFile, newId);
    }
    if (id) {
      this.updateFile(file, {
        tags: {
            [id]: !(file.tags[id])
        }
      });
    } 
  }

  /**
   * Sets the selection ID that the user refers to.
   * @param user The user file.
   * @param selectionId The ID of the selection.
   */
  setUserSelection(user: Object, selectionId: string) {
    this.updateFile(this.userFile, {
      tags: {
        _selection: selectionId
      }
    });
  }

  clearSelection() {
    this.clearSelectionForUser(this.userFile);
  }

  /**
   * The ID of the selection that the user is using.
   * If the user doesn't have a selection, returns null.
   * @param user The user's file.
   */
  selectionIdForUser(user: Object) {
    const userFile = this.userFile;
    
    if (userFile && userFile.tags._selection) {
        return { id: userFile.tags._selection || null, newId: <string>null };
    } else {
      const id = this.newSelectionId();
      console.log(`[FileManager] New selection for ${user.id}: ${id}`);
      return { id: id, newId: id };
    }
  }

  /**
   * Creates a new selection id.
   */
  newSelectionId() {
    return `_selection_${uuid()}`;
  }

  /**
   * Clears the selection that the given user has.
   * @param user The file for the user to clear the selection of.
   */
  clearSelectionForUser(user: Object) {
    console.log('[FileManager] Clear selection for', user.id);
    this.setUserSelection(user, null);
  }

  calculateFileValue(object: Object, tag: string) {
    if (tag === 'id') {
      return object.id;
    } else if (this.isFormulaObject(object)) {
      const o: any = object;
      return this._calculateValue(object, tag, o[tag]);
    } else {
      return this._calculateValue(object, tag, object.tags[tag]);
    }
  }

  calculateFormattedFileValue(file: Object, tag: string): string {
    const value = this.calculateFileValue(file, tag);
    return this._formatValue(value);
  }

  private _formatValue(value: any): string {
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.map(v => this._formatValue(v)).join(',')}]`;
      } else {
        if (value.id) {
          return value.id.substr(0, 5);
        } else {
          return JSON.stringify(value);
        }
      }
    } else if(typeof value !== 'undefined' && value !== null) {
      return value.toString();
    } else {
      return value;
    }
  }

  private _calculateValue(object: any, tag: string, formula: string): any {
    const isString = typeof formula === 'string';
    if (this.isFormula(formula)) {
      const result = this._calculateFormulaValue(object, tag, formula);
      if (result.success) {
        return result.result;
      } else {
        return result.extras.formula;
      }
    } else if (this.isAssignment(formula)) {
      const obj: Assignment = <any>formula;
      return obj.value;
    } else if(this.isArray(formula)) {
      const split = this._parseArray(formula);
      return split.map(s => this._calculateValue(object, tag, s.trim()));
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
   * Determines if the given value represents an assignment.
   */
  isAssignment(object: any): any {
    return typeof object === 'object' && object && !!object._assignment;
  }

  /**
   * Determines if the given value contains a formula.
   * This is different from isFormula() because it checks arrays for containing formulas in their elements.
   * @param value The value to check.
   */
  containsFormula(value: string): boolean {
    return this.isFormula(value) || (this.isArray(value) && some(this._parseArray(value), v => this.isFormula(v)));
  }

  /**
   * Determines if the given string value represents an array.
   */
  isArray(value: string): boolean {
    return typeof value === 'string' && value.indexOf(',') >= 0;
  }

  /**
   * Determines if the given value represents a number.
   */
  isNumber(value: string): boolean {
    return (/^-?\d+\.?\d*$/).test(value) || (typeof value === 'string' && 'infinity' === value.toLowerCase());
  }

  /**
   * Creates a new object that contains the tags that the given object has
   * and is usable in a formula.
   */
  convertToFormulaObject(object: any) {
    if (this.isFormulaObject(object)) {
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
        if(this.containsFormula(val)) {
          Object.defineProperty(converted, key, {
            get: () => this._calculateValue(object, key, val)
          });
        } else {
          converted[key] = this._calculateValue(object, key, val);
        }
      }
    }
    return converted;
  }

  _convertToAssignment(object: any): Assignment {
    if (this.isAssignment(object)) {
      return object;
    }

    return {
      _assignment: true,
      editing: true,
      formula: object,
    };
  }

  /**
   * Determines if the given value is an assignment expression or an assignment object.
   */
  _isAssignmentFormula(value: any): boolean {
    if(typeof value === 'string') {
      return value.indexOf(':') === 0 && value.indexOf('=') === 1;
    } else {
      return this.isAssignment(value);
    }
  }

  isFormulaObject(object: any) {
    return !!object._converted;
  }

  /**
   * Updates the given file with the given data.
   */
  async updateFile(file: File, newData: PartialFile) {
    if (newData.tags) {

      // Cleanup/preprocessing
      for (let property in newData.tags) {
        let value = newData.tags[property];
        if (!value) {
          newData.tags[property] = null;
        } else {
          if (this._isAssignmentFormula(value)) {
            const assignment = this._convertToAssignment(value);
            const result = this._calculateFormulaValue(file, property, assignment.formula);
            newData.tags[property] = assign(assignment, { value: result.result });
          }
        }
      }
    }

    this._files.emit(fileUpdated(file.id, newData));
  }
  

  async createFile(id = uuid(), tags: Object['tags'] = {
    _position: { x: 0, y: 0, z: 0},
    _workspace: <string>null
  }) {
    console.log('[FileManager] Create File');

    const file: Object =
        {id: id, type: 'object', tags: tags};

    this._files.emit(fileAdded(file));
  }

  async createWorkspace() {
    console.log('[FileManager] Create File');

    const workspace: Workspace = {
      id: uuid(),
      type: 'workspace',
      position: {x: 0, y: 0, z: 0},
      size: 0
    };

    this._files.emit(fileAdded(workspace));
  }

  private _calculateFormulaValue(object: any, tag: string, formula: string) {
    return this._sandbox.run(formula, {
      formula,
      tag
    }, this.convertToFormulaObject(object));
  }

  private _parseArray(value: string): string[] {
    return value.split(',');
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
      await this.createFile(this._appManager.user.username, {
        _hidden: true,
        _position: { x: 0, y: 0, z: 0},
        _workspace: null
      });
    }

    this._setStatus('Initialized.');
  }

  private _setStatus(status: string) {
    this._status = status;
    console.log('[FileManager] Status:', status);
  }
}