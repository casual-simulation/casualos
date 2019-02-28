import { RealtimeCausalTree } from './RealtimeCausalTree';
import { AtomOp, atom, atomId } from './Atom';
import { CausalTreeStore } from './CausalTreeStore';
import { CausalTreeFactory } from './CausalTreeFactory';
import { RealtimeChannel } from './RealtimeChannel';
import { TestCausalTreeStore } from './test/TestCausalTreeStore';
import { CausalTree } from './CausalTree';
import { AtomReducer } from './AtomReducer';
import { Weave, WeaveReference } from './Weave';
import { TestChannelConnection } from './test/TestChannelConnection';
import { site, SiteInfo } from './SiteIdInfo';
import { SiteVersionInfo } from './SiteVersionInfo';

jest.useFakeTimers();

class Op implements AtomOp {
    type: number;
}

class Tree extends CausalTree<Op, number> {

}

class NumberReducer implements AtomReducer<Op, number> {
    eval(weave: Weave<Op>): number {
        return 0;
    }
}

describe('RealtimeCausalTree', () => {
    let realtime: RealtimeCausalTree<Tree>;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let channel: RealtimeChannel<WeaveReference<Op>>;
    let connection: TestChannelConnection;
    let flush = false;
    let weave: WeaveReference<Op>[];
    let knownSites: SiteInfo[]; 
    let siteVersion: SiteVersionInfo;
    let allowSiteId: boolean[];
    let localWeaves: WeaveReference<Op>[][];
    let errors: any[] = [];
    let updated: WeaveReference<Op>[][] = [];
    
    beforeEach(() => {
        flush = false;
        weave = [];
        localWeaves = [];
        errors = [];
        updated = [];
        knownSites = [ 
            site(1)
        ];
        siteVersion = {
            site: site(1),
            knownSites: knownSites,
            version: null
        };
        allowSiteId = [];
        store = new TestCausalTreeStore();
        factory = new CausalTreeFactory({
            'numbers': (tree) => new Tree(tree, new NumberReducer())
        });
        connection = new TestChannelConnection();
        channel = new RealtimeChannel<WeaveReference<Op>>({
            id: 'abc',
            type: 'numbers'
        }, connection);
        realtime = new RealtimeCausalTree<Tree>(factory, store, channel);
        realtime.onError.subscribe(e => errors.push(e));
        realtime.onUpdated.subscribe(refs => updated.push(refs));

        connection.resolve = (name, data) => {
            flush = true;
            if (name.indexOf('info') >= 0) {
                return siteVersion;
            } else if(name.indexOf('site') >= 0) {
                if (allowSiteId.length > 0) {
                    return allowSiteId.shift();
                } else {
                    return true;
                }
            } else {
                localWeaves.push(data.weave);
                return weave;
            }
        };
    });

    afterEach(() => {
        expect(errors).toEqual([]);
    });

    describe('init()', () => {
        it('should have a null tree by default', async () => {
            await realtime.init();

            expect(realtime.tree).toBe(null);
        });

        it('should load the tree from the store', async () => {
            await store.update('abc', {
                site: site(2),
                knownSites: null,
                weave: null
            });

            await realtime.init();

            expect(realtime.tree).not.toBe(null);
        });
    });

    describe('connected without existing tree', () => {
        it('should request the next ID if no tree is stored', async () => {
            allowSiteId.push(true);

            await realtime.init();

            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.site).toEqual(site(2));
            expect(updated.length).toBe(1);
        });

        it('should continue to increment the site ID until a request is granted', async () => {
            
            allowSiteId.push(false);
            allowSiteId.push(false);
            allowSiteId.push(false);
            
            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.site).toEqual(site(5));
            expect(updated.length).toBe(1);
        });

        it('should be based on the largest site ID from the known sites list', async () => {
            knownSites.push(site(99));

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.site).toEqual(site(100));
            expect(updated.length).toBe(1);
        });

        it('should get the weave from the remote site and import it', async () => {
            let w = new Weave<Op>();
            w.insert(atom(atomId(1, 0), null, new Op()));
            w.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));

            weave.push(...w.atoms);

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.weave.atoms).toEqual(weave);
            expect(updated.length).toBe(1);
        });

        it('should send an empty weave to the remote site', async () => {
            let w = new Weave<Op>();
            w.insert(atom(atomId(1, 0), null, new Op()));
            w.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));

            weave.push(...w.atoms);

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree).not.toBe(null);
            expect(localWeaves).toEqual([
                []
            ]);
            expect(updated.length).toBe(1);
        });

        it('should import the remote known sites', async () => {

            knownSites.push(site(99), site(10));

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.knownSites).toContainEqual(site(1));
            expect(realtime.tree.knownSites).toContainEqual(site(99));
            expect(realtime.tree.knownSites).toContainEqual(site(10));
            expect(updated.length).toBe(1);
        });
    });

    describe('connected with existing tree', () => {

        it('should import the weave from the store', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));

            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(1),
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.weave.atoms).toEqual(localWeave.atoms);
            expect(updated.length).toBe(1);
        });

        it('should import the remote weave atoms', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));

            let remoteWeave = new Weave<Op>();
            remoteWeave.insert(atom(atomId(1, 0), null, new Op()));
            remoteWeave.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));
            remoteWeave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            
            let finalWeave = new Weave<Op>();
            finalWeave.import(localWeave.atoms);
            finalWeave.import(remoteWeave.atoms);
            
            weave.push(...remoteWeave.atoms);
            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(1),
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.weave.atoms).toEqual(finalWeave.atoms);
            expect(updated.length).toBe(2);
        });

        it('should import the remote known sites', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));
            
            knownSites.push(site(1999));

            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.knownSites).toContainEqual(site(2));
            expect(realtime.tree.knownSites).toContainEqual(site(1));
            expect(realtime.tree.knownSites).toContainEqual(site(1999));
            expect(updated.length).toBe(2);
        });
    });

    describe('reconnect', () => {
        it('should request and import the remote weave', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));

            let remoteWeave = new Weave<Op>();
            remoteWeave.insert(atom(atomId(1, 0), null, new Op()));
            remoteWeave.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));
            remoteWeave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            
            let finalWeave = new Weave<Op>();
            finalWeave.import(localWeave.atoms);
            finalWeave.import(remoteWeave.atoms);
            
            weave.push(...remoteWeave.atoms);
            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(1),
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            remoteWeave.insert(atom(atomId(1, 5), atomId(1, 0), new Op()));
            finalWeave.import(remoteWeave.atoms);
            weave.splice(0, weave.length, ...remoteWeave.atoms);

            connection.setConnected(false);
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.weave.atoms).toEqual(finalWeave.atoms);
            expect(updated.length).toBe(3);
        });

        it('should not request if the versions are the same', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));

            let remoteWeave = new Weave<Op>();
            remoteWeave.insert(atom(atomId(1, 0), null, new Op()));
            remoteWeave.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));
            remoteWeave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            let finalWeave = new Weave<Op>();
            finalWeave.import(localWeave.atoms);
            finalWeave.import(remoteWeave.atoms);
            
            weave.push(...remoteWeave.atoms);
            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(1),
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            siteVersion = {
                site: site(1),
                knownSites: [ site(1), site(2) ],
                version: finalWeave.getVersion()
            };

            // even though the remote weave has new atoms
            // the realtime tree should not request it
            // because their versions match.
            remoteWeave.insert(atom(atomId(1, 5), atomId(1, 0), new Op()));
            weave.splice(0, weave.length, ...remoteWeave.atoms);

            connection.setConnected(false);
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.weave.atoms).toEqual(finalWeave.atoms);

            // 1 connection + 1 load from store
            // second is skipped because no atoms were imported
            expect(updated.length).toBe(2);
        });

        it('should import the remote known sites', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));
            
            knownSites.push(site(1999));

            await store.update('abc', {
                site: site(2),
                knownSites: [
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            knownSites.push(site(15));
            knownSites.push(site(23));

            connection.setConnected(false);
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.knownSites).toContainEqual(site(15));
            expect(realtime.tree.knownSites).toContainEqual(site(23));
            expect(updated.length).toBe(3);
        });
    });

    describe('events', () => {
        it('should try to insert new atoms into the tree', async () => {
            let weave = new Weave<Op>();

            const root = weave.insert(atom(atomId(1, 0), null, new Op()));
            const first = weave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            // send root event
            connection.events.next({
                name: 'event_abc',
                data: root
            });

            connection.events.next({
                name: 'event_abc',
                data: first
            });

            expect(realtime.tree.weave.atoms).toEqual([
                root,
                first
            ]);
            expect(updated.length).toBe(3);
        });

        it('should send new atoms through the channel', async () => {
            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            const root = realtime.tree.add(atom(atomId(2, 1), null, new Op()));
            const child = realtime.tree.add(atom(atomId(2, 2), atomId(2, 1), new Op()));
            const skipped = realtime.tree.add(atom(atomId(2, 3), atomId(2, 10), new Op()));
            const alsoSkipped = realtime.tree.add(atom(atomId(3, 4), atomId(2, 1), new Op()));

            expect(connection.emitted).toContainEqual({
                name: 'event_abc',
                data: root
            });

            expect(connection.emitted).toContainEqual({
                name: 'event_abc',
                data: child
            });

            expect(connection.emitted).not.toContainEqual({
                name: 'event_abc',
                data: skipped
            });

            expect(connection.emitted).not.toContainEqual({
                name: 'event_abc',
                data: alsoSkipped
            });

            // 1 connection + 2 events
            expect(updated.length).toBe(3);
        }); 

        it('should ignore events if the tree has not been initialized', async () => {
            
            let weave = new Weave<Op>();

            const root = weave.insert(atom(atomId(1, 0), null, new Op()));
            const first = weave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            await realtime.init();
            await connection.flushPromises();

             // send root event
             connection.events.next({
                name: 'event_abc',
                data: root
            });

            connection.events.next({
                name: 'event_abc',
                data: first
            });

            expect(realtime.tree).toBe(null);
            expect(updated.length).toBe(0);
        });
    });

});