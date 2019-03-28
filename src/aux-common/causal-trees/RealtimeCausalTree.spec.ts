import { RealtimeCausalTree } from './RealtimeCausalTree';
import { AtomOp, atom, atomId, Atom } from './Atom';
import { CausalTreeStore } from './CausalTreeStore';
import { CausalTreeFactory } from './CausalTreeFactory';
import { RealtimeChannel } from './RealtimeChannel';
import { TestCausalTreeStore } from './test/TestCausalTreeStore';
import { CausalTree } from './CausalTree';
import { AtomReducer } from './AtomReducer';
import { Weave } from './Weave';
import { TestChannelConnection } from './test/TestChannelConnection';
import { site, SiteInfo } from './SiteIdInfo';
import { SiteVersionInfo } from './SiteVersionInfo';
import { StoredCausalTree } from '.';
import { storedTree } from './StoredCausalTree';
import { TestScheduler } from 'rxjs/testing';
import { AsyncScheduler } from "rxjs/internal/scheduler/AsyncScheduler";
import { AtomValidator } from './AtomValidator';
import { TestCryptoImpl } from '../crypto/test/TestCryptoImpl';
import { RejectedAtom } from './RejectedAtom';

jest.useFakeTimers();

class Op implements AtomOp {
    type: number;
}

class Tree extends CausalTree<Op, number, any> {

}

class NumberReducer implements AtomReducer<Op, number, any> {
    eval(weave: Weave<Op>): [number, any] {
        return [0, null];
    }
}

describe('RealtimeCausalTree', () => {
    let realtime: RealtimeCausalTree<Tree>;
    let store: TestCausalTreeStore;
    let factory: CausalTreeFactory;
    let channel: RealtimeChannel<Atom<Op>[]>;
    let connection: TestChannelConnection;
    let flush = false;
    let weave: Atom<Op>[];
    let knownSites: SiteInfo[]; 
    let siteVersion: SiteVersionInfo;
    let allowSiteId: boolean[];
    let localWeaves: Atom<Op>[][];
    let errors: any[] = [];
    let updated: Atom<Op>[][] = [];
    let scheduler: TestScheduler;

    beforeEach(() => {
        scheduler = new TestScheduler((actual, expected) => {
            expect(actual).toEqual(expected);
        });
        AsyncScheduler.delegate = scheduler;

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
            'numbers': (tree, options) => new Tree(tree, new NumberReducer(), options)
        });
        connection = new TestChannelConnection();
        channel = new RealtimeChannel<Atom<Op>[]>({
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
            } else if(name === 'join_channel') {
                return null;
            } else {
                localWeaves.push(data.weave);
                return storedTree(site(1), [], weave);
            }
        };
    });

    afterEach(() => {
        AsyncScheduler.delegate = null;
        expect(errors).toEqual([]);
    });

    describe('init()', () => {
        it('should have a null tree by default', async () => {
            await realtime.init();

            expect(realtime.tree).toBe(null);
        });

        it('should load the tree from the store', async () => {
            await store.put('abc', {
                site: site(2),
                knownSites: null,
                weave: null
            });

            await realtime.init();

            expect(realtime.tree).not.toBe(null);
        });

        it('should load the version 2 tree from the store', async () => {
            await store.put('abc', {
                formatVersion: 2,
                site: site(2),
                knownSites: null,
                weave: null
            });

            await realtime.init();

            expect(realtime.tree).not.toBe(null);
        });
    });

    describe('new site', () => {
        it('should add the new site to the tree', async () => {
            let spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            connection.events.next({
                name: 'site_abc',
                data: { id: 1000 }
            });

            expect(realtime.tree.knownSites).toContainEqual({
                id: 1000
            });

            spy.mockRestore();
        });
    });

    describe('connected without existing tree', () => {
        let spy: jest.SpyInstance<any>;
        beforeAll(() => {
            spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterAll(() => {
            spy.mockRestore();
        });

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
            scheduler.flush();
            await connection.flushPromise();

            expect(realtime.tree).not.toBe(null);
            expect(realtime.tree.site).toEqual(site(5));
            expect(updated.length).toBe(1);
        });

        it('should be based on the first unused site ID from the known sites list', async () => {
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

        it('should save the tree info to the store', async () => {
            knownSites.push(site(99), site(10));

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            const stored = await store.get('abc');

            expect(stored).toBeTruthy();
            expect(stored.knownSites).toEqual([
                site(100), site(1), site(99), site(10)
            ]);
            expect(stored.site).toEqual(site(100));
        });

        it('should generate a public key and private key if there are none in the store', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let generateSpy = jest.spyOn(crypto, 'generateKeyPair');
            let validator = new AtomValidator(crypto);
            let tree = new RealtimeCausalTree(factory, store, channel, {
                validator: validator
            });

            await tree.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(generateSpy).toBeCalled();
            expect(tree.tree.site.crypto).toBeTruthy();
            expect(tree.tree.site.crypto.publicKey).toBeTruthy();
            expect(tree.tree.site.crypto.signatureAlgorithm).toBe('ECDSA-SHA256-NISTP256');
            expect(tree.tree.factory.signingKey).toBeTruthy();

            const stored = await store.getKeys('abc');
            expect(stored).toBeTruthy();
            expect(stored.privateKey).toBeTruthy();
            expect(stored.publicKey).toBeTruthy();
        });

        it('should use the stored keys', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let generateSpy = jest.spyOn(crypto, 'generateKeyPair');
            let validator = new AtomValidator(crypto);
            let tree = new RealtimeCausalTree(factory, store, channel, {
                validator: validator
            });

            let privateKey = 'abcdefgh';
            let publicKey = 'iasfasdfa';
            await store.putKeys('abc', privateKey, publicKey);

            await tree.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(generateSpy).not.toBeCalled();
            expect(tree.tree.site.crypto).toBeTruthy();
            expect(tree.tree.site.crypto.publicKey).toBe(publicKey);
            expect(tree.tree.site.crypto.signatureAlgorithm).toBe('ECDSA-SHA256-NISTP256');
            expect(tree.tree.factory.signingKey).toBeTruthy();
            expect(tree.tree.factory.signingKey.type).toBe(privateKey);
        });

        it('should send rejected atoms', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let spy = jest.spyOn(crypto, 'verify').mockResolvedValue(false);
            let validator = new AtomValidator(crypto);
            let tree = new RealtimeCausalTree(factory, store, channel, {
                validator: validator
            });

            let w = new Weave<Op>();
            let [root] = w.insert(atom(atomId(1, 0), null, new Op()));
            root.signature = 'bad';

            weave.push(...w.atoms);

            let rejected: RejectedAtom<AtomOp>[][] = [];
            tree.onRejected.subscribe(r => {
                rejected.push(r);
            });

            await tree.init();
            connection.setConnected(true);
            await connection.flushPromises();

            expect(rejected).toEqual([
                [
                    { atom: root, reason: 'no_public_key' },
                ]
            ]);
        });
    });

    describe('connected with existing tree', () => {
        let spy: jest.SpyInstance<any>;
        beforeAll(() => {
            spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterAll(() => {
            spy.mockRestore();
        });

        describe('version 1', () => {
            it('should import the version 1 weave from the store', async () => {
                let localWeave = new Weave<Op>();
                localWeave.insert(atom(atomId(1, 0), null, new Op()));
                localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
                localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));
    
                await store.put('abc', <StoredCausalTree<Op>>{
                    site: site(2),
                    knownSites: [
                        site(1),
                        site(2)
                    ],
                    weave: localWeave.atoms.map(a => ({
                        atom: a
                    }))
                });
    
                await realtime.init();
    
                expect(realtime.tree).not.toBe(null);
                expect(realtime.tree.weave.atoms).toEqual(localWeave.atoms);
                expect(updated.length).toBe(1);
            });
        });


        it('should import the weave from the store', async () => {
            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));

            await store.put('abc', {
                formatVersion: 2,
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
            const newRef1 = remoteWeave.insert(atom(atomId(1, 1), atomId(1, 0), new Op()));
            const newRef2 = remoteWeave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            
            let finalWeave = new Weave<Op>();
            finalWeave.import(localWeave.atoms);
            finalWeave.import(remoteWeave.atoms);
            
            weave.push(...remoteWeave.atoms);
            await store.put('abc', {
                formatVersion: 2,
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

            await store.put('abc', {
                formatVersion: 2,
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

        it('should use the stored keys', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let generateSpy = jest.spyOn(crypto, 'generateKeyPair');
            let validator = new AtomValidator(crypto);
            let tree = new RealtimeCausalTree(factory, store, channel, {
                validator: validator
            });

            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));
            
            knownSites.push(site(1999));

            await store.put('abc', {
                formatVersion: 2,
                site: site(2),
                knownSites: [
                    site(2)
                ],
                weave: localWeave.atoms
            });

            let privateKey = 'abcdefgh';
            let publicKey = 'iasfasdfa';
            await store.putKeys('abc', privateKey, publicKey);

            await tree.init();
            await connection.flushPromises();

            expect(generateSpy).not.toBeCalled();
            expect(tree.tree).toBeTruthy();
            expect(tree.tree.site.crypto).toBeTruthy();
            expect(tree.tree.site.crypto.publicKey).toBe(publicKey);
            expect(tree.tree.site.crypto.signatureAlgorithm).toBe('ECDSA-SHA256-NISTP256');
            expect(tree.tree.factory.signingKey).toBeTruthy();
            expect(tree.tree.factory.signingKey.type).toBe(privateKey);
        });

        it('should not generate new keys if they dont exist', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let generateSpy = jest.spyOn(crypto, 'generateKeyPair');
            let validator = new AtomValidator(crypto);
            let tree = new RealtimeCausalTree(factory, store, channel, {
                validator: validator
            });

            let localWeave = new Weave<Op>();
            localWeave.insert(atom(atomId(1, 0), null, new Op()));
            localWeave.insert(atom(atomId(2, 3), atomId(1, 0), new Op()));
            localWeave.insert(atom(atomId(2, 4), atomId(1, 0), new Op()));
            
            knownSites.push(site(1999));

            await store.put('abc', {
                formatVersion: 2,
                site: site(2),
                knownSites: [
                    site(2)
                ],
                weave: localWeave.atoms
            });

            await tree.init();
            await connection.flushPromises();

            expect(generateSpy).not.toBeCalled();
            expect(tree.tree).toBeTruthy();
            expect(tree.tree.site.crypto).toBeFalsy();
            expect(tree.tree.factory.signingKey).toBeFalsy();
        });
    });

    describe('reconnect', () => {
        let spy: jest.SpyInstance<any>;
        beforeAll(() => {
            spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });

        afterAll(() => {
            spy.mockRestore();
        });

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
            await store.put('abc', {
                formatVersion: 2,
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

            const [addedRef] = remoteWeave.insert(atom(atomId(1, 5), atomId(1, 0), new Op()));
            finalWeave.import(remoteWeave.atoms);
            weave.splice(0, weave.length, ...remoteWeave.atoms);

            connection.setConnected(false);
            connection.setConnected(true);
            await connection.flushPromises();

            expect(realtime.tree.weave.atoms).toEqual(finalWeave.atoms);
            expect(updated[2]).toEqual([
                addedRef
            ]);
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
            await store.put('abc', {
                formatVersion: 2,
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

            await store.put('abc', {
                formatVersion: 2,
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
        let spy: jest.SpyInstance<any>;
        beforeAll(() => {
            spy = jest.spyOn(console, 'log').mockImplementation(() => {});
        });
        
        afterAll(() => {
            spy.mockRestore();
        });

        it('should try to insert new atoms into the tree', async () => {
            let weave = new Weave<Op>();

            const [root] = weave.insert(atom(atomId(1, 0), null, new Op()));
            const [first] = weave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            await realtime.init();
            connection.setConnected(true);
            await connection.flushPromises();

            // send root event
            connection.events.next({
                name: 'event_abc',
                data: [root]
            });

            connection.events.next({
                name: 'event_abc',
                data: [first]
            });
            scheduler.flush();

            // flush all the promises
            for (let i = 0; i < 10; i++) {
                await connection.flushPromise();
            }

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

            const { added: root } = await realtime.tree.add(atom(atomId(2, 1), null, new Op()));
            const { added: child } = await realtime.tree.add(atom(atomId(2, 2), atomId(2, 1), new Op()));
            const { added: skipped } = await realtime.tree.add(atom(atomId(2, 3), atomId(2, 10), new Op()));
            const { added: alsoSkipped } = await realtime.tree.add(atom(atomId(3, 4), atomId(2, 1), new Op()));

            expect(connection.emitted).toContainEqual({
                name: 'event_abc',
                data: [root]
            });

            expect(connection.emitted).toContainEqual({
                name: 'event_abc',
                data: [child]
            });

            expect(connection.emitted).not.toContainEqual({
                name: 'event_abc',
                data: [skipped]
            });

            expect(connection.emitted).not.toContainEqual({
                name: 'event_abc',
                data: [alsoSkipped]
            });

            // 1 connection + 2 events
            expect(updated.length).toBe(3);
        });

        it('should ignore events if the tree has not been initialized', async () => {
            
            let weave = new Weave<Op>();

            const [root] = weave.insert(atom(atomId(1, 0), null, new Op()));
            const [first] = weave.insert(atom(atomId(1, 2), atomId(1, 0), new Op()));

            await realtime.init();
            await connection.flushPromises();

             // send root event
             connection.events.next({
                name: 'event_abc',
                data: [root]
            });

            connection.events.next({
                name: 'event_abc',
                data: [first]
            });

            expect(realtime.tree).toBe(null);
            expect(updated.length).toBe(0);
        });
    });

});