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
    console.assert('completionInfoResp', JSON.stringify(completionInfoResp));

    const getCompletionDetailsResp = await tsServer.getCompletionDetails(file.filepath, file.getCompletionDetails.line, file.getCompletionDetails.offset, completionInfoResp.body.entries[0].name);
    console.assert('getCompletionDetailsResp', JSON.stringify(getCompletionDetailsResp));

    const getCompileOnSaveResp = await tsServer.getCompileOnSaveAffectedFileList(file.filepath);
    console.assert('getCompileOnSaveResp', JSON.stringify(getCompileOnSaveResp));

    const compileOnSaveEmitFileResp = await tsServer.compileOnSaveEmitFile(file.filepath);
    console.assert('compileOnSaveEmitFileResp', JSON.stringify(compileOnSaveEmitFileResp));

    const getDefinitionAndBoundSpanResp = await tsServer.getDefinitionAndBoundSpan(file.filepath, file.getDefinitionAndBoundSpan.line, file.getDefinitionAndBoundSpan.offset);
    console.assert('getDefinitionAndBoundSpanResp', JSON.stringify(getDefinitionAndBoundSpanResp));

    const getImplementationsResp = await tsServer.getImplementations(file.filepath, file.getImplementations.line, file.getImplementations.offset);
    console.assert('getImplementationsResp', JSON.stringify(getImplementationsResp));

    const formatResp = await tsServer.format(file.filepath, file.format.line, file.format.offset, file.format.endLine, file.format.endOffset);
    console.assert('formatResp', JSON.stringify(formatResp));

    const formatOnKeyResp = await tsServer.formatOnKey(file.filepath, file.formatOnKey.line, file.formatOnKey.offset, file.formatOnKey.key);
    console.assert('formatOnKeyResp', JSON.stringify(formatOnKeyResp));


}
tsServer.exitServer();
