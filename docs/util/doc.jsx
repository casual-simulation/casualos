import React from 'react';
import {usePluginData} from '@docusaurus/useGlobalData';

export function ClassDescription(props) {
    const { project } = usePluginData('docusaurus-plugin-typedoc');
    if (!project) {
        throw new Error('Unable to get TypeDoc project!');
    }
    const reflection = project.children.find(c => c.name === props.name);
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
    const { project } = usePluginData('docusaurus-plugin-typedoc');
    if (!project) {
        throw new Error('Unable to get TypeDoc project!');
    }
    const reflection = project.children.find(c => c.name === props.name);
    if (!reflection) {
        throw new Error('Unable to find ' + props.name + '!');
    }

    return (
        <div>
            {reflection.children.map(c => <ClassMember key={c.name} member={c}/>)}
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
            <ClassMemberHeader {...props}/>
            {detail}
        </div>
    )
}

export function ClassMemberHeader(props) {
    return (<h3 id={`${props.anchorRoot}-${props.member.name}`}><code>{props.member.name}</code></h3>);
}

export function ClassPropertyMember(props) {
    return (
        <div>
            <p>{props.member.comment?.shortText}</p>
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function ClassPropertyConstructor(props) {
    return (
        <div>
            {props.member.signatures.map(s => <FunctionSignature func={s} />)}
            {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
        </div>
    )
}

export function ClassPropertyMethod(props) {
    return (
        <div>
            {props.member.signatures.map(s => <FunctionSignature func={s} />)}
            <pre><code>{JSON.stringify(props.member)}</code></pre>
        </div>
    )
}

export function FunctionSignature({func}) {
    const params = (func.parameters || []);
    return (
        <>
            <h4><code>{func.name}({params.map((p, i) => <span>{i > 0 ? ', ' : ''}{p.name}</span>)})</code></h4>
            <span>{func.comment?.shortText}</span>
            <p>
                <strong>Parameters</strong>
                <ul>
                    {params.map(p => (
                        <li><strong>{p.name}</strong>: <MemberType member={p}/> {p.comment?.shortText}</li>
                    ))}
                </ul>
            </p>
        </>
    );
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