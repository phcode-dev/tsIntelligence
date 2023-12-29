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
    //await tsServer.getErrors(file.getErrors.files, file.getErrors.delay);

    //await tsServer.getErrorsForProject(file.getErrorsForProject.filePath, file.getErrorsForProject.delay);

   // await tsServer.openFile(file.getSemanticDiagnosticsSync.filePath);
    const getSemanticDiagnosticsSyncResp = await tsServer.getSemanticDiagnosticsSync(file.getSemanticDiagnosticsSync.filePath, true);
    console.log('getSemanticDiagnosticsSyncResp', JSON.stringify(getSemanticDiagnosticsSyncResp));
}
//tsServer.exitServer();
