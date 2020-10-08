import { createBot } from '../bots/BotCalculations';
import {
    apply,
    applyEdit,
    del,
    edit,
    insert,
    preserve,
    updates,
} from './AuxStateHelpers';
import { Bot } from '../bots/Bot';

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
                                abc: edit(preserve(3), insert('ghi')),
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
                                abc: edit(insert('ghi')),
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
                                abc: edit(preserve(1), insert('ghi')),
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
                                abc: edit(preserve(1), del(2)),
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
                                abc: edit(del(2)),
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
                                abc: edit(preserve(1), del(1)),
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
                                abc: edit(insert('ghi')),
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
                                        abc: edit(preserve(3), insert('ghi')),
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
                                        abc: edit(insert('ghi')),
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
                                        abc: edit(preserve(1), insert('ghi')),
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
                                        abc: edit(preserve(1), del(2)),
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
                                        abc: edit(del(2)),
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
                                        abc: edit(preserve(1), del(1)),
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

    describe('applyEdit()', () => {
        const editCases = [
            [
                'should be able to insert at the end',
                'abc',
                edit(preserve(3), insert('def')),
                'abcdef',
            ],
            [
                'should be able to insert at the beginning',
                'abc',
                edit(insert('def')),
                'defabc',
            ],
            [
                'should be able to insert in the middle',
                'abc',
                edit(preserve(1), insert('def')),
                'adefbc',
            ],

            [
                'should replace an undefined value with the inserted value',
                undefined,
                edit(insert('def')),
                'def',
            ],
            [
                'should be able to insert multiple times into undefined',
                undefined,
                edit(insert('abc'), insert('def')),
                'abcdef',
            ],
            [
                'should replace an null value with the inserted value',
                null,
                edit(insert('def')),
                'def',
            ],
            [
                'should be able to insert multiple times into null',
                null,
                edit(insert('abc'), insert('def')),
                'abcdef',
            ],

            [
                'should be able to delete at the end',
                'abc',
                edit(preserve(2), del(1)),
                'ab',
            ],
            [
                'should be able to delete at the beginning',
                'abc',
                edit(del(1)),
                'bc',
            ],
            [
                'should be able to delete in the middle',
                'abc',
                edit(preserve(1), del(1)),
                'ac',
            ],
        ];

        it.each(editCases)('%s', (desc, start, edits, expected) => {
            expect(applyEdit(start, edits)).toEqual(expected);
        });
    });

    describe('updates()', () => {
        describe('new bots', () => {
            it('should return the new bots', () => {
                const current = {};
                const update = {
                    test: createBot('test'),
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [createBot('test')],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should discard partial bots that are new', () => {
                const current = {};
                const update = {
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });

        describe('removed bots', () => {
            it('should remove bots set to null in the update', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: null as Bot,
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: ['test'],
                    updatedBots: [],
                });
            });
        });

        describe('updated bots', () => {
            it('should record new tags', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        tags: {
                            abc: 'def',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                            }),
                            tags: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should record new signatures', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        signatures: {
                            abc: 'tag',
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {},
                                signatures: {
                                    abc: 'tag',
                                },
                            },
                            tags: new Set(),
                            signatures: new Set(['abc']),
                        },
                    ],
                });
            });

            it('should record updated tags', () => {
                const current = {
                    test: createBot('test', {
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: 123,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                num: 123,
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should ignore tags that were not updated', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: 123,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                                num: 123,
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should delete tags that were set to null', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {
                            num: null as any,
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: createBot('test', {
                                abc: 'def',
                            }),
                            tags: new Set(['num']),
                        },
                    ],
                });
            });

            it('should not include the update if no tags were updated', () => {
                const current = {
                    test: createBot('test', {
                        abc: 'def',
                        num: 987,
                    }),
                };
                const update = {
                    test: {
                        tags: {},
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should not include tag mask updates for bots that are not in the current state', () => {
                const current = {};
                const update = {
                    test: {
                        masks: {
                            test: {
                                abc: 'def',
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should not include tag mask updates for bots that have no tag updates', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        masks: {
                            test: {
                                abc: 'def',
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });

            it('should include new tag masks when tags are updated', () => {
                const current = {
                    test: createBot('test'),
                };
                const update = {
                    test: {
                        tags: {
                            newTag: true,
                        },
                        masks: {
                            test: {
                                abc: 'def',
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {
                                    newTag: true,
                                },
                                masks: {
                                    test: {
                                        abc: 'def',
                                    },
                                },
                            },
                            tags: new Set(['newTag', 'abc']),
                        },
                    ],
                });
            });

            it('should include updated tag masks when tags are updated', () => {
                const current = {
                    test: {
                        id: 'test',
                        tags: {},
                        masks: {
                            test: {
                                abc: 'def',
                            },
                        },
                    },
                };
                const update = {
                    test: {
                        tags: {
                            newTag: true,
                        },
                        masks: {
                            test: {
                                abc: 123,
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {
                                    newTag: true,
                                },
                                masks: {
                                    test: {
                                        abc: 123,
                                    },
                                },
                            },
                            tags: new Set(['newTag', 'abc']),
                        },
                    ],
                });
            });

            it('should ignore tag masks that were not updated', () => {
                const current = {
                    test: {
                        id: 'test',
                        tags: {},
                        masks: {
                            test: {
                                abc: 'def',
                                num: 987,
                            },
                        },
                    },
                };
                const update = {
                    test: {
                        tags: {
                            newTag: true,
                        },
                        masks: {
                            test: {
                                num: 123,
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {
                                    newTag: true,
                                },
                                masks: {
                                    test: {
                                        abc: 'def',
                                        num: 123,
                                    },
                                },
                            },
                            tags: new Set(['newTag', 'num']),
                        },
                    ],
                });
            });

            it('should delete tags masks that were set to null', () => {
                const current = {
                    test: {
                        id: 'test',
                        tags: {},
                        masks: {
                            test: {
                                abc: 'def',
                                num: 987,
                            },
                        },
                    },
                };
                const update = {
                    test: {
                        tags: {
                            newTag: true,
                        },
                        masks: {
                            test: {
                                num: null as any,
                            },
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [
                        {
                            bot: {
                                id: 'test',
                                tags: {
                                    newTag: true,
                                },
                                masks: {
                                    test: {
                                        abc: 'def',
                                    },
                                },
                            },
                            tags: new Set(['newTag', 'num']),
                        },
                    ],
                });
            });

            it('should not include the update if no tag masks were updated', () => {
                const current = {
                    test: {
                        id: 'test',
                        tags: {},
                        masks: {
                            test: {},
                        },
                    },
                };
                const update = {
                    test: {
                        masks: {
                            test: {},
                        },
                    },
                };

                const result = updates(current, update);
                expect(result).toEqual({
                    addedBots: [],
                    removedBots: [],
                    updatedBots: [],
                });
            });
        });
    });
});
