

// module.exports = function pluginTypedoc(context: any, options: any) {

import { sortBy } from 'lodash';
import { ReferenceType, Reflection, Type } from 'typedoc';
import { getProject } from './api';

export function loadContent() {
    const { app, project } = getProject();
    if (!project) {
        console.warn('[docusarus-plugin-typedoc] Unable to load TypeDoc project!');
    }

    let allUsedTypes = new Set<Reflection>();
    let typesWithPages = new Set<Reflection>();

    let pages = new Map<string, {
        hash: string,
        contents: {
            order: number,
            name: string,
            reflection: any
        }[]
    }>();

    const getPage = (hash: string) => {
        let page = pages.get(hash);
        if(!page) {
            page = {
                hash,
                contents: []
            };
            pages.set(hash, page);
        }
        return page;
    };
    walk(project, (child, parent, key) => {
        if ('kind' in child) {
            // Reflection
            let hash = getReflectionHash(child);
            if (hash) {
                let order = getReflectionOrder(child);
                const page = getPage(hash);
                page.contents.push({
                    order,
                    name: child.name,
                    reflection: app.serializer.toObject(child)
                });
                typesWithPages.add(child);
            }
        } else {
            if (child.type === 'reference') {
                const referenceType = child as ReferenceType;
                if (referenceType.reflection) {
                    let resolvedReferences = resolveTypeReferences([referenceType]);
                    for (let ref of resolvedReferences) {
                        allUsedTypes.add(ref);
                    }
                }
            }
        }
    });

    for (let type of allUsedTypes) {
        if (!typesWithPages.has(type)) {
            const page = getPage('types');
            page.contents.push({
                order: 0,
                name: type.name,
                reflection: app.serializer.toObject(type)
            });
        }
    }

    for(let page of pages.values()) {
        page.contents = sortBy(page.contents, c => c.order, c => c.name);
    }

    let types = [];
    for (let child of project.children) {
        types.push({
            name: child.name,
            default: app.serializer.toObject(child),
        });
    }

    return {
        pages: [
            ...pages.values()
        ],
        types: types
    };
}

function getReflectionHash(reflection: Reflection): string {
    const hash = reflection.comment?.tags.find(t => {
        return t.tagName === 'dochash';
    });
    if (hash) {
        return hash.text.trim();
    }
    return null;
}

function getReflectionOrder(reflection: Reflection): number {
    const order = reflection.comment?.tags.find(t =>{
        return t.tagName === 'docorder'
    });
    if (order) {
        return parseInt(order.text.trim());
    }
    return 9999;
}

function resolveTypeReferences(typeReferences: ReferenceType[]): Set<Reflection> {
    let result: Set<Reflection> = new Set();
    for (let ref of typeReferences) {
        let referencedType = ref.reflection;
        if (referencedType) {
            result.add(referencedType);
        } else if(ref.name !== 'Promise') {
            console.warn(`[docusarus-plugin-typedoc] Unable to resolve type reference: ${ref.name}`);
        }

        if (ref.typeArguments && ref.typeArguments.length > 0) {
            for (let inner of resolveTypeReferences(ref.typeArguments.filter(t => t.type === 'reference') as ReferenceType[])) {
                result.add(inner);
            }
        }
    }
    return result;
}

const keysMap = {
    'Property': ['type'],
    'reflection': ['declaration'],
    'Type literal': ['children', 'signatures'],
    'Call signature': ['parameters', 'comment', 'type'],
    'Class': ['children'],
    'Constructor': ['signatures'],
    'Function': ['signatures'],
    'Project': ['children'],
};

function walk(obj: Reflection | Type, callback: (value: Reflection | Type, parent: Reflection | Type, key: string) => void, parent: Reflection = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

function walkSingle(obj: Reflection | Type, callback: (value: Reflection, parent: Reflection, key: string) => void, parent: Reflection = null) {
    let type = 'kind' in obj ? obj.kindString : obj.type;
    let keys = (keysMap as any)[type] || [];
    for(let key of keys) {
        let value = (obj as any)[key];
        if (Array.isArray(value)) {
            for (let v of value) {
                if (v) {
                    callback(v, parent, key);
                }
            }
        } else if (value) {
            callback(value, parent, key);
        }
    }
}

function getTypeReferences(type: Reflection | Type): ReferenceType[] {
    return getByFilter(type, v => 'type' in v && v.type === 'reference') as ReferenceType[];
}

function getByFilter(type: Reflection | Type, filter: (value: Reflection | Type, parent: Reflection | Type, key: string) => boolean) {
    let result: (Reflection | Type)[] = [];
    walk(type, (value, parent, key) => {
        if (filter(value, parent, key)) {
            result.push(value);
        }
    });
    return result;
}