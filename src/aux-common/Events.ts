// [Ryan] I would love to have multiple versions of Event and Listener that support more than one generic parameter.
// However, this is not supported by JavaScript. TypeScript's compiler complains about the class name already being declared even though
// the generic parameters are different. This is because when transpiled to JavaScript,all generic types are stripped.
// So the best way to handle this is if you need mutiple objects to store them in a custom JavaScript object / Typescript interface.

/**
* Event that has no arguments.
*/
export class Event {
    private _listeners: EventListener[] = [];
 
    public addListener(listener:EventListener) {
        this._listeners.push(listener);
    }
 
    public removeListener(listener:EventListener) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }
 
    public removeAllListeners() {
        this._listeners = [];
    }
 
    public invoke() {
        this._listeners.forEach((l) => {
            l();
        });
    }
 }
 
 /**
 * Signature of event listener that has no arguments.
 */
 declare type EventListener = () => void;


/**
* Event that takes typed argument.
*/
export class ArgEvent<T> {
    private _listeners: ArgEventListener<T>[] = [];
 
    public addListener(listener:ArgEventListener<T>) {
        this._listeners.push(listener);
    }
 
    public removeListener(listener:ArgEventListener<T>) {
        const index = this._listeners.indexOf(listener);
        if (index !== -1) {
            this._listeners.splice(index, 1);
        }
    }
 
    public removeAllListeners() {
        this._listeners = [];
    }
 
    public invoke(arg: T) {
        this._listeners.forEach((l) => {
            l(arg);
        });
    }
 }
 
 /**
 * Signature of event listener that accepts typed argument.
 */
 declare type ArgEventListener<T> = (arg: T) => void;
