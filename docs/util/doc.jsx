import React from 'react';
import Heading from '@theme/Heading';
import CodeBlock from '@theme/CodeBlock';
import { sortBy } from 'lodash';
import { ReflectionBoundary } from './errors';
import useBaseUrl from '@docusaurus/useBaseUrl';
import Link from '@docusaurus/Link'

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

    const declaration = reflection.type.declaration;

    let { properties, constructors, methods } = groupMembers(declaration.children);

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

export function apiTableOfContents(doc) {
    let toc = [];

    for(let c of doc.contents) {
        if(c.reflection.kindString === 'Interface' || c.reflection.kindString === 'Class') {
            toc.push({
                value: c.reflection.name,
                id: c.reflection.name,
                level: 2
            });

            toc.push(...classTableOfContents(c.reflection));
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

export function ApiContents({contents}) {
    return (
        <div class="api">
            {contents.map(c => <ApiReflection key={c.name} reflection={c.reflection} />)}
        </div>
    );
}

function ApiReflection({ reflection }) {
    return (
        <div>
            <Heading as='h2' id={reflection.name}>{reflection.name}</Heading>
            <ApiMembers reflection={reflection} />
        </div>
    )
}

export function ApiMembers({reflection}) {
    if (reflection.kindString === 'Interface' || reflection.kindString === 'Class') {
        return <ClassMembers reflection={reflection} />
    } else {
        return <ObjectMembers reflection={reflection} />
    }
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
                {children.map(c => <ClassMember key={c.name} member={c} link={memberLink(reflection, c)}/>)}
            </div>
        </ReflectionBoundary>
    );
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
                <code>{props.member.name}: <TypeLink type={props.member.getSignature[0].type}/></code>
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
                <code>{props.member.name}: <TypeLink type={props.member.type}/></code>
            </Heading>
            <p>{props.member.comment?.shortText}</p>
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function ClassPropertyConstructor(props) {
    return (
        <div>
            <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link}/>
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

    const children = sortMembers(declaration.children).filter(c => isFunctionProperty(c));

    return (
        <ReflectionBoundary reflection={reflection} root={true}>
            <div className="api">
                {children.map(c => <ObjectMember key={c.name} namespace={reflection.name} property={c} link={memberLink(reflection, c)}/>)}
            </div>
        </ReflectionBoundary>
    )
}

export function ObjectMember(props) {
    let detail;
    if (isFunctionProperty(props.property)) {
        // detail = <>{props.property.name}</>
        detail = FunctionSignature({ name: props.namespace + '.' + props.property.name, func: props.property, sig: props.property.type.declaration.signatures[0], link: props.link });
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
                <code>{props.property.name}: <TypeLink type={props.property.type}/></code>
            </Heading>
            <p>{props.property.comment?.shortText}</p>
            <pre><code>{JSON.stringify(props.property, undefined, 2)}</code></pre>
        </div>
    )
}

export function FunctionSignature({func, sig, link, name}) {
    const params = (sig.parameters || []);
    return (
        <div>
            <Heading as='h3' id={link}>
                <FunctionDefinition func={func} sig={sig} name={name}/>
            </Heading>
            <p>{sig.comment?.shortText}</p>
            {params.length > 0 ? (
                <div>
                    {params.map((p, i) => <FunctionParameter key={p.name} param={p} index={i} />)}
                </div>
            ) : ''}
            <MemberExamples member={sig} />
        </div>
    );
}

export function FunctionDefinition({ func, sig, name }) {
    const params = sig.parameters || [];
    return (
        <code>{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.name}: <TypeLink type={p.type}/></span>)}): <TypeLink type={sig.type}/></code>
    );
}

export function functionDefinition(func) {
    const params = func.parameters || [];
    return `${func.name}(${params.map((p, i) => p.name).join(', ')}): ${typeName(func.type)}`;
}

export function FunctionParameter({ param, index }) {
    return (
        <p>The <strong>{indexName(index)} parameter</strong> is a <TypeLink type={param.type}/> and {parameterDescription(param)}</p>
    );
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

export function propertyDefinition(prop) {
    return `${prop.name}: ${typeName(prop.type)}`;
}

export function accessorDefinition(prop) {
    return `${prop.name}: ${typeName(prop.getSignature[0].type)}`;
}

function parameterDescription(param) {
    let comment = param.comment?.shortText;

    if (!comment) {
        return '';
        // throw `A description for "${param.name}" is not available.`;
    }
    // lowercase first char
    comment = comment.slice(0, 1).toLowerCase() + comment.slice(1);

    if (comment.startsWith('the')) {
        comment = 'is ' + comment;
    }
    return comment;
}

function TypeLink({ type }) {
    if (type.type === 'intrinsic') {
        return <span>{type.name}</span>
    } else if (type.name) {
        let href = `#${type.name.toLowerCase()}`;
        const page = typeMap[type.name];
        if (page) {
            href = useBaseUrl(page) + href;
        }
        return <Link href={href}>{type.name}</Link>
    } else if (type.type === 'union') {
        return <span>{type.types.map((t, i) => 
            <React.Fragment key={i}>
                {(i > 0 ? ' | ' : '')}
                <TypeLink type={t} />
            </React.Fragment>)}</span>
    } else if (type.type === 'array') {
        return <><TypeLink type={type.elementType}/>[]</>
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
    return property && property.type && property.type.type === 'reflection' &&
        property.type.declaration && property.type.declaration.signatures &&
        property.type.declaration.signatures.some(s => s.kindString === 'Call signature');
}

const keysMap = {
    'Property': ['type'],
    'reflection': ['declaration'],
    'Type literal': ['children', 'signatures'],
    'Call signature': ['parameters', 'comment', 'type']
}

export function walk(obj, callback, parent = null) {
    walkSingle(obj, (value, parent, key) => {
        callback(value, parent, key);
        walk(value, callback, value); 
    });
}

export function walkSingle(obj, callback, parent = null) {
    let keys = keysMap[obj.kindString ?? obj.type] || [];
    for(let key of keys) {
        let value = obj[key];
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

export function getTypeReferences(type) {
    return getByFilter(type, v => v.type === 'reference');
}

export function getByFilter(type, filter) {
    let result = [];
    walk(type, (value, parent, key) => {
        if (filter(value, parent, key)) {
            result.push(value);
        }
    });
    return result;
}

export function RenderTree({ type }) {
    let tree = [];

    walkSingle(type, (value, parent) => {
        console.log('value', value);
        tree.push(<li key={value.id ?? Math.random()}>
            {value.name}
            <RenderTree type={value} />
        </li>);
    });

    return <ul>
        {tree}
    </ul>;
}