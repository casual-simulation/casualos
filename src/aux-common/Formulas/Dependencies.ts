import { Transpiler } from './Transpiler';
import { traverse, VisitorOption } from 'estraverse';
import { flatMap } from 'lodash';

export class Dependencies {
    private _transpiler: Transpiler = new Transpiler();

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
    dependentTagsAndFunctions(
        node: AuxScriptDependency
    ): AuxScriptSimpleDependency[] {
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
                if (node.type !== 'literal') {
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
        let current: AuxScriptObjectDependency = this._rootMember(node);
        if (current && (current.type === 'file' || current.type === 'tag')) {
            return this._simpleTagDependencies(current);
        }
        return [
            <AuxScriptSimpleMemberDependency>{
                type: 'member',
                name: this.getMemberName(node),
            },
        ];
    }

    private _rootMember(node: AuxScriptObjectDependency) {
        let current: AuxScriptObjectDependency = node;
        while (current) {
            if (current.type === 'member') {
                current = current.object;
            } else if (current.type === 'call') {
                current = current.identifier;
            } else {
                break;
            }
        }
        return current;
    }

    private _simpleFunctionDependencies(
        node: AuxScriptFunctionDependency
    ): AuxScriptSimpleDependency[] {
        let current = this._rootMember(node.identifier);
        if (current && (current.type === 'file' || current.type === 'tag')) {
            return [
                ...this._simpleTagDependencies(current),
                ...flatMap(node.dependencies, d =>
                    this.dependentTagsAndFunctions(d)
                ),
            ];
        }

        return [
            {
                type: 'function',
                name: this.getMemberName(node.identifier),
                dependencies: flatMap(node.dependencies, d =>
                    this.dependentTagsAndFunctions(d)
                ),
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
                dependencies: flatMap(node.dependencies, d =>
                    this.dependentTagsAndFunctions(d)
                ),
            },
        ];
    }

    private _simpleExpressionDependencies(
        node: AuxScriptExpressionDependencies
    ): AuxScriptSimpleDependency[] {
        return flatMap(node.dependencies, d =>
            this.dependentTagsAndFunctions(d)
        );
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
    | AuxScriptSimpleLiteralDependency;

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

export interface AuxScriptReplacements {
    [key: string]: AuxScriptReplacement;
}

export type AuxScriptReplacement = (
    node: AuxScriptSimpleDependency
) => AuxScriptSimpleDependency[];
