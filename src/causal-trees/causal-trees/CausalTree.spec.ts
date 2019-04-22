import { CausalTree } from './CausalTree';
import { Atom, AtomId, AtomOp, atomId, atom } from './Atom';
import { AtomReducer } from './AtomReducer';
import { Weave } from './Weave';
import { site } from './SiteIdInfo';
import {
    storedTree,
    StoredCausalTreeVersion1,
    StoredCausalTree,
    StoredCausalTreeVersion2,
    StoredCausalTreeVersion3,
    currentFormatVersion,
} from './StoredCausalTree';
import { precalculatedOp } from './PrecalculatedOp';
import { jestPreset } from 'ts-jest';
import { AtomValidator } from './AtomValidator';
import { TestCryptoImpl, TestCryptoKey } from '../crypto/test/TestCryptoImpl';
import { RejectedAtom } from './RejectedAtom';
import { AddResult } from './AddResult';

enum OpType {
    root = 0,
    add = 1,
    subtract = 2,
}

class Op implements AtomOp {
    type: number;

    constructor(type: OpType = OpType.root) {
        this.type = type;
    }
}

class Reducer implements AtomReducer<Op, number, any> {
    refs: Atom<Op>[];

    eval(weave: Weave<Op>, refs?: Atom<Op>[]): [number, any] {
        this.refs = refs;
        let val = 0;
        for (let i = 0; i < weave.atoms.length; i++) {
            const atom = weave.atoms[i];
            if (atom.value.type === OpType.add) {
                val += 1;
            } else if (atom.value.type === OpType.subtract) {
                val -= 1;
            }
        }
        return [val, null];
    }
}

describe('CausalTree', () => {
    describe('constructor', () => {
        it('should not import the given weave', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            const root = await tree1.factory.create(new Op(), null); // Time 1
            await tree1.add(root);

            let tree2 = new CausalTree(
                storedTree(site(2), null, tree1.weave.atoms),
                new Reducer()
            );

            expect(tree2.weave.atoms.map(r => r)).toEqual([]);
        });

        it('should add the given known sites to the known sites list', () => {
            let tree1 = new CausalTree(
                storedTree(site(1), [site(2), site(1)]),
                new Reducer()
            );

            expect(tree1.knownSites).toEqual([{ id: 1 }, { id: 2 }]);
        });
    });

    describe('add()', () => {
        it('should update the factory time when adding an atom from another site', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            await tree.add(atom(atomId(2, 3), atomId(2, 2), new Op()));

            expect(tree.factory.time).toBe(4);
        });

        it('should update the factory time when adding an atom from this site', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            await tree.add(atom(atomId(1, 3), atomId(1, 2), new Op()));

            expect(tree.factory.time).toBe(3);
        });

        it('should trigger an event when an atom gets added', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            let refs: Atom<Op>[][] = [];
            tree.atomAdded.subscribe(ref => {
                refs.push(ref);
            });

            // no parent so it's skipped
            const { added: skipped } = await tree.add(
                atom(atomId(1, 3), atomId(1, 2), new Op())
            );

            const { added: root } = await tree.add(
                atom(atomId(1, 3), null, new Op())
            );
            const { added: child } = await tree.add(
                atom(atomId(1, 4), atomId(1, 3), new Op())
            );

            expect(refs).toEqual([[root], [child]]);
        });

        it('should batch multiple updates into one', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            let refs: Atom<Op>[][] = [];
            tree.atomAdded.subscribe(ref => {
                refs.push(ref);
            });

            let skipped: AddResult<Op>;
            let root: Atom<Op>;
            let child: Atom<Op>;
            await tree.batch(async () => {
                // no parent so it's skipped
                skipped = await tree.add(
                    atom(atomId(1, 3), atomId(1, 2), new Op())
                );

                ({ added: root } = await tree.add(
                    atom(atomId(1, 3), null, new Op())
                ));
                ({ added: child } = await tree.add(
                    atom(atomId(1, 4), atomId(1, 3), new Op())
                ));
            });

            expect(refs).toEqual([[root, child]]);
        });

        it('should validate incoming atoms', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let spy = jest
                .spyOn(validator, 'verifyBatch')
                .mockResolvedValue([true]);
            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );

            let a = atom(atomId(1, 0), null, new Op());
            a.signature = 'test';

            const { added } = await tree.add(a);
            expect(added).toBe(a);
            expect(spy).toBeCalledWith(
                expect.any(TestCryptoKey),
                expect.objectContaining([a])
            );
        });

        it('should reject atoms that have a signature but the tree doesnt have the public key for it', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let spy = jest
                .spyOn(validator, 'verifyBatch')
                .mockResolvedValue([true]);
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );

            const { added: root } = await tree.create(new Op(), null);

            let [site2Pub, site2Priv] = await crypto.generateKeyPair();
            let tree2 = new CausalTree(
                storedTree(
                    site(2, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test2',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: site2Priv,
                }
            );

            let rejected: RejectedAtom<Op>[] = [];
            let sub = tree2.atomRejected.subscribe(atoms => {
                rejected.push(...atoms);
            });

            const { added, rejected: rej } = await tree2.add(root);

            expect(added).toBe(null);
            expect(rej).toEqual({
                atom: root,
                reason: 'no_public_key',
            });
            expect(rejected).toEqual([{ atom: root, reason: 'no_public_key' }]);

            spy.mockRestore();
        });
    });

    describe('create()', () => {
        it('should sign new atoms if a validator and signing key are provided', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );
            crypto.valid = true;

            const { added: atom } = await tree.create(new Op(), null);
            expect(atom.signature).toBeTruthy();
        });

        it('should not sign new atoms if a validator and signing key are not provided', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer(), {});

            const { added: atom } = await tree.create(new Op(), null);
            expect(atom.signature).toBeFalsy();
        });

        it('should warn when a validator is provided but the stored site does not have a public key', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let [publicKey, privateKey] = await crypto.generateKeyPair();

            let spy = jest.spyOn(console, 'warn').mockImplementation(() => {});

            let tree = new CausalTree(storedTree(site(1)), new Reducer(), {
                validator: validator,
                signingKey: privateKey,
            });

            expect(spy).toBeCalled();

            spy.mockRestore();
        });
    });

    describe('addMany()', () => {
        it('should produce a consistent weave from randomly sorted atoms', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let atoms: Atom<Op>[] = [];
            for (let i = 0; i < 1000; i++) {
                let cause = null;
                if (i !== 0) {
                    const random = Math.round(
                        Math.random() * (atoms.length - 1)
                    );
                    cause = atoms[random];
                    atoms.push(await tree1.factory.create(new Op(), cause.id));
                } else {
                    atoms.push(await tree1.factory.create(new Op(), null));
                }
            }

            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            for (let i = 0; i < atoms.length; i++) {
                let random = Math.round(Math.random() * (atoms.length - 1));
                let temp = atoms[random];
                atoms[random] = atoms[i];
                atoms[i] = temp;
            }

            const added = await tree2.addMany(atoms);

            expect(tree2.weave.isValid()).toBe(true);
            expect(added.added.length).toBe(atoms.length);
            for (let i = 0; i < atoms.length; i++) {
                expect(added.added).toContainEqual(atoms[i]);
            }
        });

        it('should produce a consistent weave even if some atoms get dropped', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let atoms: Atom<Op>[] = [];
            for (let i = 0; i < 1000; i++) {
                let cause = null;
                if (i !== 0) {
                    const random = Math.round(
                        Math.random() * (atoms.length - 1)
                    );
                    cause = atoms[random];
                    atoms.push(await tree1.factory.create(new Op(), cause.id));
                } else {
                    atoms.push(await tree1.factory.create(new Op(), null));
                }
            }

            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            for (let i = 0; i < atoms.length; i++) {
                let random = Math.round(Math.random() * (atoms.length - 1));
                let temp = atoms[random];
                atoms[random] = atoms[i];
                atoms[i] = temp;
            }

            let filtered = atoms.filter(
                a => Math.round(Math.random() * 2) % 2 === 0
            );

            const added = tree2.addMany(filtered);

            expect(tree2.weave.isValid()).toBe(true);
        });

        it('should emit rejected atoms all together', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let atoms: Atom<Op>[] = [];

            let s1t0 = atom(atomId(1, 0), null, new Op());
            let s2t0 = atom(atomId(2, 0), null, new Op());
            let s5t2 = atom(atomId(5, 2), atomId(1, 2), new Op());

            let rejected: RejectedAtom<Op>[][] = [];
            tree1.atomRejected.subscribe(atoms => {
                rejected.push(atoms);
            });

            const added = await tree1.addMany([s1t0, s2t0, s5t2]);

            expect(rejected).toEqual([
                [
                    { atom: s2t0, reason: 'second_root_not_allowed' },
                    { atom: s5t2, reason: 'cause_not_found' },
                ],
            ]);
        });
    });

    describe('value', () => {
        it('should calculate the value using the reducer', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            const { added: root } = await tree.add(
                await tree.factory.create(new Op(), null)
            );
            await tree.create(new Op(OpType.add), root);
            await tree.create(new Op(OpType.subtract), root);
            await tree.create(new Op(OpType.add), root);

            expect(tree.value).toBe(1);
        });
    });

    describe('export()', () => {
        it('should export a stored tree with the current version', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            const { added: root } = await tree.add(
                await tree.factory.create(new Op(), null)
            );
            await tree.add(await tree.factory.create(new Op(OpType.add), root));
            await tree.add(await tree.factory.create(new Op(OpType.add), root));
            await tree.add(await tree.factory.create(new Op(OpType.add), root));

            const exported = tree.export();

            expect(exported.formatVersion).toBe(currentFormatVersion);
        });
    });

    describe('import()', () => {
        describe('version 1', () => {
            it('should be able to import', async () => {
                let weave = new Weave<Op>();

                const [a1] = weave.insert(atom(atomId(1, 1), null, new Op()));
                const [a2] = weave.insert(
                    atom(atomId(1, 2), atomId(1, 1), new Op())
                );
                const [a3] = weave.insert(
                    atom(atomId(1, 3), atomId(1, 1), new Op())
                );

                let stored: StoredCausalTreeVersion1<Op> = {
                    knownSites: [site(1)],
                    site: site(1),
                    weave: weave.atoms.map(atom => ({ atom })),
                };

                let tree = new CausalTree(storedTree(site(2)), new Reducer());
                const added = await tree.import(stored);

                expect(added.added).toEqual([a1, a3, a2]);
            });
        });

        describe('version 2', () => {
            it('should be able to import', async () => {
                let weave = new Weave<Op>();

                const [a1] = weave.insert(atom(atomId(1, 1), null, new Op()));
                const [a2] = weave.insert(
                    atom(atomId(1, 2), atomId(1, 1), new Op())
                );
                const [a3] = weave.insert(
                    atom(atomId(1, 3), atomId(1, 1), new Op())
                );

                let stored: StoredCausalTreeVersion2<Op> = {
                    formatVersion: 2,
                    knownSites: [site(1)],
                    site: site(1),
                    weave: weave.atoms,
                };

                let tree = new CausalTree(storedTree(site(2)), new Reducer());
                const added = await tree.import(stored);

                expect(added.added).toEqual([a1, a3, a2]);
            });
        });

        describe('version 3', () => {
            it('should be able to import', async () => {
                let weave = new Weave<Op>();

                const [a1] = weave.insert(atom(atomId(1, 1), null, new Op()));
                const [a2] = weave.insert(
                    atom(atomId(1, 2), atomId(1, 1), new Op())
                );
                const [a3] = weave.insert(
                    atom(atomId(1, 3), atomId(1, 1), new Op())
                );

                let stored: StoredCausalTreeVersion3<Op> = {
                    formatVersion: 3,
                    knownSites: [site(1)],
                    site: site(1),
                    weave: weave.atoms,
                    ordered: true,
                };

                let tree = new CausalTree(storedTree(site(2)), new Reducer());
                const added = await tree.import(stored);

                expect(added.added).toEqual([a1, a3, a2]);
            });

            it('should be able to import unordered weaves', async () => {
                let weave = new Weave<Op>();

                const [a1] = weave.insert(atom(atomId(1, 1), null, new Op()));
                const [a2] = weave.insert(
                    atom(atomId(1, 2), atomId(1, 1), new Op())
                );
                const [a3] = weave.insert(
                    atom(atomId(1, 3), atomId(1, 1), new Op())
                );

                let stored: StoredCausalTreeVersion3<Op> = {
                    formatVersion: 3,
                    knownSites: [site(1)],
                    site: site(1),
                    weave: [a3, a1, a2],
                    ordered: false,
                };

                let tree = new CausalTree(storedTree(site(2)), new Reducer());
                const added = await tree.import(stored);

                expect(added.added).toEqual([a1, a2, a3]);
            });
        });

        it('should ignore unknown versions', async () => {
            const spy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            let weave = new Weave<Op>();

            const a1 = weave.insert(atom(atomId(1, 1), null, new Op()));
            const a2 = weave.insert(atom(atomId(1, 2), atomId(1, 1), new Op()));
            const a3 = weave.insert(atom(atomId(1, 3), atomId(1, 1), new Op()));

            let stored: StoredCausalTree<Op> = <any>{
                formatVersion: 1000,
                knownSites: [site(1)],
                site: site(1),
                weave: weave.atoms.map(atom => ({ atom })),
            };

            let tree = new CausalTree(storedTree(site(2)), new Reducer());
            const added = await tree.import(stored);

            expect(added.added).toEqual([]);

            spy.mockRestore();
        });

        it('should import known sites', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            tree.registerSite(site(3));
            tree.registerSite(site(2));
            tree.registerSite(site(6));
            await tree2.import(tree.export());

            expect(tree2.knownSites).toEqual([
                site(2),
                site(1),
                site(3),
                site(6),
            ]);
        });

        it('should import known sites before importing atoms', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let spy = jest
                .spyOn(validator, 'verifyBatch')
                .mockResolvedValue([true]);
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );

            const { added: root, rejected: rej } = await tree.create(
                new Op(),
                null
            );

            expect(rej).toBe(null);

            let [site2Pub, site2Priv] = await crypto.generateKeyPair();
            let tree2 = new CausalTree(
                storedTree(
                    site(2, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test2',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: site2Priv,
                }
            );

            let rejected: RejectedAtom<Op>[] = [];
            let sub = tree2.atomRejected.subscribe(atoms => {
                rejected.push(...atoms);
            });

            const exported = tree.export();

            const added = await tree2.import(exported);

            expect(added.added).toEqual([root]);
            expect(added.rejected).toEqual([]);
            expect(rejected).toEqual([]);

            spy.mockRestore();
        });
    });

    describe('importWeave()', () => {
        it('should update the current time based on the given references', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = await tree1.factory.create(new Op(), null); // Time 1
            await tree1.add(root);
            await tree2.add(root); // Time 2

            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 3
            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 4
            await tree2.add(
                await tree2.factory.create(new Op(OpType.subtract), root)
            ); // Time 5

            await tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(6);
        });

        it('should update the current time even when importing from the same site', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            let tree2 = new CausalTree(storedTree(site(1)), new Reducer());

            const root = await tree1.factory.create(new Op(), null); // Time 1
            await tree1.add(root);
            await tree2.add(root); // Time 1

            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 2
            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 3
            await tree2.add(
                await tree2.factory.create(new Op(OpType.subtract), root)
            ); // Time 4

            await tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(4);
        });

        it('should not update the current time when importing duplicates', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = await tree1.factory.create(new Op(), null); // Time 1
            await tree1.add(root);
            await tree2.add(root); // Time 2

            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 3
            await tree2.add(
                await tree2.factory.create(new Op(OpType.add), root)
            ); // Time 4
            await tree2.add(
                await tree2.factory.create(new Op(OpType.subtract), root)
            ); // Time 5

            await tree1.importWeave(tree2.weave.atoms);
            await tree1.importWeave(tree2.weave.atoms);

            expect(tree1.time).toBe(6);
        });

        it('should only include the atoms that were added to the weave when calculating', async () => {
            const reducer = new Reducer();
            let tree1 = new CausalTree(storedTree(site(1)), reducer);
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = await tree1.factory.create(new Op(), null);
            await tree1.add(root);
            await tree2.add(root);

            const { added: add1 } = await tree2.add(
                atom(atomId(2, 10), root.id, new Op(OpType.add))
            );
            const { added: add2 } = await tree2.add(
                atom(atomId(2, 11), root.id, new Op(OpType.add))
            );
            const { added: sub } = await tree2.add(
                atom(atomId(2, 12), add2.id, new Op(OpType.subtract))
            );

            tree2.weave.remove(add2);

            await tree1.importWeave([...tree2.weave.atoms, sub]);

            expect(reducer.refs).toEqual([add1]);
            expect(tree1.value).toBe(1);
        });

        it('should not import atoms if they are invalid', async () => {
            const spy = jest
                .spyOn(console, 'warn')
                .mockImplementation(() => {});
            const reducer = new Reducer();
            let tree1 = new CausalTree(storedTree(site(1)), reducer);

            const root = await tree1.factory.create(new Op(), null);
            await tree1.add(root);

            const add1 = atom(atomId(2, 10), root.id, new Op(OpType.add));
            const add2 = atom(atomId(2, 11), root.id, new Op(OpType.add));
            const sub = atom(atomId(2, 12), add2.id, new Op(OpType.subtract));

            expect(tree1.importWeave([root, add1, add2, sub])).rejects.toThrow(
                /not valid/i
            );

            spy.mockRestore();
        });

        it('should validate incoming atoms signatures if specified', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let [publicKey, privateKey] = await crypto.generateKeyPair();

            let spy = jest
                .spyOn(validator, 'verifyBatch')
                .mockResolvedValue([true]);

            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );

            const root = await tree.factory.create(new Op(), null);
            const add1 = await tree.factory.create(new Op(OpType.add), root.id);
            const add2 = await tree.factory.create(new Op(OpType.add), root.id);
            const sub = await tree.factory.create(
                new Op(OpType.subtract),
                add2.id
            );

            await tree.importWeave([root, add2, sub, add1], true, true);

            expect(spy).toBeCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(
                expect.any(TestCryptoKey),
                expect.arrayContaining([root, add2, sub, add1])
            );
        });

        it('should reject atoms with invalid signatures', async () => {
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let validator = new AtomValidator(crypto);
            let [publicKey, privateKey] = await crypto.generateKeyPair();

            let spy = jest
                .spyOn(validator, 'verifyBatch')
                .mockResolvedValueOnce([true, false, false, false]);

            let tree = new CausalTree(
                storedTree(
                    site(1, {
                        signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                        publicKey: 'test',
                    })
                ),
                new Reducer(),
                {
                    validator: validator,
                    signingKey: privateKey,
                }
            );

            const root = await tree.factory.create(new Op(), null);
            const add1 = await tree.factory.create(new Op(OpType.add), root.id);
            const add2 = await tree.factory.create(new Op(OpType.add), root.id);
            const sub = await tree.factory.create(
                new Op(OpType.subtract),
                add2.id
            );

            const rejected: RejectedAtom<Op>[] = [];
            tree.atomRejected.subscribe(atoms => {
                rejected.push(...atoms);
            });

            const added = await tree.importWeave(
                [root, add2, sub, add1],
                true,
                true
            );

            expect(added.added).toEqual([]);
            expect(added.rejected).toEqual([
                { atom: add2, reason: 'signature_failed' },
                { atom: sub, reason: 'signature_failed' },
                { atom: add1, reason: 'signature_failed' },
            ]);
            expect(rejected).toEqual([
                { atom: add2, reason: 'signature_failed' },
                { atom: sub, reason: 'signature_failed' },
                { atom: add1, reason: 'signature_failed' },
            ]);

            spy.mockRestore();
        });
    });

    describe('knownSites', () => {
        it('should default to only our site ID', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            expect(tree1.knownSites).toEqual([{ id: 1 }]);
        });

        it('should not combine with the weaves known sites', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());
            let tree2 = new CausalTree(storedTree(site(2)), new Reducer());

            const root = await tree1.factory.create(new Op(), null);
            await tree1.add(root);
            await tree2.add(root);

            expect(tree2.knownSites).toEqual([{ id: 2 }]);
        });

        it('should allow adding sites via registerSite()', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            tree1.registerSite(site(12));

            expect(tree1.knownSites).toEqual([{ id: 1 }, { id: 12 }]);
        });

        it('should ignore duplicate sites', () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            tree1.registerSite(site(1));

            expect(tree1.knownSites).toEqual([{ id: 1 }]);
        });
    });

    describe('createFromPrecalculated()', () => {
        it('should add the given op to the tree', async () => {
            let tree1 = new CausalTree(storedTree(site(1)), new Reducer());

            await tree1.createFromPrecalculated(precalculatedOp(new Op()));

            expect(tree1.weave.atoms.length).toBe(1);
        });
    });
});
