import { CausalTree } from './CausalTree';
import { ValidatedCausalTree } from './ValidatedCausalTree';
import { AtomReducer } from './AtomReducer';
import { Atom, atom, atomId, AtomOp } from './Atom';
import { Weave } from './Weave';
import { storedTree } from './StoredCausalTree';
import { site } from './SiteIdInfo';
import { AtomValidator } from './AtomValidator';
import { TestCryptoImpl } from '../crypto/test/TestCryptoImpl';

enum OpType {
    root = 0,
    add = 1,
    subtract = 2
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
            if(atom.value.type === OpType.add) {
                val += 1;
            } else if(atom.value.type === OpType.subtract) {
                val -= 1;
            }
        }
        return [val, null];
    }
}

describe('ValidatedCausalTree', () => {
    describe('add()', () => {
        it('should not sign atoms if the validator is null', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());
            let validated = new ValidatedCausalTree(tree, null, null);

            const s1t0 = atom(atomId(1, 0), null, new Op());
            const ref = await validated.add(s1t0);

            expect(ref).toBe(s1t0);
        });

        it('should sign atoms if the validator is provided', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let validator = new AtomValidator(crypto)
            let validated = new ValidatedCausalTree(tree, validator, privateKey);

            const s1t0 = atom(atomId(1, 0), null, new Op());
            const ref = await validated.add(s1t0);

            expect(ref).not.toBe(s1t0);
            expect(ref.signature).toBeTruthy();
        });

        it('should not validate atoms if the known site doesnt have a public key', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());
            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let validator = new AtomValidator(crypto)
            let validated = new ValidatedCausalTree(tree, validator, privateKey);

            const s2t0 = atom(atomId(2, 0), null, new Op());
            const ref = await validated.add(s2t0);

            expect(ref).toBe(s2t0);
        });

        it('should validate atoms if the known site has a public key', async () => {
            let tree = new CausalTree(storedTree(site(1)), new Reducer());

            tree.registerSite(site(2, {
                signatureAlgorithm: 'ECDSA-SHA256-NISTP256',
                publicKey: 'test'
            }));

            let crypto = new TestCryptoImpl('ECDSA-SHA256-NISTP256');
            let [publicKey, privateKey] = await crypto.generateKeyPair();
            let validator = new AtomValidator(crypto)
            let validated = new ValidatedCausalTree(tree, validator, privateKey);

            const s2t0 = atom(atomId(2, 0), null, new Op());

            await expect(validated.add(s2t0)).rejects.toBeTruthy();
        });
    });
});