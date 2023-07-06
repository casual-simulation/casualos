import React from 'react';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import { flatMap, groupBy, sortBy } from 'lodash';
import { ReflectionBoundary } from './errors';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Link from '@docusaurus/Link';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkTagLinks from './remarkTagLinks';
import unwrapFirstParagraph from './remarkUnwrapFirstParagraph';
import { getByKind } from './walk';

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
    return sortBy(children, c => c.kindString === 'Property' || c.kindString === 'Accessor' ? 0 : c.kindString === 'Constructor' ? 1 : 2)
        .filter(c => !c.flags.isPrivate);
}

function groupMembers(children) {
    let properties = [];
    let constructors = [];
    let methods = [];

    for(let c of children) {
        if (c.flags.isPrivate) {
            continue;
        }
        if (c.kindString === 'Property' || c.kindString === 'Accessor') {
            properties.push(c);
        } else if(c.kindString === 'Constructor') {
            constructors.push(c);
        } else if(c.kindString === 'Method') {
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
    if (member.kindString === 'Constructor') {
        name = functionDefinition(member.signatures[0]);
    } else if(member.kindString === 'Method') {
        name = functionDefinition(member.signatures[0]);
    } else if(member.kindString === 'Accessor') {
        name = accessorDefinition(member);
    } else {
        name = propertyDefinition(member);
    }

    name = `<code>${name}</code>`;

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
    let toc = [];

    for(let c of doc.contents) {
        if (c.reflection.kindString === 'Interface' || c.reflection.kindString === 'Class') {
            toc.push({
                value: c.reflection.name,
                id: c.reflection.name,
                level: 2
            });

            toc.push(...classTableOfContents(c.reflection));
        } else if (c.reflection.kindString === 'Call signature') {
            const name = getChildName(c.reflection);
            console.log(name);
            toc.push({
                value: functionDefinition(c.reflection, name),
                id: name,
                level: 2
            });
        } else {
            toc.push({
                value: c.reflection.name,
                id: c.reflection.name,
                level: 2
            });

            toc.push(...objectTableOfContents(c.reflection));
        }
    }

    return toc;
}

export function ApiContents({contents, references}) {
    return (
        <div className="api">
            {contents.map(c => <ApiReflection key={c.name} reflection={c.reflection} references={references} />)}
        </div>
    );
}

function ApiReflection({ reflection, references }) {

    if (reflection.kindString === 'Interface' || reflection.kindString === 'Class') {
        return <ClassReflection reflection={reflection} references={references} />
    } else if (reflection.kindString === 'Call signature') {
        return <SignatureReflection reflection={reflection} references={references} />
    } else {
        return <ObjectReflection reflection={reflection} references={references} />
    }
}

export function ClassReflection({ reflection, references }) {
    return (
        <div>
            <Heading as='h2' id={reflection.name}>{reflection.name}</Heading>
            <ClassMembers reflection={reflection}  references={references} />
        </div>
    )
}

export function ObjectReflection({ reflection, references }) {
    return (
        <div>
            <Heading as='h2' id={reflection.name}>{reflection.name}</Heading>
            <ObjectMembers reflection={reflection}  references={references} />
        </div>
    )
}

export function SignatureReflection({ reflection, references }) {
    const name = getChildName(reflection);
    return (
        <div>
            <FunctionSignature func={reflection} sig={reflection} name={name} link={name} references={references} />
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

    const children = sortMembers(reflection.children);

    // console.log(children);
    return (
        <ReflectionBoundary reflection={reflection} root={true}>
            <div className="api">
                <ReflectionDiscription reflection={reflection} />
                {children.map(c => <ClassMember key={c.name} member={c} link={memberLink(reflection, c)} references={props.references}/>)}
            </div>
        </ReflectionBoundary>
    );
}

export function ReflectionDiscription({ reflection }) {
    return <div>
        <CommentMarkdown comment={reflection.comment} />
    </div>
}

export function ClassMember(props) {
    let detail;
    if (props.member.kindString === 'Property') {
        detail = ClassPropertyMember(props);
    } else if(props.member.kindString === 'Constructor') {
        detail = ClassPropertyConstructor(props);
    } else if (props.member.kindString === 'Method') {
        detail = ClassPropertyMethod(props);
    } else if(props.member.kindString === 'Accessor') {
        detail = ClassPropertyAccessor(props);
    } else {
        detail = 'Not found ' + props.member.kindString;
    }
    
    return (
        <ReflectionBoundary reflection={props.member}>
            <div>
                {detail}
            </div>
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
        <div>
            <Heading as='h3' id={props.link}>
                <code>{props.member.name}: <TypeLink type={props.member.getSignature[0].type} references={props.references}/></code>
            </Heading>
            <p>{props.member.getSignature[0].comment?.shortText}</p>
            {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
        </div>
    );
}

export function ClassPropertyMember(props) {
    return (
        <div>
            <Heading as='h3' id={props.link}>
                <code>{props.member.name}: <TypeLink type={props.member.type} references={props.references}/></code>
            </Heading>
            <p>{props.member.comment?.shortText}</p>
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function ClassPropertyConstructor(props) {
    return (
        <div>
            <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link} references={props.references}/>
        </div>
    )
}

export function ClassPropertyMethod(props) {
    return (
        <div>
            <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link}/>
            {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
        </div>
    )
}

export function ObjectMembers(props) {
    const reflection = props.reflection;
    const declaration = reflection.type.declaration;

    const childGroups = calculateObjectMemberGroups(reflection);
    console.log(childGroups);

    // const children = sortMembers(declaration.children).filter(c => isFunctionProperty(c) || isObjectProperty(c));
    // const isHiddenNamespace = getReflectionTag(reflection, 'hiddennamespace') !== null;
    // const namespace = isHiddenNamespace ? null : reflection.name;

    return (
        <ReflectionBoundary reflection={reflection} root={true}>
            <div className="api">
                <ReflectionDiscription reflection={reflection} />
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
        console.log(name, sig, props.property);
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
    } else if (props.property.kindString === 'Property') {
        detail = ObjectProperty(props);
    // } else if(props.member.kindString === 'Constructor') {
    //     detail = ObjectPropertyConstructor(props);
    // } else if (props.member.kindString === 'Method') {
    //     detail = ObjectPropertyMethod(props);
    // } else if(props.member.kindString === 'Accessor') {
    //     detail = ObjectPropertyAccessor(props);
    } else {
        detail = 'Not found ' + props.property.kindString;
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
            <p>{props.property.comment?.shortText}</p>
            <pre><code>{JSON.stringify(props.property, undefined, 2)}</code></pre>
        </div>
    )
}

export function FunctionSignature({func, sig, link, name, references}) {
    if(!sig) {
        console.log(name, func);
    }
    const params = (sig.parameters || []);
    // console.log
    return (
        <div>
            <Heading as='h3' id={link}>
                <FunctionDefinition func={func} sig={sig} name={name} references={references}/>
            </Heading>
            <FunctionDescription sig={sig} />
            {params.length > 0 ? (
                <div>
                    {params.map((p, i) => <FunctionParameter key={p.name} param={p} index={i} references={references} />)}
                </div>
            ) : ''}
            <MemberExamples member={sig} />
        </div>
    );
}

export function FunctionDescription({ sig }) {
    return <CommentMarkdown comment={sig.comment} />
}

export function CommentMarkdown({ comment }) {
    return <Markdown>{getCommentText(comment)}</Markdown>
}

export function Markdown({ children, remarkPlugins, rehypePlugins }) {
    return <ReactMarkdown remarkPlugins={[remarkTagLinks, ...(remarkPlugins || [])]} rehypePlugins={[rehypeRaw, ...(rehypePlugins || [])]}>{children}</ReactMarkdown>
}

function getCommentText(comment) {
    let text = '';
    if (comment) {
        text += comment.shortText;

        if (comment.text) {
            text += '\n\n' + comment.text;
        }
    }
    return text;
}

export function FunctionDefinition({ func, sig, name, references }) {
    const params = sig.parameters || [];
    return (
        <code>{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.name}{p.flags.isOptional ? '?' : ''}: <TypeLink type={p.type} references={references}/></span>)}): <TypeLink type={sig.type} references={references}/></code>
    );
}

export function functionDefinition(func, name = func.name) {
    const params = func.parameters || [];
    return `${name}(${params.map((p, i) => p.name).join(', ')}): ${typeName(func.type)}`;
}

export function FunctionParameter({ param, index, references }) {
    let detail;
    if (param.flags.isRest && param.type.elementType) {
        if(index === 0) {

            detail = <p><strong>Each parameter</strong> is a <TypeLink type={param.type.elementType} references={references}/> and are <ParameterDescription param={param} isRest={true}/></p>
        } else {
            detail = <p><strong>Each other parameter</strong> is a <TypeLink type={param.type.elementType} references={references}/> and are <ParameterDescription param={param} isRest={true}/></p>
        }
    } else {
        detail = <p>The <strong>{indexName(index)} parameter</strong> is{param.flags.isOptional ? ' optional and is' : ''} a <TypeLink type={param.type} references={references}/> and <ParameterDescription param={param}/></p>
    }

    return detail;
}

export function MemberExamples({ member }) {
    if (!member.comment?.tags) {
        return '';
    }
    const examples = member.comment.tags.filter(t => t.tag === 'example');

    if (examples.length > 0) {
        return (
            <div>
                <h4>Examples</h4>
                {examples.map((e, i) => <CodeExample key={i} example={e} />)}
            </div>
        );
    }

    return '';
}

export function CodeExample({ example }) {
    const text = example.text;
    const firstLineIndex = text.indexOf('\n');
    const title = text.substring(0, firstLineIndex);
    const code = text.substring(firstLineIndex + 1);

    return <CodeBlock language="typescript" title={title.trim()}>{code.trim()}</CodeBlock>
}

export function indexName(index) {
    return numberList[index];
}

export function propertyDefinition(prop, name = prop.name) {
    return `${name}: ${typeName(prop.type)}`;
}

export function accessorDefinition(prop) {
    return `${prop.name}: ${typeName(prop.getSignature[0].type)}`;
}

function ParameterDescription({ param, isRest }) {
    return <Markdown remarkPlugins={[unwrapFirstParagraph]}>{parameterDescription(param, isRest)}</Markdown>
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

function TypeLink({ type, references }) {
    if (type.type === 'intrinsic') {
        return <span>{type.name}</span>
    } else if (type.name) {
        let href = `#${type.name}`;
        const hash = references?.[type.id];
        if (hash) {
            href = useBaseUrl(hash) + href;
        }
        return <Link href={href}>{type.name}</Link>
    } else if (type.type === 'union') {
        return <span>{type.types.map((t, i) => 
            <React.Fragment key={i}>
                {(i > 0 ? ' | ' : '')}
                <TypeLink type={t} references={references} />
            </React.Fragment>)}</span>
    } else if (type.type === 'array') {
        return <><TypeLink type={type.elementType} references={references}/>[]</>
    } else if (type.type === 'literal') {
        if (typeof type.value === 'string') {
            return <span>"{type.value}"</span>
        } else if (typeof type.value === 'number') {
            return <span>{type.value}</span>
        } else if (typeof type.value === 'boolean') {
            return <span>{type.value ? 'true' : 'false'}</span>
        } else {
            return '' + JSON.stringify(type);
        }
    } else if(type.type === 'reflection') {
        return '' + JSON.stringify(type);
        // return <>Dynamic</>
    } else {
        return '' + JSON.stringify(type);
    }
}

function typeName(type) {
    if (type.type === 'intrinsic') {
        return type.name;
    } else if (type.name) {
        return type.name;
    } else if (type.type === 'union') {
        return type.types.map(t => typeName(t)).join(' | ');
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
    return obj.type.declaration.children.find(c => c.name === prop && c.kindString === 'Property');
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
        type.declaration.signatures.some(s => s.kindString === 'Call signature');
}

function isInterpretableFunctionProperty(property) {
    return property && property.type && property.type.type === 'intersection' &&
        property.type.types.some(t => isSimpleFunctionPropertyType(t));
}

function isFunctionSignature(signature) {
    return signature && signature.kindString === 'Call signature';
}

function isObjectProperty(property) {
    return property && property.type && property.type.type === 'reflection' &&
        property.type.declaration && property.type.declaration.kindString === 'Type literal' &&
        property.type.declaration.children;
}

// export function RenderTree({ type }) {
//     let tree = [];

//     walkSingle(type, (value, parent) => {
//         console.log('value', value);
//         tree.push(<li key={value.id ?? Math.random()}>
//             {value.name}
//             <RenderTree type={value} />
//         </li>);
//     });

//     return <ul>
//         {tree}
//     </ul>;
// }

function getReflectionTag(reflection, tag) {
    const tagValue = reflection.comment?.tags?.find(t => {
        return t.tag === tag;
    });
    if (tagValue) {
        return tagValue.text.trim();
    }
    return null;
}

function getReflectionName(reflection) {
    const tagValue = getReflectionTag(reflection, 'docname');
    if (tagValue) {
        return tagValue;
    }
    return reflection.name;
}

function getNameFromSignatures(signatures) {
    if (signatures) {
        for(let sig of signatures) {
            const tagValue = getReflectionTag(sig, 'docname');
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

    // console.log('sig', child);
    if (isSimpleFunctionProperty(child)) {
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

function getDocGroupFromSignatures(signatures) {
    if (signatures) {
        for(let sig of signatures) {
            const tagValue = getReflectionTag(sig, 'docgroup');
            if (tagValue) {
                return tagValue.trim();
            }
        }
    }

    return null;
}

function getPreferredSignature(signatures) {
    for(let sig of signatures) {
        const tagValue = getReflectionTag(sig, 'docgroup');
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
    const signatures = getByKind(child, 'Call signature');

    console.log('signatures', child, signatures);
    for(let sig of signatures) {
        const tagValue = getReflectionTag(sig, 'docgrouptitle');
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
    if (reflection.kindString === 'Call signature') {
        if (isFunctionSignature(reflection) || isFunctionProperty(reflection) || isObjectProperty(reflection)) {
            return [{
                group: getChildGroup(reflection),
                name: getChildName(reflection),
                reflection: reflection,
                child: reflection
            }];
        }
        return [];
    }
    const declaration = reflection.type.declaration;
    const children = declaration.children.filter(c => isFunctionSignature(c) || isFunctionProperty(c) || isObjectProperty(c));

    const isHiddenNamespace = getReflectionTag(reflection, 'hiddennamespace') !== null;
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