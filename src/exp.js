import createTSServerInstance from './utils/server.js';
import {FILES} from "./utils/testconfig.js";

const tsServer = createTSServerInstance(false);
await tsServer.init();
console.log('server intializeed');

for (let file of FILES) {
    tsServer.openFile(file.filepath);

    const definitonResp = await tsServer.getDefinition(file.filepath, file.definition.line, file.definition.offset);
    console.log("resp+++", JSON.stringify(definitonResp));

    const findReferencesResp = await tsServer.findReferences(file.filepath, file.reference.line, file.reference.offset);
    console.log('find reference resp', JSON.stringify(findReferencesResp));
//await tsServer.killServer();
    const quickInfoResp = await tsServer.getQuickInfo(file.filepath, file.quickInfo.line, file.quickInfo.offset);
    console.log('quickInfoResp', JSON.stringify(quickInfoResp));

    const findSourceDefinitionResp = await tsServer.findSourceDefinition(file.filepath, file.findSourceDefinition.line, file.findSourceDefinition.offset);
    console.log('findSourceDefinitionResp', JSON.stringify(findSourceDefinitionResp));

    const completionInfoResp = await tsServer.getCompletionInfo(file.filepath, file.getCompletionInfo.line, file.getCompletionInfo.offset);
    console.log('completionInfoResp', JSON.stringify(completionInfoResp));

    const getCompletionDetailsResp = await tsServer.getCompletionDetails(file.filepath, file.getCompletionDetails.line, file.getCompletionDetails.offset, completionInfoResp.body.entries[0].name);
    console.log('getCompletionDetailsResp', JSON.stringify(getCompletionDetailsResp));

    const getCompileOnSaveResp = await tsServer.getCompileOnSaveAffectedFileList(file.filepath);
    console.log('getCompileOnSaveResp', JSON.stringify(getCompileOnSaveResp));

    const compileOnSaveEmitFileResp = await tsServer.compileOnSaveEmitFile(file.filepath);
    console.log('compileOnSaveEmitFileResp', JSON.stringify(compileOnSaveEmitFileResp));

    const getDefinitionAndBoundSpanResp = await tsServer.getDefinitionAndBoundSpan(file.filepath, file.getDefinitionAndBoundSpan.line, file.getDefinitionAndBoundSpan.offset);
    console.log('getDefinitionAndBoundSpanResp', JSON.stringify(getDefinitionAndBoundSpanResp));

    const getImplementationsResp = await tsServer.getImplementations(file.filepath, file.getImplementations.line, file.getImplementations.offset);
    console.log('getImplementationsResp', JSON.stringify(getImplementationsResp));

    const formatResp = await tsServer.format(file.filepath, file.format.line, file.format.offset, file.format.endLine, file.format.endOffset);
    console.log('formatResp', JSON.stringify(formatResp));

    const formatOnKeyResp = await tsServer.formatOnKey(file.filepath, file.formatOnKey.line, file.formatOnKey.offset, file.formatOnKey.key);
    console.log('formatOnKeyResp', JSON.stringify(formatOnKeyResp));

    for (const sample of file.getErrors.files) {
        await tsServer.openFile(sample);
    }
    // await tsServer.getErrors(file.getErrors.files, file.getErrors.delay);
    //
    // await tsServer.getErrorsForProject(file.getErrorsForProject.filePath, file.getErrorsForProject.delay);

    await tsServer.openFile(file.getSemanticDiagnosticsSync.filePath);
    const getSemanticDiagnosticsSyncResp = await tsServer.getSemanticDiagnosticsSync(file.getSemanticDiagnosticsSync.filePath, true);
    console.log('getSemanticDiagnosticsSyncResp', JSON.stringify(getSemanticDiagnosticsSyncResp));
    const getSyntacticDiagnosticsSyncResp = await tsServer.getSyntacticDiagnosticsSync(file.getSemanticDiagnosticsSync.filePath, true);
    console.log('getSyntacticDiagnosticsSyncResp', JSON.stringify(getSyntacticDiagnosticsSyncResp));
    const getSuggestionDiagnosticsSyncResp = await tsServer.getSuggestionDiagnosticsSync(file.getSuggestionDiagnosticsSync.filePath, true);
    console.log('getSuggestionDiagnosticsSyncResp', JSON.stringify(getSuggestionDiagnosticsSyncResp));

    const getNavBarResp = await tsServer.getNavBar(file.getNavBar.filePath);
    console.log('getNavBarResp', JSON.stringify(getNavBarResp));

    const navTorResp = await tsServer.navTo(file.navto.searchValue);
    console.log('navTorResp', JSON.stringify(navTorResp));

    const getNavTreeResp = await tsServer.getNavTree(file.getNavTree.filePath);
    console.log('getNavTreeResp', JSON.stringify(getNavTreeResp));

    const getNavTreeFullResp = await tsServer.getNavTree(file.getNavTreeFull.filePath);
    console.log('getNavTreeFullResp', JSON.stringify(getNavTreeFullResp));

    const documentHighlightsResp = await tsServer.documentHighlights(file.documentHighlights.filePath, file.documentHighlights.line, file.documentHighlights.offset, file.documentHighlights.filesToSearch);
    console.log('documentHighlightsResp', JSON.stringify(documentHighlightsResp));

    const reloadResp = await tsServer.reload(file.reload.filePath, file.reload.tempFilePath);
    console.log('reloadResp', JSON.stringify(reloadResp));

    const renameResp = await tsServer.rename(file.rename.filePath, file.rename.line, file.rename.offset, file.rename.findInComments, file.rename.findInStrings);
    console.log('renameResp', JSON.stringify(renameResp));

    await tsServer.saveto(file.saveto.filePath, file.saveto.tempFilePath);

    const signatureHelpResp = await tsServer.signatureHelp(file.signatureHelp.filePath, file.signatureHelp.line, file.signatureHelp.offset, file.signatureHelp.triggerReason);
    console.log('signatureHelpResp', JSON.stringify(signatureHelpResp));

    const statusResp = await tsServer.status();
    console.log('statusResp', JSON.stringify(statusResp));

    const typeDefinitionResp = await tsServer.typeDefinition(file.typeDefinition.filePath, file.typeDefinition.line, file.typeDefinition.offset);
    console.log('typeDefinitionResp', JSON.stringify(typeDefinitionResp));

    const projectInfoResp = await tsServer.projectInfo(file.projectInfo.filePath, file.projectInfo.needFileNameList);
    console.log('projectInfoResp', JSON.stringify(projectInfoResp));

    await tsServer.reloadProjects();

    const openExternalProjectResp = await tsServer.openExternalProject(file.openExternalProject.project);
    console.log('openExternalProjectResp', JSON.stringify(openExternalProjectResp));

    const openExternalProjectsResp = await tsServer.openExternalProjects(file.openExternalProjects.projects);
    console.log('openExternalProjectsResp', JSON.stringify(openExternalProjectsResp));

    const closeExternalProjectResp = await tsServer.closeExternalProject(file.openExternalProject.project.projectFileName);
    console.log('closeExternalProjectResp ', JSON.stringify(closeExternalProjectResp));

    for (const project of file.openExternalProjects.projects) {
        const closeExternalProjectResp = await tsServer.closeExternalProject(project.projectFileName);
        console.log('closeExternalProjectResp ', JSON.stringify(closeExternalProjectResp));
    }
    /* await  tsServer.openFile(file.updateOpen.openFiles.fileName)
     const updateOpenResp = await tsServer.updateOpen(file.updateOpen.openFiles, file.updateOpen.changedFiles, file.updateOpen.closedFiles);
     console.log('updateOpenResp ', JSON.stringify(updateOpenResp));*/
    const getOutliningSpansResponse = await tsServer.getOutliningSpans(file.getOutliningSpans.fileName);
    console.log('getOutliningSpansResponse', JSON.stringify(getOutliningSpansResponse));
    const todoCommentsResponse = await tsServer.todoComments(file.todoComments.fileName, file.todoComments.descriptors);
    console.log('todoCommentsResponse', JSON.stringify(todoCommentsResponse));

    const indentationsResponse = await tsServer.indentation(file.indentation.fileName, file.indentation.line, file.indentation.offset, file.indentation.options);
    console.log('indentationsResponse', JSON.stringify(indentationsResponse));

    await tsServer.openFile(file.docCommentTemplate.fileName);
    const docCommentTemplateResponse = await tsServer.docCommentTemplate(file.docCommentTemplate.fileName, file.docCommentTemplate.line, file.docCommentTemplate.offset);
    console.log('docCommentTemplateResponse', JSON.stringify(docCommentTemplateResponse));

    /*const setCompilerOptionsForInferredProjectsResponse = await tsServer.setCompilerOptionsForInferredProjects(file.setCompilerOptionsForInferredProjects.options, file.setCompilerOptionsForInferredProjects.projectRootPath);
    console.log('setCompilerOptionsForInferredProjectsResponse', JSON.stringify(setCompilerOptionsForInferredProjectsResponse));*/

    //TODO: Revisit
    /* await tsServer.openFile(file.getCodeFixes.fileName);
     const getCodeFixesResponse = await tsServer.getCodeFixes(file.getCodeFixes.fileName, file.getCodeFixes.startLine, file.getCodeFixes.endLine, file.getCodeFixes.endLine, file.getCodeFixes.endOffset, file.getCodeFixes.errorCodes);
     console.log('getCodeFixesResponse', JSON.stringify(getCodeFixesResponse));*/

    // TODO: Revisit as it is used along with getCodeFixes in vscode
    /*   await tsServer.openFile(file.getCombinedCodeFix.scope.args.file);
       const getCombinedCodeFixResponse = await tsServer.getCombinedCodeFix(file.getCombinedCodeFix.fileName, file.getCombinedCodeFix.fixId, file.getCombinedCodeFix.scope);
       console.log('getCombinedCodeFixResponse', JSON.stringify(getCombinedCodeFixResponse));*/

    const getSupportedCodeFixesResponse = await tsServer.getSupportedCodeFixes(file.getSupportedCodeFixes.file);
    console.log('getSupportedCodeFixesResponse', JSON.stringify(getSupportedCodeFixesResponse));

    await tsServer.openFile(file.getApplicableRefactors.filePath);
    const getApplicableRefactorsResponse = await tsServer.getApplicableRefactors(file.getApplicableRefactors.filePath, file.getApplicableRefactors.line, file.getApplicableRefactors.offset/*, file.getApplicableRefactors.triggerReason, file.getApplicableRefactors.kind, file.getApplicableRefactors.includeInteractiveActions*/);
    console.log('getApplicableRefactorsResponse', JSON.stringify(getApplicableRefactorsResponse));

    //TODO: Write working use case with editor
    await tsServer.openFile(file.getEditsForRefactor.filePath);
    const getEditsForRefactorResponse = await tsServer.getEditsForRefactor(file.getEditsForRefactor.filePath, file.getEditsForRefactor.refactor, file.getEditsForRefactor.action, file.getEditsForRefactor.startLine, file.getEditsForRefactor.startOffset, file.getEditsForRefactor.endLine, file.getEditsForRefactor.endOffset, file.getEditsForRefactor.interactiveRefactorArguments);
    console.log('getEditsForRefactorResponse', JSON.stringify(getEditsForRefactorResponse));

    await tsServer.openFile(file.getMoveToRefactoringFileSuggestions.filePath);
    const getMoveToRefactoringFileSuggestionsResponse = await tsServer.getMoveToRefactoringFileSuggestions(file.getMoveToRefactoringFileSuggestions.filePath, file.getMoveToRefactoringFileSuggestions.startLine, file.getMoveToRefactoringFileSuggestions.startOffset, file.getMoveToRefactoringFileSuggestions.endLine, file.getMoveToRefactoringFileSuggestions.endOffset/*,file.getMoveToRefactoringFileSuggestions.kind*/);
    console.log('getMoveToRefactoringFileSuggestionsResponse', JSON.stringify(getMoveToRefactoringFileSuggestionsResponse));

    await tsServer.openFile(file.organizeImports.filePath);
    const organizeImportsResponse = await tsServer.organizeImports(file.organizeImports.filePath, file.organizeImports.mode);
    console.log('organizeImportsResponse', JSON.stringify(organizeImportsResponse));

    await tsServer.openFile(file.getEditsForFileRename.oldFilePath);
    const getEditsForFileRenameResponse = await tsServer.getEditsForFileRename(file.getEditsForFileRename.oldFilePath, file.getEditsForFileRename.newFilePath);
    console.log('getEditsForFileRenameResponse', JSON.stringify(getEditsForFileRenameResponse));

    await tsServer.openFile(file.selectionRange.filePath);
    const selectionRangeResponse = await tsServer.selectionRange(file.selectionRange.filePath, file.selectionRange.locations);
    console.log('selectionRangeResponse', JSON.stringify(selectionRangeResponse));

    await tsServer.openFile(file.toggleLineComment.filePath);
    const toggleLineCommentResponse = await tsServer.toggleLineComment(file.toggleLineComment.filePath, file.toggleLineComment.startLine, file.toggleLineComment.startOffset, file.toggleLineComment.endLine, file.toggleLineComment.endOffset);
    console.log('toggleLineCommentResponse', JSON.stringify(toggleLineCommentResponse));

    const toggleMultilineCommentResponse = await tsServer.toggleMultilineComment(file.toggleLineComment.filePath, file.toggleLineComment.startLine, file.toggleLineComment.startOffset, file.toggleLineComment.endLine, file.toggleLineComment.endOffset);
    console.log('toggleMultilineCommentResponse', JSON.stringify(toggleMultilineCommentResponse));

    const commentSelectionResponse = await tsServer.commentSelection(file.toggleLineComment.filePath, file.toggleLineComment.startLine, file.toggleLineComment.startOffset, file.toggleLineComment.endLine, file.toggleLineComment.endOffset);
    console.log('commentSelectionResponse', JSON.stringify(commentSelectionResponse));

    const uncommentSelectionResponse = await tsServer.uncommentSelection(file.toggleLineComment.filePath, file.toggleLineComment.startLine, file.toggleLineComment.startOffset, file.toggleLineComment.endLine, file.toggleLineComment.endOffset);
    console.log('uncommentSelectionResponse', JSON.stringify(uncommentSelectionResponse));

    await tsServer.openFile(file.prepareCallHierarchy.filePath);
    const prepareCallHierarchyResponse = await tsServer.prepareCallHierarchy(file.prepareCallHierarchy.filePath, file.prepareCallHierarchy.line, file.prepareCallHierarchy.offset);
    console.log('prepareCallHierarchyResponse', JSON.stringify(prepareCallHierarchyResponse));

    await tsServer.openFile(file.prepareCallHierarchy.filePath);
    const provideCallHierarchyIncomingCallsResponse = await tsServer.provideCallHierarchyIncomingCalls(file.prepareCallHierarchy.filePath, file.prepareCallHierarchy.line, file.prepareCallHierarchy.offset);
    console.log('provideCallHierarchyIncomingCallsResponse', JSON.stringify(provideCallHierarchyIncomingCallsResponse));

    await tsServer.openFile(file.prepareCallHierarchy.filePath);
    const provideCallHierarchyOutgoingCallsResponse = await tsServer.provideCallHierarchyOutgoingCalls(file.prepareCallHierarchy.filePath, file.prepareCallHierarchy.line, file.prepareCallHierarchy.offset);
    console.log('provideCallHierarchyOutgoingCallsResponse', JSON.stringify(provideCallHierarchyOutgoingCallsResponse));
}
//tsServer.exitServer();
