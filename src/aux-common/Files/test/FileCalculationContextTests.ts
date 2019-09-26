import { FileSandboxContext } from '../FileCalculationContext';
import {
    createFile,
    objectsAtContextGridPosition,
    getFileShape,
    calculateFormulaValue,
    calculateFileValue,
    filterFilesBySelection,
    updateFile,
    isMergeable,
    isPickupable,
    isSimulation,
    isDestroyable,
    isEditable,
    getDiffUpdate,
    filtersMatchingArguments,
    COMBINE_ACTION_NAME,
    parseFilterTag,
    filterMatchesArguments,
    duplicateFile,
    isFileMovable,
    getFileDragMode,
    isFileStackable,
    getUserMenuId,
    getFilesInMenu,
    addFileToMenu,
    removeFileFromMenu,
    getContextVisualizeMode,
    getBuilderContextGrid,
    getContextSize,
    addToContextDiff,
    removeFromContextDiff,
    isContextMovable,
    isContext,
    getFileConfigContexts,
    isContextLocked,
    getFileLabelAnchor,
    getFileVersion,
    isFileInContext,
    getFileUsernameList,
    isInUsernameList,
    whitelistAllowsAccess,
    blacklistAllowsAccess,
    whitelistOrBlacklistAllowsAccess,
    getUserFileColor,
    getUserAccountFile,
    getTokensForUserAccount,
    findMatchingToken,
    calculateStringListTagValue,
    getFileRoles,
    getChannelFileById,
    calculateBooleanTagValue,
    calculateNumericalTagValue,
    getChannelConnectedDevices,
    getConnectedDevices,
    getChannelMaxDevicesAllowed,
    getMaxDevicesAllowed,
    getFileScale,
    calculateCopiableValue,
    isUserActive,
    calculateStringTagValue,
} from '../FileCalculations';
import {
    Bot,
    PartialFile,
    DEFAULT_BUILDER_USER_COLOR,
    DEFAULT_PLAYER_USER_COLOR,
    GLOBALS_FILE_ID,
    AuxDomain,
} from '../File';

export function fileCalculationContextTests(
    uuidMock: jest.Mock,
    dateNowMock: jest.Mock,
    createCalculationContext: (
        files: Bot[],
        userId?: string
    ) => FileSandboxContext
) {
    describe('objectsAtContextGridPosition()', () => {
        it('should return files at the given position', () => {
            const file1 = createFile('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file2 = createFile('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file3 = createFile('test3', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([file2, file1, file3]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([file1, file2, file3]);
        });

        it('should ignore user files', () => {
            const file1 = createFile('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
                'aux._user': 'abc',
            });
            const file2 = createFile('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([file1, file2]);
            const result = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });

            expect(result).toEqual([file2]);
        });

        it('should cache the query and results', () => {
            const file1 = createFile('test1', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file2 = createFile('test2', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });
            const file3 = createFile('test3', {
                context: true,
                'context.x': -1,
                'context.y': 1,
            });

            const context = createCalculationContext([file2, file1, file3]);
            const context2 = createCalculationContext([file2, file1, file3]);
            const result1 = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });
            const result2 = objectsAtContextGridPosition(context, 'context', {
                x: -1,
                y: 1,
            });
            const result3 = objectsAtContextGridPosition(context2, 'context', {
                x: -1,
                y: 1,
            });

            expect(result1).toBe(result2);
            expect(result1).not.toBe(result3);
        });
    });

    describe('calculateFormulaValue()', () => {
        it('should return the formula result', () => {
            const formula = '123.4567';
            const context = createCalculationContext([]);
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123.4567);
        });

        it('should unwrap proxy values', () => {
            const obj1 = createFile('test1', {
                name: 'test',
                num: 123,
            });
            const context = createCalculationContext([obj1]);

            const formula = '=getTag(getBots("name", "test").first(), "#num")';
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toBeCloseTo(123);
        });

        it('should calculate formulas in tags', () => {
            const obj1 = createFile('test1', {
                name: 'test',
                formula: '=getTag(this, "#name")',
            });
            const context = createCalculationContext([obj1]);

            const formula = '=getTag(getBot("#name", "test"), "#formula")';
            const result = calculateFormulaValue(context, formula);

            expect(result.success).toBe(true);
            expect(result.result).toEqual('test');
        });
    });

    describe('calculateFileValue()', () => {
        it('should convert to a number if it is a number', () => {
            const file = createFile();
            file.tags.tag = '123.145';
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toBeCloseTo(123.145);
        });

        it('should parse numbers that dont start with a digit', () => {
            const file = createFile();
            file.tags.tag = '.145';
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toBeCloseTo(0.145);
        });

        it('should convert to a boolean if it is a boolean', () => {
            const file = createFile();
            file.tags.tag = 'true';

            const context = createCalculationContext([file]);
            const trueValue = calculateFileValue(context, file, 'tag');

            expect(trueValue).toBe(true);

            file.tags.tag = 'false';
            const falseValue = calculateFileValue(context, file, 'tag');

            expect(falseValue).toBe(false);
        });

        it('should convert arrays into arrays', () => {
            const file = createFile();
            file.tags.tag = '[test(a, b, c), 1.23, true]';
            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'tag');

            expect(value).toEqual(['test(a', 'b', 'c)', 1.23, true]);
        });

        it('should unwrap proxies in arrays', () => {
            const file = createFile('test', {
                formula: '=[getTag(this, "#num._1"),getTag(this, "#num._2")]',
                'num._1': '1',
                'num._2': '2',
            });

            const context = createCalculationContext([file]);
            const value = calculateFileValue(context, file, 'formula');

            expect(Array.isArray(value)).toBe(true);
            expect(value).toEqual([1, 2]);
        });

        describe('filterFilesBySelection()', () => {
            it('should return the files that have the given selection ID set to a truthy value', () => {
                const selectionId = 'abcdefg1234';
                const file1 = createFile('test1');
                const file2 = createFile('test2');
                const file3 = createFile('test3');
                const file4 = createFile('test4');
                const file5 = createFile('test5');
                const file6 = createFile('test6');

                file1.tags[selectionId] = true;
                file2.tags[selectionId] = 1;
                file3.tags[selectionId] = -1;
                file4.tags[selectionId] = 'hello';
                file5.tags[selectionId] = false;

                const selected = filterFilesBySelection(
                    [file1, file2, file3, file4, file5, file6],
                    selectionId
                );

                expect(selected).toEqual([file1, file2, file3, file4]);
            });

            it('should return files that have the same ID as the selection', () => {
                const selectionId = 'abcdefg1234';
                const file1 = createFile('test1');
                const file2 = createFile('abcdefg1234');

                file1.tags[selectionId] = true;

                const selected = filterFilesBySelection(
                    [file1, file2],
                    selectionId
                );

                expect(selected).toEqual([file1, file2]);
            });
        });

        describe('formulas', () => {
            const quoteCases = [['‘', '’'], ['“', '”']];

            it.each(quoteCases)(
                'should support curly quotes by converting them to normal quotes',
                (openQuote: string, closeQuote: string) => {
                    const file1 = createFile('test1');

                    file1.tags.formula = `=${openQuote}Hello, World${closeQuote}`;

                    const context = createCalculationContext([file1]);
                    const value = calculateFileValue(context, file1, 'formula');

                    // Order is based on the file ID
                    expect(value).toEqual('Hello, World');
                }
            );

            it('should throw the error that the formula throws', () => {
                const file = createFile('test', {
                    formula: '=throw new Error("hello")',
                });

                const context = createCalculationContext([file]);
                expect(() => {
                    const value = calculateFileValue(context, file, 'formula');
                }).toThrow(new Error('hello'));
            });

            it('should run out of energy in infinite loops', () => {
                const file = createFile('test', {
                    formula: '=while(true) {}',
                });

                const context = createCalculationContext([file]);

                expect(() => {
                    const value = calculateFileValue(context, file, 'formula');
                }).toThrow(new Error('Ran out of energy'));
            });

            it('should run out of energy in recursive tags', () => {
                const file = createFile('test', {
                    formula: '=getTag(this, "formula")',
                });

                const context = createCalculationContext([file]);

                expect(() => {
                    calculateFileValue(context, file, 'formula');
                }).toThrow();
            });

            it('should return the value from the return statement', () => {
                const file = createFile('test', {
                    formula: '=let a = "a"; let b = "b"; a + b;',
                });

                const context = createCalculationContext([file]);
                const value = calculateFileValue(context, file, 'formula');

                expect(value).toEqual('ab');
            });

            describe('getBotTagValues()', () => {
                it('should get every tag value', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 'hello';
                    file2.tags.abc = 'world';
                    file3.tags.abc = '!';

                    file3.tags.formula = '=getBotTagValues("abc")';

                    const context = createCalculationContext([
                        file4,
                        file2,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is based on the file ID
                    expect(value).toEqual(['hello', 'world', '!']);
                });

                it('should return all the values that equal the given value', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 2;

                    file3.tags.formula = '=getBotTagValues("abc", 2)';

                    const context = createCalculationContext([
                        file4,
                        file2,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 2]);
                });

                it('should use the given filter', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 3;

                    file3.tags.formula =
                        '=getBotTagValues("abc", num => num > 1)';

                    const context = createCalculationContext([
                        file2,
                        file4,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should handle filters on formulas', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = '=5';
                    file3.tags.abc = 3;

                    file3.tags.formula =
                        '=getBotTagValues("abc", num => num > 1)';

                    const context = createCalculationContext([
                        file2,
                        file4,
                        file1,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([5, 3]);
                });

                it('should support tags with dots', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['abc.def'] = 1;
                    file2.tags['abc.def'] = '=2';
                    file3.tags['abc.def'] = 3;

                    file3.tags.formula = '=getBotTagValues("abc.def")';
                    file3.tags.formula1 =
                        '=getBotTagValues("abc.def", num => num >= 2)';
                    file3.tags.formula2 =
                        '=getBotTagValues("abc.def", 2).first()';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([1, 2, 3]);

                    value = calculateFileValue(context, file3, 'formula1');

                    expect(value).toEqual([2, 3]);

                    value = calculateFileValue(context, file3, 'formula2');

                    expect(value).toEqual(2);
                });

                it('should support tags in strings', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=getBotTagValues("🎶🎉🦊")';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([1, 2, 3]);
                });

                it('should support tags in strings with filters', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula =
                        '=getBotTagValues("🎶🎉🦊", num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([2, 3]);
                });

                it('should work with dots after the filter args', () => {
                    const file1 = createFile('test1');

                    file1.tags.num = {
                        a: 1,
                    };

                    file1.tags.formula =
                        '=getBotTagValues("num", () => true).first().a';
                    const context = createCalculationContext([file1]);
                    let value = calculateFileValue(context, file1, 'formula');

                    expect(value).toBe(1);
                });

                it('should support filtering on values that contain arrays', () => {
                    const file = createFile('test', {
                        filter:
                            '=getBotTagValues("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "#num._1"),getTag(this, "#num._2")]',
                        'num._1': '1',
                        'num._2': '2',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value).toEqual([[1, 2]]);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const file = createFile('test', {
                        filter:
                            '=getBotTagValues("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "num._1"), getTag(this, "num._2")]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("num")',
                        num: '0',
                    });

                    const file2 = createFile('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([0, 1]);
                });

                it('should include false in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("bool")',
                        bool: false,
                    });

                    const file2 = createFile('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([false, true]);
                });

                it('should include NaN in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("num")',
                        num: NaN,
                    });

                    const file2 = createFile('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([NaN, 1.23]);
                });

                it('should not include empty strings in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("val")',
                        val: '',
                    });

                    const file2 = createFile('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual(['Hi']);
                });

                it('should not include null in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("obj")',
                        obj: null,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });

                it('should not include undefined in results', () => {
                    const file = createFile('test', {
                        formula: '=getBotTagValues("obj")',
                        obj: undefined,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([{ test: true }]);
                });
            });

            describe('getBots()', () => {
                it('should get every file that has the given tag', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 'hello';
                    file2.tags.abc = 'world';
                    file3.tags.abc = '!';

                    file3.tags.formula = '=getBots("abc")';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file1, file2, file3]);
                });

                it('should run out of energy in recursive tags', () => {
                    const file = createFile('test', {
                        formula: '=getBots("formula", "value")',
                    });

                    const context = createCalculationContext([file]);

                    expect(() => {
                        const val = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );
                    }).toThrow();
                });

                it('should run out of energy for recursive tags which dont check the tag value', () => {
                    const file1 = createFile('test1', {
                        formula: '=getBots("formula")',
                    });

                    const context = createCalculationContext([file1]);
                    expect(() => {
                        const val = calculateFileValue(
                            context,
                            file1,
                            'formula'
                        );
                    }).toThrow();
                });

                it('should get every file that has the given tag which matches the filter', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = 2;
                    file3.tags.abc = 3;

                    file3.tags.formula = '=getBots("abc", (num => num >= 2))';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file2, file3]);
                });

                it('should handle filters on formulas', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags.abc = 1;
                    file2.tags.abc = '=2';
                    file3.tags.abc = 3;

                    file3.tags.formula = '=getBots("abc", (num => num >= 2))';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file3, 'formula');

                    // Order is dependent on the position in the context.
                    expect(value).toEqual([file2, file3]);
                });

                it('should support tags with dots', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['abc.def'] = 1;
                    file2.tags['abc.def'] = '=2';
                    file3.tags['abc.def'] = 3;

                    file3.tags.formula = '=getBots("abc.def")';
                    file3.tags.formula1 =
                        '=getBots("abc.def", (num => num >= 2))';
                    file3.tags.formula2 = '=getBots("abc.def", 2).first()';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file1, file2, file3]);

                    value = calculateFileValue(context, file3, 'formula1');

                    expect(value).toEqual([file2, file3]);

                    value = calculateFileValue(context, file3, 'formula2');

                    expect(value).toEqual(file2);
                });

                it('should support tags in strings', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=getBots("🎶🎉🦊")';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file1, file2, file3]);
                });

                it('should support tags in strings with filters', () => {
                    const file1 = createFile('test1');
                    const file2 = createFile('test2');
                    const file3 = createFile('test3');
                    const file4 = createFile('test4');

                    file1.tags['🎶🎉🦊'] = 1;
                    file2.tags['🎶🎉🦊'] = '=2';
                    file3.tags['🎶🎉🦊'] = 3;

                    file3.tags.formula = '=getBots("🎶🎉🦊", num => num >= 2)';

                    const context = createCalculationContext([
                        file2,
                        file1,
                        file4,
                        file3,
                    ]);
                    let value = calculateFileValue(context, file3, 'formula');

                    expect(value).toEqual([file2, file3]);
                });

                it('should support filtering on values that contain arrays with elements that dont exist', () => {
                    const file = createFile('test', {
                        filter:
                            '=getBots("formula", x => x[0] == 1 && x[1] == 2)',
                        formula:
                            '=[getTag(this, "num._1"), getTag(this, "num._2")]',
                        'num._1': '1',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'filter');

                    expect(value).toEqual([]);
                });

                it('should include zeroes in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("num")',
                        num: '0',
                    });

                    const file2 = createFile('test2', {
                        num: '1',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should include false in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("bool")',
                        bool: false,
                    });

                    const file2 = createFile('test2', {
                        bool: true,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should include NaN in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("num")',
                        num: NaN,
                    });

                    const file2 = createFile('test2', {
                        num: 1.23,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                it('should not include empty strings in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("val")',
                        val: '',
                    });

                    const file2 = createFile('test2', {
                        val: 'Hi',
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should not include null in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("obj")',
                        obj: null,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should get the list of files with the given tag', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBots("#name")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual([fileA, fileB, fileC]);
                });

                it('should get the list of files with the given tag matching the given value', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBots("#name", "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual([fileA, fileC]);
                });

                it('should get the list of files with the given tag matching the given predicate', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBots("#name", x => x == "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual([fileA, fileC]);
                });

                it('should not include undefined in results', () => {
                    const file = createFile('test', {
                        formula: '=getBots("obj")',
                        obj: undefined,
                    });

                    const file2 = createFile('test2', {
                        obj: { test: true },
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should return files matching the given filter function', () => {
                    const file = createFile('test', {
                        formula: '=getBots(b => b.id === "test2")',
                        abc: 1,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file2]);
                });

                it('should return files matching all the given filter functions', () => {
                    const file = createFile('test', {
                        formula:
                            '=getBots(b => getTag(b, "abc") === 2, b => getTag(b, "def") === true)',
                        abc: 1,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                        def: false,
                    });

                    const file3 = createFile('test3', {
                        abc: 2,
                        def: true,
                    });

                    const context = createCalculationContext([
                        file,
                        file2,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file3]);
                });

                it('should sort files using the given sort function in the filter functions', () => {
                    const file = createFile('test', {
                        formula:
                            '=let filter = () => true; filter.sort = b => getTag(b, "order"); getBots(filter)',
                        abc: 1,
                        order: 3,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                        def: false,
                        order: 2,
                    });

                    const file3 = createFile('test3', {
                        abc: 2,
                        def: true,
                        order: 1,
                    });

                    const context = createCalculationContext([
                        file,
                        file2,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file3, file2, file]);
                });

                it('should return all files if no arguments are provdided', () => {
                    const file = createFile('test', {
                        formula: '=getBots()',
                        abc: 1,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual([file, file2]);
                });

                const emptyCases = [['null', 'null'], ['empty string', '""']];

                it.each(emptyCases)(
                    'should return an empty array if a %s tag is provided',
                    (desc, val) => {
                        const file = createFile('test', {
                            formula: `=getBots(${val})`,
                            abc: 1,
                        });

                        const file2 = createFile('test2', {
                            abc: 2,
                        });

                        const context = createCalculationContext([file, file2]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        expect(value).toEqual([]);
                    }
                );
            });

            describe('getBot()', () => {
                it('should get the first file with the given tag', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBot("#name")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([fileB, fileA]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(fileA);
                });

                it('should get the first file matching the given value', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBot("#name", "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(fileA);
                });

                it('should remove the first hashtag but not the second', () => {
                    const fileA = createFile('a', {
                        '#name': 'bob',
                        formula: '=getBot("##name")',
                    });
                    const fileB = createFile('b', {
                        '#name': 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([fileA, fileB]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(fileA);
                });

                it('should get the first file matching the given filter function', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBot("#name", x => x == "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(fileA);
                });

                it('should return the first file matching the given filter function', () => {
                    const file = createFile('test', {
                        formula: '=getBot(b => getTag(b, "abc") === 2)',
                        abc: 2,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([file2, file]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual(file);
                });

                it('should return the first file file matching all the given filter functions', () => {
                    const file = createFile('test', {
                        formula:
                            '=getBot(b => getTag(b, "abc") === 2, b => getTag(b, "def") === true)',
                        abc: 1,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                        def: false,
                    });

                    const file3 = createFile('test3', {
                        abc: 2,
                        def: true,
                    });

                    const file4 = createFile('test4', {
                        abc: 2,
                        def: true,
                    });

                    const context = createCalculationContext([
                        file4,
                        file,
                        file2,
                        file3,
                    ]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual(file3);
                });

                it('should return the first file if no arguments are provdided', () => {
                    const file = createFile('test', {
                        formula: '=getBot()',
                        abc: 1,
                    });

                    const file2 = createFile('test2', {
                        abc: 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    expect(value).toEqual(file);
                });

                const emptyCases = [['null', 'null'], ['empty string', '""']];

                it.each(emptyCases)(
                    'should return undefined if a %s tag is provided',
                    (desc, val) => {
                        const file = createFile('test', {
                            formula: `=getBot(${val})`,
                            abc: 1,
                        });

                        const file2 = createFile('test2', {
                            abc: 2,
                        });

                        const context = createCalculationContext([file, file2]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        expect(value).toEqual(undefined);
                    }
                );
            });

            describe('getBotTagValues()', () => {
                it('should get the list of values with the given tag', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(['bob', 'alice', 'bob']);
                });

                it('should get the list of files with the given tag matching the given value', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name", "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(['bob', 'bob']);
                });

                it('should get the list of files with the given tag matching the given predicate', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getBotTagValues("#name", x => x == "bob")',
                    });
                    const fileB = createFile('b', {
                        name: 'alice',
                    });
                    const fileC = createFile('c', {
                        name: 'bob',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileB,
                        fileA,
                        fileC,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual(['bob', 'bob']);
                });
            });

            describe('getTag()', () => {
                it('should get the specified tag value', () => {
                    const fileA = createFile('a', {
                        name: 'bob',
                        formula: '=getTag(this, "#name")',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([fileA]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual('bob');
                });

                it('should calculate formulas', () => {
                    const fileA = createFile('a', {
                        name: '="bob"',
                        formula: '=getTag(this, "#name")',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([fileA]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual('bob');
                });

                it('should be able to get a chain of tags', () => {
                    const fileA = createFile('a', {
                        file: '=getBot("#name", "bob")',
                        formula: '=getTag(this, "#file", "#file", "#name")',
                    });

                    const fileB = createFile('b', {
                        name: 'bob',
                        file: '=getBot("#name", "alice")',
                    });

                    const fileC = createFile('c', {
                        name: 'alice',
                    });

                    // specify the UUID to use next
                    uuidMock.mockReturnValue('uuid-0');
                    const context = createCalculationContext([
                        fileC,
                        fileB,
                        fileA,
                    ]);
                    const result = calculateFileValue(
                        context,
                        fileA,
                        'formula'
                    );

                    expect(result).toEqual('alice');
                });
            });

            describe('byTag()', () => {
                describe('just tag', () => {
                    const cases = [
                        [true, 'a file has the given tag', 0],
                        [false, 'a file has null for the given tag', null],
                        [
                            false,
                            'a file has undefined for the given tag',
                            undefined,
                        ],
                    ];

                    it.each(cases)(
                        'should return a function that returns %s if %s',
                        (expected, desc, val) => {
                            const file = createFile('test', {
                                formula: '=byTag("red")',
                            });

                            const context = createCalculationContext([file]);
                            const value = calculateFileValue(
                                context,
                                file,
                                'formula'
                            );

                            const file2 = createFile('test', {
                                red: val,
                            });

                            expect(value(file2)).toBe(expected);
                        }
                    );
                });

                describe('tag + value', () => {
                    it('should return a function that returns true when the value matches the tag', () => {
                        const file = createFile('test', {
                            formula: '=byTag("red", "abc")',
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file2 = createFile('test', {
                            red: 'abc',
                        });

                        expect(value(file2)).toBe(true);
                    });

                    it('should return a function that returns true when the value does not match the tag', () => {
                        const file = createFile('test', {
                            formula: '=byTag("red", "abc")',
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file2 = createFile('test', {
                            red: 123,
                        });

                        expect(value(file2)).toBe(false);
                    });

                    const falsyCases = [['zero', 0], ['false', false]];

                    it.each(falsyCases)('should work with %s', (desc, val) => {
                        const file = createFile('test', {
                            formula: `=byTag("red", ${val})`,
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file2 = createFile('test', {
                            red: 1,
                        });
                        const file3 = createFile('test', {
                            red: val,
                        });

                        expect(value(file2)).toBe(false);
                        expect(value(file3)).toBe(true);
                    });

                    it('should be able to match files without the given tag using null', () => {
                        const file = createFile('test', {
                            formula: `=byTag("red", null)`,
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file2 = createFile('test', {
                            red: 1,
                        });
                        const file3 = createFile('test', {
                            abc: 'def',
                        });

                        expect(value(file2)).toBe(false);
                        expect(value(file3)).toBe(true);
                    });
                });

                describe('tag + filter', () => {
                    it('should return a function that returns true when the function returns true', () => {
                        const file = createFile('test', {
                            formula:
                                '=byTag("red", tag => typeof tag === "number")',
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );
                        const file2 = createFile('test', {
                            red: 123,
                        });

                        expect(value(file2)).toBe(true);
                    });

                    it('should return a function that returns false when the function returns false', () => {
                        const file = createFile('test', {
                            formula:
                                '=byTag("red", tag => typeof tag === "number")',
                        });

                        const context = createCalculationContext([file]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );
                        const file2 = createFile('test', {
                            red: 'test',
                        });

                        expect(value(file2)).toBe(false);
                    });
                });
            });

            describe('byMod()', () => {
                it('should match files with all of the same tags and values', () => {
                    const file = createFile('test', {
                        formula: `=byMod({
                            "aux.color": "red",
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {
                        'aux.color': 'red',
                        number: 123,
                        other: true,
                    });

                    expect(value(file2)).toBe(true);
                });

                it('should not match files with wrong tag values', () => {
                    const file = createFile('test', {
                        formula: `=byMod({
                            "aux.color": "red",
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {
                        'aux.color': 'red',
                        number: 999,
                        other: true,
                    });

                    expect(value(file2)).toBe(false);
                });

                it('should match tags using the given filter', () => {
                    const file = createFile('test', {
                        formula: `=byMod({
                            "aux.color": x => x.startsWith("r"),
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {
                        'aux.color': 'rubble',
                        number: 123,
                        other: true,
                    });

                    expect(value(file2)).toBe(true);
                });

                it('should match tags with null', () => {
                    const file = createFile('test', {
                        formula: `=byMod({
                            "aux.color": null,
                            number: 123
                        })`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {
                        number: 123,
                        other: true,
                    });

                    const file3 = createFile('test', {
                        'aux.color': false,
                        number: 123,
                        other: true,
                    });

                    expect(value(file2)).toBe(true);
                    expect(value(file3)).toBe(false);
                });
            });

            describe('inContext()', () => {
                it('should return a function that returns true if the file is in the given context', () => {
                    const file = createFile('test', {
                        formula: '=inContext("red")',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {
                        red: true,
                    });

                    expect(value(file2)).toBe(true);
                });

                it('should return a function that returns false if the file is not in the given context', () => {
                    const file = createFile('test', {
                        formula: '=inContext("red")',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {});

                    expect(value(file2)).toBe(false);
                });
            });

            describe('inStack()', () => {
                it('should return a function that returns true if the file is in the same stack as another file', () => {
                    const file = createFile('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const file2 = createFile('test2', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    expect(value(file3)).toBe(true);
                });

                it('should return a function that returns false if the file is not in the same stack as another file', () => {
                    const file = createFile('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const file2 = createFile('test2', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 3,
                    });

                    expect(value(file3)).toBe(false);
                });

                it('should return a function that returns false if the file is not in the same context as another file', () => {
                    const file = createFile('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const file2 = createFile('test2', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    const context = createCalculationContext([file, file2]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: false,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    expect(value(file3)).toBe(false);
                });

                it('should return a function with a sort function that sorts the files by their sort order', () => {
                    const file = createFile('test', {
                        formula: '=inStack(getBot("id", "test2"), "red")',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                        'red.sortOrder': 100,
                    });

                    expect(typeof value.sort).toBe('function');
                    expect(value.sort(file3)).toBe(100);
                });
            });

            describe('atPosition()', () => {
                it('should return a function that returns true if the file is at the given position', () => {
                    const file = createFile('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    expect(value(file3)).toBe(true);
                });

                it('should return a function that returns false if the file is not at the given position', () => {
                    const file = createFile('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: true,
                        'red.x': 1,
                        'red.y': 3,
                    });

                    expect(value(file3)).toBe(false);
                });

                it('should return a function that returns false if the file is not in the given context', () => {
                    const file = createFile('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: false,
                        'red.x': 1,
                        'red.y': 2,
                    });

                    expect(value(file3)).toBe(false);
                });

                it('should return a function with a sort function that sorts the files by their sort order', () => {
                    const file = createFile('test', {
                        formula: '=atPosition("red", 1, 2)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');

                    const file3 = createFile('test3', {
                        red: false,
                        'red.x': 1,
                        'red.y': 2,
                        'red.sortOrder': 100,
                    });

                    expect(typeof value.sort).toBe('function');
                    expect(value.sort(file3)).toBe(100);
                });
            });

            describe('neighboring()', () => {
                const directionCases = [
                    ['front', 0, -1],
                    ['back', 0, 1],
                    ['left', 1, 0],
                    ['right', -1, 0],
                ];

                describe.each(directionCases)('%s', (direction, x, y) => {
                    it('should return a function that returns true if the given file is at the correct position', () => {
                        const file = createFile('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const file2 = createFile('test2', {
                            red: true,
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([file, file2]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file3 = createFile('test3', {
                            red: true,
                            'red.x': x,
                            'red.y': y,
                        });

                        expect(value(file3)).toBe(true);
                    });

                    it('should return a function that returns false if the given file is not at the correct position', () => {
                        const file = createFile('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const file2 = createFile('test2', {
                            red: true,
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([file, file2]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file3 = createFile('test3', {
                            red: true,
                            'red.x': -x,
                            'red.y': -y,
                        });

                        expect(value(file3)).toBe(false);
                    });

                    it('should return a function with a sort function that sorts the files by their sort order', () => {
                        const file = createFile('test', {
                            formula: `=neighboring(getBot("id", "test2"), "red", "${direction}")`,
                        });

                        const file2 = createFile('test2', {
                            red: true,
                            'red.x': 0,
                            'red.y': 0,
                        });

                        const context = createCalculationContext([file, file2]);
                        const value = calculateFileValue(
                            context,
                            file,
                            'formula'
                        );

                        const file3 = createFile('test3', {
                            red: true,
                            'red.x': x,
                            'red.y': y,
                            'red.sortOrder': 100,
                        });

                        expect(typeof value.sort).toBe('function');
                        expect(value.sort(file3)).toBe(100);
                    });
                });
            });

            describe('either()', () => {
                it('should return a function that returns true when any of the given functions return true', () => {
                    const file = createFile('test', {
                        formula: '=either(b => false, b => true)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {});

                    expect(value(file2)).toBe(true);
                });

                it('should return a function that returns false when all of the given functions return false', () => {
                    const file = createFile('test', {
                        formula: '=either(b => false, b => false)',
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {});

                    expect(value(file2)).toBe(false);
                });

                it('should return a function that doesnt have a sort function', () => {
                    const file = createFile('test', {
                        formula: `=either(b => false, b => false)`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test', {});

                    expect(typeof value.sort).toBe('undefined');
                });
            });

            describe('not()', () => {
                it('should return a function which negates the given function results', () => {
                    const file = createFile('test', {
                        formula: `=not(b => b.id === "test2")`,
                    });

                    const context = createCalculationContext([file]);
                    const value = calculateFileValue(context, file, 'formula');
                    const file2 = createFile('test2', {});

                    expect(value(file2)).toBe(false);
                    expect(value(file)).toBe(true);
                });
            });
        });
    });

    describe('calculateCopiableValue()', () => {
        it('should catch errors from calculateFileValue()', () => {
            const file1 = createFile('test1', {
                formula: '=throw new Error("Test")',
            });

            const context = createCalculationContext([file1]);
            const result = calculateCopiableValue(
                context,
                file1,
                'formula',
                file1.tags['formula']
            );

            expect(result).toEqual('Error: Test');
        });
    });

    describe('calculateBooleanTagValue()', () => {
        booleanTagValueTests(false, (value, expected) => {
            let file = createFile('test', {
                tag: value,
            });

            const calc = createCalculationContext([file]);
            expect(calculateBooleanTagValue(calc, file, 'tag', false)).toBe(
                expected
            );
        });
    });

    describe('calculateStringTagValue()', () => {
        stringTagValueTests('test', (value, expected) => {
            let file = createFile('test', {
                tag: value,
            });

            const calc = createCalculationContext([file]);
            expect(calculateStringTagValue(calc, file, 'tag', 'test')).toBe(
                expected
            );
        });
    });

    describe('calculateNumericalTagValue()', () => {
        numericalTagValueTests(null, (value, expected) => {
            let file = createFile('test', {
                tag: value,
            });

            const calc = createCalculationContext([file]);
            expect(calculateNumericalTagValue(calc, file, 'tag', null)).toBe(
                expected
            );
        });
    });

    describe('updateFile()', () => {
        it('should do nothing if there is no new data', () => {
            let file: Bot = createFile();
            let newData = {};

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
            );

            expect(newData).toEqual({});
        });

        it('should set leave falsy fields alone in newData', () => {
            let file: Bot = createFile();
            let newData = {
                tags: {
                    a: false,
                    b: '',
                    c: 0,
                    d: <any>[],
                    e: <any>null,
                    f: <any>undefined,
                    g: NaN,
                },
            };

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
            );

            expect(newData).toEqual({
                tags: {
                    a: false,
                    b: '',
                    c: 0,
                    d: [],
                    e: null,
                    f: undefined,
                    g: NaN,
                    'aux._lastEditedBy': 'testUser',
                },
            });
        });

        it('should calculate assignment formulas', () => {
            let file = createFile();
            file.tags.num = 5;

            let newData: any = {
                tags: {
                    sum: ':=getTag(this, "#num") + 5',
                },
            };

            updateFile(file, 'testUser', newData, () =>
                createCalculationContext([file])
            );

            expect(newData.tags.sum.value).toBe(10);
            expect(newData.tags.sum.formula).toBe(':=getTag(this, "#num") + 5');
        });
    });

    describe('isMergeable()', () => {
        it('should return true if the file is mergeable', () => {
            const file1 = createFile(undefined, { 'aux.mergeable': true });
            const update1 = isMergeable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(true);
        });

        it('should return false if the file is not mergeable', () => {
            const file1 = createFile(undefined, { 'aux.mergeable': false });
            const update1 = isMergeable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(false);
        });
    });

    describe('isPickupable()', () => {
        const cases = [
            [true, true],
            [true, 'move'],
            [true, 'any'],
            [false, 'drag'],
            [false, 'clone'],
            [true, 'pickup'],
            [false, false],
        ];

        it.each(cases)('should return %s if set to %s', (expected, value) => {
            const file1 = createFile(undefined, { 'aux.movable': value });
            const update1 = isPickupable(
                createCalculationContext([file1]),
                file1
            );

            expect(update1).toBe(expected);
        });
    });

    describe('isUserActive()', () => {
        it('should return true if the last active time is within 60 seconds', () => {
            dateNowMock.mockReturnValue(1000 * 60 + 999);
            const file1 = createFile(undefined, {
                'aux._lastActiveTime': 1000,
                'aux.user.active': true,
            });
            const calc = createCalculationContext([file1]);
            const update1 = isUserActive(calc, file1);

            expect(update1).toBe(true);
        });

        it('should return true if the last active time is within 60 seconds', () => {
            dateNowMock.mockReturnValue(1000 * 61);
            const file1 = createFile(undefined, {
                'aux._lastActiveTime': 1000,
                'aux.user.active': true,
            });
            const calc = createCalculationContext([file1]);
            const update1 = isUserActive(calc, file1);

            expect(update1).toBe(false);
        });

        it('should return false if the user is not active', () => {
            dateNowMock.mockReturnValue(1000);
            const file1 = createFile(undefined, {
                'aux._lastActiveTime': 1000,
                'aux.user.active': false,
            });
            const calc = createCalculationContext([file1]);
            const update1 = isUserActive(calc, file1);

            expect(update1).toBe(false);
        });
    });

    describe('isSimulation()', () => {
        let cases = [
            ['', false],
            [null, false],
            [0, false],
            ['=false', false],
            ['=0', false],
            ['a', true],
            [1, true],
            [true, true],
            ['=1', true],
            ['="hello"', true],
        ];

        it.each(cases)(
            'should map aux.channel:%s to %s',
            (value: string, expected: boolean) => {
                let file = createFile('test', {
                    'aux.channel': value,
                });

                const calc = createCalculationContext([file]);
                expect(isSimulation(calc, file)).toBe(expected);
            }
        );
    });

    describe('isDestroyable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let file = createFile('test', {
                'aux.destroyable': value,
            });

            const calc = createCalculationContext([file]);
            expect(isDestroyable(calc, file)).toBe(expected);
        });
    });

    describe('isEditable()', () => {
        booleanTagValueTests(true, (value, expected) => {
            let file = createFile('test', {
                'aux.editable': value,
            });

            const calc = createCalculationContext([file]);
            expect(isEditable(calc, file)).toBe(expected);
        });
    });

    describe('getDiffUpdate()', () => {
        it('should return null if the file is not a diff', () => {
            const file1 = createFile();
            const calc1 = createCalculationContext([file1]);
            const update1 = getDiffUpdate(calc1, file1);

            // not a diff because it doesn't have any tags
            const file2 = createFile(undefined, {
                tags: { 'aux.mod': true },
            });
            const calc2 = createCalculationContext([file2]);
            const update2 = getDiffUpdate(calc2, file2);

            expect(update1).toBe(null);
            expect(update2).toBe(null);
        });

        it('should return a partial file that contains the specified tags', () => {
            let file1 = createFile();
            file1.tags['aux.mod'] = true;
            file1.tags['aux.mod.mergeTags'] = [
                'aux.label',
                'name',
                'zero',
                'false',
                'gone',
                'empty',
                'null',
            ];

            file1.tags.name = 'test';
            file1.tags['aux.label'] = 'label';
            file1.tags['zero'] = 0;
            file1.tags['false'] = false;
            file1.tags['empty'] = '';
            file1.tags['null'] = null;
            file1.tags['other'] = 'heheh';

            const calc = createCalculationContext([file1]);
            const update = getDiffUpdate(calc, file1);

            expect(update).toEqual({
                tags: {
                    'aux.label': 'label',
                    name: 'test',
                    zero: 0,
                    false: false,
                },
            });
        });

        it('should return a partial file that contains the specified tags from the formula', () => {
            let file1 = createFile();
            file1.tags['aux.mod'] = true;
            file1.tags['aux.mod.mergeTags'] =
                '[aux.label,name,zero,false,gone,empty,null]';

            file1.tags.name = 'test';
            file1.tags['aux.label'] = 'label';
            file1.tags['zero'] = 0;
            file1.tags['false'] = false;
            file1.tags['empty'] = '';
            file1.tags['null'] = null;
            file1.tags['other'] = 'heheh';

            const calc = createCalculationContext([file1]);
            const update = getDiffUpdate(calc, file1);

            expect(update).toEqual({
                tags: {
                    'aux.label': 'label',
                    name: 'test',
                    zero: 0,
                    false: false,
                },
            });
        });

        it('should use the list of tags from aux.movable.mod.tags before falling back to aux.mod.mergeTags', () => {
            let file1 = createFile();
            file1.tags['aux.mod'] = true;
            file1.tags['aux.movable.mod.tags'] = '[abc]';
            file1.tags['aux.mod.mergeTags'] = [
                'aux.label',
                'name',
                'zero',
                'false',
                'gone',
                'empty',
                'null',
            ];

            file1.tags.name = 'test';
            file1.tags['aux.label'] = 'label';
            file1.tags['zero'] = 0;
            file1.tags['false'] = false;
            file1.tags['empty'] = '';
            file1.tags['null'] = null;
            file1.tags['other'] = 'heheh';
            file1.tags['abc'] = 'def';

            const calc = createCalculationContext([file1]);
            const update = getDiffUpdate(calc, file1);

            expect(update).toEqual({
                tags: {
                    abc: 'def',
                },
            });
        });
    });

    describe('filtersMatchingArguments()', () => {
        it('should return an empty array if no tags match', () => {
            let file = createFile();
            let other = createFile();

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags).toEqual([]);
        });

        it('should match based on tag and exact value', () => {
            let other = createFile();
            other.tags.name = 'Test';
            other.tags.val = '';

            let file = createFile();
            file.tags['onCombine(#name:"Test")'] = 'abc';
            file.tags['onCombine(#val:"")'] = 'abc';
            file.tags['onCombine(#name:"test")'] = 'def';

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual([
                'onCombine(#name:"Test")',
                'onCombine(#val:"")',
            ]);
        });

        it('should only match tags in the given file', () => {
            let file = createFile();
            file.tags['onCombine(#name:"Test")'] = 'abc';

            let other = createFile();
            other.tags.name = 'Test';

            const context = createCalculationContext([file, other]);
            const tags = filtersMatchingArguments(
                context,
                file,
                COMBINE_ACTION_NAME,
                [other]
            );

            expect(tags.map(t => t.tag)).toEqual(['onCombine(#name:"Test")']);
        });
    });

    describe('filterMatchesArguments()', () => {
        it('should match string values', () => {
            let other = createFile();
            other.tags.name = 'test';

            const context = createCalculationContext([other]);
            const filter = parseFilterTag('onCombine(#name:"test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match number values', () => {
            let other = createFile();
            other.tags.num = 123456;

            const context = createCalculationContext([other]);
            let filter = parseFilterTag('onCombine(#num:"123456")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.num = 3.14159;
            filter = parseFilterTag('onCombine(#num:"3.14159")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match boolean values', () => {
            let other = createFile();
            other.tags.bool = true;
            const context = createCalculationContext([other]);
            let filter = parseFilterTag('onCombine(#bool:"true")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.bool = false;

            filter = parseFilterTag('onCombine(#bool:"false")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should match array values', () => {
            let other = createFile();
            other.tags.array = [];
            const context = createCalculationContext([other]);

            let filter = parseFilterTag('onCombine(#array:"[]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            filter = parseFilterTag('onCombine(#array:"["anything"]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            other.tags.array = [1];
            filter = parseFilterTag('onCombine(#array:"[1]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.array = ['hello', 'world'];
            filter = parseFilterTag('onCombine(#array:"[hello, world]")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.array = ['hello', 'world', 12.34];
            filter = parseFilterTag(
                'onCombine(#array:"[hello, world, 12.34]")'
            );
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });

        it('should evaluate the value filters', () => {
            let other = createFile();
            other.tags.name = '=getTag(this, "#cool")';
            other.tags.cool = 'Test';

            const context = createCalculationContext([other, other]);
            let filter = parseFilterTag('onCombine(#name:"Test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.value = '10.15';
            filter = parseFilterTag('onCombine(#value:10.15)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            other.tags.value = 'true';
            filter = parseFilterTag('onCombine(#value:true)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            filter = parseFilterTag('onCombine(#value:false)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            other.tags.value = 'false';
            filter = parseFilterTag('onCombine(#value:true)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(false);

            filter = parseFilterTag('onCombine(#value:false)');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);

            let newData: PartialFile = {
                tags: {
                    assign: ':=getTag(this, "#cool")',
                },
            };
            updateFile(other, 'testId', newData, () => context);
            other.tags.assign = newData.tags.assign;
            filter = parseFilterTag('onCombine(#assign:"Test")');
            expect(
                filterMatchesArguments(context, filter, COMBINE_ACTION_NAME, [
                    other,
                ])
            ).toBe(true);
        });
    });

    describe('duplicateFile()', () => {
        beforeAll(() => {
            uuidMock.mockReturnValue('test');
        });

        it('should return a copy with a different ID', () => {
            const first: Bot = createFile('id');
            first.tags.fun = 'abc';

            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.id).toBe('test');
            expect(second.tags).toEqual(first.tags);
        });

        it('should not be destroyed', () => {
            let first: Bot = createFile('id');
            first.tags['aux._destroyed'] = true;
            first.tags._workspace = 'abc';

            uuidMock.mockReturnValue('test');
            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags['aux._destroyed']).toBeUndefined();
        });

        it('should not have any auto-generated contexts or selections', () => {
            let first: Bot = createFile('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';
            first.tags[`aux._context_abcdefg`] = true;
            first.tags[`aux._context_1234567`] = true;
            first.tags[`aux._context_1234567.x`] = 1;
            first.tags[`aux._context_1234567.y`] = 2;
            first.tags[`aux._context_1234567.z`] = 3;
            first.tags[`aux._selection_99999`] = true;

            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first);

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
            });
            expect(first.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
                'aux._context_abcdefg': true,
                'aux._context_1234567': true,
                'aux._context_1234567.x': 1,
                'aux._context_1234567.y': 2,
                'aux._context_1234567.z': 3,
                'aux._selection_99999': true,
            });
        });

        it('should keep the tags that the new data contains', () => {
            let first: Bot = createFile('id');
            first.tags[`aux.other`] = 100;
            first.tags[`myTag`] = 'Hello';

            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first, {
                tags: {
                    [`aux._selection_99999`]: true,
                    [`aux._context_abcdefg`]: true,
                },
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                'aux.other': 100,
                myTag: 'Hello',
                'aux._context_abcdefg': true,
                'aux._selection_99999': true,
            });
        });

        it('should merge in the additional changes', () => {
            let first: Bot = createFile('id', {
                testTag: 'abcdefg',
                name: 'ken',
            });
            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first, {
                tags: {
                    name: 'abcdef',
                },
            });

            expect(second.id).not.toEqual(first.id);
            expect(second.tags).toEqual({
                testTag: 'abcdefg',
                name: 'abcdef',
            });
        });

        it('should not modify the original file', () => {
            let first: Bot = createFile('id');
            first.tags['aux._destroyed'] = true;
            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first);

            expect(first.tags['aux._destroyed']).toBe(true);
        });

        it('should not clear aux.mod', () => {
            let first: Bot = createFile('id');
            first.tags['aux.mod'] = true;
            first.tags['aux.mod.mergeTags'] = ['abvc'];

            const calc = createCalculationContext([first]);
            const second = duplicateFile(calc, first);

            expect(second.tags['aux.mod']).toBe(true);
            expect(second.tags['aux.mod.mergeTags']).toEqual(['abvc']);
        });

        it('should not have any contexts', () => {
            let first: Bot = createFile('id', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                def: true,
            });
            let context: Bot = createFile('context', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([context, first]);
            const second = duplicateFile(calc, first);

            expect(second.tags).toEqual({
                def: true,
            });
        });

        it('should keep tags that are in diff tags', () => {
            let first: Bot = createFile('id', {
                abc: true,
                'abc.x': 1,
                'abc.y': 2,
                def: true,
                'aux.mod.mergeTags': ['abc'],
            });
            let context: Bot = createFile('context', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([context, first]);
            const second = duplicateFile(calc, first);

            expect(second.tags).toEqual({
                abc: true,
                def: true,
                'aux.mod.mergeTags': ['abc'],
            });
        });
    });

    describe('isFileMovable()', () => {
        it('should return true when aux.movable has no value', () => {
            let file = createFile('test', {});
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(true);
        });

        it('should return false when aux.movable is false', () => {
            let file = createFile('test', {
                ['aux.movable']: false,
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return false when aux.movable calculates to false', () => {
            let file = createFile('test', {
                ['aux.movable']: '=false',
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(false);
        });

        it('should return true when aux.movable has any other value', () => {
            let file = createFile('test', {
                ['aux.movable']: 'anything',
            });
            const context = createCalculationContext([file]);
            expect(isFileMovable(context, file)).toBe(true);
        });
    });

    describe('getFileDragMode()', () => {
        const cases = [
            ['all', 'all'],
            ['all', 'adfsdfa'],
            ['all', true],
            ['all', 'none'],
            ['all', 0],
            ['clone', 'clone'],
            ['pickup', 'pickup'],
            ['drag', 'drag'],
            ['all', 'diff'],
            ['cloneMod', 'cloneMod'],
            ['none', false],
        ];

        it.each(cases)('should return %s for %s', (expected, val) => {
            const file1 = createFile('file1', { 'aux.movable': val });
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe(expected);
        });

        it('should default to all', () => {
            const file1 = createFile('file1', {});
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe('all');
        });

        it('should return the default when given an invalid value', () => {
            const file1 = createFile('file1', { 'aux.movable': <any>'test' });
            const result = getFileDragMode(
                createCalculationContext([file1]),
                file1
            );

            expect(result).toBe('all');
        });
    });

    describe('isFileStackable()', () => {
        it('should return true when aux.stackable has no value', () => {
            let file = createFile('test', {});
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(true);
        });

        it('should return false when aux.stackable is false', () => {
            let file = createFile('test', {
                ['aux.stackable']: false,
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return false when aux.stackable calculates to false', () => {
            let file = createFile('test', {
                ['aux.stackable']: '=false',
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(false);
        });

        it('should return true when aux.stackable has any other value', () => {
            let file = createFile('test', {
                ['aux.stackable']: 'anything',
            });
            const context = createCalculationContext([file]);
            expect(isFileStackable(context, file)).toBe(true);
        });
    });

    describe('getFileShape()', () => {
        const cases = [['cube'], ['sphere'], ['sprite']];
        it.each(cases)('should return %s', (shape: string) => {
            const file = createFile('test', {
                'aux.shape': <any>shape,
            });

            const calc = createCalculationContext([file]);

            expect(getFileShape(calc, file)).toBe(shape);
        });

        it('should return sphere when the file is a diff', () => {
            const file = createFile('test', {
                'aux.shape': 'cube',
                'aux.mod': true,
                'aux.mod.mergeTags': ['aux.shape'],
            });

            const calc = createCalculationContext([file]);

            expect(getFileShape(calc, file)).toBe('sphere');
        });

        it('should default to cube', () => {
            const file = createFile();

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('cube');
        });

        it('should return the shape from aux.shape', () => {
            let file = createFile();
            file.tags['aux.shape'] = 'sphere';

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('sphere');
        });

        it('should return sphere when aux.mod is true', () => {
            let file = createFile();
            file.tags['aux.mod'] = true;
            file.tags['aux.shape'] = 'cube';

            const calc = createCalculationContext([file]);
            const shape = getFileShape(calc, file);

            expect(shape).toBe('sphere');
        });
    });

    describe('getFileScale()', () => {
        it('should return the scale.x, scale.y, and scale.z values', () => {
            const file = createFile('test', {
                'aux.scale.x': 10,
                'aux.scale.y': 11,
                'aux.scale.z': 12,
            });

            const calc = createCalculationContext([file]);

            expect(getFileScale(calc, file)).toEqual({
                x: 10,
                y: 11,
                z: 12,
            });
        });

        it('should cache the result', () => {
            const file = createFile('test', {
                'aux.scale.x': 10,
                'aux.scale.y': 11,
                'aux.scale.z': 12,
            });

            const calc = createCalculationContext([file]);
            const calc2 = createCalculationContext([file]);

            expect(getFileScale(calc, file)).toBe(getFileScale(calc, file));
            expect(getFileScale(calc, file)).not.toBe(
                getFileScale(calc2, file)
            );
        });
    });

    describe('getUserMenuId()', () => {
        it('should return the value from aux._userMenuContext', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });

            const calc = createCalculationContext([user]);
            const id = getUserMenuId(calc, user);
            expect(id).toBe('context');
        });
    });

    describe('getFilesInMenu()', () => {
        it('should return the list of files in the users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file1 = createFile('file1', {
                context: true,
                'context.sortOrder': 0,
            });
            const file2 = createFile('file2', {
                context: true,
                'context.sortOrder': 1,
            });
            const file3 = createFile('file3', {
                context: true,
                'context.sortOrder': 2,
            });

            const calc = createCalculationContext([user, file2, file1, file3]);
            const files = getFilesInMenu(calc, user);

            expect(files).toEqual([file1, file2, file3]);
        });
    });

    describe('getUserAccountFile()', () => {
        it('should return the file with aux.account.username that matches the given username', () => {
            const user = createFile('user', {
                'aux.account.username': 'name',
            });
            const file1 = createFile('file1', {
                'aux.account.username': 'other',
            });
            const file2 = createFile('file2', {
                'aux.account.username': 'name',
            });
            const file3 = createFile('file3', {
                'aux.account.username': 'test',
            });

            const calc = createCalculationContext([user, file2, file1, file3]);
            const file = getUserAccountFile(calc, 'name');

            expect(file).toEqual(user);
        });

        it('should return null if nothing matches the given username', () => {
            const user = createFile('user', {
                'aux.account.username': 'name',
            });
            const file1 = createFile('file1', {
                'aux.account.username': 'other',
            });
            const file2 = createFile('file2', {
                'aux.account.username': 'name',
            });
            const file3 = createFile('file3', {
                'aux.account.username': 'test',
            });

            const calc = createCalculationContext([user, file2, file1, file3]);
            const file = getUserAccountFile(calc, 'abc');

            expect(file).toEqual(null);
        });
    });

    describe('getTokensForUserAccount()', () => {
        it('should return the list of files that match the username', () => {
            const token = createFile('token', {
                'aux.token.username': 'name',
            });
            const token2 = createFile('token2', {
                'aux.token.username': 'other',
            });
            const token3 = createFile('token3', {
                'aux.token.username': 'name',
            });
            const token4 = createFile('token4', {
                'aux.token.username': 'test',
            });

            const calc = createCalculationContext([
                token,
                token2,
                token3,
                token4,
            ]);
            const files = getTokensForUserAccount(calc, 'name');

            expect(files).toEqual([token, token3]);
        });
    });

    describe('findMatchingToken()', () => {
        it('should return the first token that matches', () => {
            const token = createFile('token', {
                'aux.token': 'name',
            });
            const token2 = createFile('token2', {
                'aux.token': 'other',
            });
            const token3 = createFile('token3', {
                'aux.token': 'name',
            });
            const token4 = createFile('token4', {
                'aux.token': 'test',
            });

            const calc = createCalculationContext([
                token,
                token2,
                token3,
                token4,
            ]);
            const file = findMatchingToken(
                calc,
                [token3, token, token2, token4],
                'name'
            );

            expect(file).toEqual(token3);
        });

        it('should return null for no matches', () => {
            const token = createFile('token', {
                'aux.token': 'name',
            });
            const token2 = createFile('token2', {
                'aux.token': 'other',
            });
            const token3 = createFile('token3', {
                'aux.token': 'name',
            });
            const token4 = createFile('token4', {
                'aux.token': 'test',
            });

            const calc = createCalculationContext([
                token,
                token2,
                token3,
                token4,
            ]);
            const file = findMatchingToken(
                calc,
                [token3, token, token2, token4],
                'nomatch'
            );

            expect(file).toEqual(null);
        });
    });

    describe('getChannelFileById()', () => {
        it('should return the first file that matches', () => {
            const channel = createFile('channel', {
                'aux.channel': 'test',
                'aux.channels': true,
            });

            const calc = createCalculationContext([channel]);
            const file = getChannelFileById(calc, 'test');

            expect(file).toEqual(channel);
        });

        it('should return null if there are no matches', () => {
            const channel = createFile('channel', {
                'aux.channel': 'test',
                'aux.channels': true,
            });

            const calc = createCalculationContext([channel]);
            const file = getChannelFileById(calc, 'other');

            expect(file).toEqual(null);
        });
    });

    describe('getChannelConnectedDevices()', () => {
        numericalTagValueTests(0, (value, expected) => {
            let file = createFile('test', {
                'aux.channel.connectedSessions': value,
            });

            const calc = createCalculationContext([file]);
            expect(getChannelConnectedDevices(calc, file)).toBe(expected);
        });
    });

    describe('getChannelMaxDevicesAllowed()', () => {
        numericalTagValueTests(null, (value, expected) => {
            let file = createFile('test', {
                'aux.channel.maxSessionsAllowed': value,
            });

            const calc = createCalculationContext([file]);
            expect(getChannelMaxDevicesAllowed(calc, file)).toBe(expected);
        });
    });

    describe('getConnectedDevices()', () => {
        numericalTagValueTests(0, (value, expected) => {
            let file = createFile('test', {
                'aux.connectedSessions': value,
            });

            const calc = createCalculationContext([file]);
            expect(getConnectedDevices(calc, file)).toBe(expected);
        });
    });

    describe('getMaxDevicesAllowed()', () => {
        numericalTagValueTests(null, (value, expected) => {
            let file = createFile('test', {
                'aux.maxSessionsAllowed': value,
            });

            const calc = createCalculationContext([file]);
            expect(getMaxDevicesAllowed(calc, file)).toBe(expected);
        });
    });

    describe('getFileRoles()', () => {
        it('should get a list of strings from the aux.account.roles tag', () => {
            const file = createFile('file', {
                'aux.account.roles': ['admin'],
            });

            const calc = createCalculationContext([file]);
            const roles = getFileRoles(calc, file);

            expect(roles).toEqual(new Set(['admin']));
        });
    });

    describe('addFileToMenu()', () => {
        it('should return the update needed to add the given file ID to the given users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = addFileToMenu(calc, user, 'item');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 0,
                    'context.id': 'item',
                },
            });
        });

        it('should return the given sortOrder', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = addFileToMenu(calc, user, 'item', 5);

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 5,
                    'context.id': 'item',
                },
            });
        });

        it('should return sortOrder needed to place the file at the end of the list', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');
            const file2 = createFile('file2', {
                context: 0,
            });

            const calc = createCalculationContext([user, file, file2]);
            const update = addFileToMenu(calc, user, 'abc');

            expect(update).toEqual({
                tags: {
                    context: true,
                    'context.sortOrder': 1,
                    'context.id': 'abc',
                },
            });
        });
    });

    describe('removeFileFromMenu()', () => {
        it('should return the update needed to remove the given file from the users menu', () => {
            const user = createFile('user', {
                'aux._userMenuContext': 'context',
            });
            const file = createFile('file');

            const calc = createCalculationContext([user, file]);
            const update = removeFileFromMenu(calc, user);

            expect(update).toEqual({
                tags: {
                    context: null,
                    'context.sortOrder': null,
                    'context.id': null,
                },
            });
        });
    });

    describe('getContextVisualizeMode()', () => {
        const cases = [
            ['surface', 'surface'],
            ['true', true],
            ['false', false],
            [0, false],
            [1, false],
            ['anything', false],
        ];

        it.each(cases)('should map %s to %s', (given: any, expected: any) => {
            const file = createFile('file', {
                'aux.context.visualize': given,
            });

            const calc = createCalculationContext([file]);
            const visible = getContextVisualizeMode(calc, file);

            expect(visible).toBe(expected);
        });
    });

    describe('getContextGrid()', () => {
        it('should find all the tags that represent a grid position', () => {
            const file = createFile('file', {
                'aux.context.surface.grid.0:1': 1,
                'aux.context.surface.grid.1:1': 1,
                'aux.context.surface.grid.2:1': 2,
                'aux.context.surface.grid.2:2': '=3',
            });

            const calc = createCalculationContext([file]);
            const grid = getBuilderContextGrid(calc, file);

            expect(grid).toEqual({
                '0:1': 1,
                '1:1': 1,
                '2:1': 2,
                '2:2': 3,
            });
        });

        it('should not get confused by grid scale', () => {
            const file = createFile('file', {
                'aux.context.surface.grid.0:1': 1,
                'aux.context.grid.scale': 50,
            });

            const calc = createCalculationContext([file]);
            const grid = getBuilderContextGrid(calc, file);

            expect(grid).toEqual({
                '0:1': 1,
            });
        });
    });

    describe('getContextSize()', () => {
        it('should return the default size if none exists', () => {
            const file = createFile('file', {
                'aux.context.visualize': 'surface',
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(1);
        });

        it('should return the default if the file is a user file', () => {
            const file = createFile('file', {
                'aux._user': 'user',
                'aux.context.visualize': 'surface',
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(1);
        });

        it('should still return the user files context size', () => {
            const file = createFile('file', {
                'aux._user': 'user',
                'aux.context.visualize': 'surface',
                'aux.context.surface.size': 10,
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(10);
        });

        it('should return 0 if the file is not a surface', () => {
            const file = createFile('file', {
                'aux.context.visualize': true,
                'aux.context.surface.size': 10,
            });

            const calc = createCalculationContext([file]);
            const size = getContextSize(calc, file);

            expect(size).toBe(0);
        });
    });

    describe('calculateStringListTagValue()', () => {
        it('should return the list contained in the tag with each value converted to a string', () => {
            const file = createFile('test', {
                tag: ['abc', '', {}, [], false, 0, null, undefined],
            });
            const calc = createCalculationContext([file]);
            const result = calculateStringListTagValue(calc, file, 'tag', []);

            expect(result).toEqual([
                'abc',
                '',
                '[object Object]',
                '',
                'false',
                '0',
                null,
                undefined,
            ]);
        });

        it('should return the default value if the list doesnt exist', () => {
            const file = createFile('test', {});
            const calc = createCalculationContext([file]);
            const result = calculateStringListTagValue(calc, file, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        it('should return the default value if the tag contains an empty string', () => {
            const file = createFile('test', {
                tag: '',
            });
            const calc = createCalculationContext([file]);
            const result = calculateStringListTagValue(calc, file, 'tag', [
                'hello',
            ]);

            expect(result).toEqual(['hello']);
        });

        let cases = [
            [1.1, ['1.1']],
            [false, ['false']],
            ['abc', ['abc']],
            ['[abc]', ['abc']],
        ];

        it.each(cases)('should convert %s', (value, expected) => {
            const file = createFile('test', {
                tag: value,
            });
            const calc = createCalculationContext([file]);
            const result = calculateStringListTagValue(calc, file, 'tag', []);

            expect(result).toEqual(expected);
        });
    });

    describe('addToContextDiff()', () => {
        it('should return the tags needed to add a file to a context', () => {
            const file = createFile('file', {});

            const calc = createCalculationContext([file]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.sortOrder': 0,
            });
        });

        it('should calculate the sortOrder', () => {
            const file = createFile('file', {});
            const file2 = createFile('file2', {
                test: true,
                'test.sortOrder': 0,
            });

            const calc = createCalculationContext([file, file2]);
            const tags = addToContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: true,
                'test.x': 0,
                'test.y': 0,
                'test.sortOrder': 1,
            });
        });

        it('should calculate the sortOrder based on the given position', () => {
            const file = createFile('file', {});
            const file2 = createFile('file2', {
                test: true,
                'test.sortOrder': 0,
                'test.x': 0,
                'test.y': 0,
            });

            const calc = createCalculationContext([file, file2]);
            const tags = addToContextDiff(calc, 'test', 1, 2);

            expect(tags).toEqual({
                test: true,
                'test.x': 1,
                'test.y': 2,
                'test.sortOrder': 0,
            });
        });
    });

    describe('removeFromContextDiff()', () => {
        it('should return the tags needed to remove a file from a context', () => {
            const calc = createCalculationContext([]);
            const tags = removeFromContextDiff(calc, 'test');

            expect(tags).toEqual({
                test: null,
                'test.x': null,
                'test.y': null,
                'test.sortOrder': null,
            });
        });
    });

    describe('isContextMovable()', () => {
        it('should return true if movable', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
                'aux.context.surface.movable': true,
            });

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(true);
        });

        it('should return false if not movable', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
                'aux.context.surface.movable': false,
            });

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(false);
        });

        it('should be movable by default', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);

            expect(isContextMovable(calc, file)).toBe(true);
        });
    });

    describe('isContext()', () => {
        it('should return true when the given file has aux.context set to something', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            expect(isContext(calc, file)).toBe(true);
        });

        it('should return false when the given file does not have aux.context set to something', () => {
            const file = createFile('test', {
                'aux.context': '',
            });

            const calc = createCalculationContext([file]);
            expect(isContext(calc, file)).toBe(false);
        });
    });

    describe('getFileConfigContexts()', () => {
        it('should return the list of values in aux.context', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['abc']);
        });

        it('should evalulate formulas', () => {
            const file = createFile('test', {
                'aux.context': '="abc"',
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['abc']);
        });

        it('should return the list of values when given a number', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': 123,
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['123']);
        });

        it('should return the list of values when given a boolean', () => {
            const file = createFile('test', {
                abc: true,
                'aux.context': false,
            });

            const calc = createCalculationContext([file]);
            const tags = getFileConfigContexts(calc, file);

            expect(tags).toEqual(['false']);
        });
    });

    describe('isContextLocked()', () => {
        it('should default to false when the file is a context', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
            });

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(false);
        });

        it('should default to true when the file is not a context', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(true);
        });

        it('should evaluate formulas', () => {
            const file = createFile('test', {
                'aux.context': 'abc',
                'aux.context.locked': '=true',
            });

            const calc = createCalculationContext([file]);
            const locked = isContextLocked(calc, file);

            expect(locked).toEqual(true);
        });
    });

    describe('getLabelAnchor()', () => {
        it('should default to top', () => {
            const file = createFile('file');

            const calc = createCalculationContext([file]);
            const anchor = getFileLabelAnchor(calc, file);

            expect(anchor).toBe('top');
        });

        const cases = [
            ['top', 'top'],
            ['front', 'front'],
            ['back', 'back'],
            ['left', 'left'],
            ['right', 'right'],
            ['floating', 'floating'],
            ['abc', 'top'],
        ];
        it.each(cases)('given %s it should return %s', (anchor, expected) => {
            const file = createFile('file', {
                'aux.label.anchor': anchor,
            });

            const calc = createCalculationContext([file]);
            const a = getFileLabelAnchor(calc, file);

            expect(a).toBe(expected);
        });

        it('should support formulas', () => {
            const file = createFile('file', {
                'aux.label.anchor': '="front"',
            });

            const calc = createCalculationContext([file]);
            const anchor = getFileLabelAnchor(calc, file);

            expect(anchor).toBe('front');
        });
    });

    describe('getFileVersion()', () => {
        it('should return the aux.version', () => {
            const file = createFile('test', {
                'aux.version': 1,
            });

            const calc = createCalculationContext([file]);

            expect(getFileVersion(calc, file)).toBe(1);
        });

        it('should return undefined if not a number', () => {
            const file = createFile('test', {
                'aux.version': 'abc',
            });

            const calc = createCalculationContext([file]);

            expect(getFileVersion(calc, file)).toBeUndefined();
        });
    });

    describe('hasBotInInventory()', () => {
        it('should return true if the given file is in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return true if all the given files are in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const otherFile = createFile('otherFile', {
                name: 'bob',
                test: true,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, otherFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(true);
        });

        it('should return false if one of the given files are not in the users inventory context', () => {
            const thisFile = createFile('thisFile', {
                isInInventory:
                    '=player.hasBotInInventory(getBots("name", "bob"))',
            });
            const thatFile = createFile('thatFile', {
                name: 'bob',
                test: true,
            });
            const otherFile = createFile('otherFile', {
                name: 'bob',
                test: false,
            });
            const user = createFile('userId', {
                'aux._userInventoryContext': 'test',
            });

            const calc = createCalculationContext(
                [thisFile, thatFile, otherFile, user],
                'userId'
            );
            const result = calculateFileValue(calc, thisFile, 'isInInventory');

            expect(result).toBe(false);
        });
    });

    describe('isFileInContext()', () => {
        it('should handle boolean objects', () => {
            const thisFile = createFile('thisFile', {
                context: new Boolean(true),
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, 'context');

            expect(result).toBe(true);
        });

        it('should handle string objects', () => {
            const thisFile = createFile('thisFile', {
                context: new String('true'),
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, 'context');

            expect(result).toBe(true);
        });

        it('should handle a string object as the context', () => {
            const thisFile = createFile('thisFile', {
                context: true,
            });

            const calc = createCalculationContext([thisFile]);
            const result = isFileInContext(calc, thisFile, <any>(
                new String('context')
            ));

            expect(result).toBe(true);
        });
    });

    describe('getFileUsernameList()', () => {
        const cases = [['aux.whitelist'], ['aux.blacklist'], ['aux.designers']];

        describe.each(cases)('%s', tag => {
            it(`should return the ${tag}`, () => {
                const file = createFile('test', {
                    [tag]: '[Test, Test2]',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toEqual([
                    'Test',
                    'Test2',
                ]);
            });

            it('should always return an array', () => {
                const file = createFile('test', {
                    [tag]: 'Test',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toEqual(['Test']);
            });

            it('should handle falsy values', () => {
                const file = createFile('test', {
                    [tag]: '',
                });

                const calc = createCalculationContext([file]);

                expect(getFileUsernameList(calc, file, tag)).toBeFalsy();
            });

            it('should get the aux._user tag from files', () => {
                const file = createFile('test', {
                    [tag]: '=getBots("name", "bob")',
                });
                const user = createFile('user', {
                    name: 'bob',
                    'aux._user': 'a',
                });
                const bad = createFile('user2', {
                    name: 'bob',
                });

                const calc = createCalculationContext([file, user, bad]);

                expect(getFileUsernameList(calc, file, tag)).toEqual([
                    'a',
                    'user2',
                ]);
            });
        });
    });

    describe('isInUsernameList()', () => {
        const cases = [['aux.whitelist'], ['aux.blacklist']];

        describe.each(cases)('%s', tag => {
            const extraCases = [
                ['Test', '[Test, Test2]', true],
                ['Test', '[Test2]', false],
                ['Test', 'Test2', false],
                ['Test2', 'Test2', true],
                ['Test2', '', false],
            ];

            it.each(extraCases)(
                'should determine if %s is in the list',
                (username, list, expected) => {
                    const file = createFile('test', {
                        [tag]: list,
                    });

                    const calc = createCalculationContext([file]);

                    expect(isInUsernameList(calc, file, tag, username)).toBe(
                        expected
                    );
                }
            );
        });
    });

    describe('whitelistAllowsAccess()', () => {
        it('should check the whitelist to determine if the username is allowed access', () => {
            const file = createFile('test', {
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should always allow access if no usernames are specified', () => {
            const file = createFile('test', {
                'aux.whitelist': '',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should deny access if the username is not in the list', () => {
            const file = createFile('test', {
                'aux.whitelist': 'Test',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistAllowsAccess(calc, file, 'ABC')).toBe(false);
        });
    });

    describe('blacklistAllowsAccess()', () => {
        it('should check the blacklist to determine if the username is allowed access', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'DEF')).toBe(true);
        });

        it('should always allow access if no usernames are specified', () => {
            const file = createFile('test', {
                'aux.blacklist': '',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'ABC')).toBe(true);
        });

        it('should deny access if the username is in the list', () => {
            const file = createFile('test', {
                'aux.blacklist': 'ABC',
            });

            const calc = createCalculationContext([file]);

            expect(blacklistAllowsAccess(calc, file, 'ABC')).toBe(false);
        });
    });

    describe('whitelistOrBlacklistAllowsAccess()', () => {
        it('should allow access if the name is in the whitelist and the blacklist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                true
            );
        });

        it('should allow access if neither list exists', () => {
            const file = createFile('test', {});

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                true
            );
        });

        it('should deny access if the name is not in the whitelist and not in the blacklist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                false
            );
        });

        it('should deny access if the name is in the blacklist and not in the whitelist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
                'aux.whitelist': '[DEF]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                false
            );
        });

        it('should deny access if the name is in the blacklist the whitelist doesnt exist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'ABC')).toBe(
                false
            );
        });

        it('should allow access if the name is not in the blacklist the whitelist doesnt exist', () => {
            const file = createFile('test', {
                'aux.blacklist': '[ABC]',
            });

            const calc = createCalculationContext([file]);

            expect(whitelistOrBlacklistAllowsAccess(calc, file, 'DEF')).toBe(
                true
            );
        });
    });

    describe('getUserFileColor()', () => {
        const defaultCases = [
            [DEFAULT_BUILDER_USER_COLOR, 'builder'],
            [DEFAULT_PLAYER_USER_COLOR, 'player'],
        ];

        it.each(defaultCases)(
            'should default to %s when in %s',
            (expected: any, domain: AuxDomain) => {
                const file = createFile('test', {});
                const globals = createFile(GLOBALS_FILE_ID, {});

                const calc = createCalculationContext([globals, file]);

                expect(getUserFileColor(calc, file, globals, domain)).toBe(
                    expected
                );
            }
        );

        const globalsCases = [
            ['aux.scene.user.player.color', 'player', '#40A287'],
            ['aux.scene.user.builder.color', 'builder', '#AAAAAA'],
        ];

        it.each(globalsCases)(
            'should use %s when in %s',
            (tag: string, domain: AuxDomain, value: any) => {
                const file = createFile('test', {});
                const globals = createFile(GLOBALS_FILE_ID, {
                    [tag]: value,
                });

                const calc = createCalculationContext([globals, file]);

                expect(getUserFileColor(calc, file, globals, domain)).toBe(
                    value
                );
            }
        );

        const userCases = [['player'], ['builder']];

        it.each(userCases)(
            'should use aux.color from the user file',
            (domain: AuxDomain) => {
                const file = createFile('test', {
                    'aux.color': 'red',
                });
                const globals = createFile(GLOBALS_FILE_ID, {});

                const calc = createCalculationContext([globals, file]);

                expect(getUserFileColor(calc, file, globals, domain)).toBe(
                    'red'
                );
            }
        );
    });
}

function booleanTagValueTests(
    defaultValue: boolean,
    testFunc: (given: any, expected: boolean) => void
) {
    let cases = [
        ['', defaultValue],
        [null, defaultValue],
        [0, defaultValue],
        ['=false', false],
        ['=0', defaultValue],
        ['a', defaultValue],
        [1, defaultValue],
        [false, false],
        ['false', false],
        [true, true],
        ['true', true],
        ['=1', defaultValue],
        ['="hello"', defaultValue],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}

function numericalTagValueTests(
    defaultValue: number,
    testFunc: (given: any, expected: number) => void
) {
    let cases = [
        ['', defaultValue],
        [null, defaultValue],
        [0, 0],
        ['=false', defaultValue],
        ['=0', 0],
        ['a', defaultValue],
        [1, 1],
        [-10, -10],
        ['1', 1],
        ['.5', 0.5],
        [false, defaultValue],
        ['false', defaultValue],
        [true, defaultValue],
        ['true', defaultValue],
        ['=1', 1],
        ['="hello"', defaultValue],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}

function stringTagValueTests(
    defaultValue: string,
    testFunc: (given: any, expected: string) => void
) {
    let cases = [
        ['', ''],
        [null, defaultValue],
        [0, defaultValue],
        ['=false', defaultValue],
        ['=0', defaultValue],
        ['a', 'a'],
        [1, defaultValue],
        ['1', defaultValue],
        ['.5', defaultValue],
        [false, defaultValue],
        ['false', defaultValue],
        [true, defaultValue],
        ['true', defaultValue],
        ['=1', defaultValue],
        ['="hello"', 'hello'],
    ];

    it.each(cases)('should map %s to %s', testFunc);
}
