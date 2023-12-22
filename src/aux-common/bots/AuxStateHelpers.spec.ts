import { createBot } from './BotCalculations';
import {
    apply,
    applyEdit,
    applyTagEdit,
    del,
    edit,
    edits,
    insert,
    mergeEdits,
    preserve,
    remoteEdit,
    remoteEdits,
} from './AuxStateHelpers';
import { Bot } from './Bot';

describe('AuxStateHelpers', () => {
    describe('apply()', () => {
        describe('new bots', () => {
            it('should add new bots to the state', () => {
                const current = {};
                const update = {
                    test: createBot('test'),
                };

                const final = apply(current, update);
                expect(final).toEqual(update);
            });

            it('should support tag edits on new bots', () => {
                const current = {};
                const update = {
                    test: {
                        tags: {
                            abc: edit({}, insert('def')),
                        },
                    },
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                });
            });

            it('should support tag mask edits on new bots', () => {
                const current = {};
                const update = {
                    test: {
                        masks: {
                            space: {
                                abc: edit({}, insert('def')),
                            },
                        },
                    },
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        masks: {
                            space: {
                                abc: 'def',
                            },
                        },
                    },
                });
            });
        });

        describe('updated bots', () => {
            it('should merge tags', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: createBot('test', {
                        def: 'ghi',
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        id: 'test',
                        tags: {
                            abc: 'def',
                            def: 'ghi',
                        },
                    },
                });
            });

            it('should overwrite tags', () => {
                const current = {
                    test: createBot('test', {
                        abc: [1, 2, 3],
                    }),
                };
                const update = {
                    test: createBot('test', {
                        abc: 'haha',
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test', {
                        abc: 'haha',
                    }),
                });
            });

            it('should not merge arrays', () => {
                const current = {
                    test: createBot('test', {
                        abc: [1, 2, 3],
                    }),
                };
                const update = {
                    test: createBot('test', {
                        abc: [3, 2, 1],
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test', {
                        abc: [3, 2, 1],
                    }),
                });
            });

            it('should not merge objects in tags', () => {
                const current = {
                    test: createBot('test', {
                        abc: {
                            def: 1,
                        },
                    }),
                };
                const update = {
                    test: createBot('test', {
                        abc: {
                            ghi: 2,
                        },
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test', {
                        abc: {
                            ghi: 2,
                        },
                    }),
                });
            });

            it('should delete tags that are set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            abc: null as string,
                        },
                    },
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: createBot('test'),
                });
            });

            it('should delete tags that were set to null in new bots', () => {
                const current = {};
                const update = {
                    test: createBot('test', {
                        abc: null as any,
                    }),
                };

                const final = apply(current, update);
                expect(final).toEqual({
                    test: {
                        id: 'test',
                        tags: {},
                    },
                });
            });

            describe('edit', () => {
                it('should support inserting text at the end of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, preserve(3), insert('ghi')),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'defghi',
                        }),
                    });
                });

                it('should support inserting text at the beginning of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, insert('ghi')),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'ghidef',
                        }),
                    });
                });

                it('should support inserting text in the middle of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, preserve(1), insert('ghi')),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'dghief',
                        }),
                    });
                });

                it('should support deleting text at the end of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, preserve(1), del(2)),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'd',
                        }),
                    });
                });

                it('should support deleting text at the beginning of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, del(2)),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'f',
                        }),
                    });
                });

                it('should support deleting text in the middle of the tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, preserve(1), del(1)),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'df',
                        }),
                    });
                });

                it('should support inserting and deleting text at the same time', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit(
                                    { a: 1 },
                                    preserve(1),
                                    del(1),
                                    insert('a'),
                                    preserve(1),
                                    insert('b')
                                ),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'dafb',
                        }),
                    });
                });

                it('should not conflict with a property with a similar name as the marker', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: {
                                    cqtag_edit: true,
                                },
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: {
                                cqtag_edit: true,
                            },
                        }),
                    });
                });

                it('should support inserting text into a tag that doesnt exist', () => {
                    const current = {
                        test: createBot('test', {}),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, insert('ghi')),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {
                            abc: 'ghi',
                        }),
                    });
                });

                it('should support deleting the entire tag', () => {
                    const current = {
                        test: createBot('test', {
                            abc: 'def',
                        }),
                    };
                    const update = {
                        test: {
                            tags: {
                                abc: edit({ a: 1 }, del(3)),
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: createBot('test', {}),
                    });
                });
            });

            describe('masks', () => {
                it('should merge tag masks', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: 'def',
                                },
                            },
                        },
                    };
                    const update = {
                        test: {
                            masks: {
                                shared: {
                                    def: 'ghi',
                                },
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: 'def',
                                    def: 'ghi',
                                },
                            },
                        },
                    });
                });

                it('should overwrite tag masks', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: [1, 2, 3],
                                },
                            },
                        },
                    };
                    const update = {
                        test: {
                            masks: {
                                shared: {
                                    abc: 'haha',
                                },
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: 'haha',
                                },
                            },
                        },
                    });
                });

                it('should not merge arrays in masks', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: [1, 2, 3],
                                },
                            },
                        },
                    };
                    const update = {
                        test: {
                            masks: {
                                shared: {
                                    abc: [3, 2, 1],
                                },
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: [3, 2, 1],
                                },
                            },
                        },
                    });
                });

                it('should not merge objects in masks', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: {
                                        def: 1,
                                    },
                                },
                            },
                        },
                    };
                    const update = {
                        test: {
                            masks: {
                                shared: {
                                    abc: {
                                        ghi: 2,
                                    },
                                },
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {},
                            masks: {
                                shared: {
                                    abc: {
                                        ghi: 2,
                                    },
                                },
                            },
                        },
                    });
                });

                describe('edit', () => {
                    it('should support inserting text at the end of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit(
                                            { a: 1 },
                                            preserve(3),
                                            insert('ghi')
                                        ),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'defghi',
                                    },
                                },
                            },
                        });
                    });

                    it('should support inserting text at the beginning of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit({ a: 1 }, insert('ghi')),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'ghidef',
                                    },
                                },
                            },
                        });
                    });

                    it('should support inserting text in the middle of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit(
                                            { a: 1 },
                                            preserve(1),
                                            insert('ghi')
                                        ),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'dghief',
                                    },
                                },
                            },
                        });
                    });

                    it('should support deleting text at the end of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit(
                                            { a: 1 },
                                            preserve(1),
                                            del(2)
                                        ),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'd',
                                    },
                                },
                            },
                        });
                    });

                    it('should support deleting text at the beginning of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit({ a: 1 }, del(2)),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'f',
                                    },
                                },
                            },
                        });
                    });

                    it('should support deleting text in the middle of the tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit(
                                            { a: 1 },
                                            preserve(1),
                                            del(1)
                                        ),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'df',
                                    },
                                },
                            },
                        });
                    });

                    it('should support inserting and deleting text at the same time', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit(
                                            { a: 1 },
                                            preserve(1),
                                            del(1),
                                            insert('a'),
                                            preserve(1),
                                            insert('b')
                                        ),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'dafb',
                                    },
                                },
                            },
                        });
                    });

                    it('should support deleting the entire tag', () => {
                        const current = {
                            test: {
                                id: 'test',
                                tags: {},
                                masks: {
                                    shared: {
                                        abc: 'def',
                                    },
                                },
                            },
                        };
                        const update = {
                            test: {
                                masks: {
                                    shared: {
                                        abc: edit({ a: 1 }, del(3)),
                                    },
                                },
                            },
                        };

                        const final = apply(current, update);
                        expect(final).toEqual({
                            test: {
                                id: 'test',
                                tags: {},
                            },
                        });
                    });
                });
            });

            describe('signatures', () => {
                it('should delete signatures that are set to null', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {
                                abc: 'def',
                            },
                            signatures: {
                                sig: 'abc',
                            },
                        },
                    };
                    const update = {
                        test: {
                            signatures: {
                                sig: null as string,
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {
                                abc: 'def',
                            },
                        },
                    });
                    expect(update).toEqual({
                        test: {
                            signatures: {
                                sig: null,
                            },
                        },
                    });
                });

                it('should not change the original signatures object if it was able to be copied', () => {
                    const current = {
                        test: {
                            id: 'test',
                            tags: {
                                abc: 'def',
                            },
                        },
                    };
                    const update = {
                        test: {
                            signatures: {
                                sig: null as string,
                            },
                        },
                    };

                    const final = apply(current, update);
                    expect(final).toEqual({
                        test: {
                            id: 'test',
                            tags: {
                                abc: 'def',
                            },
                        },
                    });
                    expect(update).toEqual({
                        test: {
                            signatures: {
                                sig: null,
                            },
                        },
                    });
                });
            });
        });

        describe('deleted bots', () => {
            it('should delete bots that are set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                    }),
                };
                const update = {
                    test: null as Bot,
                };

                const final = apply(current, update);
                expect(final).toEqual({});
            });
        });
    });

    const editCases = [
        [
            'should be able to insert at the end',
            'abc',
            edit({ a: 1 }, preserve(3), insert('def')),
            'abcdef',
        ] as const,
        [
            'should be able to insert at the beginning',
            'abc',
            edit({ a: 1 }, insert('def')),
            'defabc',
        ] as const,
        [
            'should be able to insert in the middle',
            'abc',
            edit({ a: 1 }, preserve(1), insert('def')),
            'adefbc',
        ] as const,

        [
            'should replace an undefined value with the inserted value',
            undefined as any,
            edit({ a: 1 }, insert('def')),
            'def',
        ] as const,
        [
            'should be able to insert multiple times into undefined',
            undefined as any,
            edit({ a: 1 }, insert('abc'), insert('def')),
            'abcdef',
        ] as const,
        [
            'should replace an null value with the inserted value',
            null as any,
            edit({ a: 1 }, insert('def')),
            'def',
        ] as const,
        [
            'should be able to insert multiple times into null',
            null as any,
            edit({ a: 1 }, insert('abc'), insert('def')),
            'abcdef',
        ] as const,

        [
            'should be able to delete at the end',
            'abc',
            edit({ a: 1 }, preserve(2), del(1)),
            'ab',
        ] as const,
        [
            'should be able to delete at the beginning',
            'abc',
            edit({ a: 1 }, del(1)),
            'bc',
        ] as const,
        [
            'should be able to delete in the middle',
            'abc',
            edit({ a: 1 }, preserve(1), del(1)),
            'ac',
        ] as const,
        [
            'should be able insert into a number',
            123,
            edit({ a: 1 }, preserve(1), insert('abc')),
            '1abc23',
        ] as const,
        [
            'should be able insert into a boolean',
            false,
            edit({ a: 1 }, preserve(1), insert('abc')),
            'fabcalse',
        ] as const,
        [
            'should be able insert into an object',
            { prop: 'yes' },
            edit({ a: 1 }, preserve(1), insert('abc')),
            '{abc"prop":"yes"}',
        ] as const,
    ];
    describe('applyEdit()', () => {
        it.each(editCases)('%s', (desc, start, edits, expected) => {
            expect(applyEdit(start, edits)).toEqual(expected);
        });
    });

    describe('applyTagEdit()', () => {
        const tagEditCases = [
            ...editCases,
            [
                'should return null when all the text is deleted',
                'abc',
                edit({ a: 1 }, preserve(0), del(3)),
                null as string,
            ] as const,
        ];
        it.each(tagEditCases)('%s', (desc, start, edits, expected) => {
            expect(applyTagEdit(start, edits)).toEqual(expected);
        });
    });

    describe('mergeEdits()', () => {
        it('should concatenate the edits', () => {
            const first = edit({}, insert('abc'));
            const second = edit({}, insert('def'));

            const final = mergeEdits(first, second);
            expect(final).toEqual(edits({}, [insert('abc')], [insert('def')]));
        });

        it('should merge the version vectors', () => {
            const first = edit({ a: 1 }, insert('abc'));
            const second = edit({ b: 2 }, insert('def'));

            const final = mergeEdits(first, second);
            expect(final).toEqual(
                edits({ a: 1, b: 2 }, [insert('abc')], [insert('def')])
            );
        });

        it('should be remote if at least one edit is remote', () => {
            const first = edit({ a: 1 }, insert('abc'));
            const second = remoteEdit({ b: 2 }, insert('def'));

            const final = mergeEdits(first, second);
            expect(final).toEqual(
                remoteEdits({ a: 1, b: 2 }, [insert('abc')], [insert('def')])
            );
        });
    });
});
