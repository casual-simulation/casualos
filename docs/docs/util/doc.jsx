import React from 'react';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import Details from '@theme/Details';
import { flatMap, groupBy, sortBy } from 'lodash';
import { ReflectionBoundary } from './errors';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Link from '@docusaurus/Link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkTagLinks from './remarkTagLinks';
import unwrapFirstParagraph from './remarkUnwrapFirstParagraph';
import { getByKind, getCommentTags } from './walk';
import { ReflectionKind } from './reflectionKind';

let typeMap = {};

export function setLinkMap(map) {
    typeMap = map;
}

const numberList = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth'
];

function memberLink(reflection, member) {
    return `${reflection.name}-${member.name}`;
}

function sortMembers(children){
    return sortBy(children, c => c.kind === ReflectionKind.Property || c.kind === ReflectionKind.Accessor ? 0 : c.kind === ReflectionKind.Constructor ? 1 : 2)
        .filter(c => !c.flags.isPrivate);
}

function groupMembers(children) {
    let properties = [];
    let constructors = [];
    let methods = [];
    if (!children) {
        return {
            properties,
            constructors,
            methods
        };
    }

    for(let c of children) {
        if (c.flags.isPrivate) {
            continue;
        }
        if (c.kind === ReflectionKind.Property || c.kind === ReflectionKind.Accessor) {
            properties.push(c);
        } else if(c.kind === ReflectionKind.Constructor) {
            constructors.push(c);
        } else if(c.kind === ReflectionKind.Method) {
            methods.push(c);
        }
    }

    return {
        properties,
        constructors,
        methods
    };
}

function memberTableOfContents(reflection, member) {
    const id = memberLink(reflection, member);

    let name;
    if (member.kind === ReflectionKind.Constructor) {
        name = functionDefinition(member.signatures[0], getChildName(member));
    } else if(member.kind === ReflectionKind.Method) {
        name = functionDefinition(member.signatures[0]);
    } else if(member.kind === ReflectionKind.Accessor) {
        name = accessorDefinition(member);
    } else {
        name = propertyDefinition(member);
    }

    name = `<span>${name}</span>`;

    return {
        value: name,
        id: id,
        level: 3
    };
}

export function classTableOfContents(reflection) {
    let toc = [];

    let { properties, constructors, methods } = groupMembers(reflection.children);

    if (properties.length > 0) {
        // toc.push({
        //     value: 'Properties',
        //     id: `${reflection.name}-properties`,
        //     level: 3
        // });

        toc.push(...properties.map(m => memberTableOfContents(reflection, m)));
    }

    if (constructors.length > 0) {
        // toc.push({
        //     value: 'Constructors',
        //     id: `${reflection.name}-constructors`,
        //     level: 3
        // });

        toc.push(...constructors.map(m => memberTableOfContents(reflection, m)));
    }

    if (methods.length > 0) {
        // toc.push({
        //     value: 'Methods',
        //     id: `${reflection.name}-methods`,
        //     level: 3
        // });

        toc.push(...methods.map(m => memberTableOfContents(reflection, m)));
    }

    return toc;
}

export function objectTableOfContents(reflection) {
    let toc = [];

    const childGroups = calculateObjectMemberGroups(reflection);

    for(let group of childGroups) {
        const title = getGroupTitle(group);

        toc.push({
            value: title,
            id: group.group,
            level: 2
        });

        toc.push(...group.children.map(c => objectMemberTableOfContents(c)));
    }

    return toc;
}

function objectMemberTableOfContents({ reflection, child, group, name, namespace }) {
    const displayName = namespace ? namespace + '.' + name : name;

    let definition;
    if (isSimpleFunctionProperty(child)) {
        const declaration = child.type.declaration;
        const signatures = declaration.signatures;
        const sig = getPreferredSignature(signatures) ?? signatures[0];
        definition = functionDefinition(sig, displayName);
    } else if (isInterpretableFunctionProperty(child)) {
        const sig = getInterpretableFunctionSignature(child);
        definition = functionDefinition(sig, displayName);
    } else {
        definition = propertyDefinition(child, displayName);
    }

    definition = `<code>${definition}</code>`;

    return {
        value: definition,
        id: `${reflection.name}-${child.name}`,
        level: 3
    };
}

export function apiTableOfContents(doc) {
    let toc = [
        {
            value: doc.pageTitle,
            id: '',
            level: 2
        }
    ];

    for(let c of doc.contents) {
        if (c.reflection.kind === ReflectionKind.Interface || c.reflection.kind === ReflectionKind.Class) {
            const name = getChildName(c.reflection);
            const id = getChildId(c.reflection);
            toc.push({
                value: name,
                id: id,
                level: 2
            });

            if (c.reflection.kind === ReflectionKind.Class) {
                toc.push(...classTableOfContents(c.reflection));
            }
            // toc.push(...classTableOfContents(c.reflection));
        } else if (c.reflection.kind === ReflectionKind.CallSignature) {
            const name = getChildName(c.reflection);
            const id = getChildId(c.reflection);
            toc.push({
                value: `<span>${functionDefinition(c.reflection, name)}</span>`,
                id: id,
                level: 2
            });
        } else if(c.reflection.kind === ReflectionKind.TypeAlias) {
            const name = getChildName(c.reflection);
            const id = getChildId(c.reflection);
            toc.push({
                value: name,
                id: id,
                level: 2
            });
        } else if(c.reflection.kind === ReflectionKind.GetSignature || c.reflection.kind === ReflectionKind.SetSignature) {
            const name = getChildName(c.reflection);
            const id = getChildId(c.reflection);
            toc.push({
                value: `<code>${functionDefinition(c.reflection, name)}</code>`,
                id: id,
                level: 2
            });
        } else {
            const name = getChildName(c.reflection);
            const id = getChildId(c.reflection);
            toc.push({
                value: name,
                id: id,
                level: 2
            });

            // toc.push(...objectTableOfContents(c.reflection));
        }
    }

    return toc;
}

export function ApiContents({doc}) {
    const contents = doc.contents;
    const references = doc.references;
    return (
        <ul className="api api-list">
            {contents.map(c => 
                <li key={c.id} className="api-member-item">
                    <ApiReflection reflection={c.reflection} references={references} />
                </li>
            )}
        </ul>
    );
}

function ApiReflection({ reflection, references }) {
    if (reflection.kind === ReflectionKind.Interface || reflection.kind === ReflectionKind.Class) {
        return <ClassReflection reflection={reflection} references={references} />
    } else if (reflection.kind === ReflectionKind.CallSignature || reflection.kind === ReflectionKind.GetSignature || reflection.kind === ReflectionKind.SetSignature) {
        return <SignatureReflection reflection={reflection} references={references} />
    } else if(reflection.kind === ReflectionKind.TypeAlias) {
        return <TypeAliasReflection reflection={reflection} references={references} />
    } else {
        return <ObjectReflection reflection={reflection} references={references} />
    }
}

export function TypeAliasReflection({ reflection, references }) {
    const name = getChildName(reflection);
    const id = getChildId(reflection);
    return (
        <div>
            <Heading as='h2' id={id}>{name}</Heading>
            <ReflectionDiscription reflection={reflection} references={references} />
            <TypeAliasMembers reflection={reflection} name={name} references={references} />
            <MemberExamples member={reflection} />
        </div>
    )
}

export function TypeAliasMembers({ reflection, name, references }) {
    let detail = '';

    if (reflection.type.type === 'union') {
        detail = <UnionTypeMembers type={reflection.type} name={name} references={references} />
    }
    return detail;
}

export function UnionTypeMembers({ type, name, references }) {
    return <div>
        <p>A {name} can be one of the following values:</p>
        <ul>
            {type.types.map((t, i) => <UnionTypeMember key={i} type={t} references={references} />)}
        </ul>
    </div>
}

export function UnionTypeMember({ type, references }) {
    return <li><code><TypeLink type={type} references={references}/></code></li>
}

export function ClassReflection({ reflection, references }) {
    const name = getChildName(reflection);
    const id = getChildId(reflection);
    return (
        <div>
            <Heading as='h2' id={id}>{name}</Heading>
            <ClassMembers reflection={reflection} references={references} />
            <MemberExamples member={reflection} />
        </div>
    )
}

export function ObjectReflection({ reflection, references }) {
    const name = getChildName(reflection);
    const id = getChildId(reflection);

    return (
        <div>
            <Heading as='h2' id={id}>{name}</Heading>
            <ObjectMembers reflection={reflection}  references={references} />
            <MemberExamples member={reflection} />
        </div>
    )
}

export function SignatureReflection({ reflection, references }) {
    const name = getChildName(reflection);
    const id = getChildId(reflection);
    return (
        <div>
            <FunctionSignature func={reflection} sig={reflection} name={name} link={id} references={references} />
        </div>
    )
}

export function ClassDescription(props) {
    const reflection = props.reflection;
    if (!reflection) {
        throw new Error('Unable to find ' + props.name + '!');
    }

    return (
        <div>
            <h2>{reflection.name}</h2>
        </div>
    );
}

export function ClassMembers(props) {
    const reflection = props.reflection;
    if (!reflection) {
        throw new Error('Unable to find ' + props.name + '!');
    }

    const children = sortMembers(reflection.children ?? []);

    return (
        <ReflectionBoundary reflection={reflection} root={true}>
            <div className="api">
                <ReflectionDiscription reflection={reflection} references={props.references} />
                <Heading as='h3' id={`${reflection.name}-properties`}>Members</Heading>
                <div>
                    <ul className="class-members-list">
                        {reflection.indexSignature ? <IndexSignature reflection={reflection} index={reflection.indexSignature} references={props.references} /> : ''}
                        {reflection.references ? <ClassReferences prop={reflection} references={props.references}/> : ''}
                        {children.map(c => <ClassMember key={c.name} member={c} link={memberLink(reflection, c)} references={props.references}/>)}
                    </ul>
                </div>
            </div>
        </ReflectionBoundary>
    );
}

export function IndexSignature({ reflection, index, references }) {
    const param = index.parameters[0];
    return <li className="class-member-item">
        <Heading as='h4' id={`${reflection.name}-_index`}>Index Signature</Heading>
        <ReflectionDiscription reflection={index} references={references} />
        <pre><code>[{param.name}: <TypeLink type={param.type} references={references} />]: <TypeLink type={index.type} references={references} /></code></pre>
        <MemberExamples member={index} />
    </li>
}

export function ReflectionDiscription({ reflection, references }) {
    return <div>
        <CommentMarkdown comment={reflection.comment} references={references} />
    </div>
}

export function ClassMember(props) {
    let detail;
    if (props.member.kind === ReflectionKind.Property) {
        detail = ClassPropertyMember(props);
    } else if(props.member.kind === ReflectionKind.Constructor) {
        detail = ClassPropertyConstructor(props);
    } else if (props.member.kind === ReflectionKind.Method) {
        detail = ClassPropertyMethod(props);
    } else if(props.member.kind === ReflectionKind.Accessor) {
        detail = ClassPropertyAccessor(props);
    } else {
        detail = 'Kind not found ' + props.member.kind;
    }
    
    return (
        <ReflectionBoundary reflection={props.member}>
            <span role="separator" className="class-member-separator"></span>
            <li className="class-member-item">
                {detail}
            </li>
        </ReflectionBoundary>
    )
}

export function ClassMemberHeader(props) {
    return (
        <Heading as='h3' id={props.link}>
            <code>{props.member.name}</code>
        </Heading>
    )
}

export function ClassPropertyAccessor(props) {
    return (
        <div className="class-member-property">
            <Heading as='h4' id={props.link}>
                <span className="class-member-name">{props.member.name}</span> <span className="class-member-type"><TypeLink type={props.member.getSignature.type} references={props.references}/></span>
            </Heading>
            <p>{props.member.getSignature.comment?.text}</p>
            {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
        </div>
    );
}

export function ClassPropertyMember(props) {
    let prop = props.member;
    let typeDetail;
    let extraDetail = '';

    if (prop.references) {
        extraDetail = <ClassPropertyReferences prop={prop} references={props.references} />;
        typeDetail = <>{prop.typeReference}</>
    } else if (prop.type.type === 'reflection' && prop.typeText && prop.typeReference) {
        typeDetail = <>{prop.typeReference}</>
        extraDetail = <CodeBlock language='typescript'>{prop.typeText}</CodeBlock>
    } else {
        typeDetail = <TypeLink type={props.member.type} references={props.references}/>
    }

    if (!extraDetail && prop.typeText && prop.typeReference) {
        extraDetail = <CodeBlock language='typescript'>{prop.typeText}</CodeBlock>
    }

    const name = getChildName(prop);
    const id = getChildId(prop);

    return (
        <div className="class-member-property">
            <Heading as='h4' id={props.link}>
                <span className="class-member-name">{name}{props.member.flags.isOptional ? <span className="class-member-optional">?</span> : ''}</span> <span className="class-member-type">{typeDetail}</span>
            </Heading>
            <ReflectionDiscription reflection={props.member} references={props.references} />
            {extraDetail}
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function ClassReferences({ prop, references }) {
    const id = getChildId(prop);
    return <li className="class-member-item">
        <Heading as='h4' id={`${id}-extra-functions`}>Extra Functions</Heading>
        <p>The extra functions that are available on this type.</p>
        <Details>
            <p>See the following functions for more information:</p>
            <Markdown children={prop.references} references={references}/>
        </Details>
    </li>
}

export function ClassPropertyReferences({ prop, references }) {
    return <Details>
        <p>See the following functions for more information:</p>
        <Markdown children={prop.references} references={references}/>
    </Details>
}

export function ClassPropertyConstructor(props) {
    const name = getChildName(props.member);

    return (
        <div>
            <FunctionSignature func={props.member} name={name} sig={props.member.signatures[0]} link={props.link} references={props.references}/>
        </div>
    )
}

export function ClassPropertyMethod(props) {
    const name = getChildName(props.member);

    return (
        <div>
            <FunctionSignature func={props.member} name={name} sig={props.member.signatures[0]} link={props.link} references={props.references} />
            {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
        </div>
    )
}

export function ObjectMembers(props) {
    const reflection = props.reflection;
    const declaration = reflection.type.declaration;

    const childGroups = calculateObjectMemberGroups(reflection);

    return (
        <ReflectionBoundary reflection={reflection} root={true}>
            <div className="api">
                <ReflectionDiscription reflection={reflection} references={props.references} />
                {childGroups.map(c => <GroupChildren key={c.group} group={c} references={props.references}/>)}
            </div>
        </ReflectionBoundary>
    )
}

export function GroupChildren({ group, references }) {
    const children = group.children;

    const title = getGroupTitle(group);

    return <div>
        <Heading as="h3" id={group.group}>{title}</Heading>
        {children.map(c => {
            return <ObjectMember key={c.child.id} namespace={c.namespace} name={c.name} property={c.child} link={memberLink(c.reflection, c.child)} references={references}/>
        })}
    </div>
}

export function ObjectMember(props) {
    let detail;
    if (isSimpleFunctionProperty(props.property)) {
        // detail = <>{props.property.name}</>
        const name = props.namespace ? props.namespace + '.' + props.name : props.name;
        const declaration = props.property.type.declaration;
        detail = FunctionSignature({
            name: name,
            func: props.property,
            sig: getPreferredSignature(declaration.signatures) ?? declaration.signatures[0],
            link: props.link,
            references:props.references
        });
    } else if (isInterpretableFunctionProperty(props.property)) {
        const name = props.namespace ? props.namespace + '.' + props.name : props.name;
        const sig = getInterpretableFunctionSignature(props.property);
        detail = FunctionSignature({
            name: name,
            func: props.property,
            sig: sig,
            link: props.link,
            references:props.references
        });
        // detail = <>This is special{props.property.name}</>
    } else if(isObjectProperty(props.property)) {
        detail = <>This is really fun! {props.property.name}</>
        // detail = ObjectMembers({ reflection: props.property, references: props.references });
    } else if (props.property.kind === ReflectionKind.Property) {
        detail = ObjectProperty(props);
    } else {
        detail = 'Kind Not found ' + props.property.kind;
    }
    
    return (
        <ReflectionBoundary reflection={props.property}>
            <div>
                {detail}
            </div>
        </ReflectionBoundary>
    )
}

export function ObjectProperty(props) {
    return (
        <div>
            <Heading as='h3' id={props.link}>
                <code>{props.property.name}: <TypeLink type={props.property.type} references={props.references}/></code>
            </Heading>
            <ReflectionDiscription reflection={props.property} references={props.references} />
            {/* <pre><code>{JSON.stringify(props.property, undefined, 2)}</code></pre> */}
        </div>
    )
}

export function FunctionSignature({func, sig, link, name, references}) {
    const params = (sig.parameters || []);
    return (
        <div>
            <Heading as='h4' id={link}>
                <FunctionDefinition func={func} sig={sig} name={name} references={references}/>
            </Heading>
            <FunctionDescription sig={sig} references={references} />
            {params.length > 0 ? (
                <div>
                    {params.map((p, i) => <FunctionParameter key={p.name} param={p} index={i} references={references} />)}
                </div>
            ) : ''}
            <MemberExamples member={sig} />
        </div>
    );
}

export function FunctionDescription({ sig, references }) {
    return <CommentMarkdown comment={sig.comment} references={references} />
}

export function CommentMarkdown({ comment, references }) {
    return <Markdown references={references}>{getCommentText(comment)}</Markdown>
}

export function Markdown({ children, remarkPlugins, rehypePlugins, references }) {
    return <ReactMarkdown remarkPlugins={[
        [remarkTagLinks, {
            references
        }],
        ...(remarkPlugins || [])
    ]} rehypePlugins={[
        rehypeRaw, 
        ...(rehypePlugins || [])
    ]}>{children}</ReactMarkdown>
}

function getCommentText(comment) {
    let text = '';
    if (comment && comment.summary) {
        for(let block of comment.summary) {
            text += block.text;
        }
    }
    return text;
}

export function FunctionDefinition({ func, sig, name, references }) {
    const params = sig.parameters || [];

    let paramsDetail = '';

    if (func.kind !== ReflectionKind.GetSignature) {
        paramsDetail = <>({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.flags.isRest ? '...' : ''}{p.name}{p.flags.isOptional ? '?' : ''}: <TypeLink type={p.type} references={references}/></span>)})</>;
    }

    return (
        <><span className="function-member-name">{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}{paramsDetail}</span>: <span className="function-member-type"><TypeLink type={sig.type} references={references}/></span></>
    );
}

export function functionDefinition(func, name = func.name) {
    const params = func.parameters || [];
    let paramsDetail = '';

    if (func.kind !== ReflectionKind.GetSignature) {
        paramsDetail = `(${params.map((p, i) => (p.flags.isRest ? '...' : '') + p.name).join(', ')})`;
    }
    return `${name}${paramsDetail}: ${typeName(func.type)}`;
}

export function FunctionParameter({ param, index, references }) {
    let detail;
    if (param.flags.isRest && param.type.elementType) {
        if(index === 0) {
            detail = <p><em>Each parameter</em> is a <TypeLink type={param.type.elementType} references={references}/> and are <ParameterDescription param={param} isRest={true} references={references}/></p>
        } else {
            detail = <p><em>Each other parameter</em> is a <TypeLink type={param.type.elementType} references={references}/> and are <ParameterDescription param={param} isRest={true} references={references}/></p>
        }
    } else {
        detail = <p>The <em>{indexName(index)} parameter</em> is{param.flags.isOptional ? ' optional and is' : ''} a <TypeLink type={param.type} references={references}/> and <ParameterDescription param={param} references={references}/></p>
    }

    return detail;
}

export function MemberExamples({ member }) {
    if (!member.comment?.blockTags) {
        return '';
    }
    const examples = member.comment.blockTags.filter(t => t.tag === '@example');

    if (examples.length > 0) {
        return (
            <div>
                <h5 className="examples-heading">Examples</h5>
                {examples.map((e, i) => <CodeExample key={i} example={e} />)}
            </div>
        );
    }

    return '';
}

export function CodeExample({ example }) {
    const text = example.content.map(c => c.text).join('');
    const firstLineIndex = text.indexOf('\n');
    const secondLineIndex = text.indexOf('\n', firstLineIndex + 1);

    let language = 'typescript';
    if (firstLineIndex > 3) {
        language = text.substring(3, firstLineIndex).trim();
    }

    const codeBlockEnd = text.lastIndexOf('```');
    const title = text.substring(firstLineIndex, secondLineIndex);
    const code = text.substring(secondLineIndex, codeBlockEnd);

    return <CodeBlock language={language} title={title.trim()}>{code.trim()}</CodeBlock>
}

export function indexName(index) {
    return numberList[index];
}

export function propertyDefinition(prop, name = prop.name) {
    let type;
    if (prop.typeReference) {
        type = prop.typeReference;
    } else {
        type = typeName(prop.type);
    }
    return `${name}${prop.flags.isOptional ? '?' : ''}: ${type}`;
}

export function accessorDefinition(prop) {
    return `${prop.name}: ${typeName(prop.getSignature.type)}`;
}

function ParameterDescription({ param, isRest, references }) {
    return <Markdown remarkPlugins={[unwrapFirstParagraph]} references={references}>{parameterDescription(param, isRest)}</Markdown>
}

function parameterDescription(param, isRest) {
    let comment = getCommentText(param.comment);

    if (!comment) {
        return '';
        // throw `A description for "${param.name}" is not available.`;
    }
    // lowercase first char
    comment = comment.slice(0, 1).toLowerCase() + comment.slice(1);

    if (comment.startsWith('the') && !isRest) {
        comment = 'is ' + comment;
    }
    return comment;
}

const wellKnownTypes = new Map([
    ['ArrayBuffer', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer'],
    ['Blob', 'https://developer.mozilla.org/en-US/docs/Web/API/Blob'],
    ['Uint8Array', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array'],
    ['RegExp', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp'],
    ['Function', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function'],
    ['Error', 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error'],
]);

function TypeLink({ type, references, isInUnionOrArray }) {
    if (type.type === 'intrinsic') {
        return <span>{type.name}</span>
    } else if (type.name) {

        if (type.name === type.target?.qualifiedName && wellKnownTypes.has(type.name)) {
            const link = wellKnownTypes.get(type.name);
            return <><a className="type-link" href={link}>{type.name}</a></>
        }

        if (type.name === 'Promise' && type.target?.qualifiedName === 'Promise' && type.typeArguments && type.typeArguments.length === 1) {
            return <><a className="type-link" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise">Promise</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>&gt;</>
        } else if (type.name === 'Partial' && type.target?.qualifiedName === 'Partial' && type.typeArguments && type.typeArguments.length === 1) {
            return <><a className="type-link" href="https://www.typescriptlang.org/docs/handbook/utility-types.html#partialtype">Partial</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>&gt;</>
        } else if (type.name === 'Omit' && type.target?.qualifiedName === 'Omit' && type.typeArguments && type.typeArguments.length === 2) {
            return <><a className="type-link" href="https://www.typescriptlang.org/docs/handbook/utility-types.html#omittype-keys">Omit</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>, <TypeLink type={type.typeArguments[1]} references={references}/>&gt;</>
        } else if(type.name === 'Map' && type.target?.qualifiedName === 'Map' && type.typeArguments && type.typeArguments.length === 2) {
            return <><a className="type-link" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map">Map</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>, <TypeLink type={type.typeArguments[1]} references={references}/>&gt;</>
        } else if(type.name === 'Set' && type.target?.qualifiedName === 'Set' && type.typeArguments && type.typeArguments.length === 1) {
            return <><a className="type-link" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set">Set</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>&gt;</>
        } else if(type.name === 'Observable' && type.target?.qualifiedName === 'Observable' && type.typeArguments && type.typeArguments.length === 1) {
            return <><a className="type-link" href="https://rxjs.dev/api/index/class/Observable">Observable</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>&gt;</>
        } else if (type.name === 'IterableIterator' && type.target?.qualifiedName === 'IterableIterator' && type.typeArguments && type.typeArguments.length >= 1) {
            return <><a className="type-link" href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols">IterableIterator</a>&lt;<TypeLink type={type.typeArguments[0]} references={references}/>&gt;</>
        }

        let href = `#${type.name}`;
        const docId = type.id ? references?.[`id-${type.id}`] : null;
        if (docId)  {
            const hash = references?.[docId];
            if (hash) {
                href = useBaseUrl(hash) + `#${docId}`;
            }
        } else {
            if (!type.id) {
                console.log('Missing reference for', type, 'it is likely that the type is not exported from the entry. ');
            } else {
                console.log('Missing reference for', type.id, type.name, type, 'it is likely that the type does not have a @docid or @docname comment');
            }
        }
        return <Link className="type-link" href={href}>{type.name}</Link>
    } else if (type.type === 'union') {
        return <span>({type.types.map((t, i) => 
            <React.Fragment key={i}>
                {(i > 0 ? ' | ' : '')}
                <TypeLink type={t} references={references} isInUnionOrArray={true} />
            </React.Fragment>)})</span>
    } else if (type.type === 'array') {
        return <><TypeLink type={type.elementType} references={references} isInUnionOrArray={true}/>[]</>
    } else if (type.type === 'literal') {
    if (typeof type.value === 'string') {
            return <span>"{type.value}"</span>
        } else if (typeof type.value === 'number') {
            return <span>{type.value}</span>
        } else if (typeof type.value === 'boolean') {
            return <span>{type.value ? 'true' : 'false'}</span>
        } else if (typeof type.value === 'undefined') {
            return <span>undefined</span>
        } else if(type.value === null) {
            return <span>null</span>
        } else {
            return '' + JSON.stringify(type);
        }
    } else if (type.type === 'reflection') {
        const declaration = type.declaration;
        if (declaration.kind === ReflectionKind.TypeLiteral) {
            if (declaration.signatures && !declaration.children) {
                // arrow function type literal
                const sig = getPreferredSignature(declaration.signatures) ?? declaration.signatures[0];
                const params = sig.parameters || [];
                return <><span>{isInUnionOrArray ? '(':''}({params.map((p, i) => <span key={i}>{i > 0 ? ',' : ''}{p.name}: <TypeLink type={p.type} references={references}/></span>)}) =&gt; <TypeLink type={sig.type} references={references}/>{isInUnionOrArray ? ')':''}</span></>
            }
        }
        return 'object';
        // return '' + JSON.stringify(type);
        // return <>Dynamic</>
    } else if(type.type ==='intersection') {
        const types = type.types.map((t, index) => <>
            {index > 0 ? ' & ' : ''}
            <TypeLink type={t} references={references} isInUnionOrArray={true} />
        </>);
        return types;
    } else if(type.type === 'tuple') {
        const types = type.elements.map((t, index) => <>
            {index > 0 ? ', ' : ''}
            <TypeLink type={t} references={references} isInUnionOrArray={true} />
        </>);
        return <span>[{types}]</span>
    } else if (type.type === 'typeOperator') {
        return <span>{type.operator} <TypeLink type={type.target} references={references} isInUnionOrArray={true} /></span>
    } else {
        return '' + JSON.stringify(type);
    }
}

function typeName(type) {
    if (type.type === 'intrinsic') {
        return type.name;
    } else if (type.name) {
        if (type.name === 'Promise' && type.qualifiedName === 'Promise' && type.typeArguments && type.typeArguments.length === 1) {
            return `Promise&lt;${typeName(type.typeArguments[0])}&gt;`
        }
        return type.name;
    } else if (type.type === 'union') {
        return `(${type.types.map(t => typeName(t)).join(' | ')})`;
    } else if (type.type === 'array') {
        return `${typeName(type.elementType)}[]`;
    } else if (type.type === 'literal') {
        if (typeof type.value === 'string') {
            return `"${type.value}"`
        } else if (typeof type.value === 'number') {
            return String(type.value)
        } else if (typeof type.value === 'boolean') {
            return type.value ? 'true' : 'false'
        } else {
            return '' + JSON.stringify(type);
        }
    } else if (type.type === 'reflection') {
        return 'object';
    } else {
        return 'missing!: ' + JSON.stringify(type);
    }
}

export function MemberType(props) {
    if(props.member.type === 'intrinsic') {
        return IntrinsicType(props);
    } else {
        return ReferencedType(props);
    }
}

export function ReferencedType(props) {
    const type = 'primary';
    return (<a href={`#${props.member.type.name.toLowerCase()}`}>
        <span title={props.member.type.name} className={`badge badge--${type}`}>{props.member.type.name}</span>
    </a>)
}

export function IntrinsicType(props) {
    return (<span>{props.member.type.name}</span>)
}

// function WrapDebug(name, Component) {
//     try {
//         return (params) => <Component {...params}/>
//     } catch(err) {
//         throw new Error(`[${name}] ${err}`);
//     }
// }

export function DebugObject(props) {
    return <pre><code>{JSON.stringify(props.object, undefined, 2)}</code></pre>
}

export function getReturnType(func) {
    return func.signatures[0];
}

export function getProperty(obj, prop) {
    return obj.type.declaration.children.find(c => c.name === prop && c.kind === ReflectionKind.Property);
}

function isFunctionProperty(property) {
    return isSimpleFunctionProperty(property) || isInterpretableFunctionProperty(property);
}

function isSimpleFunctionProperty(property) {
    return property && isSimpleFunctionPropertyType(property.type);
}

function isSimpleFunctionPropertyType(type) {
    return type && type.type === 'reflection' &&
        type.declaration && type.declaration.signatures &&
        type.declaration.signatures.some(s => s.kind === ReflectionKind.CallSignature);
}

function isInterpretableFunctionProperty(property) {
    return property && property.type && property.type.type === 'intersection' &&
        property.type.types.some(t => isSimpleFunctionPropertyType(t));
}

function isFunctionSignature(signature) {
    return signature && signature.kind === ReflectionKind.CallSignature;
}

function isObjectProperty(property) {
    return property && property.type && property.type.type === 'reflection' &&
        property.type.declaration && property.type.declaration.kind === ReflectionKind.TypeLiteral &&
        property.type.declaration.children;
}

function getReflectionTag(reflection, tag) {
    const tagValue = reflection.comment?.blockTags?.find(t => {
        return t.tag === tag;
    });
    if (tagValue) {
        return tagValue.content.map(c => c.text).join('');
    }
    return null;
}

function getReflectionName(reflection) {
    const tagValue = getReflectionTag(reflection, '@docname');
    if (tagValue) {
        return tagValue;
    }
    return reflection.name;
}

function getNameFromSignatures(signatures) {
    if (signatures) {
        for(let sig of signatures) {
            const tagValue = getReflectionTag(sig, '@docname');
            if (tagValue) {
                return tagValue.trim();
            }
        }
    }

    return null;
}

function getChildGroup(child) {
    if (isSimpleFunctionProperty(child)) {
        const declaration =child?.type?.declaration; 
        const signatures = declaration?.signatures;

        let group = getDocGroupFromSignatures(signatures);
        if (group) {
            return group;
        }
    } else if (isInterpretableFunctionProperty(child)) {
        const type = child.type;
        const types = type.types;

        for (let t of types) {
            if (isSimpleFunctionPropertyType(t)) {
                const declaration = t.declaration; 
                const signatures = declaration.signatures;
        
                let group = getDocGroupFromSignatures(signatures);
                if (group) {
                    return group;
                }
            }
        }
    } else if (isFunctionSignature(child)) {
        let group = getDocGroupFromSignatures([child]);
        if (group) {
            return group;
        }
    }

    return '99-default';
}

function getChildName(child) {
    if (child.kind === ReflectionKind.Method) {
        let group = getNameFromSignatures(child.signatures);
        if (group) {
            return group;
        }
    } else if (isSimpleFunctionProperty(child)) {
        const declaration =child?.type?.declaration; 
        const signatures = declaration?.signatures;

        let group = getNameFromSignatures(signatures);
        if (group) {
            return group;
        }
    } else if (isInterpretableFunctionProperty(child)) {
        const type = child.type;
        const types = type.types;

        for (let t of types) {
            if (isSimpleFunctionPropertyType(t)) {
                const declaration = t.declaration; 
                const signatures = declaration.signatures;
        
                let group = getNameFromSignatures(signatures);
                if (group) {
                    return group;
                }
            }
        }
    } else if (isFunctionSignature(child)) {
        let group = getNameFromSignatures([child]);
        if (group) {
            return group;
        }
    }

    return getReflectionName(child);
}

function getChildId(child) {
    const id = getReflectionTag(child, '@docid');
    if (id) {
        return id;
    }
    const docId = getCommentTags(child, '@docid');
    if (docId.length > 0) {
        return docId[0].text.trim();
    }

    return getChildName(child);
}

function getDocGroupFromSignatures(signatures) {
    if (signatures) {
        for(let sig of signatures) {
            const tagValue = getReflectionTag(sig, '@docgroup');
            if (tagValue) {
                return tagValue.trim();
            }
        }
    }

    return null;
}

function getPreferredSignature(signatures) {
    for(let sig of signatures) {
        const tagValue = getReflectionTag(sig, '@docgroup');
        if (tagValue) {
            return sig;
        }
    }

    return null;
}

function getInterpretableFunctionSignature(property) {
    const type = property.type;
    const types = type.types;

    let firstSignature = null;
    for (let t of types) {
        if (isSimpleFunctionPropertyType(t)) {
            const declaration = t.declaration; 
            const signatures = declaration.signatures;
    
            if (!firstSignature) {
                firstSignature = signatures[0];
            }

            let sig = getPreferredSignature(signatures);
            if (sig) {
                return sig;
            }
        }
    }

    return firstSignature;
}

function getChildGroupTitle(child) {
    const signatures = getByKind(child, ReflectionKind.CallSignature);

    for(let sig of signatures) {
        const tagValue = getReflectionTag(sig, '@docgrouptitle');
        if (tagValue) {
            return tagValue.trim();
        }
    }

    return null;
}

function getGroupTitle(group) {
    for(let child of group.children) {
        let title = getChildGroupTitle(child.child);
        if(title) {
            return title;
        }
    }

    return group.group;
}

function flattenObjectChildren(reflection) {
    if (reflection.kind === ReflectionKind.CallSignature) {
        if (isFunctionSignature(reflection) || isFunctionProperty(reflection) || isObjectProperty(reflection)) {
            return [{
                group: getChildGroup(reflection),
                name: getChildName(reflection),
                reflection: reflection,
                child: reflection
            }];
        }
        return [];
    } else if (reflection.kind === ReflectionKind.TypeAlias || reflection.kind === ReflectionKind.GetSignature || reflection.kind === ReflectionKind.SetSignature) {
        return [];
    }
    const declaration = reflection.type.declaration;
    const children = declaration.children.filter(c => isFunctionSignature(c) || isFunctionProperty(c) || isObjectProperty(c));

    const isHiddenNamespace = getReflectionTag(reflection, '@hiddennamespace') !== null;
    const namespace = isHiddenNamespace ? null : reflection.name;

    return flatMap(children, c => {
        if (isFunctionProperty(c)) {
            return {
                group: getChildGroup(c),
                name: getChildName(c),
                namespace: namespace,
                reflection: reflection,
                child: c
            };
        }

        return flattenObjectChildren(c);
    });
}

function calculateObjectMemberGroups(reflection) {
    const flattened = flattenObjectChildren(reflection);
    const groups = groupBy(flattened, c => c.group);

    let childGroups = [];
    for(let group in groups) {
        childGroups.push({
            group: group,
            children: groups[group]
        });
    }

    childGroups = sortBy(childGroups, c => c.group);

    return childGroups;
}