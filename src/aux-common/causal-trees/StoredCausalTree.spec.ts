import { StoredCausalTreeVersion1, upgrade, StoredCausalTreeVersion2, StoredCausalTreeVersion3 } from "./StoredCausalTree";
import { site } from "./SiteIdInfo";
import { atomId, atom } from "./Atom";

describe('StoredCausalTree', () => {
    describe('upgrade()', () => {
        it('should upgrade version 1', () => {
            const a1 = atom(atomId(1, 1), null, {type: 0});
            const a2 = atom(atomId(1, 2), atomId(1, 1), {type: 0});
            const a3 = atom(atomId(1, 3), atomId(1, 1), {type: 0});

            let stored: StoredCausalTreeVersion1<any> = {
                knownSites: [ site(1) ],
                site: site(1),
                weave: [
                    { atom: a1 },
                    { atom: a3 },
                    { atom: a2 }
                ]
            };

            expect(upgrade(stored)).toEqual({
                formatVersion: 3,
                knownSites: [ site(1) ],
                site: site(1),
                ordered: true,
                weave: [
                    a1, a3, a2
                ]
            });
        });

        it('should upgrade version 2', () => {
            const a1 = atom(atomId(1, 1), null, {type: 0});
            const a2 = atom(atomId(1, 2), atomId(1, 1), {type: 0});
            const a3 = atom(atomId(1, 3), atomId(1, 1), {type: 0});

            let stored: StoredCausalTreeVersion2<any> = {
                formatVersion: 2,
                knownSites: [ site(1) ],
                site: site(1),
                weave: [
                    a1,
                    a3,
                    a2
                ]
            };

            expect(upgrade(stored)).toEqual({
                formatVersion: 3,
                knownSites: [ site(1) ],
                site: site(1),
                ordered: true,
                weave: [
                    a1, a3, a2
                ]
            });
        });

        it('should upgrade version 3', () => {
            const a1 = atom(atomId(1, 1), null, {type: 0});
            const a2 = atom(atomId(1, 2), atomId(1, 1), {type: 0});
            const a3 = atom(atomId(1, 3), atomId(1, 1), {type: 0});

            let stored: StoredCausalTreeVersion3<any> = {
                formatVersion: 3,
                knownSites: [ site(1) ],
                site: site(1),
                ordered: false,
                weave: [
                    a1,
                    a3,
                    a2
                ]
            };

            expect(upgrade(stored)).toEqual({
                formatVersion: 3,
                knownSites: [ site(1) ],
                site: site(1),
                ordered: false,
                weave: [
                    a1, a3, a2
                ]
            });
        });
    });
});