import { Transpiler } from './Transpiler';
import { traverse, VisitorOption } from 'estraverse';
import flatMap from 'lodash/flatMap';
import { getTag, trimTag } from '../bots';

export const defaultReplacement = Symbol('defaultReplacement');
export const tagNameSymbol = Symbol('tagName');

export class Dependencies {
    private _transpiler: Transpiler = new Transpiler();

    /**
     * Calculates which tags and bots the given code is dependent on.
     */
    calculateAuxDependencies(code: string): AuxScriptExternalDependency[] {
        try {
            const tree = this.dependencyTree(code);
            const simple = this.simplify(tree);
            const replaced = this.replaceAuxDependencies(simple);
            const flat = this.flatten(replaced);
            return <AuxScriptExternalDependency[]>(
                flat.filter(
                    (f) =>
                        f.type === 'all' ||
                        f.type === 'tag' ||
                        f.type === 'bot' ||
                        f.type === 'this' ||
                        f.type === 'tag_value'
                )
            );
        } catch (e) {
            if (e instanceof SyntaxError) {
                return [];
            } else {
                throw e;
            }
        }
    }

    /**
     * Gets a dependency tree for the given code.
     * @param code The code to parse into a dependency tree.
     */
    dependencyTree(code: string): AuxScriptExpressionDependencies {
        const node = this._transpiler.parse(code);
        return this._expressionDependencies(node);
    }

    /**
     * Reduces the given Dependency Tree to a list of simplified dependencies.
     * Useful to reduce the amount of information that the tree contains and make it easier to process.
     * @param node The root node of the dependency tree.
     */
    simplify(node: AuxScriptDependency): AuxScriptSimpleDependency[] {
        if (node.type === 'expression') {
            return this._simpleExpressionDependencies(node);
        } else if (node.type === 'bot' || node.type === 'tag') {
            return this._simpleTagDependencies(node);
        } else if (node.type === 'call') {
            return this._simpleFunctionDependencies(node);
        } else if (node.type === 'member') {
            return this._simpleMemberDependencies(node);
        } else if (node.type === 'literal') {
            return this._simpleLiteralDependencies(node);
        } else if (node.type === 'object_expression') {
            return this._simpleObjectExpressionDependencies(node);
        }

        return [];
    }

    /**
     * Flattens the given list to make it easy to de-duplicate dependencies.
     * @param nodes The nodes to flatten.
     */
    flatten(nodes: AuxScriptSimpleDependency[]): AuxScriptSimpleDependency[] {
        return flatMap(nodes, (n) => {
            if (
                n.type === 'bot' ||
                n.type === 'tag' ||
                n.type === 'function' ||
                n.type === 'tag_value'
            ) {
                return [n, ...this.flatten(n.dependencies)];
            }
            return n;
        });
    }

    /**
     * Replaces all dependencies on AUX functions with their related dependencies on bots/tags.
     * @param nodes The nodes to perform the replacements on.
     */
    replaceAuxDependencies(
        nodes: AuxScriptSimpleDependency[]
    ): AuxScriptSimpleDependency[] {
        return this.replaceDependencies(nodes, auxDependencies(this));
    }

    /**
     * Replaces matching function calls in the given list of simplified dependencies with their actual dependencies.
     * This is useful to be able to match functions like getBotsInContext("context_a") to the actual dependency.
     */
    replaceDependencies(
        nodes: AuxScriptSimpleDependency[],
        replacements: AuxScriptReplacements
    ): AuxScriptSimpleDependency[] {
        return [...iterator.call(this)];

        function* iterator(
            this: Dependencies
        ): IterableIterator<AuxScriptSimpleDependency> {
            for (let node of nodes) {
                let replaced = false;
                if (
                    node.type !== 'literal' &&
                    node.type !== 'all' &&
                    node.type !== 'this' &&
                    node.type !== 'object_expression' &&
                    node.type !== 'property' &&
                    node.type !== 'end_function_parameters'
                ) {
                    const replacement =
                        replacements[<string>node.name] ||
                        replacements[defaultReplacement];
                    if (replacement) {
                        yield* replacement(node);
                        replaced = true;
                    }
                }

                if (!replaced) {
                    if (
                        node.type === 'function' ||
                        node.type === 'bot' ||
                        node.type === 'tag' ||
                        node.type === 'object_expression'
                    ) {
                        yield {
                            ...node,
                            dependencies: this.replaceDependencies(
                                node.dependencies,
                                replacements
                            ),
                        };
                    } else {
                        yield node;
                    }
                }
            }
        }
    }

    private _simpleMemberDependencies(
        node: AuxScriptMemberDependency
    ): AuxScriptSimpleDependency[] {
        let root = this._rootMembers(node);
        if (root) {
            if (root.type === 'call') {
                let deps = this._simpleFunctionDependencies(root);
                let func = deps[0];
                if (func.type === 'function') {
                    let member = this._simplifyMember(node, false);
                    func.dependencies.push(
                        {
                            type: 'end_function_parameters',
                        },
                        ...member
                    );
                }

                return deps;
            }

            return this._simpleRootDependencies(root);
        }

        return this._simplifyMember(node, true);
    }

    private _simplifyMember(
        node: AuxScriptMemberDependency,
        allowFunctions: boolean
    ): AuxScriptSimpleDependency[] {
        let firstMember: AuxScriptSimpleMemberDependency = this._reorderMember(
            node,
            allowFunctions
        );

        if (!firstMember) {
            return [];
        }

        if (firstMember.name === 'this') {
            return [{ type: 'this' }];
        }
        return [firstMember];
    }

    /**
     * Produces a new simple member dependency that provides a top-down view of the
     * tree instead of a bottom up view.
     * @param node The node.
     * @param allowFunctions Whether to continue when a call dependency occurs. If true, then function names can be part of the member name.
     */
    private _reorderMember(
        node: AuxScriptMemberDependency,
        allowFunctions: boolean
    ) {
        let stack = [];
        let current: AuxScriptObjectDependency = node;
        while (current) {
            stack.unshift(current);
            if (current.type === 'member') {
                current = current.object;
            } else if (current.type === 'bot') {
                current = null;
            } else if (current.type === 'tag') {
                current = null;
            } else if (current.type === 'call') {
                if (allowFunctions) {
                    current = current.identifier;
                } else {
                    current = null;
                }
            }
        }

        let firstMember: AuxScriptSimpleMemberDependency;
        let currentMember: AuxScriptSimpleMemberDependency = null;
        for (let abc of stack) {
            if (abc.type === 'member') {
                let nextMember: AuxScriptSimpleMemberDependency = {
                    type: 'member',
                    name: abc.identifier,
                    reference: abc.reference,
                    dependencies: [],
                };

                if (currentMember) {
                    currentMember.dependencies.push(nextMember);
                } else {
                    firstMember = nextMember;
                }
                currentMember = nextMember;
            }
        }
        return firstMember;
    }

    /**
     * Gets the root-most member from the given node.
     * This is useful for finding if the member node is attached to the end of a function call or if it is standalone.
     * @param node
     */
    private _rootMembers(
        node: AuxScriptObjectDependency
    ): AuxScriptObjectDependency {
        let current: AuxScriptObjectDependency = node;
        while (current) {
            if (current.type === 'member') {
                current = current.object;
            } else if (current.type === 'call') {
                return current;
            } else {
                return current;
            }
        }
        return null;
    }

    private _simpleRootDependencies(
        root: AuxScriptObjectDependency
    ): AuxScriptSimpleDependency[] {
        if (root.type === 'bot' || root.type === 'tag') {
            return this._simpleTagDependencies(root);
        } else if (root.type === 'call') {
            return this._simpleFunctionDependencies(root);
        } else {
            return [];
        }
    }

    private _simpleFunctionDependencies(
        node: AuxScriptFunctionDependency
    ): AuxScriptSimpleDependency[] {
        let current = this._rootMembers(node.identifier);
        if (current) {
            return [
                ...this._simpleRootDependencies(current),
                ...flatMap(node.dependencies, (d) => this.simplify(d)),
            ];
        }

        return [
            {
                type: 'function',
                name: this.getMemberName(node.identifier),
                dependencies: flatMap(node.dependencies, (d) =>
                    this.simplify(d)
                ),
            },
        ];
    }

    private _simpleTagDependencies(
        node: AuxScriptTagDependency | AuxScriptBotDependency
    ): AuxScriptSimpleDependency[] {
        return [
            <AuxScriptSimpleBotDependency | AuxScriptSimpleTagDependency>{
                type: node.type,
                name: this.getMemberName(node),
                dependencies: flatMap(node.dependencies, (d) =>
                    this.simplify(d)
                ),
            },
        ];
    }

    private _simpleExpressionDependencies(
        node: AuxScriptExpressionDependencies
    ): AuxScriptSimpleDependency[] {
        return flatMap(node.dependencies, (d) => this.simplify(d));
    }

    private _simpleLiteralDependencies(
        node: AuxScriptLiteralDependency
    ): AuxScriptSimpleDependency[] {
        return [node];
    }

    private _simpleObjectExpressionDependencies(
        node: AuxScriptObjectExpressionDependencies
    ): AuxScriptSimpleDependency[] {
        return [
            {
                type: node.type,
                dependencies: node.properties.map((p) => ({
                    type: p.type,
                    name: p.name,
                    dependencies: this.simplify(p.value),
                })),
            },
        ];
    }

    /**
     * Gets the full name of the given member node.
     * @param node The node.
     */
    getMemberName(node: AuxScriptObjectDependency): string {
        let stack: string[] = [];
        let current: AuxScriptObjectDependency = node;
        while (current) {
            if (current.type === 'member') {
                stack.unshift(current.identifier);
                current = current.object;
            } else if (current.type === 'call') {
                stack.unshift('()');
                current = current.identifier;
            } else {
                stack.unshift(`${current.name}`);
                current = null;
            }
        }

        return stack.join('.');
    }

    private _expressionDependencies(
        node: any
    ): AuxScriptExpressionDependencies {
        let tags: AuxScriptDependency[] = [];

        traverse(<any>node, {
            enter: (node: any, parent: any) => {
                const dep = this._nodeDependency(node, parent);
                if (dep) {
                    tags.push(dep);
                    return VisitorOption.Skip;
                }
            },

            keys: {
                ObjectValue: ['identifier'],
                TagValue: ['identifier'],
            },
        });

        return {
            type: 'expression',
            dependencies: tags,
        };
    }

    private _objectOrExpressionDependencies(
        node: any
    ): AuxScriptExpressionDependencies | AuxScriptObjectExpressionDependencies {
        if (node.type === 'ObjectExpression') {
            return this._objectExpressionDependencies(node);
        }

        return this._expressionDependencies(node);
    }

    private _objectExpressionDependencies(
        node: any
    ): AuxScriptObjectExpressionDependencies {
        return {
            type: 'object_expression',
            properties: node.properties.map((prop: any) => {
                let key =
                    prop.key.type === 'Identifier'
                        ? prop.key.name
                        : prop.key.value;
                return {
                    type: 'property',
                    name: key,
                    value: this._nodeDependency(prop.value, prop),
                } as AuxScriptProperty;
            }),
        };
    }

    private _nodeDependency(node: any, parent: any): AuxScriptDependency {
        if (
            parent &&
            (parent.type === 'ArrowFunctionExpression' ||
                parent.type === 'FunctionExpression')
        ) {
            return null;
        }
        if (node.type === 'MemberExpression') {
            return this._memberDependency(node);
        } else if (node.type === 'ThisExpression') {
            return this._thisDependency(node);
        } else if (node.type === 'TagValue' || node.type === 'ObjectValue') {
            return this._tagDependency(node);
        } else if (node.type === 'CallExpression') {
            return this._callDependency(node);
        } else if (node.type === 'Literal') {
            return this._literalDependency(node);
        } else if (node.type === 'Identifier') {
            return this._identifierDependency(node);
        }

        return null;
    }

    private _literalDependency(node: any): AuxScriptLiteralDependency {
        return {
            type: 'literal',
            value: node.value,
        };
    }

    private _callDependency(node: any): AuxScriptFunctionDependency {
        return {
            type: 'call',
            identifier: this._objectDependency(node.callee, node),
            dependencies: node.arguments
                .map(
                    (arg: any) =>
                        this._nodeDependency(arg, node) ||
                        this._objectOrExpressionDependencies(arg)
                )
                .filter((arg: any) => !!arg),
        };
    }

    private _tagDependency(node: any) {
        const { tag, args, nodes } = this._transpiler.getTagNodeValues(node);
        return <AuxScriptTagDependency | AuxScriptBotDependency>{
            type: node.type === 'TagValue' ? 'tag' : 'bot',
            name: tag,
            dependencies: args
                .map((a) => {
                    const dep = this._nodeDependency(a, node);
                    if (dep) {
                        return dep;
                    }
                    return this._objectOrExpressionDependencies(a);
                })
                .filter((e) =>
                    e.type === 'expression' ? e.dependencies.length > 0 : true
                ),
        };
    }

    private _memberDependency(node: any): AuxScriptMemberDependency {
        return {
            type: 'member',
            identifier: this._getIdentifier(node),
            reference: this._getReference(node),
            object: this._objectDependency(node.object, node),
        };
    }

    private _objectDependency(
        node: any,
        parent: any
    ): AuxScriptObjectDependency {
        if (node.type === 'Identifier') {
            return this._identifierDependency(node);
        } else {
            const dependency = this._nodeDependency(node, parent);
            if (
                dependency.type === 'member' ||
                dependency.type === 'tag' ||
                dependency.type === 'bot' ||
                dependency.type === 'call'
            ) {
                return dependency;
            }
        }
        return null;
    }

    private _identifierDependency(node: any): AuxScriptObjectDependency {
        return {
            type: 'member',
            identifier: node.name,
            reference: null,
            object: null,
        };
    }

    private _thisDependency(node: any): AuxScriptMemberDependency {
        return {
            type: 'member',
            identifier: 'this',
            reference: null,
            object: null,
        };
    }

    private _getIdentifier(node: any) {
        if (!node.computed && node.property.type === 'Identifier') {
            return node.property.name;
        } else if (node.property.type === 'Literal') {
            return node.property.value;
        } else {
            return null;
        }
    }

    private _getReference(node: any) {
        if (node.computed && node.property.type === 'Identifier') {
            return node.property.name;
        }
        return null;
    }
}

function auxDependencies(dependencies: Dependencies): AuxScriptReplacements {
    function replace(nodes: AuxScriptSimpleDependency[]) {
        return dependencies.replaceDependencies(
            nodes,
            auxDependencies(dependencies)
        );
    }

    let filterFunctions = {
        byTag: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }
                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [
                {
                    type: 'bot',
                    name: 'id',
                    dependencies: [],
                },
            ];
        },
        inDimension: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }
                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: [
                            {
                                type: 'literal',
                                value: true,
                            },
                        ],
                    },
                ];
            }
            return [];
        },
        atPosition: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }

                let extras = [] as AuxScriptSimpleDependency[];

                if (node.dependencies.length >= 2) {
                    extras.push({
                        type: 'bot',
                        name: name + 'X',
                        dependencies: [node.dependencies[1]],
                    });
                }

                if (node.dependencies.length >= 3) {
                    extras.push({
                        type: 'bot',
                        name: name + 'Y',
                        dependencies: [node.dependencies[2]],
                    });
                }

                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: [
                            {
                                type: 'literal',
                                value: true,
                            },
                        ],
                    },
                    ...extras,
                ];
            }
            return [];
        },
        inStack: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 2) {
                const name = getTagName(node.dependencies[1]);
                if (!name) {
                    return [{ type: 'all' }];
                }

                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: [
                            {
                                type: 'literal',
                                value: true,
                            },
                        ],
                    },
                    {
                        type: 'bot',
                        name: name + 'X',
                        dependencies: [],
                    },
                    {
                        type: 'bot',
                        name: name + 'Y',
                        dependencies: [],
                    },
                ];
            }
            return [];
        },
        byCreator: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'bot',
                    name: 'creator',
                    dependencies: [],
                },
            ];
        },
        bySpace: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'bot',
                    name: 'space',
                    dependencies: node.dependencies,
                },
            ];
        },
        byMod: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const obj = node.dependencies[0];
                if (obj.type === 'object_expression') {
                    let deps = [] as AuxScriptSimpleDependency[];
                    for (let prop of obj.dependencies) {
                        if (prop.type === 'property') {
                            deps.push({
                                type: 'bot',
                                name: prop.name,
                                dependencies: prop.dependencies,
                            });
                        }
                    }
                    return deps;
                } else {
                    return [
                        {
                            type: 'all',
                        },
                    ];
                }
            }
            return [];
        },
    } as AuxScriptReplacements;

    let others = {
        getTag: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 2) {
                const extras = node.dependencies.slice(1);
                return extras.map((n, i) => {
                    const name = getTagName(n);
                    if (!name) {
                        return { type: 'all' };
                    }
                    return {
                        type: 'tag_value',
                        name: name,
                        dependencies:
                            i === 0 ? replace([node.dependencies[0]]) : [],
                    };
                });
            }
            return [];
        },
        tags: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const extras = node.dependencies;
                return extras.map((n, i) => {
                    const name = getMemberName(n);
                    if (!name) {
                        return { type: 'all' };
                    }
                    return {
                        type: 'tag_value',
                        name: name,
                        dependencies: [],
                    };
                });
            }

            return [];
        },
        raw: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const extras = node.dependencies;
                return extras.map((n, i) => {
                    const name = getMemberName(n);
                    if (!name) {
                        return { type: 'all' };
                    }
                    return {
                        type: 'tag_value',
                        name: name,
                        dependencies: [],
                    };
                });
            }

            return [];
        },
        creator: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }

            return [
                {
                    type: 'tag_value',
                    name: 'creator',
                    dependencies: replace(node.dependencies),
                },
            ];
        },
        config: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }

            return [
                {
                    type: 'tag_value',
                    name: 'configBot',
                    dependencies: replace(node.dependencies),
                },
            ];
        },
        getBot: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const first = node.dependencies[0];
                if (
                    first.type === 'function' &&
                    first.name in filterFunctions
                ) {
                    return replace(node.dependencies);
                }
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }
                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [
                {
                    type: 'bot',
                    name: 'id',
                    dependencies: [],
                },
            ];
        },
        getBots: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const first = node.dependencies[0];
                if (
                    first.type === 'function' &&
                    first.name in filterFunctions
                ) {
                    return replace(node.dependencies);
                }
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }
                return [
                    {
                        type: 'bot',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [
                {
                    type: 'bot',
                    name: 'id',
                    dependencies: [],
                },
            ];
        },
        getBotTagValues: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    return [{ type: 'all' }];
                }
                return [
                    {
                        type: 'tag',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [];
        },
        'player.getCurrentDimension': (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'tag',
                    name: 'pagePortal',
                    dependencies: [],
                },
            ];
        },
        'player.getCurrentStory': (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'tag',
                    name: 'story',
                    dependencies: [],
                },
            ];
        },
        'player.getMenuDimension': (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'tag',
                    name: 'menuPortal',
                    dependencies: [],
                },
            ];
        },
        'player.getInventoryDimension': (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'tag',
                    name: 'inventoryPortal',
                    dependencies: [],
                },
            ];
        },
        'player.hasBotInInventory': (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'function') {
                return [node];
            }
            return [
                {
                    type: 'all',
                },
            ];
        },
        configTag: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }

            return [
                {
                    type: 'tag_value',
                    name: tagNameSymbol,
                    dependencies: [],
                },
            ];
        },
        tagName: (node: AuxScriptSimpleDependency) => {
            if (node.type !== 'member') {
                return [node];
            }

            return [
                {
                    type: 'tag_value',
                    name: tagNameSymbol,
                    dependencies: [],
                },
            ];
        },
        [defaultReplacement]: (node: AuxScriptSimpleDependency) => {
            if (
                node.type !== 'member' &&
                node.type !== 'function' &&
                node.type !== 'bot' &&
                node.type !== 'tag'
            ) {
                return [node];
            }

            return [
                {
                    ...node,
                    dependencies: replace(node.dependencies),
                },
            ];
        },
    } as AuxScriptReplacements;

    return {
        ...filterFunctions,
        ...others,
    };
}

function getTagName(node: AuxScriptSimpleDependency): string {
    const val = getNodeValue(node);
    if (val) {
        return trimTag(val);
    }
    return null;
}

function getNodeValue(node: AuxScriptSimpleDependency): string {
    if (node.type === 'literal') {
        return node.value.toString();
    }
    return null;
}

function getMemberName(node: AuxScriptSimpleDependency): string | symbol {
    if (node.type === 'member') {
        if (node.name) {
            return trimTag(node.name);
        } else if (node.reference) {
            if (node.reference === 'tagName') {
                return tagNameSymbol;
            }
        }
    }
    return null;
}

export type AuxScriptDependency =
    | AuxScriptTagDependency
    | AuxScriptBotDependency
    | AuxScriptFunctionDependency
    | AuxScriptMemberDependency
    | AuxScriptExpressionDependencies
    | AuxScriptLiteralDependency
    | AuxScriptObjectExpressionDependencies;

export type AuxScriptObjectDependency =
    | AuxScriptMemberDependency
    | AuxScriptTagDependency
    | AuxScriptBotDependency
    | AuxScriptFunctionDependency;

export interface AuxScriptExpressionDependencies {
    type: 'expression';

    dependencies: AuxScriptDependency[];
}

export interface AuxScriptObjectExpressionDependencies {
    type: 'object_expression';
    properties: AuxScriptProperty[];
}

export interface AuxScriptProperty {
    type: 'property';
    name: string;
    value: AuxScriptDependency;
}

export interface AuxScriptMemberDependency {
    type: 'member';
    identifier: string;
    reference: string;
    object: AuxScriptObjectDependency;
}

export interface AuxScriptVariableDependency {
    type: 'var';

    members: AuxScriptMemberDependency[];
}

export interface AuxScriptTagDependency {
    type: 'tag';

    /**
     * The name of the tag.
     */
    name: string;

    /**
     * The arguments that were used in the tag query.
     */
    dependencies: AuxScriptDependency[];
}

export interface AuxScriptBotDependency {
    type: 'bot';

    /**
     * The name of the tag.
     */
    name: string;

    /**
     * The arguments that were used in the tag query.
     */
    dependencies: AuxScriptDependency[];
}

export interface AuxScriptFunctionDependency {
    type: 'call';
    identifier: AuxScriptObjectDependency;
    dependencies: AuxScriptDependency[];
}

export interface AuxScriptLiteralDependency {
    type: 'literal';
    value: string | number | boolean | null;
}

export type AuxScriptSimpleDependency =
    | AuxScriptSimpleBotDependency
    | AuxScriptSimpleTagDependency
    | AuxScriptSimpleFunctionDependency
    | AuxScriptSimpleMemberDependency
    | AuxScriptSimpleLiteralDependency
    | AuxScriptSimpleAllDependency
    | AuxScriptSimpleThisDependency
    | AuxScriptSimpleTagValueDependency
    | AuxScriptSimpleObjectExpressionDependency
    | AuxScriptSimpleProperty
    | AuxScriptEndFunctionParametersDependency;

export type AuxScriptExternalDependency =
    | AuxScriptSimpleBotDependency
    | AuxScriptSimpleTagDependency
    | AuxScriptSimpleAllDependency
    | AuxScriptSimpleThisDependency
    | AuxScriptSimpleTagValueDependency;

export interface AuxScriptSimpleBotDependency {
    type: 'bot';
    name: string;
    dependencies: AuxScriptSimpleDependency[];
}

export interface AuxScriptSimpleTagDependency {
    type: 'tag';
    name: string;
    dependencies: AuxScriptSimpleDependency[];
}

export interface AuxScriptSimpleFunctionDependency {
    type: 'function';
    name: string;
    dependencies: AuxScriptSimpleDependency[];
}

/**
 * Defines a special "dependency" which is used to indicate that
 * the parameters for a function dependency have ended and that further dependencies
 * should not be interpreted as function parameters.
 */
export interface AuxScriptEndFunctionParametersDependency {
    type: 'end_function_parameters';
}

export interface AuxScriptSimpleMemberDependency {
    type: 'member';
    name: string;
    reference: string;
    dependencies: AuxScriptSimpleDependency[];
}

export type AuxScriptSimpleLiteralDependency = AuxScriptLiteralDependency;

export interface AuxScriptSimpleAllDependency {
    type: 'all';
}

export interface AuxScriptSimpleThisDependency {
    type: 'this';
}

export interface AuxScriptSimpleTagValueDependency {
    type: 'tag_value';
    name?: string | symbol;
    dependencies: AuxScriptSimpleDependency[];
}

export interface AuxScriptReplacements {
    [defaultReplacement]?: AuxScriptReplacement;
    [key: string]: AuxScriptReplacement;
}

export type AuxScriptReplacement = (
    node: AuxScriptSimpleDependency
) => AuxScriptSimpleDependency[];

export interface AuxScriptSimpleObjectExpressionDependency {
    type: 'object_expression';
    dependencies: AuxScriptSimpleDependency[];
}

export interface AuxScriptSimpleProperty {
    type: 'property';
    name: string;
    dependencies: AuxScriptSimpleDependency[];
}
