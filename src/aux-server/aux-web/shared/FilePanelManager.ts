import { Subject, Observable, BehaviorSubject } from 'rxjs';
import FileWatcher from './FIleWatcher';

/**
 * Defines a class that manages the file panel.
 */
export default class FilePanelManager {
    private _isOpen: boolean = false;
    private _openChanged: BehaviorSubject<boolean>;
    private _search: string = '';

    /**
     * Gets the current search phrase.
     */
    get search() {
        return this._search;
    }

    /**
     * Sets the current search phrase.
     */
    set search(value: string) {}

    /**
     * Gets whether the file panel is open.
     */
    get isOpen() {
        return this._isOpen;
    }

    /**
     * Sets whether the file panel is open.
     */
    set isOpen(value: boolean) {
        if (value != this.isOpen) {
            this._isOpen = value;
            this._openChanged.next(this._isOpen);
        }
    }

    /**
     * Gets an observable that resolves when the file panel is opened or closed.
     */
    get isOpenChanged(): Observable<boolean> {
        return this._openChanged;
    }

    /**
     * Creates a new file panel manager.
     */
    constructor() {
        this._openChanged = new BehaviorSubject<boolean>(this._isOpen);
    }

    /**
     * Toggles whether the file panel is open or closed.
     */
    toggleOpen() {
        this.isOpen = !this.isOpen;
    }
}
