import { wrap, proxy, Remote, expose, transfer, createEndpoint } from 'comlink';
import { AuthHelperInterface, AuxAuth } from '@casual-simulation/aux-vm';
import { setupChannel, waitForLoad } from '../html/IFrameHelpers';
import { Observable, Subject, Subscription } from 'rxjs';
import { AuthData, hasValue } from '@casual-simulation/aux-common';
import { CreatePublicRecordKeyResult } from '@casual-simulation/aux-records';

// Save the query string that was used when the site loaded
const query = typeof location !== 'undefined' ? location.search : null;

interface StaticAuxAuth {
    new (): AuxAuth;
}

/**
 * Defines a class that helps handle authentication/authorization for the aux VM.
 */
export class AuthHelper implements AuthHelperInterface {
    private _origin: string;
    private _iframe: HTMLIFrameElement;
    private _channel: MessageChannel;
    private _proxy: Remote<AuxAuth>;
    private _initialized: boolean = false;
    private _sub: Subscription = new Subscription();

    /**
     * Creates a new instance of the AuthHelper class.
     * @param iframeOrigin The URL that the auth iframe should be loaded from.
     */
    constructor(iframeOrigin?: string) {
        this._origin = iframeOrigin;
    }

    get closed() {
        return this._sub?.closed;
    }

    unsubscribe() {
        return this.dispose();
    }

    dispose() {
        if (this._sub) {
            this._sub.unsubscribe();
            this._sub = null;
        }
    }

    private async _init() {
        if (!hasValue(this._origin)) {
            throw new Error(
                'Cannot initialize AuthHelper because no iframe origin is set.'
            );
        }
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

        this._initialized = true;
    }

    /**
     * Determines if the user is authenticated.
     */
    async isAuthenticated() {
        if (!hasValue(this._origin)) {
            return false;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.isLoggedIn();
    }

    /**
     * Requests that the user become authenticated if they are not already.
     */
    async authenticate() {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.login();
    }

    /**
     * Requests that the user become authenticated entirely in the background.
     * This will not show any UI to the user but may also mean that the user will not be able to be authenticated.
     */
    async authenticateInBackground() {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.login(true);
    }

    async createPublicRecordKey(
        recordName: string
    ): Promise<CreatePublicRecordKeyResult> {
        if (!hasValue(this._origin)) {
            return {
                success: false,
                errorCode: 'not_supported',
                errorMessage: 'Records are not supported on this inst.',
            };
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.createPublicRecordKey(recordName);
    }

    async getAuthToken(): Promise<string> {
        if (!hasValue(this._origin)) {
            return null;
        }
        if (!this._initialized) {
            await this._init();
        }
        return await this._proxy.getAuthToken();
    }
}
