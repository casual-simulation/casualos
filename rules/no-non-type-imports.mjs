import { ESLintUtils } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
    (name) => `https://example.com/rule/${name}`
);

// Type: RuleModule<"uppercase", ...>
export const rule = createRule({
    create(context) {
        const [{ patterns }] = context.options;

        return {
            ImportDeclaration(node) {
                if (node.importKind !== 'type') {
                    for (let pattern in patterns) {
                        if (node.source.value.startsWith(pattern)) {
                            const { deny, allow } = patterns[pattern];
                            for (let specifier of node.specifiers) {
                                if (
                                    !Array.isArray(deny) ||
                                    deny.length <= 0 ||
                                    deny.some((d) =>
                                        specifier.local.name.startsWith(d)
                                    )
                                ) {
                                    if (
                                        Array.isArray(allow) &&
                                        allow.length > 0 &&
                                        allow.some((a) =>
                                            specifier.local.name.startsWith(a)
                                        )
                                    ) {
                                        continue;
                                    }

                                    if (specifier.importKind !== 'type') {
                                        context.report({
                                            messageId: 'denied',
                                            node: specifier.local,
                                            data: {
                                                name: specifier.local.name,
                                            },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            },
        };
    },
    name: 'no-non-type-imports',
    meta: {
        docs: {
            description: 'Enforce that all imports are type imports.',
        },
        messages: {
            denied: 'This import ({{name}}) is not allowed.',
        },
        type: 'problem',
        schema: [
            {
                type: 'object',
                properties: {
                    patterns: {
                        type: 'object',
                        allOf: [
                            {
                                type: 'object',
                                properties: {
                                    deny: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                        },
                                        required: false,
                                    },
                                    allow: {
                                        type: 'array',
                                        items: {
                                            type: 'string',
                                        },
                                        required: false,
                                    },
                                },
                                // additionalProperties: false,
                            },
                        ],
                    },
                },
                // properties: {

                //     deny: {
                //         type: 'array',
                //         items: {
                //             type: 'string',
                //         },
                //     },
                // }
            },
        ],
    },
    defaultOptions: [
        {
            patterns: {},
        },
    ],
});

export default {
    rules: {
        'no-non-type-imports': rule,
    },
};
