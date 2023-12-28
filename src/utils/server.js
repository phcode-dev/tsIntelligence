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
     * Initializes the TypeScript Server instance.
     *
     * This function starts a new process for the TypeScript Server using Node's `child_process.spawn`.
     * It sets up listeners for the 'stdout' and 'stderr' streams of the TypeScript Server process,
     * handling incoming data and errors respectively. It also handles the 'close' event of the process.
     * The function configures a timeout to reject the promise if the server does not start within a specified time.
     *
     * @param {string} [node=""] - The path to the Node.js executable. If not provided, defaults to 'node'.
     * @param {string} [tsServer=""] - The path to the TypeScript Server executable. If not provided,
     *                                  defaults to the 'tsserver' path in the 'node_modules' directory.
     * @returns {Promise<void>} A promise that resolves when the TypeScript Server is ready,
     *                          or rejects if there is an error or timeout.
     */
    function initTSServer(node = "", tsServer = "") {
        return new Promise((resolve, reject) => {
            const __dirname = path.dirname(fileURLToPath(import.meta.url));
            const tsserverPath = (tsServer) ? tsServer : path.join(__dirname, '..', '..', 'node_modules', 'typescript', 'bin', 'tsserver');
            const nodePath = (!node) ? 'node' : node;
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
     * Sends a 'change' command to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {Object} start - The start position of the change (line and offset).
     * @param {Object} end - The end position of the change (line and offset).
     * @param {string} newText - The new text to replace in the range.
     */
    function sendChange(filePath, start, end, newText) {
        const command = {
            command: "change",
            arguments: {
                file: filePath,
                line: start.line,
                offset: start.offset,
                endLine: end.line,
                endOffset: end.offset,
                insertString: newText
            }
        };
        // The 'change' command does not require a response from the server
        if (tsserverProcess && tsserverProcess.stdin.writable) {
            tsserverProcess.stdin.write(`${JSON.stringify(command)}\n`);
        }
    }

    /**
     * Sends a 'close' command to the TypeScript Server.
     * @param {string} filePath - The path to the file being closed.
     */
    function closeFile(filePath) {
        const command = {
            command: "close",
            arguments: {
                file: filePath
            }
        };
        // The 'close' command does not require a response from the server
        if (tsserverProcess && tsserverProcess.stdin.writable) {
            tsserverProcess.stdin.write(`${JSON.stringify(command)}\n`);
        }
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
     * Sends an 'exit' command to the TypeScript Server to gracefully shut it down.
     * @function exitServer
     */
    function exitServer() {
        if (tsserverProcess && tsserverProcess.stdin.writable) {
            const command = {
                command: "exit"
            };
            tsserverProcess.stdin.write(`${JSON.stringify(command)}\n`);
        }
        tsserverProcess = null;
    }

    /**
     * Terminates the TypeScript Server process.
     * Warning: Use this function with caution. Prefer using the exitServer function for a graceful shutdown.
     * @see exitServer - Sends an 'exit' command to the TypeScript Server for a graceful shutdown.
     * @function killTSServer
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
        sendChange,
        closeFile,
        killServer: killTSServer,
        getDefinition,
        findReferences,
        getQuickInfo,
        findSourceDefinition,
        exitServer
    };
}

export default createTSServerInstance;
