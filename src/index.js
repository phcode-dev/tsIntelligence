import createTSServerInstance from './utils/startTsserver.js';

const tsServer = createTSServerInstance();
await tsServer.init();
console.log('server intializeed');
await tsServer.openFile( '/home/charly/repo/vscode/extensions/typescript-language-features/web/src/workerSession.ts');

const definitonResp = await tsServer.getDefinition('/home/charly/repo/vscode/extensions/typescript-language-features/web/src/workerSession.ts', 26, 23)
console.log("resp+++", JSON.stringify(definitonResp));

const findReferencesResp = await tsServer.getDefinition('/home/charly/repo/vscode/extensions/typescript-language-features/web/src/workerSession.ts', 11, 16)
console.log('find reference resp',JSON.stringify(findReferencesResp))
//await tsServer.killServer();


// Initialize tsserver
/*
tsServer.init()
    .then(() => {
        console.log('tsserver is ready');

        // Path to the TypeScript file you want to open
        const filePath = '/home/charly/repo/tsIntelligence/src/utils/startTsserver.js ';

        // Open a TypeScript file
        return tsServer.openFile(filePath, 10000); // Set a 10-second timeout for response
    })
    .then(response => {
        console.log('File opened successfully:', response);
        // Handle the response for opening the file

        // Optionally, you can kill the server after processing the response
        // tsServer.killServer();
    })
    .catch(error => {
        console.error('Error:', error);
    });
*/
