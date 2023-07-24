// this runs in Node.js on the server.
import { PropType, createSSRApp, defineComponent, h, resolveComponent } from 'vue'
// Vue's server-rendering API is exposed under `vue/server-renderer`.
import { renderToString } from 'vue/server-renderer'

import { Content } from './loader';
import { SignatureReflection, ContainerReflection, IntrinsicType, ParameterReflection, Reflection, Type, ReferenceType, UnionType, ArrayType, DeclarationReflection, CommentTag } from 'typedoc';
import { flatMap, sortBy } from 'lodash';


export async function renderDoc(contents: Content['pages'][0]['contents']): Promise<string> {
    const app = createSSRApp({
        data: () => ({
            contents
        }),
        template: `<api-contents :contents="contents" />`,
    });

    app.component('api-contents', defineComponent({
        props: {
            contents: {
                type: Array as PropType<Content['pages'][0]['contents']>,
                required: true
            }
        },
        template: `<div class="api">
            <api-reflection v-for="c in contents" :key="c.name" :reflection="c.reflection" />
        </div>`,
    }));
    app.component('api-reflection', defineComponent({
        props: {
            reflection: {
                type: Object as PropType<Reflection>,
                required: true
            }
        },
        template: `<div>
            <component is="Heading" as="h3" :id="reflection.name">{{reflection.name}}</component>
            <api-members :reflection="reflection" />
        </div>`
    }));
    app.component('api-members', defineComponent({
        props: {
            reflection: {
                type: Object as PropType<Reflection>,
                required: true
            }
        },
        data: (vm) => ({
            isClass: vm.reflection.kindString === 'Interface' || vm.reflection.kindString === 'Class'
        }),
        template: `
            <class-members v-if="isClass" :reflection="reflection" />
            <object-members v-else :reflection="reflection" />
        `
    }));
    app.component('class-members', defineComponent({
        props: {
            reflection: {
                type: Object as PropType<ContainerReflection>,
                required: true
            }
        },
        data: (vm) => ({
            children: sortMembers(vm.reflection.children)
        }),
        methods: {
            memberLink: (reflection: Reflection, child: Reflection) => {
                return memberLink(reflection, child);
            }
        },
        template: `<div class="api">
            <class-member v-for="c in reflection.children" :key="c.name" :member="c" :link="memberLink(reflection, c)" />
        </div>
        `
        //const reflection = props.reflection;
//     if (!reflection) {
//         throw new Error('Unable to find ' + props.name + '!');
//     }

//     const children = sortMembers(reflection.children);

//     // console.log(children);
//     return (
//         <ReflectionBoundary reflection={reflection} root={true}>
//             <div className="api">
//                 {children.map(c => <ClassMember key={c.name} member={c} link={memberLink(reflection, c)}/>)}
//             </div>
//         </ReflectionBoundary>
//     );
    }));
    app.component('class-member', defineComponent({
        props: {
            member: {
                type: Object as PropType<Reflection>,
                required: true
            }
        },
        data: (vm) => ({
            detail: vm.$props.member.kindString === 'Property' ? 'class-property-member'
                :   vm.$props.member.kindString === 'Constructor' ? 'class-property-constructor'
                :   vm.$props.member.kindString === 'Method' ? 'class-property-method'
                :   vm.$props.member.kindString === 'Accessor' ? 'class-property-accessor'
                : null
        }),
        //     let detail;
//     if (props.member.kindString === 'Property') {
//         detail = ClassPropertyMember(props);
//     } else if(props.member.kindString === 'Constructor') {
//         detail = ClassPropertyConstructor(props);
//     } else if (props.member.kindString === 'Method') {
//         detail = ClassPropertyMethod(props);
//     } else if(props.member.kindString === 'Accessor') {
//         detail = ClassPropertyAccessor(props);
//     } else {
//         detail = 'Not found ' + props.member.kindString;
//     }
    
//     return (
//         <ReflectionBoundary reflection={props.member}>
//             <div>
//                 {detail}
//             </div>
//         </ReflectionBoundary>
//     )
        template: `<component v-if="detail" :is="detail" v-bind="$props"></component>
            <span v-else>Not found {{member.kindString}}</span>`
    }));

    app.component('class-property-member', defineComponent({
        props: {
            member: {
                type: Object as PropType<Reflection>,
                required: true
            },
            link: {
                type: String,
                required: true
            }
        },

        data: (vm) => ({
            comment: escapeCurlyBraces(vm.$props.member.comment?.shortText)
        }),
        // return (
            //         <div>
            //             <Heading as='h3' id={props.link}>
            //                 <code>{props.member.name}: <TypeLink type={props.member.type}/></code>
            //             </Heading>
            //             <p>{props.member.comment?.shortText}</p>
            //             {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
            //         </div>
            //     )
        template: `<div>
            <component is="Heading" as="h3" :id="link">
                <code>{{member.name}}: <type-link :type="member.type" /></code>
            </component>
            <p>{{comment}}</p>
        </div>`
    }));

    app.component('class-property-method', defineComponent({
        props: {
            member: {
                type: Object as PropType<Reflection>,
                required: true
            },
            link: {
                type: String,
                required: true
            }
        },
        // <div>
//             <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link}/>
//             {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
//         </div>
        template: `
            <div>
                <function-signature :func="member" :sig="member.signatures[0]" :link="link" />
            </div>
        `
    }));

    app.component('object-members', defineComponent({
        props: {
            reflection: {
                type: Object as PropType<any>,
                required: true
            }
        },

        data: (vm) => ({
            declaration: vm.$props.reflection.type.declaration,
            children: sortMembers(vm.$props.reflection.type.declaration.children).filter(c => isFunctionProperty(c)),
        }),

        methods: {
            memberLink: (reflection: Reflection, child: Reflection) => {
                return memberLink(reflection, child);
            }
        },

        template: `
            <div class="api">
                <class-members :reflection="declaration" />
            </div>
        `
        // const reflection = props.reflection;
//     const declaration = reflection.type.declaration;

//     const children = sortMembers(declaration.children).filter(c => isFunctionProperty(c));

//     return (
//         <ReflectionBoundary reflection={reflection} root={true}>
//             <div className="api">
//                 {children.map(c => <ObjectMember key={c.name} namespace={reflection.name} property={c} link={memberLink(reflection, c)}/>)}
//             </div>
//         </ReflectionBoundary>
//     )
    }));

//     app.component('object-member', defineComponent({
//         props: {
//             namespace: {
//                 type: String,
//                 required: true
//             },
//             property: {
//                 type: Object as PropType<Reflection>,
//                 required: true
//             },
//             link: {
//                 type: String,
//                 required: true
//             }
//         },
//         data: (vm) => ({
//             detail: vm.$props.property.kindString === 'Property' ? 'object-property-member'
//                 :   vm.$props.property.kindString === 'Constructor' ? 'object-property-constructor'
//                 :   vm.$props.property.kindString === 'Method' ? 'object-property-method'
//                 :   vm.$props.property.kindString === 'Accessor' ? 'object-property-accessor'
//                 : null
//         }),

//         //     let detail;
// //     if (isFunctionProperty(props.property)) {
// //         // detail = <>{props.property.name}</>
// //         detail = FunctionSignature({ name: props.namespace + '.' + props.property.name, func: props.property, sig: props.property.type.declaration.signatures[0], link: props.link });
// //     } else if (props.property.kindString === 'Property') {
// //         detail = ObjectProperty(props);
// //     // } else if(props.member.kindString === 'Constructor') {
// //     //     detail = ObjectPropertyConstructor(props);
// //     // } else if (props.member.kindString === 'Method') {
// //     //     detail = ObjectPropertyMethod(props);
// //     // } else if(props.member.kindString === 'Accessor') {
// //     //     detail = ObjectPropertyAccessor(props);
// //     } else {
// //         detail = 'Not found ' + props.property.kindString;
// //     }
    
// //     return (
// //         <ReflectionBoundary reflection={props.property}>
// //             <div>
// //                 {detail}
// //             </div>
// //         </ReflectionBoundary>
// //     )
//         template: `
        
//         `
//     }));

    app.component('function-signature', defineComponent({
        props: {
            func: {
                type: Object as PropType<Reflection>,
                required: true
            },
            sig: {
                type: Object as PropType<SignatureReflection>,
                required: true
            },
            link: {
                type: String,
                required: true
            }
        },
        data: (vm) => ({
            params: vm.$props.sig.parameters || [],
            comment: escapeCurlyBraces(vm.$props.sig.comment?.shortText)
        }),
        // const params = (sig.parameters || []);
//     return (
//         <div>
//             <Heading as='h3' id={link}>
//                 <FunctionDefinition func={func} sig={sig} name={name}/>
//             </Heading>
//             <p>{sig.comment?.shortText}</p>
//             {params.length > 0 ? (
//                 <div>
//                     {params.map((p, i) => <FunctionParameter key={p.name} param={p} index={i} />)}
//                 </div>
//             ) : ''}
//             <MemberExamples member={sig} />
//         </div>
//     );
        template: `
            <div>
                <component is="Heading" as="h3" :id="link">
                    <function-definition :func="func" :sig="sig" />
                </component>
                <p>{{comment}}</p>
                <div v-if="params.length > 0">
                    <function-parameter v-for="(p, i) in params" :key="p.name" :param="p" :index="i" />
                </div>
                <member-examples :member="sig" />
            </div>
        `
    }));

    app.component('function-definition', defineComponent({
        props: {
            func: {
                type: Object as PropType<Reflection>,
                required: true
            },
            sig: {
                type: Object as PropType<SignatureReflection>,
                required: true
            },
            name: {
                type: String,
                required: false
            }
        },
        data: (vm) => ({
            params: vm.$props.sig.parameters || []
        }),
        // export function FunctionDefinition({ func, sig, name }: any) {
            //     const params = sig.parameters || [];
            //     return (
            //         <code>{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}(<span v-for="(p, i) in params">{{i > 0 ? ', ' : ''}}{{p.name}}: <type-link :type="p.type"/></span>): <type-link :type="sig.type"/></code>
            //     );
            // }
        template: `
            <code>{{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}}(<span v-for="(p, i) in params" :key="i">{{i > 0 ? ', ' : ''}}{{p.name}}: <type-link :type="p.type"/></span>): <type-link :type="sig.type"/></code>
        `
    }));

    app.component('function-parameter', defineComponent({
        props: {
            param: {
                type: Object as PropType<ParameterReflection>,
                required: true
            },
            index: {
                type: Number,
                required: true
            }
        },

        data: (vm) => ({
            indexName: indexName(vm.$props.index),
            desc: parameterDescription(vm.$props.param)
        }),

        template: `
            <p>The <strong>{{indexName}} parameter</strong> is a <type-link :type="param.type"/> and {{desc}}</p>
        `
        // return (
            //         <p>The <strong>{indexName(index)} parameter</strong> is a <TypeLink type={param.type}/> and {parameterDescription(param)}</p>
            //     );
    }));

    app.component('type-link', defineComponent((props: { type: Type }) => {
        const type = props.type;
        return () => {
            if (type.type === 'intrinsic') {
                return h('span', (type as IntrinsicType).name);
            } else if ('name' in type) {
                let t = type as ReferenceType;
                let href = `#${t.name}`;

                return h('a', {
                    href: href
                }, t.name);
            } else if(type.type === 'union') {
                const t = type as UnionType;
                let children: any[] = flatMap(t.types, (t, i) => {
                    return [
                        i > 0 ? ' | ' : '',
                        h(resolveComponent('type-link'), { type: t })
                    ];
                });
                return h('span', children);
            } else if (type.type === 'array') {
                const t = type as ArrayType;
                return h('span', [
                    h(resolveComponent('type-link'), { type: t.elementType }),
                    '[]'
                ]);
            } else if (type.type === 'reflection') {
                return escapeCurlyBraces(JSON.stringify(type));
            } else {
                return escapeCurlyBraces(JSON.stringify(type));
            }
        };
    }, {
        props: ['type']
           
            //if (type.type === 'intrinsic') {
                //         return <span>{type.name}</span>
                //     } else if (type.name) {
                //         let href = `#${type.name.toLowerCase()}`;
                //         const page = typeMap[type.name];
                //         if (page) {
                //             href = useBaseUrl(page) + href;
                //         }
                //         return <Link href={href}>{type.name}</Link>
                //     } else if (type.type === 'union') {
                //         return <span>{type.types.map((t, i) => 
                //             <React.Fragment key={i}>
                //                 {(i > 0 ? ' | ' : '')}
                //                 <TypeLink type={t} />
                //             </React.Fragment>)}</span>
                //     } else if (type.type === 'array') {
                //         return <><TypeLink type={type.elementType}/>[]</>
                //     } else if(type.type === 'reflection') {
                //         return '' + JSON.stringify(type);
                //         // return <>Dynamic</>
                //     } else {
                //         return '' + JSON.stringify(type);
                //     }
            // if(vm.)
        
    }));

    app.component('member-examples', defineComponent({
        props: {
            member: {
                type: Object as PropType<Reflection>,
                required: true
            }
        },

        data: (vm) => {
            let r = ({
                examples: vm.$props.member.comment?.tags?.filter(t => (t as any).tag === 'example') || []
            });
            return r;
        },

        template: `
            <div>
                <h4>Examples</h4>
                <code-example v-for="(e, i) in examples" :key="i" :example="e" />
            </div>
        `
    }));

    app.component('code-example', defineComponent({
        props: {
            example: {
                type: Object as PropType<CommentTag>,
                required: true
            }
        },
        data: (vm) => ({
            text: vm.$props.example.text,
            firstLineIndex: vm.$props.example.text.indexOf('\n'),
            title: vm.$props.example.text.substring(0, vm.$props.example.text.indexOf('\n')).trim(),
            code: JSON.stringify(vm.$props.example.text.substring(vm.$props.example.text.indexOf('\n') + 1).trim())
        }),

        template: `
            <component is="CodeBlock" language="typescript" :title="title">{{code}}</component>
        `
    }));
    // app.component('Heading', defineComponent({
    //     render() {
    //         return h('Heading', )
    //     }
    // }))
    return (await renderToString(app)).replace(/<!--(?:\[|\])?-->/g, '');
}

function escapeCurlyBraces(text: string) {
    return text ? text.replace(/{/g, '&#123;').replace(/}/g, '&#125;') : '';
}
// export function ClassDescription(props: any) {
//     const reflection = props.reflection;
//     if (!reflection) {
//         throw new Error('Unable to find ' + props.name + '!');
//     }

//     return (
//         <div>
//             <h2>{reflection.name}</h2>
//         </div>
//     );
// }

// export function ClassMember(props: any) {
//     let detail;
//     if (props.member.kindString === 'Property') {
//         detail = ClassPropertyMember(props);
//     } else if(props.member.kindString === 'Constructor') {
//         detail = ClassPropertyConstructor(props);
//     } else if (props.member.kindString === 'Method') {
//         detail = ClassPropertyMethod(props);
//     } else if(props.member.kindString === 'Accessor') {
//         detail = ClassPropertyAccessor(props);
//     } else {
//         detail = 'Not found ' + props.member.kindString;
//     }
    
//     return (
//         <ReflectionBoundary reflection={props.member}>
//             <div>
//                 {detail}
//             </div>
//         </ReflectionBoundary>
//     )
// }

// export function ClassMemberHeader(props: any) {
//     return (
//         <Heading as='h3' id={props.link}>
//             <code>{props.member.name}</code>
//         </Heading>
//     )
// }

// export function ClassPropertyAccessor(props: any) {
//     return (
//         <div>
//             <Heading as='h3' id={props.link}>
//                 <code>{props.member.name}: <TypeLink type={props.member.getSignature[0].type}/></code>
//             </Heading>
//             <p>{props.member.getSignature[0].comment?.shortText}</p>
//             {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
//         </div>
//     );
// }

// export function ClassPropertyMember(props: any) {
//     return (
//         <div>
//             <Heading as='h3' id={props.link}>
//                 <code>{props.member.name}: <TypeLink type={props.member.type}/></code>
//             </Heading>
//             <p>{props.member.comment?.shortText}</p>
//             {/* <pre><code>{JSON.stringify(props.member)}</code></pre> */}
//         </div>
//     )
// }

// export function ClassPropertyConstructor(props: any) {
//     return (
//         <div>
//             <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link}/>
//         </div>
//     )
// }

// export function ClassPropertyMethod(props: any) {
//     return (
//         <div>
//             <FunctionSignature func={props.member} sig={props.member.signatures[0]} link={props.link}/>
//             {/* <CodeBlock language="json">{JSON.stringify(props.member, undefined, 2)}</CodeBlock> */}
//         </div>
//     )
// }


// export function ObjectMember(props: any) {
//     let detail;
//     if (isFunctionProperty(props.property)) {
//         // detail = <>{props.property.name}</>
//         detail = FunctionSignature({ name: props.namespace + '.' + props.property.name, func: props.property, sig: props.property.type.declaration.signatures[0], link: props.link });
//     } else if (props.property.kindString === 'Property') {
//         detail = ObjectProperty(props);
//     // } else if(props.member.kindString === 'Constructor') {
//     //     detail = ObjectPropertyConstructor(props);
//     // } else if (props.member.kindString === 'Method') {
//     //     detail = ObjectPropertyMethod(props);
//     // } else if(props.member.kindString === 'Accessor') {
//     //     detail = ObjectPropertyAccessor(props);
//     } else {
//         detail = 'Not found ' + props.property.kindString;
//     }
    
//     return (
//         <ReflectionBoundary reflection={props.property}>
//             <div>
//                 {detail}
//             </div>
//         </ReflectionBoundary>
//     )
// }

// export function ObjectProperty(props: any) {
//     return (
//         <div>
//             <Heading as='h3' id={props.link}>
//                 <code>{props.property.name}: <TypeLink type={props.property.type}/></code>
//             </Heading>
//             <p>{props.property.comment?.shortText}</p>
//             <pre><code>{JSON.stringify(props.property, undefined, 2)}</code></pre>
//         </div>
//     )
// }

// export function FunctionSignature({func, sig, link, name}: any) {
//     const params = (sig.parameters || []);
//     return (
//         <div>
//             <Heading as='h3' id={link}>
//                 <FunctionDefinition func={func} sig={sig} name={name}/>
//             </Heading>
//             <p>{sig.comment?.shortText}</p>
//             {params.length > 0 ? (
//                 <div>
//                     {params.map((p, i) => <FunctionParameter key={p.name} param={p} index={i} />)}
//                 </div>
//             ) : ''}
//             <MemberExamples member={sig} />
//         </div>
//     );
// }

// export function FunctionDefinition({ func, sig, name }: any) {
//     const params = sig.parameters || [];
//     return (
//         <code>{(func.flags.isStatic ? 'static ' : '') + (name || sig.name)}({params.map((p, i) => <span key={p.name}>{i > 0 ? ', ' : ''}{p.name}: <TypeLink type={p.type}/></span>)}): <TypeLink type={sig.type}/></code>
//     );
// }

// export function functionDefinition(func: any) {
//     const params = func.parameters || [];
//     return `${func.name}(${params.map((p, i) => p.name).join(', ')}): ${typeName(func.type)}`;
// }

// export function FunctionParameter({ param, index }: any) {
//     return (
//         <p>The <strong>{indexName(index)} parameter</strong> is a <TypeLink type={param.type}/> and {parameterDescription(param)}</p>
//     );
// }

// export function MemberExamples({ member }: any) {
//     if (!member.comment?.tags) {
//         return '';
//     }
//     const examples = member.comment.tags.filter(t => t.tag === 'example');

//     if (examples.length > 0) {
//         return (
//             <div>
//                 <h4>Examples</h4>
//                 {examples.map((e, i) => <CodeExample key={i} example={e} />)}
//             </div>
//         );
//     }

//     return '';
// }

// export function CodeExample({ example }: any) {
//     const text = example.text;
//     const firstLineIndex = text.indexOf('\n');
//     const title = text.substring(0, firstLineIndex);
//     const code = text.substring(firstLineIndex + 1);

//     return <CodeBlock language="typescript" title={title.trim()}>{code.trim()}</CodeBlock>
// }

// function TypeLink({ type }) {
//     if (type.type === 'intrinsic') {
//         return <span>{type.name}</span>
//     } else if (type.name) {
//         let href = `#${type.name.toLowerCase()}`;
//         const page = typeMap[type.name];
//         if (page) {
//             href = useBaseUrl(page) + href;
//         }
//         return <Link href={href}>{type.name}</Link>
//     } else if (type.type === 'union') {
//         return <span>{type.types.map((t, i) => 
//             <React.Fragment key={i}>
//                 {(i > 0 ? ' | ' : '')}
//                 <TypeLink type={t} />
//             </React.Fragment>)}</span>
//     } else if (type.type === 'array') {
//         return <><TypeLink type={type.elementType}/>[]</>
//     } else if(type.type === 'reflection') {
//         return '' + JSON.stringify(type);
//         // return <>Dynamic</>
//     } else {
//         return '' + JSON.stringify(type);
//     }
// }

function memberLink(reflection: Reflection, member: any) {
    return `${reflection.name}-${member.name}`;
}

function sortMembers(children: any){
    return sortBy(children, c => c.kindString === 'Property' || c.kindString === 'Accessor' ? 0 : c.kindString === 'Constructor' ? 1 : 2)
        .filter(c => !c.flags.isPrivate);
}

const numberList = [
    'first',
    'second',
    'third',
    'fourth',
    'fifth'
];

export function indexName(index: number) {
    return numberList[index];
}

export function propertyDefinition(prop: any) {
    return `${prop.name}: ${typeName(prop.type)}`;
}

export function accessorDefinition(prop: any) {
    return `${prop.name}: ${typeName(prop.getSignature[0].type)}`;
}

function typeName(type: any): any {
    if (type.type === 'intrinsic') {
        return type.name;
    } else if (type.name) {
        return type.name;
    } else if (type.type === 'union') {
        return type.types.map((t: any) => typeName(t)).join(' | ');
    } else if (type.type === 'array') {
        return `${typeName(type.elementType)}[]`;
    } else {
        return 'missing!: ' + JSON.stringify(type);
    }
}


function parameterDescription(param: ParameterReflection) {
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
    return escapeCurlyBraces(comment);
}


function isFunctionProperty(c: any): unknown {
    throw new Error('Function not implemented.');
}
// function TypeLink({ type }: any) {
//     if (type.type === 'intrinsic') {
//         return <span>{type.name}</span>
//     } else if (type.name) {
//         let href = `#${type.name.toLowerCase()}`;
//         const page = typeMap[type.name];
//         if (page) {
//             href = useBaseUrl(page) + href;
//         }
//         return <Link href={href}>{type.name}</Link>
//     } else if (type.type === 'union') {
//         return <span>{type.types.map((t, i) => 
//             <React.Fragment key={i}>
//                 {(i > 0 ? ' | ' : '')}
//                 <TypeLink type={t} />
//             </React.Fragment>)}</span>
//     } else if (type.type === 'array') {
//         return <><TypeLink type={type.elementType}/>[]</>
//     } else if (type.type === 'reflection') {
//         return '' + JSON.stringify(type);
//         // return <>Dynamic</>
//     } else {
//         return '' + JSON.stringify(type);
//     }
// }


// export function MemberType(props) {
//     if(props.member.type === 'intrinsic') {
//         return IntrinsicType(props);
//     } else {
//         return ReferencedType(props);
//     }
// }

// export function ReferencedType(props) {
//     const type = 'primary';
//     return (<a href={`#${props.member.type.name.toLowerCase()}`}>
//         <span title={props.member.type.name} className={`badge badge--${type}`}>{props.member.type.name}</span>
//     </a>)
// }

// export function IntrinsicType(props) {
//     return (<span>{props.member.type.name}</span>)
// }

// function Raw(code: string) {
//     return <div dangerouslySetInnerHTML={{ __html: code }}></div>
// }