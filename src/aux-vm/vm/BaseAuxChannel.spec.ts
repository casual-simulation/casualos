import { BaseAuxChannel } from './BaseAuxChannel';
import {
    RealtimeCausalTree,
    LocalRealtimeCausalTree,
    storedTree,
    site,
    AuthorizationMessage,
} from '@casual-simulation/causal-trees';
import {
    AuxCausalTree,
    GLOBALS_FILE_ID,
    createFile,
} from '@casual-simulation/aux-common';
import { AuxUser, AuxConfig } from '..';
import { first } from 'rxjs/operators';

console.log = jest.fn();

describe('BaseAuxChannel', () => {
    let channel: BaseAuxChannel;
    let user: AuxUser;
    let config: AuxConfig;
    let tree: AuxCausalTree;

    beforeEach(async () => {
        config = {
            id: 'auxId',
            config: { isBuilder: false, isPlayer: false },
            host: 'host',
            treeName: 'test',
        };
        user = {
            id: 'userId',
            username: 'username',
            channelId: null,
            isGuest: false,
            name: 'name',
            token: 'token',
        };
        tree = new AuxCausalTree(storedTree(site(1)));
        await tree.root();

        channel = new AuxChannelImpl(tree, user, config);
    });

    describe('init()', () => {
        it('should create a file for the user', async () => {
            await channel.init();

            const userFile = channel.helper.userFile;
            expect(userFile).toBeTruthy();
            expect(userFile.tags).toMatchSnapshot();
        });

        it('should create the globals file', async () => {
            await channel.init();

            const globals = channel.helper.globalsFile;
            expect(globals).toBeTruthy();
            expect(globals.tags).toMatchSnapshot();
        });

        it('should issue an authorization event if the user is not in the designers list in builder', async () => {
            config.config.isBuilder = true;
            await tree.addFile(
                createFile(GLOBALS_FILE_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            let messages: AuthorizationMessage[] = [];
            channel.onConnectionStateChanged.subscribe(m => {
                if (m.type === 'authorization') {
                    messages.push(m);
                }
            });

            await channel.init();

            expect(messages).toEqual([
                {
                    type: 'authorization',
                    authorized: false,
                    reason: 'unauthorized',
                },
            ]);
        });
    });
});

class AuxChannelImpl extends BaseAuxChannel {
    private _tree: AuxCausalTree;
    constructor(tree: AuxCausalTree, user: AuxUser, config: AuxConfig) {
        super(user, config);
        this._tree = tree;
    }

    protected async _createRealtimeCausalTree(): Promise<
        RealtimeCausalTree<AuxCausalTree>
    > {
        return new LocalRealtimeCausalTree(this._tree);
    }
}

function waitForChannelInit(channel: BaseAuxChannel) {
    return channel.onConnectionStateChanged
        .pipe(first(state => state.type === 'init'))
        .toPromise();
}
