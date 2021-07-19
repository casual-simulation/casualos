import undom from './index';

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
    });
});
