import undom, { registerMethodHandler } from './index';

describe('undom', () => {
    it('should create a Document', () => {
        let document: any = undom();
        expect(document).toBeInstanceOf(document.Document);
    });

    it('should create a valid Document tree', () => {
        let document: any = undom();
        let html = document.documentElement;

        expect(html).toBeInstanceOf(document.Element);
        expect(html).toHaveProperty('nodeName', '#document');

        expect(document.head).toBeInstanceOf(document.Element);
        expect(document.head).toHaveProperty('nodeName', 'HEAD');
        expect(document.head).toHaveProperty('parentNode', html);

        expect(document.body).toBeInstanceOf(document.Element);
        expect(document.body).toHaveProperty('nodeName', 'BODY');
        expect(document.body).toHaveProperty('parentNode', html);
    });

    describe('createElement()', () => {
        let document: any;

        beforeEach(() => {
            document = undom();
        });

        it('should create an Element', () => {
            expect(document.createElement('div')).toBeInstanceOf(
                document.Element
            );
        });

        it('should generate correct nodeNames', () => {
            expect(document.createElement('div')).toHaveProperty(
                'nodeName',
                'DIV'
            );
            expect(document.createElement('section')).toHaveProperty(
                'nodeName',
                'SECTION'
            );
            expect(document.createElement('span')).toHaveProperty(
                'nodeName',
                'SPAN'
            );
            expect(document.createElement('foo-bar')).toHaveProperty(
                'nodeName',
                'FOO-BAR'
            );
            expect(document.createElement('Foo:bar')).toHaveProperty(
                'nodeName',
                'FOO:BAR'
            );
        });

        it('should generate correct nodeTypes', () => {
            expect(document).toHaveProperty('nodeType', 9);
            expect(document.createElement('div')).toHaveProperty('nodeType', 1);
            expect(document.createElement('section')).toHaveProperty(
                'nodeType',
                1
            );
            expect(document.createElement('span')).toHaveProperty(
                'nodeType',
                1
            );
        });
    });

    describe('createElementNS()', () => {
        let document: any;

        beforeEach(() => {
            document = undom();
        });

        it('should create HTMLElement objects by default', () => {
            expect(document.createElementNS(null, 'div')).toBeInstanceOf(
                document.HTMLElement
            );
        });

        it('should create HTMLElement objects by namespace', () => {
            expect(
                document.createElementNS('http://www.w3.org/1999/xhtml', 'div')
            ).toBeInstanceOf(document.HTMLElement);
        });

        it('should create SVGElement objects by namespace', () => {
            expect(
                document.createElementNS('http://www.w3.org/2000/svg', 'circle')
            ).toBeInstanceOf(document.SVGElement);
        });

        it('should throw a DOMException if given an invalid namespace', () => {
            expect(() => {
                document.createElementNS('invalid', 'div');
            }).toThrow(
                new document.DOMException(
                    'The specified namespace is not supported.',
                    'NamespaceError'
                )
            );
        });
    });

    describe('getElementById()', () => {
        it('should return the first element with the given ID', () => {
            let document: any = undom();

            let div1 = document.createElement('div');
            let div2 = document.createElement('div');
            let div3 = document.createElement('div');
            let div4 = document.createElement('div');

            document.body.appendChild(div1);
            document.body.appendChild(div2);
            document.body.appendChild(div3);
            document.body.appendChild(div4);

            div1.id = 'div1';
            div2.id = 'div2';
            div3.id = 'div3';
            div4.id = 'div4';

            expect(document.getElementById('div1') === div1).toBe(true);
            expect(document.getElementById('div2') === div2).toBe(true);
            expect(document.getElementById('div3') === div3).toBe(true);
            expect(document.getElementById('div4') === div4).toBe(true);
            expect(document.getElementById('missing')).toBe(null);
        });

        it('should return the most recently set ID', () => {
            let document: any = undom();

            let div1 = document.createElement('div');
            let div2 = document.createElement('div');

            document.body.appendChild(div1);
            document.body.appendChild(div2);

            div1.id = 'div1';
            div2.id = 'div1';

            expect(document.getElementById('div1') === div2).toBe(true);

            div1.id = 'div1';

            expect(document.getElementById('div1') === div1).toBe(true);
        });
    });

    describe('Element', () => {
        let document: any;

        beforeEach(() => {
            document = undom();
        });

        describe('#appendChild', () => {
            it('should set parentNode', () => {
                let child = document.createElement('span');
                let parent = document.createElement('div');
                parent.appendChild(child);
                expect(child).toHaveProperty('parentNode', parent);
            });

            it('should insert into .children / .childNodes', () => {
                let child = document.createElement('span');
                let parent = document.createElement('div');

                parent.appendChild(child);
                expect(parent).toHaveProperty('childNodes', [child]);
                expect(parent).toHaveProperty('children', [child]);
                expect(child).toHaveProperty('parentNode', parent);

                parent.appendChild(child);
                expect(parent).toHaveProperty('childNodes', [child]);
                expect(parent).toHaveProperty('children', [child]);
                expect(child).toHaveProperty('parentNode', parent);
            });

            it('should remove child from any current parentNode', () => {
                let child = document.createElement('span');
                let parent1 = document.createElement('div');
                let parent2 = document.createElement('div');

                parent1.appendChild(child);
                expect(parent1.childNodes).toEqual([child]);
                expect(child).toHaveProperty('parentNode', parent1);

                parent2.appendChild(child);
                expect(child).toHaveProperty('parentNode', parent2);
                expect(parent1.childNodes).toEqual([]);
                expect(parent2.childNodes).toEqual([child]);
            });

            describe('mutations', () => {
                let mutations: MutationRecord[];
                let observer: MutationObserver;
                beforeEach(() => {
                    mutations = [];
                    observer = new document.defaultView.MutationObserver(
                        (m: any[]) => mutations.push(...m)
                    );
                });

                it('should send a childList mutation', async () => {
                    let child = document.createElement('span');
                    let parent = document.createElement('div');
                    observer.observe(parent, {
                        subtree: true,
                    });

                    parent.appendChild(child);
                    expect(child).toHaveProperty('parentNode', parent);

                    await waitAsync();

                    expect(mutations).toHaveLength(1);
                    expect(mutations[0].type).toBe('childList');
                    expect(mutations[0].target === parent).toBe(true);
                    expect(mutations[0].addedNodes).toHaveLength(1);
                    expect(mutations[0].addedNodes[0] === child).toBe(true);
                    expect(mutations[0].nextSibling).toBeUndefined();
                });

                it('should send childList mutations if appending a node to its own parent', async () => {
                    let child = document.createElement('span');
                    let parent = document.createElement('div');
                    parent.appendChild(child);
                    expect(child).toHaveProperty('parentNode', parent);

                    observer.observe(parent, {
                        subtree: true,
                    });

                    parent.appendChild(child);
                    expect(child).toHaveProperty('parentNode', parent);

                    await waitAsync();

                    expect(mutations).toHaveLength(1);
                    expect(mutations[0].type).toBe('childList');
                    expect(mutations[0].target === parent).toBe(true);
                    expect(mutations[0].addedNodes).toHaveLength(1);
                    expect(mutations[0].addedNodes[0] === child).toBe(true);
                    expect(mutations[0].nextSibling).toBeUndefined();
                });
            });

            // describe('actions', () => {
            //     let actions: any[] = [];

            //     beforeEach(() => {

            //     });
            // });
        });

        describe('#replaceChild()', () => {
            it('should replace a child', () => {
                let parent = document.createElement('div');
                let child1 = document.createElement('child1');
                let child2 = document.createElement('child2');
                let child3 = document.createElement('child3');
                let child4 = document.createElement('child4');
                parent.appendChild(child1);
                parent.appendChild(child2);
                parent.appendChild(child3);

                expect(parent).toHaveProperty('childNodes', [
                    child1,
                    child2,
                    child3,
                ]);
                expect(parent).toHaveProperty('children', [
                    child1,
                    child2,
                    child3,
                ]);

                parent.replaceChild(child4, child2);

                expect(parent).toHaveProperty('childNodes', [
                    child1,
                    child4,
                    child3,
                ]);
                expect(parent).toHaveProperty('children', [
                    child1,
                    child4,
                    child3,
                ]);
            });
        });

        describe('#setAttribute()', () => {
            it('should set a given named attribute', () => {
                let el = document.createElement('div');
                expect(el.attributes).toEqual([]);

                el.setAttribute('foo', 'bar');
                expect(el.attributes).toEqual([
                    { name: 'foo', value: 'bar', ns: null },
                ]);

                el.setAttribute('foo', 'baz');
                expect(el.attributes).toEqual([
                    { name: 'foo', value: 'baz', ns: null },
                ]);
            });

            it('should stringify numbers', () => {
                let el = document.createElement('div');
                el.setAttribute('a', 1);

                expect(el.attributes[0].value).toEqual('1');
            });

            it('should stringify booleans', () => {
                let el = document.createElement('div');
                el.setAttribute('a', true);

                expect(el.attributes[0].value).toEqual('true');
            });

            // NOTE: Spec Change - see https://developer.mozilla.org/en-US/docs/Web/API/Element/setAttribute
            // Changed so that the style property can reuse setAttribute() to propogate mutation events.
            // If issues arise from this change, then the behavior should be reverted to match the spec.
            it('should not stringify objects', () => {
                let el = document.createElement('div');

                let obj = {};
                el.setAttribute('b', obj);
                expect(el.attributes[0].value).toEqual({});
                expect(el.attributes[0].value).not.toBe(obj);
            });
        });

        describe('#getAttribute()', () => {
            it('should return a stored attribute value', () => {
                let el = document.createElement('div');
                el.setAttribute('a', 'b');
                expect(el.getAttribute('a')).toEqual('b');
                el.setAttribute('a', 'c');
                expect(el.getAttribute('a')).toEqual('c');
            });

            it('should return undefined for missing attribute', () => {
                let el = document.createElement('div');
                expect(el.getAttribute('a')).toEqual(undefined);
            });
        });

        describe('#addEventListener', () => {
            it('should append listener to event list', () => {
                let el = document.createElement('div');

                expect(el.__handlers).toEqual({});

                let fn = () => {};
                el.addEventListener('type', fn);
                expect(el.__handlers).toEqual({ type: [fn] });
            });

            it('should allow duplicates', () => {
                let el = document.createElement('div');
                let fn = () => {};
                el.addEventListener('type', fn);
                el.addEventListener('type', fn);
                expect(el.__handlers).toEqual({ type: [fn, fn] });
            });

            it('should not normalize type', () => {
                let el = document.createElement('div');
                let fn1 = () => {};
                let fn2 = () => {};
                let fn3 = () => {};
                el.addEventListener('TYPE', fn1);
                el.addEventListener('TyPe', fn2);
                el.addEventListener('type', fn3);
                expect(el.__handlers).toEqual({
                    TYPE: [fn1],
                    TyPe: [fn2],
                    type: [fn3],
                });
            });
        });

        describe('#removeEventListener', () => {
            it('should remove existing listeners', () => {
                let el = document.createElement('div');
                let fn = () => {};
                el.addEventListener('type', fn);

                el.removeEventListener('type', fn);
                expect(el.__handlers).toEqual({ type: [] });
            });

            it('should not normalize type', () => {
                let el = document.createElement('div');
                let fn1 = () => {};
                let fn2 = () => {};
                let fn3 = () => {};
                el.addEventListener('type', fn1);
                el.addEventListener('type', fn2);
                el.addEventListener('type', fn3);

                el.removeEventListener('TYPE', fn1);
                el.removeEventListener('TyPe', fn2);
                el.removeEventListener('type', fn3);
                expect(el.__handlers).toEqual({ type: [fn1, fn2] });
            });

            it('should remove only one listener at a time', () => {
                let el = document.createElement('div');
                let fn = () => {};
                el.addEventListener('type', fn);
                el.addEventListener('type', fn);

                el.removeEventListener('type', fn);
                expect(el.__handlers).toEqual({ type: [fn] });

                el.removeEventListener('type', fn);
                expect(el.__handlers).toEqual({ type: [] });
            });
        });

        describe('#dispatchEvent()', () => {
            it('should invoke matched listener', () => {
                let event = { type: 'foo', cancelable: true, bubbles: true };
                let el = document.createElement('div');
                let fn = jest.fn();
                let fn2 = jest.fn();
                el.addEventListener('foo', fn);
                el.addEventListener('bar', fn2);
                el.dispatchEvent(event);

                expect(fn).toHaveBeenCalledTimes(1);
                expect(fn).toHaveBeenCalledWith(event);
                expect(fn2).not.toHaveBeenCalled();
            });

            it('should invoke multiple listeners', () => {
                let event = { type: 'foo', cancelable: true, bubbles: true };
                let el = document.createElement('div');
                let fn = jest.fn();
                el.addEventListener('foo', fn);
                el.addEventListener('foo', fn);
                el.addEventListener('foo', fn);
                el.dispatchEvent(event);

                expect(fn).toHaveBeenCalledTimes(3);
            });

            it('should bubble if enabled', () => {
                let event = new document.defaultView.Event('foo', {
                    cancelable: true,
                    bubbles: true,
                });
                let child = document.createElement('div');
                let parent = document.createElement('div');
                parent.appendChild(child);

                child.addEventListener('foo', (child.fn = jest.fn()));
                parent.addEventListener('foo', (parent.fn = jest.fn()));
                child.dispatchEvent(event);

                expect(child.fn).toHaveBeenCalledTimes(1);
                expect(parent.fn).toHaveBeenCalledTimes(1);

                child.fn.mockClear();
                parent.fn.mockClear();
                parent.dispatchEvent(event);
                expect(child.fn).not.toHaveBeenCalled();

                child.fn.mockClear();
                parent.fn.mockClear();
                event.bubbles = false;
                child.addEventListener('foo', (e: any) => (e._stop = true));
                child.dispatchEvent(event);
                expect(parent.fn).not.toHaveBeenCalled();
            });

            it('should return false if defaultPrevented() was called', () => {
                let el = document.createElement('div');
                let el2 = document.createElement('div');
                el.addEventListener('foo', (e: any) => {
                    e.preventDefault();
                });

                expect(
                    el.dispatchEvent(new document.defaultView.Event('foo'))
                ).toEqual(false);
                expect(
                    el2.dispatchEvent(new document.defaultView.Event('foo'))
                ).toEqual(true);
            });

            it('preventDefault() should set defaultPrevented', () => {
                let event = new document.defaultView.Event('foo', {
                    cancelable: true,
                    bubbles: true,
                });
                let el = document.createElement('div');
                let parent = document.createElement('div');
                parent.appendChild(el);
                let fn = jest.fn((e) => {
                    e.preventDefault();
                });
                let parentFn = jest.fn((e) => {
                    e.preventDefault();
                });
                el.addEventListener('foo', fn);
                parent.addEventListener('foo', parentFn);

                el.dispatchEvent(event);

                expect(fn).toHaveBeenCalledTimes(1);
                expect(parentFn).toHaveBeenCalledTimes(1);
                expect(parentFn).toHaveBeenCalledWith(
                    expect.objectContaining({
                        defaultPrevented: true,
                    })
                );
            });
        });

        describe('#style', () => {
            let el: ReturnType<Document['createElement']>;

            beforeEach(() => {
                el = document.createElement('div');
            });

            it('should contain an empty object by default', () => {
                expect(Object.keys(el.style)).toEqual([]);
            });

            it('should allow setting properties directly on the object', () => {
                el.style.color = 'red';

                expect(el.style.color).toBe('red');
                expect(Object.keys(el.style)).toEqual(['color']);
            });

            it('should return an empty string for missing properties', () => {
                expect(el.style['missing' as any]).toBe('');
            });

            describe('#getPropertyValue()', () => {
                it('should return the value stored for the given style property', () => {
                    el.style['abc' as any] = 'def';

                    expect(el.style.getPropertyValue('abc')).toBe('def');
                });

                it('should return an empty string if given a missing property', () => {
                    expect(el.style.getPropertyValue('missing')).toBe('');
                });
            });

            describe('#setProperty()', () => {
                it('should save the given property value to the style', () => {
                    el.style.setProperty('my-property', 'test');

                    expect(el.style['my-property' as any]).toBe('test');
                    expect(el.style.getPropertyValue('my-property')).toBe(
                        'test'
                    );
                    expect(Object.keys(el.style)).toEqual(['my-property']);
                });
            });

            describe('#removeProperty', () => {
                it('should remove the given property from the style', () => {
                    el.style.setProperty('my-property', 'test');

                    expect(el.style.removeProperty('my-property')).toBe('test');
                    expect(el.style['my-property' as any]).toBe('');
                    expect(el.style.getPropertyValue('my-property')).toBe('');
                    expect(Object.keys(el.style)).toEqual([]);
                });
            });
        });
    });

    describe('HTMLElement', () => {
        let handler: jest.Mock<any>;
        let document: any;

        beforeEach(() => {
            handler = jest.fn();
            document = undom();
        });

        it('should be creatable by a document', () => {
            let div = document.createElement('div');
            expect(div).toBeInstanceOf(document.HTMLElement);
            expect(div).toBeInstanceOf(document.Element);
            expect(div).toBeInstanceOf(document.Node);
        });

        const functionCases = [['focus'], ['blur'], ['click']];

        describe.each(functionCases)('%s()', (func) => {
            let cleanup: Function;
            beforeEach(() => {
                cleanup = registerMethodHandler(
                    document,
                    'HTMLElement',
                    func,
                    handler
                );
            });

            afterEach(() => {
                if (cleanup) {
                    cleanup();
                }
            });

            it('should call the method handler', () => {
                handler.mockReturnValueOnce(123);
                const el = document.createElement('div');

                expect(typeof el[func]).toBe('function');
                const result = el[func]();

                expect(result).toBe(123);
                expect(handler).toHaveBeenCalledWith(el, func, []);
            });
        });
    });

    describe('HTMLInputElement', () => {
        let handler: jest.Mock<any>;
        let document: any;

        beforeEach(() => {
            handler = jest.fn();
            document = undom();
        });

        it('should be creatable by a document', () => {
            let input = document.createElement('input');
            expect(input).toHaveProperty('value', '');
            expect(input).toBeInstanceOf(document.HTMLInputElement);
            expect(input).toBeInstanceOf(document.HTMLElement);
        });

        const functionCases = [
            ['checkValidity'],
            ['reportValidity'],
            ['select'],
            ['setCustomValidity'],
            ['setRangeText'],
            ['setSelectionRange'],
            ['showPicker'],
            ['stepDown'],
            ['stepUp'],
        ];

        describe.each(functionCases)('%s()', (func) => {
            let cleanup: Function;
            beforeEach(() => {
                cleanup = registerMethodHandler(
                    document,
                    'HTMLInputElement',
                    func,
                    handler
                );
            });

            afterEach(() => {
                if (cleanup) {
                    cleanup();
                }
            });

            it('should call the method handler', () => {
                handler.mockReturnValueOnce(123);
                const input = document.createElement('input');

                expect(typeof input[func]).toBe('function');
                const result = input[func]();

                expect(result).toBe(123);
                expect(handler).toHaveBeenCalledWith(input, func, []);
            });
        });
    });

    describe('HTMLFormElement', () => {
        let handler: jest.Mock<any>;
        let document: any;

        beforeEach(() => {
            handler = jest.fn();
            document = undom();
        });

        it('should be creatable by a document', () => {
            let input = document.createElement('form');
            expect(input).toBeInstanceOf(document.HTMLFormElement);
            expect(input).toBeInstanceOf(document.HTMLElement);
        });

        const functionCases = [
            ['reportValidity'],
            ['requestSubmit'],
            ['reset'],
            ['submit'],
        ];

        describe.each(functionCases)('%s()', (func) => {
            let cleanup: Function;
            beforeEach(() => {
                cleanup = registerMethodHandler(
                    document,
                    'HTMLFormElement',
                    func,
                    handler
                );
            });

            afterEach(() => {
                if (cleanup) {
                    cleanup();
                }
            });

            it('should call the method handler', () => {
                handler.mockReturnValueOnce(123);
                const form = document.createElement('form');

                expect(typeof form[func]).toBe('function');
                const result = form[func]();

                expect(result).toBe(123);
                expect(handler).toHaveBeenCalledWith(form, func, []);
            });
        });
    });

    describe('HTMLVideoElement', () => {
        let handler: jest.Mock<any>;
        let document: any;

        beforeEach(() => {
            handler = jest.fn();
            document = undom();
        });

        it('should be creatable by a document', () => {
            let input = document.createElement('video');
            expect(input).toBeInstanceOf(document.HTMLVideoElement);
            expect(input).toBeInstanceOf(document.HTMLMediaElement);
            expect(input).toBeInstanceOf(document.HTMLElement);
        });

        const functionCases = [
            ['HTMLMediaElement', 'canPlayType'],
            ['HTMLMediaElement', 'fastSeek'],
            ['HTMLMediaElement', 'load'],
            ['HTMLMediaElement', 'pause'],
            ['HTMLMediaElement', 'play'],
            ['HTMLVideoElement', 'getVideoPlaybackQuality'],
            ['HTMLVideoElement', 'requestPictureInPicture'],
        ];

        describe.each(functionCases)('%s.%s()', ($class, func) => {
            let cleanup: Function;
            beforeEach(() => {
                cleanup = registerMethodHandler(
                    document,
                    $class,
                    func,
                    handler
                );
            });

            afterEach(() => {
                if (cleanup) {
                    cleanup();
                }
            });

            it('should call the method handler', () => {
                handler.mockReturnValueOnce(123);
                const video = document.createElement('video');

                expect(typeof video[func]).toBe('function');
                const result = video[func]();

                expect(result).toBe(123);
                expect(handler).toHaveBeenCalledWith(video, func, []);
            });
        });
    });
});

export async function waitAsync() {
    return new Promise((resolve) =>
        jest.requireActual('timers').setImmediate(resolve)
    );
}
