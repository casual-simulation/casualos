import { Transpiler } from './Transpiler';
import { traverse, VisitorOption } from 'estraverse';
import { flatMap } from 'lodash';
import { getTag, trimTag } from '../Files';

export class Dependencies {
    private _transpiler: Transpiler = new Transpiler();

    /**
     * Calculates which tags and files the given code is dependent on.
     */
    calculateAuxDependencies(code: string): AuxScriptExternalDependency[] {
        const tree = this.dependencyTree(code);
        const simple = this.simplify(tree);
        const replaced = this.replaceAuxDependencies(simple);
        const flat = this.flatten(replaced);
        return <AuxScriptExternalDependency[]>(
            flat.filter(
                f =>
                    f.type === 'all' ||
                    f.type === 'tag' ||
                    f.type === 'file' ||
                    f.type === 'this' ||
                    f.type === 'tag_value'
            )
        );
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
        } else if (node.type === 'file' || node.type === 'tag') {
            return this._simpleTagDependencies(node);
        } else if (node.type === 'call') {
            return this._simpleFunctionDependencies(node);
        } else if (node.type === 'member') {
            return this._simpleMemberDependencies(node);
        } else if (node.type === 'literal') {
            return this._simpleLiteralDependencies(node);
        }

        return [];
    }

    /**
     * Flattens the given list to make it easy to de-duplicate dependencies.
     * @param nodes The nodes to flatten.
     */
    flatten(nodes: AuxScriptSimpleDependency[]): AuxScriptSimpleDependency[] {
        return flatMap(nodes, n => {
            if (
                n.type === 'file' ||
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
     * Replaces all dependencies on AUX functions with their related dependencies on files/tags.
     * @param nodes The nodes to perform the replacements on.
     */
    replaceAuxDependencies(
        nodes: AuxScriptSimpleDependency[]
    ): AuxScriptSimpleDependency[] {
        return this.replaceDependencies(nodes, auxDependencies(this));
    }

    /**
     * Replaces matching function calls in the given list of simplified dependencies with their actual dependencies.
     * This is useful to be able to match functions like getFilesInContext("context_a") to the actual dependency.
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
                    node.type !== 'this'
                ) {
                    const replacement = replacements[node.name];
                    if (replacement) {
                        yield* replacement(node);
                        replaced = true;
                    }
                }

                if (!replaced) {
                    if (
                        node.type === 'function' ||
                        node.type === 'file' ||
                        node.type === 'tag'
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
            return this._simpleRootDependencies(root);
        }

        const name = this.getMemberName(node);
        if (name.indexOf('this') === 0) {
            return [{ type: 'this' }];
        }
        return [
            <AuxScriptSimpleMemberDependency>{
                type: 'member',
                name: name,
            },
        ];
    }

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
        if (root.type === 'file' || root.type === 'tag') {
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
                ...flatMap(node.dependencies, d => this.simplify(d)),
            ];
        }

        return [
            {
                type: 'function',
                name: this.getMemberName(node.identifier),
                dependencies: flatMap(node.dependencies, d => this.simplify(d)),
            },
        ];
    }

    private _simpleTagDependencies(
        node: AuxScriptTagDependency | AuxScriptFileDependency
    ): AuxScriptSimpleDependency[] {
        return [
            <AuxScriptSimpleFileDependency | AuxScriptSimpleTagDependency>{
                type: node.type,
                name: this.getMemberName(node),
                dependencies: flatMap(node.dependencies, d => this.simplify(d)),
            },
        ];
    }

    private _simpleExpressionDependencies(
        node: AuxScriptExpressionDependencies
    ): AuxScriptSimpleDependency[] {
        return flatMap(node.dependencies, d => this.simplify(d));
    }

    private _simpleLiteralDependencies(
        node: AuxScriptLiteralDependency
    ): AuxScriptSimpleDependency[] {
        return [node];
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
                        this._expressionDependencies(arg)
                )
                .filter((arg: any) => !!arg),
        };
    }

    private _tagDependency(node: any) {
        const { tag, args, nodes } = this._transpiler.getTagNodeValues(node);
        return <AuxScriptTagDependency | AuxScriptFileDependency>{
            type: node.type === 'TagValue' ? 'tag' : 'file',
            name: tag,
            dependencies: args
                .map(a => {
                    const dep = this._nodeDependency(a, node);
                    if (dep) {
                        return dep;
                    }
                    return this._expressionDependencies(a);
                })
                .filter(e =>
                    e.type === 'expression' ? e.dependencies.length > 0 : true
                ),
        };
    }

    private _memberDependency(node: any): AuxScriptMemberDependency {
        return {
            type: 'member',
            identifier: this._getIdentifier(node),
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
                dependency.type === 'file' ||
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
            object: null,
        };
    }

    private _thisDependency(node: any): AuxScriptMemberDependency {
        return {
            type: 'member',
            identifier: 'this',
            object: null,
        };
    }

    private _getIdentifier(node: any) {
        if (!node.computed && node.property.type === 'Identifier') {
            return node.property.name;
        } else if (node.property.type === 'Literal') {
            return node.property.value;
        } else {
            throw new Error('Unable to calculate dependencies for script');
        }
    }
}

function auxDependencies(dependencies: Dependencies): AuxScriptReplacements {
    function replace(nodes: AuxScriptSimpleDependency[]) {
        return dependencies.replaceDependencies(
            nodes,
            auxDependencies(dependencies)
        );
    }

    return {
        getTag: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 2) {
                const extras = node.dependencies.slice(1);
                return extras.map((n, i) => {
                    const name = getTagName(n);
                    if (!name) {
                        throw new Error(
                            '[Dependencies] Unable to determine which tag the getTag() call is dependent on.'
                        );
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
        getBot: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which tag the getBot() call is dependent on.'
                    );
                }
                return [
                    {
                        type: 'file',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [];
        },
        getBots: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which tag the getBots() call is dependent on.'
                    );
                }
                return [
                    {
                        type: 'file',
                        name: name,
                        dependencies: replace(node.dependencies.slice(1)),
                    },
                ];
            }
            return [];
        },
        getBotTagValues: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 1) {
                const name = getTagName(node.dependencies[0]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which tag the getBots() call is dependent on.'
                    );
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
        getBotsInContext: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 1) {
                const name = getNodeValue(node.dependencies[0]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which context the getBotsInContext() call is dependent on.'
                    );
                }
                return [
                    {
                        type: 'file',
                        name: name,
                        dependencies: [],
                    },
                ];
            }
            return [];
        },
        getBotsInStack: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 2) {
                const name = getNodeValue(node.dependencies[1]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which context the getBotsInStack() call is dependent on.'
                    );
                }
                return [
                    {
                        type: 'file',
                        name: name,
                        dependencies: [],
                    },
                    {
                        type: 'file',
                        name: name + '.x',
                        dependencies: [],
                    },
                    {
                        type: 'file',
                        name: name + '.y',
                        dependencies: [],
                    },
                ];
            }
            return [];
        },
        getNeighboringBots: (node: AuxScriptSimpleFunctionDependency) => {
            if (node.dependencies.length >= 2) {
                const name = getNodeValue(node.dependencies[1]);
                if (!name) {
                    throw new Error(
                        '[Dependencies] Unable to determine which context the getBotsInStack() call is dependent on.'
                    );
                }
                return [
                    {
                        type: 'file',
                        name: name,
                        dependencies: [],
                    },
                    {
                        type: 'file',
                        name: name + '.x',
                        dependencies: [],
                    },
                    {
                        type: 'file',
                        name: name + '.y',
                        dependencies: [],
                    },
                ];
            }
            return [];
        },
        'player.isDesigner': (node: AuxScriptSimpleFunctionDependency) => {
            return [
                {
                    type: 'tag',
                    name: 'aux.designers',
                    dependencies: [],
                },
            ];
        },
        'player.currentContext': (node: AuxScriptSimpleFunctionDependency) => {
            return [
                {
                    type: 'tag',
                    name: 'aux._userContext',
                    dependencies: [],
                },
            ];
        },
        'player.getMenuContext': (node: AuxScriptSimpleFunctionDependency) => {
            return [
                {
                    type: 'tag',
                    name: 'aux._userMenuContext',
                    dependencies: [],
                },
            ];
        },
        'player.getInventoryContext': (
            node: AuxScriptSimpleFunctionDependency
        ) => {
            return [
                {
                    type: 'tag',
                    name: 'aux._userInventoryContext',
                    dependencies: [],
                },
            ];
        },
        'player.hasFileInInventory': (
            node: AuxScriptSimpleFunctionDependency
        ) => {
            return [
                {
                    type: 'all',
                },
            ];
        },
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

export type AuxScriptDependency =
    | AuxScriptTagDependency
    | AuxScriptFileDependency
    | AuxScriptFunctionDependency
    | AuxScriptMemberDependency
    | AuxScriptExpressionDependencies
    | AuxScriptLiteralDependency;

export type AuxScriptObjectDependency =
    | AuxScriptMemberDependency
    | AuxScriptTagDependency
    | AuxScriptFileDependency
    | AuxScriptFunctionDependency;

export interface AuxScriptExpressionDependencies {
    type: 'expression';

    dependencies: AuxScriptDependency[];
}

export interface AuxScriptMemberDependency {
    type: 'member';
    identifier: string;
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

export interface AuxScriptFileDependency {
    type: 'file';

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
    | AuxScriptSimpleFileDependency
    | AuxScriptSimpleTagDependency
    | AuxScriptSimpleFunctionDependency
    | AuxScriptSimpleMemberDependency
    | AuxScriptSimpleLiteralDependency
    | AuxScriptSimpleAllDependency
    | AuxScriptSimpleThisDependency
    | AuxScriptSimpleTagValueDependency;

export type AuxScriptExternalDependency =
    | AuxScriptSimpleFileDependency
    | AuxScriptSimpleTagDependency
    | AuxScriptSimpleAllDependency
    | AuxScriptSimpleThisDependency
    | AuxScriptSimpleTagValueDependency;

export interface AuxScriptSimpleFileDependency {
    type: 'file';
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

export interface AuxScriptSimpleMemberDependency {
    type: 'member';
    name: string;
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
    name: string;
    dependencies: AuxScriptSimpleDependency[];
}

export interface AuxScriptReplacements {
    [key: string]: AuxScriptReplacement;
}

export type AuxScriptReplacement = (
    node: AuxScriptSimpleDependency
) => AuxScriptSimpleDependency[];
