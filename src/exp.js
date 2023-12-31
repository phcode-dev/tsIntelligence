import createTSServerInstance from './utils/server.js';
import {FILES} from "./utils/testconfig.js";

const tsServer = createTSServerInstance();
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



}
//tsServer.exitServer();
