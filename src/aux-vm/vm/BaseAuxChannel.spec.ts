import { BaseAuxChannel } from './BaseAuxChannel';
import {
    RealtimeCausalTree,
    LocalRealtimeCausalTree,
    storedTree,
    site,
} from '@casual-simulation/causal-trees';
import {
    AuxCausalTree,
    GLOBALS_FILE_ID,
    createFile,
} from '@casual-simulation/aux-common';
import { AuxUser, AuxConfig } from '..';

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
            await channel.init(null, null, null, null);

            const userFile = channel.helper.userFile;
            expect(userFile).toBeTruthy();
            expect(userFile.tags).toMatchSnapshot();
        });

        it('should create the globals file', async () => {
            await channel.init(null, null, null, null);

            const globals = channel.helper.globalsFile;
            expect(globals).toBeTruthy();
            expect(globals.tags).toMatchSnapshot();
        });

        it('should throw if is builder and the user is not in the designers list', async () => {
            config.config.isBuilder = true;
            await tree.addFile(
                createFile(GLOBALS_FILE_ID, {
                    'aux.designers': ['notusername'],
                })
            );

            expect(channel.init(null, null, null, null)).rejects.toEqual(
                new Error('You are denied access to this channel.')
            );
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
