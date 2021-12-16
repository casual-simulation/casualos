import { wrap, proxy, Remote, expose, transfer, createEndpoint } from 'comlink';
import { AuxAuth } from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import { Observable, Subject, Subscription } from 'rxjs';
import { AuthData } from '@casual-simulation/aux-common';

// Save the query string that was used when the site loaded
const query = typeof location !== 'undefined' ? location.search : null;

interface StaticAuxAuth {
    new (): AuxAuth;
}

/**
 * Defines a class that helps handle authentication/authorization for the aux VM.
 */
export class AuthHelper {
    private _origin: string;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxAuth>;
    private _initialized: boolean = false;
    private _sub: Subscription = new Subscription();
    private _authDataUpdated = new Subject<AuthData>();

    /**
     * Gets an observable that resolves whenever auth data is updated and should be propagated into the AuxRuntime.
     */
    get authDataUpdated(): Observable<AuthData> {
        return this._authDataUpdated;
    }

    /**
     * Creates a new instance of the AuthHelper class.
     * @param iframeOrigin The URL that the auth iframe should be loaded from.
     */
    constructor(iframeOrigin?: string) {
        this._origin = iframeOrigin || 'https://casualos.me';
    }

    dispose() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private async _init() {
        const iframeUrl = new URL(`/iframe.html${query}`, this._origin).href;

        const iframe = (this._iframe = document.createElement('iframe'));
        this._sub.add(() => {
            iframe.remove();
        });
        this._iframe.src = iframeUrl;
        this._iframe.style.display = 'none';

        let promise = waitForLoad(this._iframe);
        document.body.insertBefore(this._iframe, document.body.firstChild);

        await promise;

        this._channel = setupChannel(this._iframe.contentWindow);

        const wrapper = wrap<StaticAuxAuth>(this._channel.port1);
        this._proxy = await new wrapper();

        this._proxy.addTokenListener(
            proxy((err, data) => {
                if (err) {
                    return;
                }

                this._authDataUpdated.next(data);
            })
        );

        this._initialized = true;
    }

    /**
     * Determines if the user is authenticated.
     */
    async isAuthenticated() {
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.isLoggedIn();
    }

    /**
     * Requests that the user become authenticated if they are not already.
     */
    async authenticate() {
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.login();
    }

    async createPublicRecordKey(recordName: string) {
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.createPublicRecordKey(recordName);
    }
}
