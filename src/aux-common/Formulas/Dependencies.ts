import { Transpiler } from './Transpiler';
import { traverse, VisitorOption } from 'estraverse';

export class Dependencies {
    private _transpiler: Transpiler = new Transpiler();

    /**
     * Gets a dependency tree for the given code.
     * @param code
     */
    dependencyTree(code: string): AuxScriptExpressionDependencies {
        const node = this._transpiler.parse(code);
        return this._expressionDependencies(node);
    }

    /**
     * Gets the full name of the given member node.
     * @param node The node.
     */
    getMemberName(node: AuxScriptMemberDependency): string {
        let stack: string[] = [];
        let current:
            | AuxScriptMemberDependency
            | AuxScriptFileDependency
            | AuxScriptTagDependency = node;
        while (current) {
            if (current.type === 'member') {
                stack.unshift(current.identifier);
                current = current.object;
            } else {
                const symbol = current.type === 'file' ? '@' : '#';
                stack.unshift(`${symbol}${current.name}()`);
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
            enter: (node: any) => {
                const dep = this._nodeDependency(node);
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

    private _nodeDependency(node: any) {
        if (node.type === 'MemberExpression') {
            return this._memberDependency(node);
        } else if (node.type === 'ThisExpression') {
            return this._thisDependency(node);
        } else if (node.type === 'TagValue' || node.type === 'ObjectValue') {
            return this._tagDependency(node);
        } else if (node.type === 'CallExpression') {
            return this._callDependency(node);
        }

        return null;
    }

    private _callDependency(node: any): AuxScriptFunctionDependency {
        return {
            type: 'call',
            identifier: this._objectDependency(node.callee),
            dependencies: node.arguments
                .map((arg: any) => this._nodeDependency(arg))
                .filter((arg: any) => !!arg),
        };
    }

    private _tagDependency(node: any) {
        const { tag, args, nodes } = this._transpiler.getTagNodeValues(node);
        return <AuxScriptTagDependency | AuxScriptFileDependency>{
            type: node.type === 'TagValue' ? 'tag' : 'file',
            name: tag,
            dependencies: args
                .map(a => this._expressionDependencies(a))
                .filter(e => e.dependencies.length > 0),
        };
    }

    private _memberDependency(node: any): AuxScriptMemberDependency {
        return {
            type: 'member',
            identifier: this._getIdentifier(node),
            object: this._objectDependency(node.object),
        };
    }

    private _objectDependency(
        node: any
    ):
        | AuxScriptMemberDependency
        | AuxScriptTagDependency
        | AuxScriptFileDependency {
        if (node.type === 'Identifier') {
            return {
                type: 'member',
                identifier: node.name,
                object: null,
            };
        } else {
            const dependency = this._nodeDependency(node);
            if (
                dependency.type === 'member' ||
                dependency.type === 'tag' ||
                dependency.type === 'file'
            ) {
                return dependency;
            }
        }
        return null;
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
    | AuxScriptExpressionDependencies;

export interface AuxScriptExpressionDependencies {
    type: 'expression';

    dependencies: AuxScriptDependency[];
}

export interface AuxScriptMemberDependency {
    type: 'member';
    identifier: string;
    object:
        | AuxScriptMemberDependency
        | AuxScriptTagDependency
        | AuxScriptFileDependency;
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
    identifier: AuxScriptDependency;
    dependencies: AuxScriptDependency[];
}
