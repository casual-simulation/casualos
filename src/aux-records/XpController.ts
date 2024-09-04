import { XpStore } from './XpStore';
import { AuthController } from './AuthController';
import { AuthStore } from './AuthStore';
import { ConfigurationStore } from './ConfigurationStore';
import { RecordsStore } from './RecordsStore';
import { v4 as uuid } from 'uuid';

/**
 * Defines a class that controls an auth users relationship with the XP "system".
 */
export class XpController {
    private _auth: AuthController;
    private _xpStore: XpStore;
    private _recordsStore: RecordsStore;
    private _config: ConfigurationStore;

    constructor(
        auth: AuthController,
        config: ConfigurationStore,
        xpStore: XpStore
    ) {
        this._auth = auth;
        this._config = config;
        this._xpStore = xpStore;
    }

    createXpAccount = async (
        associationId: string,
        type: 'user' | 'contract'
    ) => {
        const id = uuid();
        this._xpStore.saveXpAccount(id, {
            id,
            currency: 'USD',
            entries: [],
            closedTime: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
        // TODO: Implement this & finish the method
    };

    createXpUser = async (email: string) => {
        const id = uuid();
        // const account = await xp.saveXpAccount(id, 'user');
        // const user: XpUser = {
        //     id,
        //     userId: authUserId,
        //     authUser: this._users.find((u) => u.id === authUserId),
        //     account,
        //     accountId: account.id,
        //     issuedContracts: [],
        //     heldContracts: [],
        //     createdAt: new Date(),
        //     updatedAt: new Date(),
        // };
        // account.user = user;
        // TODO: Implement this & finish the method
    };
}
