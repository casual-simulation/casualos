

// module.exports = function pluginTypedoc(context: any, options: any) {

import { sortBy } from 'lodash';
import type { SerializerComponent, Serializer, Application, ProjectReflection, SignatureReflection, ReflectionType, IntrinsicType, CommentDisplayPart, CommentTag } from 'typedoc';
import { ReferenceType, Reflection, ReflectionKind, Type, Comment, DeclarationReflection } from 'typedoc';
import { getProject } from './api';
import type { ModelToObject } from 'typedoc/dist/lib/serialization/schema';
import { Project } from 'ts-morph';
import path from 'path';

export type CommentType = {
    text: string;
    tags: {
        tagName: string;
        paramName: string;
        text: string;
    }[];
};

class CommentDisplayPartSerializer implements SerializerComponent<CommentDisplayPart> {
    private _app: Application;
    private _project: ProjectReflection;

    references: Map<string, string>;

    get priority() {
        return 100;
    }

    constructor(app: Application, project: ProjectReflection) {
        this._app = app;
        this._project = project;
        this.references = new Map();
    }

    supports(item: CommentDisplayPart) {
        return typeof item === 'object' && (item.kind === 'text' || item.kind === 'code' || item.kind === 'inline-tag');
    }

    toObject(item: CommentDisplayPart, obj: Partial<ModelToObject<CommentDisplayPart>>, serializer: Serializer) {
        obj.kind = item.kind;
        obj.text = item.text;

        if (item.kind === 'inline-tag' && obj.kind === 'inline-tag') {
            if (item.tag === '@link') {
                const text = this._getTextForLink(item.text);
                obj.text = text;
                (obj as any).kind = 'text';
            } else if (item.tag === '@tag') {
                const text = this._getTextForTag(item.text);
                obj.text = text;
                (obj as any).kind = 'text';
            }
        }

        return obj;
    }

    // private _getReflection(target: string): Reflection {
    //     if (target instanceof Reflection) {
    //         return target;
    //     } else if (target instanceof ReflectionSymbolId) {
    //         return getByDocId(this._project, target.getStableKey());
    //     } else {
    //         return getByDocId(this._project, target);
    //     }
    // }

    private _getTextForLink(text: string) {
        const target = getByDocId(this._project, text);
        if (target) {
            const id = text;
            const hash = getReflectionHash(target);

            if (hash) {
                this.references.set(id, hash);
                return renderLinkToType(target, id);
            } else {
                console.warn(`Type is not included in documentation: ${id}`);
                return renderTypeForComment(target, id);
            }
        }  else {
            console.warn(`Unable to find type for link: ${text}`);
            return text.toString();
        }
    }

    private _getTextForTag(tag: string) {
        if (tag.startsWith('@')) {
            return `[\`${tag}\`](tags:${tag})`;
        } else {
            return `[\`#${tag}\`](tags:${tag})`;
        }
    }
}

class CommentSerializer implements SerializerComponent<Comment> {
    private _app: Application;
    private _project: ProjectReflection;
    private _commentDisplayPartSerializer: CommentDisplayPartSerializer;

    get priority() {
        return 100;
    }

    constructor(app: Application, project: ProjectReflection, commentDisplayPartSerializer: CommentDisplayPartSerializer) {
        this._app = app;
        this._project = project;
        this._commentDisplayPartSerializer = commentDisplayPartSerializer;
    }

    supports(item: Comment) {
        return item instanceof Comment;
    }

    toObject(item: Comment, obj: Partial<ModelToObject<Comment>>, serializer: Serializer) {
        obj.summary = item.summary.map(s => this._commentDisplayPartSerializer.toObject(s, {}, serializer));
        obj.blockTags = item.blockTags.map(s => ({
            tag: s.tag,
            content: s.content.map(c => this._commentDisplayPartSerializer.toObject(c, {}, serializer))
        }));
        return obj;
    }
}

function renderLinkToType(type: Reflection, id: string) {
    return `[\`${renderTypeForComment(type, id)}\`](ref:${id})`;
}

function renderTypeForComment(type: Reflection, id: string): string {
    if (type.kind === ReflectionKind.CallSignature) {
        const name = getReflectionTag(type, 'docname') ?? id;
        const sig = type as SignatureReflection;
        const params = sig.parameters.map(p => `${p.flags.isRest ? '...' : ''}${p.name}`).join(', ');
        return `${name}(${params})`;
    } else {
        return id;
    }
}

class IncludeSourceSerializer implements SerializerComponent<Reflection> {
    private _app: Application;
    private _project: ProjectReflection;
    private _morph: Project;

    references: Map<string, string>;

    get priority() {
        return 101;
    }

    constructor(app: Application, project: ProjectReflection) {
        this._app = app;
        this._project = project;
        this._morph = new Project();
        this.references = new Map();
    }

    serializeGroup(instance: unknown): boolean {
        return instance instanceof Reflection;
    }

    supports(item: Reflection): boolean {
        return item instanceof DeclarationReflection &&
            item.kind === ReflectionKind.Property &&
            this._getType(item.type) !== null &&
            getReflectionTag(item, 'docsource') !== null;
    }

    toObject(item: DeclarationReflection, obj: Partial<ModelToObject<DeclarationReflection>>, serializer: Serializer): Partial<ModelToObject<DeclarationReflection>> {
        const file = this._morph.createSourceFile('temp.ts', undefined, { overwrite: true });
        let type = this._getType(item.type);
        const name = getReflectionTag(item, 'docsource') || type.name;

        const interfaceDeclaration = file.addInterface({
            name: name
        });

        if (type.indexSignature) {
            interfaceDeclaration.addIndexSignature({
                keyName: type.indexSignature.parameters[0].name,
                keyType: this._getTypeString(type.indexSignature.parameters[0].type),
                returnType: this._getTypeString(type.indexSignature.type)
            });
        }
        if (type.children) {
            for (let property of type.children) {
                interfaceDeclaration.addProperty({
                    name: property.name,
                    type: this._getTypeString(property.type)
                });
            }
        }

        const source = interfaceDeclaration.getText();

        let references = getReflectionTag(item, 'docreferenceactions');

        let referencesContent = '';
        if (references) {
            let refs = getByReference(this._project, references);
            for (let r of refs) {
                const hash = getReflectionHash(r);
                const id = getDocId(r);
                
                let text;
                if (hash) {
                    this.references.set(id, hash);
                    text = renderLinkToType(r, id);
                    // const ref = renderTypeForComment(ref, getDocId(ref));
                } else {
                    console.warn(`Type is not included in documentation: ${id}`);
                    text = renderTypeForComment(r, id);
                }

                if (text) {
                    referencesContent += `- ${text}\n`;
                }
            }
        }

        obj.id = item.id;
        obj.name = item.name;
        obj.kind = item.kind;
        (obj as any).kindString = ReflectionKind.singularString(item.kind);
        obj.type = serializer.toObject(item.type);
        obj.defaultValue = item.defaultValue;
        obj.flags = item.flags;
        obj.comment = serializer.toObject(item.comment);
        obj.children = serializer.toObjectsOptional(item.children);
        obj.typeParameters = serializer.toObjectsOptional(item.typeParameters);
        (obj as any).typeText = source;
        (obj as any).typeReference = name;
        (obj as any).references = referencesContent;

        return obj;
    }

    private _getTypeString(type: Type) {
        if (type.type === 'intrinsic') {
            return (type as IntrinsicType).name;
        } else if(type.type === 'array') {
            return 'any[]';
        } else {
            return 'any';
        }
    }

    private _getType(type: Type): DeclarationReflection {
        if (type.type === 'reference') {
            const ref = type as ReferenceType;
            const reflection = ref.reflection;
            if (reflection instanceof DeclarationReflection) {
                return reflection;
            }
        } else if (type.type === 'reflection') {
            const ref = type as ReflectionType;
            return ref.declaration;
        }
        return null;
    }
}

class ClassReferenceSerializer implements SerializerComponent<Reflection> {
    private _app: Application;
    private _project: ProjectReflection;

    references: Map<string, string>;

    get priority() {
        return 102;
    }

    constructor(app: Application, project: ProjectReflection) {
        this._app = app;
        this._project = project;
        this.references = new Map();
    }

    serializeGroup(instance: unknown): boolean {
        return instance instanceof Reflection;
    }

    supports(item: Reflection): boolean {
        return item instanceof DeclarationReflection &&
            (item.kind === ReflectionKind.Class || item.kind === ReflectionKind.Interface) &&
            getReflectionTag(item, 'docreferenceactions') !== null;
    }

    toObject(item: DeclarationReflection, obj: Partial<ModelToObject<DeclarationReflection>>, serializer: Serializer): Partial<ModelToObject<DeclarationReflection>> {
        let references = getReflectionTag(item, 'docreferenceactions');

        const childrenIds = new Set<string>(
            item.children.map(c => c.name)
        );

        let referencesContent = '';
        if (references) {
            let refs = getByReference(this._project, references);
            for (let r of refs) {
                if (r.kind !== ReflectionKind.CallSignature) {
                    continue;
                }

                const id = getDocId(r);
                if (childrenIds.has(id)) {
                    continue;
                }

                const hash = getReflectionHash(r);

                let text;
                if (hash) {
                    this.references.set(id, hash);
                    text = renderLinkToType(r, id);
                    // const ref = renderTypeForComment(ref, getDocId(ref));
                } else {
                    console.warn(`Type is not included in documentation: ${id}`);
                    text = renderTypeForComment(r, id);
                }

                if (text) {
                    referencesContent += `- ${text}\n`;
                }
            }
        }

        obj.id = item.id;
        obj.name = item.name;
        obj.kind = item.kind;
        (obj as any).kindString = ReflectionKind.singularString(item.kind);
        obj.type = serializer.toObject(item.type);
        obj.defaultValue = item.defaultValue;
        obj.flags = item.flags;
        obj.comment = serializer.toObject(item.comment);
        obj.children = serializer.toObjectsOptional(item.children);
        obj.typeParameters = serializer.toObjectsOptional(item.typeParameters);
        (obj as any).references = referencesContent;

        return obj;
    }
}

class RenameTypeSerializer implements SerializerComponent<ReferenceType> {
    private _app: Application;
    private _project: ProjectReflection;

    map: Map<string, string>;

    get priority() {
        return 101;
    }

    constructor(map: Map<string, string>, app: Application, project: ProjectReflection) {
        this._app = app;
        this._project = project;
        this.map = map;
    }

    serializeGroup(instance: unknown): boolean {
        return instance instanceof Type;
    }

    supports(item: ReferenceType): boolean {
        const ref = item.reflection;

        if (!ref) {
            return false;
        }

        return item instanceof ReferenceType;
    }

    toObject(item: ReferenceType, obj: Partial<ModelToObject<ReferenceType>>, serializer: Serializer): Partial<ModelToObject<ReferenceType>> {
        if (item.reflection) {
            obj.target = item.reflection.id;
            (obj as any).id = item.reflection.id;
        }

        const name = getReflectionTag(item.reflection, 'docname') ?? item.name;

        obj.name = name;
        obj.type = item.type;
        obj.package = item.package;
        obj.qualifiedName = item.qualifiedName;
        obj.typeArguments = serializer.toObjectsOptional(item.typeArguments);

        const ref = resolveType(this.map, item, this._project);
        if (ref === item) {
            return obj;
        }

        const finalRef = ref.reflection;
        obj.target = finalRef.id;
        (obj as any).id = finalRef.id;
        obj.name = getReflectionTag(finalRef, 'docname') ?? finalRef.name;

        return obj;
    }
}

function resolveType(renamedTypes: Map<string, string>, item: ReferenceType, project: ProjectReflection): ReferenceType {
    const ref = item.reflection;

    if (!ref) {
        return item;
    }
    const docId = getDocId(ref);
    const finalId = renamedTypes.get(docId);

    if (finalId) {
        const finalRef = getByDocId(project, finalId);
        if (finalRef) {
            const name = getReflectionTag(finalRef, 'docname') ?? finalRef.name;
            return ReferenceType.createResolvedReference(name, finalRef, project);
        }
    }
    return item;
}

export async function loadContent() {
    const { app, project } = await getProject();
    if (!project) {
        console.warn('[docusarus-plugin-typedoc] Unable to load TypeDoc project!');
        throw new Error('Unable to load TypeDoc project!');
    }

    let commentPartSerializer = new CommentDisplayPartSerializer(app, project);
    let commentSerializer = new CommentSerializer(app, project, commentPartSerializer);
    let sourceSerializer = new IncludeSourceSerializer(app, project);
    let classRefSerializer = new ClassReferenceSerializer(app, project);
    app.serializer.addSerializer(commentSerializer);
    app.serializer.addSerializer(commentPartSerializer);
    app.serializer.addSerializer(sourceSerializer);
    app.serializer.addSerializer(classRefSerializer);
    app.serializer.projectRoot = path.resolve(__dirname, '..', '..');

    let allUsedTypes = new Set<Reflection>();
    let typesWithPages = new Set<Reflection>();
    let usedIds = new Set<string>();

    let references = {} as {
        [id: string | number]: string
    };

    let renamedTypes = new Map<string, string>();

    let pages = new Map<string, {
        hash: string,
        pageTitle: string,
        pageDescription: string,
        pageSidebarLabel: string,
        contents: (() => ({
            id: number,
            order: number,
            name: string,
            reflection: any,
            group: string,
            comment: CommentType
        }))[],
        references: {
            [id: string]: string
        }
    }>();

    const allowedKinds = new Set<ReflectionKind>([
        ReflectionKind.Class,
        ReflectionKind.Interface,
        ReflectionKind.TypeLiteral
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

                const docId = getDocId(child);

                if(docId) {
                    if (usedIds.has(docId)) {
                        return;
                    }
                    usedIds.add(docId);
                }

                let childVisible = getReflectionTag(child, 'docvisible') === null;

                if (childVisible) {
                    page.contents.push(() => ({
                        id: child.id,
                        order,
                        name: docId ?? child.name,
                        reflection: app.serializer.toObject(child),
                        comment: getReflectionComment(child),
                        group: getReflectionTag(child, 'docgroup')
                    }));
                }
                typesWithPages.add(child);

                if (docId) {
                    references[docId] = hash;
                    references[`id-${child.id}`] = docId;
                }
            }

            let rename = getReflectionTag(child, 'docrename');

            if (rename) {
                console.log('Renaming', getDocId(child), 'to', rename);
                renamedTypes.set(getDocId(child), rename);
            }
        } else if ('type' in child) {
            if (child.type === 'reference') {
                const referenceType = child as ReferenceType;
                let resolvedReferences = resolveTypeReferences([referenceType]);
                for (let ref of resolvedReferences) {
                    allUsedTypes.add(ref);
                }
            }
        }
    });

    for (let type of allUsedTypes) {
        if (!typesWithPages.has(type) && allowedKinds.has(type.kind)) {
            const page = getPage('extra-types');
            page.contents.push(() => ({
                id: type.id,
                order: 0,
                name: type.name,
                reflection: app.serializer.toObject(type),
                comment: getReflectionComment(type),
                group: null
            }));
        }
    }

    app.serializer.addSerializer(new RenameTypeSerializer(
        renamedTypes,
        app,
        project
    ));

    for(let [id, hash] of commentPartSerializer.references) {
        references[id] = hash;
    }
    for (let [id, hash] of sourceSerializer.references) {
        if (!references[id]) {
            references[id] = hash;
        }
    }
    for (let [id, hash] of classRefSerializer.references) {
        if (!references[id]) {
            references[id] = hash;
        }
    }

    const finalPages = [...pages.values()].map(p => ({
        ...p,
        contents: p.contents.map(c => c())
    }));

    for(let page of finalPages) {
        page.contents = sortBy(page.contents, c => c.group, c => c.order, c => c.name);
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
            ...finalPages
        ],
        types: types
    };
}

function getReflectionComment(type: Reflection): CommentType {
    let comment: CommentType;
    if (type.hasComment()) {
        comment = {
            text: type.comment.summary.map(s => s.text).join(''),
            tags: type.comment.blockTags.map(t => ({
                tagName: t.tag[0] === '@' ? t.tag.substring(1) : t.tag,
                paramName: t.name,
                text: t.content.map(s => s.text).join('')
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
    const tagValue = reflection.comment?.getTag(`@${tag}`);
    if (tagValue) {
        return getTagText(tagValue);
    }
    return null;
}

function getTagText(tag: CommentTag) {
    return tag.content.map(t => t.text).join('').trim();
}

const builtinTypes = new Set([
    'Uint8Array',
]);

function resolveTypeReferences(typeReferences: ReferenceType[]): Set<Reflection> {
    let result: Set<Reflection> = new Set();
    for (let ref of typeReferences) {
        let referencedType = ref.reflection;
        if (referencedType) {
            result.add(referencedType);
        } else if (ref.name !== 'Promise' && !builtinTypes.has(ref.name)) {
            console.warn(`[docusarus-plugin-typedoc] Unable to resolve type reference: ${ref.name}`);
        }

        // if (ref.typeArguments && ref.typeArguments.length > 0) {
        //     for (let inner of resolveTypeReferences(ref.typeArguments.filter(t => t.type === 'reference') as ReferenceType[])) {
        //         result.add(inner);
        //     }
        // }
    }
    return result;
}

const keysMap = {
    'Property': ['type'],
    'reflection': ['declaration'],
    'Type literal': ['children', 'signatures'],
    'Call signature': ['parameters', 'comment', 'type'],
    'Parameter': ['type'],
    'Class': ['children'],
    'Constructor': ['signatures'],
    'Function': ['signatures'],
    'Method': ['signatures'],
    'Project': ['children'],
    'reference': ['typeArguments'],
    'Accessor': ['getSignature', 'setSignature'],
};

type WalkType = Reflection | Type | Comment;

function walk(obj: WalkType, callback: (value: WalkType, parent: WalkType, key: string) => void, parent: WalkType = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

function walkSingle(obj: WalkType, callback: (value: WalkType, parent: WalkType, key: string) => void, parent: WalkType = null) {
    if (!obj) {
        return;
    }
    let type = 'kind' in obj ? ReflectionKind.singularString(obj.kind) : 'type' in obj ? obj.type : 'comment';
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

function getByReference(type: WalkType, ref: string): Reflection[] {
    let matches = getByFilter(type, t => {
        if ('kind' in t) {
            const id = getReflectionTag(t, 'docid') ?? getReflectionTag(t, 'docname');
            if (id) {
                let regex = new RegExp(ref, 'g');
                return regex.test(id);
            }
        }
        return false;
    });

    return matches as Reflection[];
}

function getDocId(type: Reflection) {
    return getReflectionTag(type, 'docid') ?? getReflectionTag(type, 'docname');
}
