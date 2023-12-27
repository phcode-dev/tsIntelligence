import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

/**
 * Creates a new instance of TypeScript Server.
 * @returns {Object} An object containing methods to interact with TypeScript Server.
 */
function createTSServerInstance() {
    let tsserverProcess = null;
    let seqNumber = 0;
    const pendingCommands = new Map();

    /**
     * Initializes the TypeScript Server process.
     */
    function initTSServer() {
        return new Promise((resolve, reject) => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const tsserverPath = path.join(__dirname, '..', '..', 'node_modules', 'typescript', 'bin', 'tsserver');
            const nodePath = 'node';
            tsserverProcess = spawn(nodePath, [tsserverPath]);
            tsserverProcess.stdout.setEncoding('utf8');

            tsserverProcess.stdout.on('data', (data) => {
                const lines = data.split('\n');
                console.log(lines);
                for (const line of lines) {
                    if (line.trim().startsWith('{')) {
                        const message = JSON.parse(line.trim());
                        if (message.type === 'event' && message.event === 'typingsInstallerPid') {
                            // Server is ready
                            resolve();
                        }
                        onData(line);
                    }
                }
            });

            tsserverProcess.stderr.on('data', (data) => {
                console.error(`stderr: ${data}`);
            });

            tsserverProcess.on('close', (code) => {
                console.log(`tsserver process exited with code ${code}`);
            });

            // Add a timeout for server initialization
            setTimeout(() => {
                reject(new Error('Timeout waiting for tsserver to be ready'));
            }, 10000); // 10 seconds timeout
        });
    }

    /**
     * Handles incoming data from the TypeScript Server.
     * @param {string} line - A line of data received from tsserver.
     */
    function onData(line) {
        try {
            const response = JSON.parse(line);
            if (response.request_seq !== undefined && pendingCommands.has(response.request_seq)) {
                const {resolve} = pendingCommands.get(response.request_seq);
                pendingCommands.delete(response.request_seq);
                resolve(response);
            }
        } catch (e) {
            console.error('Error parsing line from tsserver:', e);
        }
    }

    /**
     * Sends a command to the TypeScript Server.
     * Special handling for 'open' command as it does not receive a response.
     * @param {Object} command - The command object to send.
     * @param {number} [timeout=5000] - The timeout in milliseconds for the command.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function sendCommand(command, timeout = 5000) {
        if (command.command === "open") {
            // For 'open' command, resolve immediately as no response is expected
            tsserverProcess.stdin.write(`${JSON.stringify(command)}\n`);
            return Promise.resolve();
        }
        return new Promise((resolve, reject) => {
            if (!tsserverProcess) {
                reject(new Error('tsserver is not initialized'));
                return;
            }

            command.seq = ++seqNumber;
            command.type = 'request';
            pendingCommands.set(command.seq, {resolve, reject});

            const timeoutId = setTimeout(() => {
                if (pendingCommands.has(command.seq)) {
                    pendingCommands.delete(command.seq);
                    reject(new Error('tsserver response timeout'));
                }
            }, timeout);

            if (tsserverProcess.stdin.writable) {
                console.log(command);
                tsserverProcess.stdin.write(`${JSON.stringify(command)}\n`);
            } else {
                clearTimeout(timeoutId);
                reject(new Error('tsserver stdin not writable'));
            }
        });
    }

    /**
     * Sends an 'open file' command to the TypeScript Server.
     * @param {string} filePath - The path to the TypeScript file to open.
     * @param {number} timeout - The timeout in milliseconds for the command.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function openFile(filePath, timeout = 5000) {
        const command = {
            command: 'open',
            arguments: {file: filePath}
        };
        return sendCommand(command, timeout);
    }

    /**
     * Sends a 'definition' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getDefinition(filePath, line, offset) {
        const command = {
            command: "definition",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'quickinfo' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getQuickInfo(filePath, line, offset) {
        const command = {
            command: "quickinfo",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }


    /**
     * Sends a 'references' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function findReferences(filePath, line, offset) {
        const command = {
            command: "references",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'FindSourceDefinition' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function findSourceDefinition(filePath, line, offset) {
        const command = {
            command: "findSourceDefinition",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Kills the TypeScript Server process.
     */
    function killTSServer() {
        if (tsserverProcess) {
            tsserverProcess.kill();
            tsserverProcess = null;
            console.log('tsserver process terminated');
        }
    }

    return {
        init: initTSServer,
        openFile,
        killServer: killTSServer,
        getDefinition: getDefinition,
        findReferences: findReferences,
        getQuickInfo: getQuickInfo,
        findSourceDefinition: findSourceDefinition
    };
}

export default createTSServerInstance;
