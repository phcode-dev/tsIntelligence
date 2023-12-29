import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

// @INCLUDE_IN_API_DOCS
/**
 * Creates a new instance of TypeScript Server.
 * @returns {Object} An object containing methods to interact with TypeScript Server.
 */
function createTSServerInstance() {
    let tsserverProcess = null;
    let seqNumber = 0;
    const pendingCommands = new Map();
    let buffer = '';
    let expectedLength = 0;
    const CONNECT_MESSAGE_KEY = -1;

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

            pendingCommands.set(CONNECT_MESSAGE_KEY, {resolve, reject});
            tsserverProcess.stdout.on('data', (data) => {
                onData(data);
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
     * @param {string} rawData - Raw data received from tsserver.
     */
    function onData(rawData) {
        buffer += rawData;
        // Check if we have received the complete message based on Content-Length
        while (hasCompleteMessage()) {
            const headerEndIndex = buffer.indexOf('\r\n\r\n') + 4; // +4 to move past the \r\n\r\n
            const message = buffer.substring(headerEndIndex, headerEndIndex + expectedLength);
            buffer = buffer.substring(headerEndIndex + expectedLength);
            expectedLength = 0; // Reset for the next message
            processMessage(message);
        }
    }

    /**
     * Processes a complete message from tsserver.
     * @param {string} message - A complete message in JSON format.
     */
    function processMessage(message) {
        try {
            console.log("++++++++++", message);
            const response = JSON.parse(message);
            if (response.type === 'event' && response.event === 'typingsInstallerPid') {
                // Server is ready
                const {resolve} = pendingCommands.get(CONNECT_MESSAGE_KEY);
                pendingCommands.delete(CONNECT_MESSAGE_KEY);
                resolve();
                return;
            }

            if (response.request_seq !== undefined && pendingCommands.has(response.request_seq)) {
                const {resolve} = pendingCommands.get(response.request_seq);
                pendingCommands.delete(response.request_seq);
                resolve(response);
            }
        } catch (e) {
            console.error('Error parsing message from tsserver:', e);
        }
    }

    /**
     * Checks if the buffer has a complete message based on Content-Length.
     * @returns {boolean} True if a complete message is present in the buffer.
     */
    function hasCompleteMessage() {
        if (!expectedLength) {
            const headerEndIndex = buffer.indexOf('\r\n\r\n');
            if (headerEndIndex !== -1) {
                const header = buffer.substring(0, headerEndIndex);
                const contentLengthMatch = header.match(/Content-Length: (\d+)/);
                if (contentLengthMatch) {
                    expectedLength = parseInt(contentLengthMatch[1], 10);
                }
            }
        }
        return buffer.length >= expectedLength + buffer.indexOf('\r\n\r\n') + 4; // +4 for header's \r\n\r\n
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
     * Sends a 'completionInfo' command to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getCompletionInfo(filePath, line, offset) {
        const command = {
            command: "completionInfo",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'completionEntryDetails' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @param {string} entryName - The name of the completion entry.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getCompletionDetails(filePath, line, offset, entryName) {
        const command = {
            command: "completionEntryDetails",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                entryNames: [entryName]
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'compileOnSaveAffectedFileList' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getCompileOnSaveAffectedFileList(filePath) {
        const command = {
            command: "compileOnSaveAffectedFileList",
            arguments: {
                file: filePath
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'compileOnSaveEmitFile' command to the TypeScript Server.
     * @param {string} filePath - The path to the TypeScript file.
     * @param {boolean} [forced=false] - Force emit even if there are errors.
     * @param {boolean} [includeLinePosition=false] - Include line position in the response.
     * @param {boolean} [richResponse=false] - If true, returns response as an object with detailed emit results.
     * @returns {Promise<boolean | EmitResult>} A promise that resolves with a boolean indicating success
     *          or an EmitResult object containing detailed information about the emit process.
     *          - If a boolean: true if the emit was successful, false otherwise.
     *          - If an EmitResult object:
     *            - `emitSkipped`: A boolean indicating whether the emit was skipped.
     *            - `diagnostics`: An array of Diagnostic or DiagnosticWithLinePosition objects, providing
     *                            detailed information about each diagnostic message.
     *            - `Diagnostic`: An object representing a diagnostic message, typically containing:
     *              - `start`: The starting position of the diagnostic message.
     *              - `length`: The length of the diagnostic message.
     *              - `text`: The text of the diagnostic message.
     *            - `DiagnosticWithLinePosition`: An extended version of Diagnostic, including line and
     *                                           character position information:
     *              - `start`: The starting position of the diagnostic message (line and character).
     *              - `end`: The ending position of the diagnostic message (line and character).
     *              - `text`: The text of the diagnostic message.
     */
    function compileOnSaveEmitFile(filePath, forced = false, includeLinePosition = false, richResponse = false) {
        const command = {
            command: "compileOnSaveEmitFile",
            arguments: {
                file: filePath,
                forced: forced,
                includeLinePosition: includeLinePosition,
                richResponse: richResponse
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'definitionAndBoundSpan' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getDefinitionAndBoundSpan(filePath, line, offset) {
        const command = {
            command: "definitionAndBoundSpan",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'implementation' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} line - The line number of the position.
     * @param {number} offset - The offset in the line of the position.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function getImplementations(filePath, line, offset) {
        const command = {
            command: "implementation",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'format' request to the TypeScript Server.
     * @param {string} filePath - The path to the file.
     * @param {number} startLine - The starting line number of the format range.
     * @param {number} startOffset - The starting offset in the start line.
     * @param {number} endLine - The ending line number of the format range.
     * @param {number} endOffset - The ending offset in the end line.
     * @param {object} [formatOptions] - Optional formatting options.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function format(filePath, startLine, startOffset, endLine, endOffset, formatOptions = {}) {
        const command = {
            command: "format",
            arguments: {
                file: filePath,
                line: startLine,
                offset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                options: formatOptions
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
     * Sends a 'formatonkey' request to the TypeScript Server. This command is used
     * for formatting code at a specific position in a file, typically in response
     * to a keystroke. It's commonly used for auto-formatting a line of code when
     * a specific key (like a closing brace or semi-colon) is pressed.
     *
     * @param {string} filePath - The path to the TypeScript file. The path should
     *                            be absolute or relative to the TypeScript server's
     *                            current working directory.
     * @param {number} line - The 1-based line number in the file where the key was
     *                        pressed. This and the offset together point to the
     *                        specific position in the file.
     * @param {number} offset - The 1-based character offset in the line where the
     *                          key was pressed. This is typically the position
     *                          right after where the key was pressed.
     * @param {string} key - The character corresponding to the key pressed. This
     *                       is typically a single character like ';' or '}' that
     *                       triggers the formatting action.
     * @param {object} [formatOptions] - Optional formatting options to customize
     *                                   the formatting behavior. These options might
     *                                   include settings like tab size, indent size,
     *                                   whether to insert spaces, and so on.
     *                                   Example: { tabSize: 4, indentSize: 4, insertSpace: true }
     *
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     *                            The response typically includes an array of code edits
     *                            that should be applied to the file to achieve the
     *                            desired formatting. Each edit suggests changes like
     *                            text insertions, deletions, or replacements.
     */
    function formatOnKey(filePath, line, offset, key, formatOptions = {}) {
        const command = {
            command: "formatonkey",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                key: key,
                options: formatOptions
            }
        };
        return sendCommand(command);
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
            console.log('tsserver pgetCompletionDetailsrocess terminated');
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
        getCompletionInfo,
        getCompletionDetails,
        getCompileOnSaveAffectedFileList,
        compileOnSaveEmitFile,
        getDefinitionAndBoundSpan,
        getImplementations,
        format,
        formatOnKey,
        exitServer
    };
}

export default createTSServerInstance;
