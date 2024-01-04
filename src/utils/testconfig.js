const compilerOption = {
    // Allow JavaScript files to be compiled
    allowJs: true,

    // Specify the module system, common options are "CommonJS" or "ESNext" for ES Modules
    module: "CommonJS",

    // Target specific ECMAScript version for output (e.g., "ES2020")
    target: "ES2020",

    // Enable strict mode for type checking (if you're using TypeScript features in .js files)
    strict: true,

    // Include type definitions for Node.js (if your project is a Node.js project)
    types: ["node"],

    // Enable synthetic default imports (e.g., to import React as `import React from 'react'`)
    allowSyntheticDefaultImports: true,

    // Optionally, set the module resolution strategy
    moduleResolution: "node",

    // Enable emitting decorator metadata (useful if you're using decorators)
    experimentalDecorators: true,

    // Emit BOM for UTF-8 files
    emitBOM: false

    // If using JSX (React), set this to "React"
    // jsx: "React"

    // Other options as needed for your project...
};
export const FILES = [{
    filepath: '/home/charly/repo/tsIntelligence/src/exp.js',
    definition: {line: 11, offset: 49},
    getDefinitionAndBoundSpan: {line: 11, offset: 49},
    getImplementations: {line: 11, offset: 49},
    reference: {line: 14, offset: 50},
    quickInfo: {line: 17, offset: 43},
    findSourceDefinition: {line: 21, offset: 48},
    getCompletionInfo: {line: 20, offset: 52},
    getCompletionDetails: {line: 20, offset: 52},
    format: {line: 9, offset: 0, endLine: 44, endOffset: 0},
    formatOnKey: {line: 44, offset: 154, key: ';'},
    getErrors: {files: ['/home/charly/repo/tsIntelligence/src/test/sample/nonCompleteInit.js'], delay: 1000},
    getErrorsForProject: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        delay: 100
    },
    getSemanticDiagnosticsSync: {filePath: '/home/charly/repo/tsIntelligence/src/test/sample/semantic.ts'},
    getSyntacticDiagnosticsSync: {filePath: '/home/charly/repo/tsIntelligence/src/test/sample/semantic.ts'},
    getSuggestionDiagnosticsSync: {filePath: '/home/charly/repo/tsIntelligence/src/test/sample/semantic.ts'},
    getNavBar: {filePath: '/home/charly/repo/tsIntelligence/src/exp.js'},
    navto: {searchValue: 'getImplementations'},
    getNavTree: {filePath: '/home/charly/repo/tsIntelligence/src/exp.js'},
    getNavTreeFull: {filePath: '/home/charly/repo/tsIntelligence/src/exp.js'},
    documentHighlights: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        line: 71,
        offset: 50,
        filesToSearch: ['/home/charly/repo/tsIntelligence/src/exp.js',
            '/home/charly/repo/tsIntelligence/src/utils/server.js']
    },
    reload: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        tempFilePath: '/home/charly/repo/tsIntelligence/src/exp.js'
    },
    rename: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        line: 4,
        offset: 31,
        findInComments: true,
        findInStrings: true
    },
    saveto: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        tempFilePath: '/home/charly/repo/tsIntelligence/src/exp1.js'
    },
    signatureHelp: {
        filePath: '/home/charly/repo/tsIntelligence/src/exp.js',
        line: 4,
        offset: 41,
        triggerReason: {kind: 'characterTyped', triggerCharacter: '('}
    },
    typeDefinition: {filePath: '/home/charly/repo/tsIntelligence/src/exp.js', line: 8, offset: 22},
    projectInfo: {filePath: '/home/charly/repo/tsIntelligence/src/exp.js', needFileNameList: true},
    openExternalProject: {
        project: {
            projectFileName: "/home/charly/repo/libmysql",
            rootFiles: [{
                fileName: "/home/charly/repo/libmysql/src/index.js",
                scriptKind: "js",
                hasMixedContent: true
            }],
            options: {noImplicitAny: true, strictNullChecks: true},
            typeAcquisition: {enable: true, include: ['node']}

        }
    },
    openExternalProjects: {
        projects: [
            {
                projectFileName: "/home/charly/repo/libcommonutils",
                rootFiles: [{
                    fileName: "/home/charly/repo/libcommonutils/src/index.js",
                    scriptKind: "js",
                    hasMixedContent: true
                }],
                options: {noImplicitAny: true, strictNullChecks: true},
                typeAcquisition: {enable: true, include: ['node']}

            },
            {
                projectFileName: "/home/charly/repo/libtestutils",
                rootFiles: [{
                    fileName: "/home/charly/repo/libtestutils/src/index.js",
                    scriptKind: "js",
                    hasMixedContent: true
                }],
                options: {noImplicitAny: true, strictNullChecks: true},
                typeAcquisition: {enable: true, include: ['node']}

            }
        ]
    },
    updateOpen: {
        openFiles: [{
            fileName: '/home/charly/repo/tsIntelligence/src/test/sample/nonCompleteInit.js'
        }],
        changedFiles: [{
            fileName: '/home/charly/repo/tsIntelligence/src/test/sample/sematic.ts',
            textChanges: [{start: {line: 6, offset: 7}, end: {line: 6, offset: 9}, newText: 'hello'}]
        }],
        closedFiles: ['/home/charly/repo/tsIntelligence/src/exp.js']
    },
    getOutliningSpans: {
        fileName: '/home/charly/repo/tsIntelligence/src/utils/server.js'
    },
    todoComments: {
        fileName: '/home/charly/repo/tsIntelligence/src/utils/server.js',
        descriptors: [{text: 'TODO', priority: 1}, {text: 'FIXME', priority: 2}]
    },
    indentation: {
        fileName: '/home/charly/repo/tsIntelligence/src/exp.js',
        line: 118,
        offset: 10,
        options: {
            indentSize: 4,
            baseIndentSize: 4,
            newLineCharacter: "\n",
            trimTrailingWhitespace: true,
            indentStyle: 1,
            tabSize: 4,
            convertTabsToSpaces: true
        }
    },
    docCommentTemplate: {
        fileName: '/home/charly/repo/tsIntelligence/src/test/sample/doctemplate.ts',
        line: 12,
        offset: 5
    },
    setCompilerOptionsForInferredProjects: {
        options: compilerOption,
        projectRootPath: '/home/charly/repo/tsIntelligence/'
    },
    //TODO: find a working use case and make experiment it
    getCodeFixes: {
        fileName: '/home/charly/repo/tsIntelligence/src/test/sample/sematic.ts',
        startLine: 1,
        startOffset: 1,
        endLine: 14,
        endOffset: 10,
        errorCodes: [1003, 1005]
    },
    //TODO: find a working use case and make experiment it
    getCombinedCodeFix: {
        fixId: "",
        scope: {type: 'file', args: {file: '/home/charly/repo/tsIntelligence/src/test/sample/getCombinedCodeFix.ts'}}
    },
    getSupportedCodeFixes: {file: '/home/charly/repo/tsIntelligence/src/exp.js'},
    getApplicableRefactors: {
        filePath: '/home/charly/repo/tsIntelligence/src/test/sample/getApplicableRefactors.ts',
        line: 2,
        offset: 10,
        triggerReason: 'invoked',
        kind: undefined,
        includeInteractiveActions: true

    },
    //TODO revisit see how to use it with editor
    getEditsForRefactor: {
        filePath: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForRefactor.ts',
        refactor: 'Extract Method',
        action: 'Extract to method in class "Sample"',
        startLine: 7,
        startOffset: 0,
        endLine: 10,
        endOffset: 0,
        interactiveRefactorArguments: {
            targetFile: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForRefactor.ts'
        }
    },
    getMoveToRefactoringFileSuggestions: {
        filePath: '/home/charly/repo/tsIntelligence/src/test/sample/getMoveToRefactoringFileSuggestions.ts',
        startLine: 3,
        startOffset: 1,
        endLine: 6,
        endOffset: 1,
        kind: ""

    },
    organizeImports: {
        filePath: '/home/charly/repo/tsIntelligence/src/test/sample/organizeImports.ts',
        mode: 'All'
    },
    getEditsForFileRename: {
        oldFilePath: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForFileRename/sample.ts',
        newFilePath: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForFileRename/greetings.ts'
    }
}, {
    filepath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
    definition: {line: 49, offset: 36},
    getDefinitionAndBoundSpan: {line: 49, offset: 36},
    getImplementations: {line: 49, offset: 36},
    reference: {line: 49, offset: 36},
    quickInfo: {line: 49, offset: 36},
    findSourceDefinition: {line: 49, offset: 36},
    getCompletionInfo: {line: 40, offset: 40},
    getCompletionDetails: {line: 40, offset: 37},
    format: {line: 9, offset: 0, endLine: 44, endOffset: 0},
    formatOnKey: {line: 23, offset: 76, key: ';'},
    getErrors: {
        files: ['/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'],
        delay: 1000
    },
    getErrorsForProject: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        delay: 100
    },
    getSemanticDiagnosticsSync:
        {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    getSyntacticDiagnosticsSync:
        {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    getSuggestionDiagnosticsSync:
        {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    getNavBar: {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    navto: {searchValue: 'createSys'},
    getNavTree: {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    getNavTreeFull: {filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    documentHighlights: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 38,
        offset: 38,
        filesToSearch: ['/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts']
    },
    reload: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        tempFilePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'
    },
    rename: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 24,
        offset: 27,
        findInComments: true,
        findInStrings: true
    },
    saveto: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        tempFilePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer1.ts'
    },
    signatureHelp: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 35,
        offset: 60,
        triggerReason: {kind: 'invoked', triggerCharacter: undefined}
    },
    typeDefinition: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 23,
        offset: 50
    },
    projectInfo: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        needFileNameList: true
    },
    openExternalProject: {
        project: {
            projectFileName: "/home/charly/repo/vscode/",
            rootFiles: [{
                fileName: "/home/charly/repo/vscode/extensions/css-language-features/server/src/cssServer.ts",
                scriptKind: "ts",
                hasMixedContent: true
            },
                {
                    fileName: "/home/charly/repo/vscode/extensions/css-language-features/client/src/cssClient.ts",
                    scriptKind: "ts",
                    hasMixedContent: true
                }],
            options: {noImplicitAny: true, strictNullChecks: true},
            typeAcquisition: {enable: true, include: ['node']}

        }
    },
    openExternalProjects: {
        projects: [
            {
                projectFileName: "/home/charly/repo/typescript-language-server",
                rootFiles: [{
                    fileName: "/home/charly/repo/typescript-language-server/src/cli.ts",
                    scriptKind: "ts",
                    hasMixedContent: true
                }],
                options: {noImplicitAny: true, strictNullChecks: true},
                typeAcquisition: {enable: true, include: ['node']}

            },
            {
                projectFileName: "/home/charly/repo/vscode-extension-samples/task-provider-sample",
                rootFiles: [{
                    // eslint-disable-next-line max-len
                    fileName: "/home/charly/repo/vscode-extension-samples/task-provider-sample/src/customTaskProvider.ts",
                    scriptKind: "ts",
                    hasMixedContent: true
                }],
                options: {noImplicitAny: true, strictNullChecks: true},
                typeAcquisition: {enable: true, include: ['node']}

            }
        ]
    },
    getOutliningSpans: {
        fileName: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'
    },
    todoComments: {
        fileName: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        descriptors: [{text: 'TODO', priority: 1}, {text: 'FIXME', priority: 2}]
    },
    indentation: {
        fileName: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 118,
        offset: 10,
        options: {
            indentSize: 4,
            baseIndentSize: 4,
            newLineCharacter: "\n",
            trimTrailingWhitespace: true,
            indentStyle: 1,
            tabSize: 4,
            convertTabsToSpaces: true
        }
    },
    docCommentTemplate: {
        fileName: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 47,
        offset: 1
    },
    setCompilerOptionsForInferredProjects: {
        options: compilerOption,
        projectRootPath: '/home/charly/repo/tsIntelligence/'
    },
    //TODO: find a working use case and make experiment it
    getCodeFixes: {
        fileName: '/home/charly/repo/tsIntelligence/src/test/sample/sematic.ts',
        startLine: 1,
        startOffset: 1,
        endLine: 14,
        endOffset: 10,
        errorCodes: [1003, 1005]
    },
    // eslint-disable-next-line max-len
    getSupportedCodeFixes: {file: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts'},
    getApplicableRefactors: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        line: 68,
        offset: 50,
        triggerReason: 'invoked',
        kind: undefined,
        includeInteractiveActions: true

    },
    //TODO revisit see how to use it with editor
    getEditsForRefactor: {
        filePath: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForRefactor.ts',
        refactor: 'Extract Method',
        action: 'Extract to method in class "Sample"',
        startLine: 7,
        startOffset: 0,
        endLine: 10,
        endOffset: 0,
        interactiveRefactorArguments: {
            targetFile: '/home/charly/repo/tsIntelligence/src/test/sample/getEditsForRefactor.ts'
        }
    },
    getMoveToRefactoringFileSuggestions: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        startLine: 62,
        startOffset: 1,
        endLine: 76,
        endOffset: 3,
        kind: ""

    },
    organizeImports: {
        filePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/webServer.ts',
        mode: 'All'
    },
    getEditsForFileRename: {
        oldFilePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/fileWatcherManager.ts',
        newFilePath: '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/fileWatcherManager1.ts'
    }
// TODO: add testcase for update and open
}];
