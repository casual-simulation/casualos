

// module.exports = function pluginTypedoc(context: any, options: any) {

import { sortBy } from 'lodash';
import { ReferenceType, Reflection, ReflectionKind, Type, TypeKind, Comment, SerializerComponent, Serializer, Application, ProjectReflection, SignatureReflection } from 'typedoc';
import { getProject } from './api';
import { ModelToObject } from 'typedoc/dist/lib/serialization/schema';
import { CallSignatureDeclaration, Declaration } from 'typescript';

export type CommentType = {
    shortText: string;
    text: string;
    returns: string;
    tags: {
        tagName: string;
        paramName: string;
        text: string;
    }[];
};

class CommentSerializer extends SerializerComponent<Comment> {
    private _app: Application;
    private _project: ProjectReflection;

    references: Map<string, string>;

    get priority() {
        return 100;
    }

    constructor(app: Application, project: ProjectReflection, serializer: Serializer) {
        super(serializer);
        this._app = app;
        this._project = project;
        this.references = new Map();
    }

    supports(item: Comment) {
        return item instanceof Comment;
    }

    toObject(item: Comment, obj: Partial<ModelToObject<Comment>>) {
        if (item.shortText) {
            obj.shortText = this._serializeLinks(item.shortText);
        }
        if (item.text) {
            obj.text = this._serializeLinks(item.text);
        }
        if (item.returns) {
            obj.returns = this._serializeLinks(item.returns);
        }
        if (item.tags) {
            obj.tags = item.tags.map(t => ({
                tag: t.tagName,
                paramName: t.paramName,
                text: t.text ? this._serializeLinks(t.text) : ''
            }));
        }

        return obj;
    }

    serializeGroup(instance: any) {
        return instance instanceof Comment;
    }

    /**
     * Renders all "{{@link }}" tags to markdown links in the given text.
     * @param str 
     * @returns 
     */
    private _serializeLinks(str: string) {
        return this._replaceTags(this._replaceReferences(str));
    }

    private _replaceReferences(str: string) {
        let regex = /\{@link ([\w-\@\.]+)\}/g;
        return str.replace(regex, (match, id) => {
            const type = getByDocId(this._project, id);

            if (type) {
                const hash = getReflectionHash(type);
                if (hash) {
                    this.references.set(id, hash);
                    return `[\`${this._renderType(type, id)}\`](ref:${id})`;
                } else {
                    console.warn(`Type is not included in documentation: ${id}`);
                    return this._renderType(type, id);
                }
            } else {
                console.warn(`Unable to find type for link: ${id}`);
                return id;
            }
        });
    }

    private _replaceTags(str: string) {
        let regex = /\{@tag ([\w-\.]+)\}/g;
        return str.replace(regex, (match, tag) => {
            return `[\`#${tag}\`](tags:${tag})`;
        });
    }

    private _renderType(type: Reflection, id: string): string {
        if (type.kindString === 'Call signature') {
            const name = getReflectionTag(type, 'docname') ?? id;
            const sig = type as SignatureReflection;
            const params = sig.parameters.map(p => `${p.flags.isRest ? '...' : ''}${p.name}`).join(', ');
            return `${name}(${params})`;
        } else {
            return id;
        }
    }
}

export function loadContent() {
    const { app, project } = getProject();
    if (!project) {
        console.warn('[docusarus-plugin-typedoc] Unable to load TypeDoc project!');
    }

    let commentSerializer = new CommentSerializer(app, project, app.serializer);
    app.serializer.addSerializer(commentSerializer);

    let allUsedTypes = new Set<Reflection>();
    let typesWithPages = new Set<Reflection>();

    let references = {} as {
        [id: string | number]: string
    };

    let pages = new Map<string, {
        hash: string,
        pageTitle: string,
        pageDescription: string,
        pageSidebarLabel: string,
        contents: {
            id: number,
            order: number,
            name: string,
            reflection: any,
            comment: CommentType
        }[],
        references: {
            [id: string]: string
        }
    }>();

    const allowedKinds = new Set<ReflectionKind>([
        ReflectionKind.Class,
        ReflectionKind.Interface,
        ReflectionKind.ObjectLiteral
    ]);

    const getPage = (hash: string) => {
        let page = pages.get(hash);
        if(!page) {
            page = {
                hash,
                pageTitle: null,
                pageDescription: null,
                pageSidebarLabel: null,
                contents: [],
                references: references
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

                if (!page.pageTitle) {
                    page.pageTitle = getReflectionTag(child, 'doctitle');
                }

                if (!page.pageDescription) {
                    page.pageDescription = getReflectionTag(child, 'docdescription');
                }

                if (!page.pageSidebarLabel) {
                    page.pageSidebarLabel = getReflectionTag(child, 'docsidebar');
                }

                const docId = getReflectionTag(child, 'docid') ?? getReflectionTag(child, 'docname');

                let childVisible = getReflectionTag(child, 'docvisible') === null;

                if (childVisible) {
                    page.contents.push({
                        id: child.id,
                        order,
                        name: docId ?? child.name,
                        reflection: app.serializer.toObject(child),
                        comment: getReflectionComment(child),
                    });
                }
                typesWithPages.add(child);

                if (docId) {
                    references[docId] = hash;
                    references[`id-${child.id}`] = docId;
                }
            }
        } else if ('type' in child) {
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
        if (!typesWithPages.has(type) && allowedKinds.has(type.kind)) {
            const page = getPage('extra-types');
            page.contents.push({
                id: type.id,
                order: 0,
                name: type.name,
                reflection: app.serializer.toObject(type),
                comment: getReflectionComment(type),
            });
        }
    }

    for(let [id, hash] of commentSerializer.references) {
        references[id] = hash;
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

function getReflectionComment(type: Reflection): CommentType {
    let comment;
    if (type.hasComment()) {
        comment = {
            shortText: type.comment.shortText,
            text: type.comment.text,
            returns: type.comment.returns,
            tags: type.comment.tags.map(t => ({
                tagName: t.tagName,
                paramName: t.paramName,
                text: t.text
            }))
        };
    }
    return comment;
}

export type Content = ReturnType<typeof loadContent>;

function getReflectionHash(reflection: Reflection): string {
    return getReflectionTag(reflection, 'dochash');
}

function getReflectionOrder(reflection: Reflection): number {
    return parseInt(getReflectionTag(reflection, 'docorder') ?? '9999');
}

function getReflectionTag(reflection: Reflection, tag: string): string {
    const tagValue = reflection.comment?.tags.find(t => {
        return t.tagName === tag;
    });
    if (tagValue) {
        return tagValue.text.trim();
    }
    return null;
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

type WalkType = Reflection | Type | Comment;

function walk(obj: WalkType, callback: (value: WalkType, parent: WalkType, key: string) => void, parent: WalkType = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

function walkSingle(obj: WalkType, callback: (value: WalkType, parent: WalkType, key: string) => void, parent: WalkType = null) {
    let type = 'kind' in obj ? obj.kindString : 'type' in obj ? obj.type : 'comment';
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

function getTypeReferences(type: WalkType): ReferenceType[] {
    return getByFilter(type, v => 'type' in v && v.type === 'reference') as ReferenceType[];
}

function getByFilter(type: WalkType, filter: (value: WalkType, parent: WalkType, key: string) => boolean) {
    let result: WalkType[] = [];
    walk(type, (value, parent, key) => {
        if (filter(value, parent, key)) {
            result.push(value);
        }
    });
    return result;
}

function getByDocId(type: WalkType, docId: string): Reflection {
    let matches = getByFilter(type, t => {
        if ('kind' in t) {
            const id = getReflectionTag(t, 'docid') ?? getReflectionTag(t, 'docname');
            if (id) {
                return id === docId;
            }
        }
        return false;
    });

    if (matches.length > 0) {
        return matches[0] as Reflection;
    }
    return null;
}

function isFunctionProperty(property: any) {
    return property && property.type && property.type.type === 'reflection' &&
        property.type.declaration && property.type.declaration.signatures &&
        property.type.declaration.signatures.some(s => s.kindString === 'Call signature');
}
