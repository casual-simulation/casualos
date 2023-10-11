import { AuthData } from '@casual-simulation/aux-common';
import { AuthEndpointHelper } from '@casual-simulation/aux-vm-browser';
import { Observable } from 'rxjs';
import { WebConfig } from 'shared/WebConfig';

/**
 * Defines a class that helps with privo authentication.
 */
export class PrivoAuthHelper extends AuthEndpointHelper {
    private _config: WebConfig;

    constructor(
        primaryAuthOrigin: string,
        primaryRecordsOrigin: string,
        config: WebConfig
    ) {
        super(primaryAuthOrigin, primaryRecordsOrigin);
        this._config = config;
    }

    private _loadScript() {
        if (
            this._config.privoAgeVerificationApiScriptUrl &&
            this._config.privoAgeVerificationServiceId
        ) {
            return new Promise<void>((resolve, reject) => {
                console.log('[PrivoAuthHelper] Loading script...');
                const script = document.createElement('script');
                script.src = this._config.privoAgeVerificationApiScriptUrl;
                script.async = true;
                script.onload = () => {
                    console.log('[PrivoAuthHelper] Script loaded!');
                    resolve();
                };
                script.onerror = (err) => {
                    reject(err);
                };

                document.body.appendChild(script);
            });
        } else {
            console.error(
                '[PrivoAuthHelper] Unable to load age verification script because the config is missing the required fields.'
            );
        }

        return Promise.reject(new Error('Unable to load script!'));
    }

    protected async _initCore(): Promise<void> {
        await this._loadScript();

        if (!globalThis.privo) {
            throw new Error(
                'Script was loaded but globalThis.privo is not defined!'
            );
        }

        console.log('[PrivoAuthHelper] Initializing...');
        await globalThis.privo.ageVerification.init({
            serviceIdentifier: this._config.privoAgeVerificationServiceId,
            displayMode: 'popup',
        });

        // const statusResult = await globalThis.privo.ageVerification.getStatus();

        // console.log('[PrivoAuthHelper] Age Verification Status: ', statusResult);
        // if (statusResult.status === 'Pending' || statusResult.status === 'Declined') {
        //     throw new Error('User has been denied!');
        // } else if (statusResult.status === 'Undefined' || statusResult.status === 'Canceled') {
        //     globalThis.privo.ageVerification.run(undefined, (event) => {
        //         console.log('[PrivoAuthHelper] Age verification event:', event);
        //     });
        // }

        await super._initCore();
    }

    protected async _authenticateCore(): Promise<AuthData> {
        console.log('[PrivoAuthHelper] Logging in...');
        // await this._runAgeVerification();
        return await super._authenticateCore();
    }

    private _runAgeVerification(): Observable<privo.AgeVerificationEvent> {
        return new Observable((observer) => {
            try {
                globalThis.privo.ageVerification.run(undefined, (event) => {
                    console.log(
                        '[PrivoAuthHelper] Age verification event:',
                        event
                    );
                    observer.next(event);
                });
            } catch (err) {
                observer.error(err);
            }
        });
    }

    private async _validateAge() {
        const status = await globalThis.privo.ageVerification.getStatus();

        if (status.status === 'Pending' || status.status === 'Declined') {
            throw new Error('User has been denied!');
        } else if (
            status.status === 'Undefined' ||
            status.status === 'Canceled'
        ) {
        }
    }
}
