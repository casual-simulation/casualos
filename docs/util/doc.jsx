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
    return sortBy(children, c => c.kindString === 'Property' ? 0 : c.kindString === 'Constructor' ? 1 : 2)
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
        if(c.kindString === 'Property') {
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

export function FunctionSignature({func, sig, link}) {
    const params = (sig.parameters || []);
    return (
        <div>
            <Heading as='h3' id={link}>
                <FunctionDefinition func={func} sig={sig}/>
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

export function FunctionDefinition({ func, sig }) {
    const params = sig.parameters || [];
    return (
        <code>{(func.flags.isStatic ? 'static ' : '') + sig.name}({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.name}: <TypeLink type={p.type}/></span>)}): <TypeLink type={sig.type}/></code>
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

function parameterDescription(param) {
    let comment = param.comment?.shortText;

    if (!comment) {
        throw `A description for "${param.name}" is not available.`;
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