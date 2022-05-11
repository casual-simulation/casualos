import React from 'react';
import Heading from '@theme/Heading';
import { sortBy } from 'lodash';

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
        console.log(member.kindString);
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

    // console.log(toc);

    // for (let member of sortMembers(reflection.children)) {
    //     const id = memberLink(reflection, member);

    //     let name;
    //     if (member.kindString === 'Constructor') {
    //         name = functionDefinition(member.signatures[0]);
    //     } else if(member.kindString === 'Method') {
    //         console.log(member.kindString);
    //         name = functionDefinition(member.signatures[0]);
    //     } else {
    //         name = propertyDefinition(member);
    //     }

    //     name = `<code>${name}</code>`;

    //     toc.push({
    //         value: name,
    //         id: id,
    //         level: 3
    //     });
    // }

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

    console.log(children);
    return (
        <div className="api">
            {children.map(c => <ClassMember key={c.name} member={c} link={memberLink(reflection, c)}/>)}
        </div>
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
    }else {
        detail = 'Not found ' + props.member.kindString;
    }
    
    return (
        <div>
            {detail}
        </div>
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
            <FunctionSignature func={props.member.signatures[0]} link={props.link}/>
        </div>
    )
}

export function ClassPropertyMethod(props) {
    return (
        <div>
            <FunctionSignature func={props.member.signatures[0]} link={props.link}/>
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function FunctionSignature({func, link}) {
    const params = (func.parameters || []);
    return (
        <div>
            <Heading as='h3' id={link}>
                <FunctionDefinition func={func}/>
            </Heading>
            <p>{func.comment?.shortText}</p>
            {params.length > 0 ? (
                <div>
                    <h4>Parameters</h4>
                    <ul>
                        {params.map(p => (
                            <li key={p.name}><strong>{p.name}</strong>: <TypeLink type={p.type}/> {p.comment?.shortText}</li>
                        ))}
                    </ul>
                </div>
            ) : ''}
        </div>
    );
}

export function FunctionDefinition({ func }) {
    const params = func.parameters || [];
    return (
        <code>{func.name}({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.name}: <TypeLink type={p.type}/></span>)}): <TypeLink type={func.type}/></code>
    );
}

export function functionDefinition(func) {
    const params = func.parameters || [];
    return `${func.name}(${params.map((p, i) => p.name).join(', ')}): ${func.type.name}`;
}

export function propertyDefinition(prop) {
    return `${prop.name}: ${prop.type.name}`;
}

function TypeLink({ type }) {
    if (type.type === 'intrinsic') {
        return <span>{type.name}</span>
    } else if(type.name) {
        return <a href={`#${type.name.toLowerCase()}`}>{type.name}</a>
    } else {
        return '';
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