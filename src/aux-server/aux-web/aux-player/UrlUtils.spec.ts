/* CasualOS is a set of web-based tools designed to facilitate the creation of real-time, multi-user, context-aware interactive experiences.
 *
 * Copyright (c) 2019-2025 Casual Simulation, Inc.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
import { getInstParameters, getPermalink } from './UrlUtils';

describe('getInstParameters()', () => {
    it('should return null if no inst options could be resolved', () => {
        const params = getInstParameters({ ab: 'test' });
        expect(params).toEqual(null);
    });

    it('should use the owner parameter', () => {
        const params = getInstParameters({
            inst: 'test',
            owner: 'testRecord',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: 'testRecord',
            owner: 'testRecord',
            kind: 'default',
        });
    });

    it('should return the inst and record', () => {
        const params = getInstParameters({
            inst: 'test',
            record: 'testRecord',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: 'testRecord',
            owner: null,
            kind: 'default',
        });
    });

    it('should support multiple insts', () => {
        const params = getInstParameters({
            inst: ['test', 'abc'],
            record: 'testRecord',
        });
        expect(params).toEqual({
            inst: ['test', 'abc'],
            recordName: 'testRecord',
            owner: null,
            kind: 'default',
        });
    });

    it('should support public insts', () => {
        const params = getInstParameters({ inst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'default',
        });
    });

    it('should support the story param', () => {
        const params = getInstParameters({ story: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'default',
            story: true,
        });
    });

    it('should support the server param', () => {
        const params = getInstParameters({ server: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'default',
            server: true,
        });
    });

    it('should support static insts', () => {
        const params = getInstParameters({ staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'static',
        });
    });

    it('should support temp insts', () => {
        const params = getInstParameters({ tempInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'temp',
        });
    });

    it('should prefer static insts', () => {
        const params = getInstParameters({ inst: 'abc', staticInst: 'test' });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'static',
        });
    });

    it('should not support deleting insts (with inst=)', () => {
        const params = getInstParameters({
            bios: 'delete inst',
            inst: 'test',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'default',
        });
    });

    it('should not support deleting insts (with staticInst=)', () => {
        const params = getInstParameters({
            bios: 'delete inst',
            staticInst: 'test',
        });
        expect(params).toEqual({
            inst: 'test',
            recordName: null,
            owner: null,
            kind: 'static',
        });
    });
});

describe('getPermalink()', () => {
    it('should add the given record name to the URL', () => {
        const url = getPermalink('https://test.com', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should do nothing if the record name is null', () => {
        const url = getPermalink('https://test.com', null);
        expect(url).toEqual('https://test.com/');
    });

    it('should remove the owner if the record name is null', () => {
        const url = getPermalink('https://test.com?owner=test', null);
        expect(url).toEqual('https://test.com/');
    });

    it('should overwrite the owner on the URL with the record name', () => {
        const url = getPermalink('https://test.com?owner=test', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should preserve the owner if the owner is public and the recordName is null', () => {
        const url = getPermalink('https://test.com?owner=public', null);
        expect(url).toEqual('https://test.com/?owner=public');
    });

    it('should remove the record query parameter', () => {
        const url = getPermalink('https://test.com?record=other', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });

    it('should remove the player query parameter', () => {
        const url = getPermalink('https://test.com?player=other', 'testRecord');
        expect(url).toEqual('https://test.com/?owner=testRecord');
    });
});
