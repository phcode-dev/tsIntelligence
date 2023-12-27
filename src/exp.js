import createTSServerInstance from './utils/server.js';
import {FILES} from "./utils/testconfig.js";

const tsServer = createTSServerInstance();
await tsServer.init();
console.log('server intializeed');

for (let file of FILES) {
    await tsServer.openFile(file.filepath);

    const definitonResp = await tsServer.getDefinition(file.filepath, file.definition.line, file.definition.offset);
    console.log("resp+++", JSON.stringify(definitonResp));

    const findReferencesResp = await tsServer.findReferences(file.filepath, file.reference.line, file.reference.offset);
    console.log('find reference resp', JSON.stringify(findReferencesResp));
//await tsServer.killServer();
    const quickInfoResp = await tsServer.getQuickInfo(file.filepath, file.quickInfo.line, file.quickInfo.offset);
    console.log('quickInfoResp', JSON.stringify(quickInfoResp));

    const findSourceDefinitionResp = await tsServer.findSourceDefinition(file.filepath, file.findSourceDefinition.line, file.findSourceDefinition.offset);
    console.log('findSourceDefinitionResp', JSON.stringify(findSourceDefinitionResp));
}
