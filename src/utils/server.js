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
        if (command.command === "open" || command.command === "geterr" || command.command === "geterrForProject" || command.command === "saveto") {
            // For 'open' command, resolve immediately as no response is expected
            // geterr and geterrForProject returns result as events so resolve geterr and wait for response in events
            // saveTo command also does not return any response
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
     * Sends a 'references' request to the TypeScript Server. This command is used to
     * find all references to a symbol at a specified position in a file. It's commonly
     * used to identify where a variable, function, class, or other symbol is used throughout
     * the codebase.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The line number where the symbol is located.
     * @param {number} offset - The character offset (position) in the line where the symbol is located.
     *
     * @returns {Promise<Object[]>} A promise that resolves with an array of reference items.
     * Each item represents a reference to the symbol and includes:
     *  - `file`: The file in which the reference occurs.
     *  - `start`: The starting position of the reference (line and character).
     *  - `end`: The ending position of the reference (line and character).
     *  - `lineText`: The text of the line containing the reference.
     *  - `isWriteAccess`: A boolean indicating if the reference is a write access (modification).
     *  - `isDefinition`: A boolean indicating if the reference is the definition of the symbol.
     *
     * Example usage:
     * ```
     * references('path/to/file.ts', 10, 5).then(refs => {
     *   console.log('Symbol references:', refs);
     * });
     * ```
     * This function is crucial for understanding how and where symbols are used in a project,
     * facilitating code comprehension and refactoring.
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
     * Sends a 'findSourceDefinition' request to the TypeScript Server. This command is utilized to
     * locate the original source definition of a symbol at a given position in a TypeScript file. It
     * is particularly useful for tracing the origin of symbols, especially in cases where symbols are
     * re-exported, helping developers navigate to the actual definition rather than a re-exported reference.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The line number where the symbol whose definition is to be found is located.
     * @param {number} offset - The character offset within the line where the symbol is located.
     *
     * @returns {Promise<Object>} A promise that resolves with the location information of the symbol's
     *                            source definition. The response object typically includes:
     *                            - `file`: String indicating the file path where the source definition is located.
     *                            - `start`: Object representing the start position of the definition, containing:
     *                              - `line`: The line number of the start position (1-based).
     *                              - `offset`: The character offset at the start line (1-based).
     *                            - `end`: Object representing the end position of the definition, similar in structure
     *                                     to the `start` object.
     *
     * Example usage:
     * ```
     * findSourceDefinition('path/to/file.ts', 10, 5).then(definition => {
     *   console.log('Source definition location:', definition);
     * });
     * ```
     * This function is essential for developers in complex TypeScript projects, providing a means to
     * quickly navigate to the original declaration of symbols, enhancing code understanding and navigation.
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
     * Sends a 'geterr' request to the TypeScript Server. This command instructs the server to compute and
     * return errors (diagnostics) for the specified files. The diagnostics are not returned directly by this
     * function but are instead sent back by the server as separate events or messages. This function is useful
     * for asynchronously obtaining diagnostic information like errors and warnings from the server.
     *
     * @param {string[]} filePaths - An array of paths to the files for which to get errors. Each path should
     *                               be either absolute or relative to the TypeScript server's current working directory.
     * @param {number} delay - The delay in milliseconds to wait before the server processes the request.
     *                         This delay can be used to batch or throttle error requests, especially when dealing
     *                         with a large number of file changes or edits.
     *
     * @returns {Promise<void>} A promise that resolves when the command has been sent to the server. The resolution
     *                          of this promise indicates that the request was successfully dispatched, but it does not
     *                          imply that the errors have been received. The actual errors (diagnostics) will be sent
     *                          back by the server asynchronously as separate events or messages, which should be handled
     *                          separately in the client's message handling logic.
     *
     * Example usage:
     * ```
     * getErrors(['path/to/file1.ts', 'path/to/file2.ts'], 500).then(() => {
     *   console.log('Error request sent. Waiting for diagnostics...');
     * });
     * ```
     * Note: The client should implement additional logic to listen for and handle the diagnostic events
     *       or messages sent by the server in response to this request.
     */
    function getErrors(filePaths, delay) {
        const command = {
            command: "geterr",
            arguments: {
                files: filePaths,
                delay: delay
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'geterrForProject' request to the TypeScript Server. This command instructs the server to compute and
     * return errors (diagnostics) for all files in a specific project. The diagnostics are not returned directly by this
     * function but are instead sent back by the server as separate events or messages. This function is useful
     * for asynchronously obtaining a comprehensive diagnostic overview of an entire project.
     *
     * @param {string} filePath - The path to any file within the project. The server uses this file to identify
     *                            the project context. The path should be absolute or relative to the TypeScript
     *                            server's current working directory.
     * @param {number} delay - The delay in milliseconds before the server processes the request.
     *                         This delay can be used to batch or throttle diagnostic requests, especially useful
     *                         when dealing with large projects or numerous file changes.
     *
     * @returns {Promise<void>} A promise that resolves when the command has been sent to the server. The resolution
     *                          of this promise indicates that the request was successfully dispatched, but it does not
     *                          imply that the errors have been received. The actual errors (diagnostics) for the entire
     *                          project will be sent back by the server asynchronously as separate events or messages,
     *                          which should be handled separately in the client's message handling logic.
     *
     * Example usage:
     * ```
     * getErrorsForProject('path/to/anyFileInProject.ts', 500).then(() => {
     *   console.log('Project error request sent. Waiting for diagnostics...');
     * });
     * ```
     * Note: The client should implement additional logic to listen for and handle the diagnostic events
     *       or messages sent by the server in response to this request. These diagnostics will cover
     *       the entire scope of the project associated with the provided file path.
     */
    function getErrorsForProject(filePath, delay) {
        const command = {
            command: "geterrForProject",
            arguments: {
                file: filePath,
                delay: delay
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'semanticDiagnosticsSync' request to the TypeScript Server. This command is used
     * to synchronously request semantic diagnostics (such as type errors) for a specific file.
     * It's useful when immediate and up-to-date semantic error information is needed for a file,
     * such as during file saves or build operations.
     *
     * @param {string} filePath - The path to the TypeScript file for which semantic diagnostics are requested.
     *                            The path should be absolute or relative to the TypeScript server's current
     *                            working directory.
     * @param {boolean} [includeLinePosition=false] - If set to true, the response will include detailed line
     *                                                and character position information for each diagnostic.
     *                                                This is useful for integrations that require precise
     *                                                location data, such as IDEs or advanced text editors.
     *
     * @returns {Promise<Object>} A promise that resolves with the semantic diagnostics response from tsserver.
     *                            The response includes an array of diagnostic objects, each representing a
     *                            semantic error or warning found in the file. Each diagnostic object typically
     *                            contains the following information:
     *                            - `start`: The starting position of the error (line and character).
     *                            - `length`: The length of the error in characters.
     *                            - `text`: The error message text.
     *                            - `category`: The error category ('error', 'warning', or 'suggestion').
     *                            - `code`: The error code (useful for further reference or lookups).
     *                            If `includeLinePosition` is true, additional line and character position
     *                            information will be included in each diagnostic.
     *
     * Example usage:
     * ```
     * getSemanticDiagnosticsSync('path/to/file.ts', true).then(response => {
     *   console.log('Semantic diagnostics with line positions:', response);
     * }).catch(error => {
     *   console.error('Error getting semantic diagnostics:', error);
     * });
     * ```
     *
     * Note: This function performs a synchronous request, meaning it waits for the TypeScript server
     *       to compute and return the diagnostics. The response is directly related to the current
     *       state of the file at the time of the request.
     */
    // TODO: Revisit find working usecase
    function getSemanticDiagnosticsSync(filePath, includeLinePosition = false) {
        const command = {
            command: "semanticDiagnosticsSync",
            arguments: {
                file: filePath,
                includeLinePosition: includeLinePosition
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'syntacticDiagnosticsSync' request to the TypeScript Server. This command is used
     * to synchronously obtain syntactic diagnostic information (like parsing errors) for a specified file.
     * Syntactic diagnostics are concerned with issues related to the parsing of the source code.
     * This function is particularly useful for quickly identifying syntax errors in a TypeScript file.
     *
     * @param {string} filePath - The path to the TypeScript file. The path should be absolute
     *                            or relative to the TypeScript server's current working directory.
     * @param {boolean} [includeLinePosition=false] - Specifies whether to include line and character
     *                                                position information in the diagnostics. When set to true,
     *                                                each diagnostic includes detailed position information,
     *                                                which is useful for displaying errors directly in an editor.
     *
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver containing syntactic
     *                            diagnostics. The response is an array of diagnostic objects. Each diagnostic object
     *                            typically contains:
     *                            - `start`: The starting position of the diagnostic message.
     *                            - `length`: The length of the diagnostic message.
     *                            - `text`: The text of the diagnostic message.
     *                            If `includeLinePosition` is true, the diagnostic object also includes:
     *                            - `startLocation`: An object with line and character position of the start.
     *                            - `endLocation`: An object with line and character position of the end.
     *
     * Example usage:
     * ```
     * getSyntacticDiagnosticsSync('path/to/file.ts', true).then(response => {
     *   console.log('Syntactic diagnostics:', response);
     * });
     * ```
     */
    // TODO: Revisit find working usecase
    function getSyntacticDiagnosticsSync(filePath, includeLinePosition = false) {
        const command = {
            command: "syntacticDiagnosticsSync",
            arguments: {
                file: filePath,
                includeLinePosition: includeLinePosition
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'suggestionDiagnosticsSync' request to the TypeScript Server. This command is used
     * to synchronously obtain suggestion diagnostic information for a specified file. Suggestion
     * diagnostics include tips and hints that may not necessarily be errors or warnings but could
     * suggest improvements or best practices in the code.
     *
     * @param {string} filePath - The path to the TypeScript file. This should be an absolute path
     *                            or relative to the TypeScript server's current working directory.
     * @param {boolean} [includeLinePosition=false] - Specifies whether to include line and character
     *                                                position information in the diagnostics. When set to true,
     *                                                each diagnostic includes detailed position information,
     *                                                which is useful for displaying suggestions directly in an editor.
     *
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver containing
     *                            suggestion diagnostics. The response is typically an array of diagnostic
     *                            objects. Each diagnostic object includes:
     *                            - `start`: The starting position of the diagnostic message.
     *                            - `length`: The length of the diagnostic message.
     *                            - `text`: The text of the diagnostic message.
     *                            If `includeLinePosition` is true, the diagnostic object also includes:
     *                            - `startLocation`: An object with line and character position of the start.
     *                            - `endLocation`: An object with line and character position of the end.
     *
     * Example usage:
     * ```
     * getSuggestionDiagnosticsSync('path/to/file.ts', true).then(response => {
     *   console.log('Suggestion diagnostics:', response);
     * });
     * ```
     * This function is particularly useful for tools and editors integrating TypeScript support,
     * providing an opportunity to present potential code improvements or best practices to the developer.
     */
    // TODO: Revisit find working usecase
    function getSuggestionDiagnosticsSync(filePath, includeLinePosition = false) {
        const command = {
            command: "suggestionDiagnosticsSync",
            arguments: {
                file: filePath,
                includeLinePosition: includeLinePosition
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'navbar' request to the TypeScript Server. This command is used to obtain
     * the navigation bar structure of a TypeScript file. The navigation bar typically
     * includes a hierarchical outline of the file's structure, including classes,
     * interfaces, functions, variables, and other code constructs.
     *
     * @param {string} filePath - The path to the TypeScript file for which the navigation
     *                            bar information is requested. The path should be absolute
     *                            or relative to the TypeScript server's current working directory.
     *
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver containing
     *                            the navigation bar information. The response is typically an array
     *                            of items representing the various code constructs in the file. Each item
     *                            includes:
     *                            - `text`: The name of the code construct (e.g., class name, function name).
     *                            - `kind`: The kind of code construct (e.g., 'class', 'function').
     *                            - `kindModifiers`: Modifiers applied to the code construct (e.g., 'public', 'static').
     *                            - `spans`: An array of span objects indicating the location of the construct in the file.
     *                            - `childItems`: An array of child items, following the same structure, representing nested constructs.
     *
     * Example usage:
     * ```
     * getNavBar('path/to/file.ts').then(response => {
     *   console.log('Navigation bar structure:', response);
     * });
     * ```
     * This function is particularly useful for tools and editors integrating TypeScript support,
     * providing an opportunity to present a structured outline or overview of a code file to the developer.
     */
    function getNavBar(filePath) {
        const command = {
            command: "navbar",
            arguments: {
                file: filePath
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'navto' request to the TypeScript Server. This command is used for
     * searching named symbols in the project or in a particular file, with options
     * to limit the results and scope the search to a specific project.
     *
     * @param {string} searchValue - The search term to navigate to from the current location.
     *                               The term can be '.*' or an identifier prefix.
     * @param {string} [file] - Optional file path to restrict the search to a specific file.
     * @param {boolean} [currentFileOnly=false] - When true, limits search to the current file.
     * @param {number} [maxResultCount] - Optional limit on the number of items to return.
     * @param {string} [projectFileName] - Optional name of the project file (absolute pathname required).
     * @returns {Promise<Object[]>} A promise that resolves with an array of navigation items.
     */
    function navTo(searchValue, file, currentFileOnly = false, maxResultCount, projectFileName) {
        const command = {
            command: "navto",
            arguments: {
                searchValue: searchValue,
                file: file,
                currentFileOnly: currentFileOnly,
                maxResultCount: maxResultCount,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'navtree' request to the TypeScript Server to obtain the navigation tree of a TypeScript file.
     * The navigation tree provides a hierarchical outline of the file's contents, detailing classes, interfaces,
     * functions, variables, and other top-level constructs. This structured information is useful for
     * understanding the organization of code and for quick navigation within IDEs or editors.
     *
     * @param {string} filePath - The absolute path to the TypeScript file. This path is required
     *                            to locate the file within the project or file system.
     * @param {string} [projectFileName] - Optional. The absolute path to the project file (usually 'tsconfig.json').
     *                                     Providing this path helps the TypeScript server correctly resolve the
     *                                     file's context within a specific project, especially useful in workspaces
     *                                     with multiple TypeScript projects.
     *
     * @returns {Promise<Object>} A promise that resolves with the navigation tree from the TypeScript server.
     *                            The tree is a hierarchical object with nodes representing various code constructs.
     *                            Each node typically includes:
     *                            - `text`: The name of the construct (e.g., class or function name).
     *                            - `kind`: The kind of construct (e.g., 'class', 'function').
     *                            - `spans`: Array of location spans indicating where the construct appears in the file.
     *                            - `childItems`: Array of child nodes for nested constructs (following the same structure).
     *
     * Example usage:
     * ```
     * getNavTree('path/to/file.ts', 'path/to/project.tsconfig.json').then(navTree => {
     *   console.log('Navigation tree:', navTree);
     * });
     * ```
     * The returned navigation tree is especially valuable in development environments where a visual outline
     * or structure of the code file is beneficial for navigation and code comprehension.
     */
    function getNavTree(filePath, projectFileName) {
        const command = {
            command: "navtree",
            arguments: {
                file: filePath,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'navtree-full' request to the TypeScript Server. This command obtains a comprehensive
     * navigation tree of a TypeScript file, which provides a detailed outline of the file's structure.
     * The response includes an extensive hierarchy of all symbols and their nested scopes within the file,
     * such as classes, interfaces, functions, variables, and other code constructs.
     *
     * This detailed navigation tree is particularly useful for applications that require an in-depth
     * understanding of the file's structure, such as advanced IDE features for code navigation and analysis.
     *
     * @param {string} filePath - The absolute path to the TypeScript file for which the full navigation
     *                            tree is requested. This path is essential for the TypeScript server to locate
     *                            and analyze the file.
     *
     * @returns {Promise<Object>} A promise that resolves with the full navigation tree from the TypeScript server.
     *                            The tree is represented as an object with a hierarchical structure. Each node in the tree
     *                            includes:
     *                            - `text`: The name of the item (e.g., a class or function name).
     *                            - `kind`: The kind of item (e.g., 'class', 'function').
     *                            - `spans`: An array of span objects indicating the location of the item in the file.
     *                            - `childItems`: An array of child nodes representing nested declarations and structures.
     *                            Each child node follows the same structure.
     *
     * Example usage:
     * ```
     * getNavTreeFull('path/to/file.ts').then(navTreeFull => {
     *   console.log('Full navigation tree:', navTreeFull);
     * });
     * ```
     */
    function getNavTreeFull(filePath) {
        const command = {
            command: "navtree-full",
            arguments: {
                file: filePath
            }
        };
        return sendCommand(command);
    }


    /**
     * Sends a 'documentHighlights' request to the TypeScript Server. This command is used to
     * obtain highlights of all occurrences of a symbol within a specified set of files, optionally
     * within the context of a specific project. It is useful for identifying and navigating to
     * instances of a variable, function name, or other identifiers across multiple files.
     *
     * @param {string} filePath - The path to the TypeScript file where the symbol occurs.
     * @param {number} line - The line number where the symbol is located.
     * @param {number} offset - The character offset (position) in the line where the symbol is located.
     * @param {string[]} filesToSearch - The list of file paths to search for document highlights.
     * @param {string} [projectFileName] - Optional. The name of the project file (absolute pathname required)
     *                                     that contains the TypeScript file. Providing this helps to
     *                                     accurately resolve symbols in the context of the given project.
     *
     * @returns {Promise<Object[]>} A promise that resolves with an array of document highlight objects.
     * Each object represents a file with highlight instances and includes:
     *  - `file`: The file in which the highlight occurs.
     *  - `highlightSpans`: An array of objects representing the highlight locations. Each object includes:
     *    - `start`: The starting position of the highlight (line and character).
     *    - `end`: The ending position of the highlight (line and character).
     *    - `kind`: The kind of highlight (e.g., 'writtenReference', 'reference', 'definition').
     *
     * Example usage:
     * ```
     * documentHighlights('path/to/file.ts', 10, 5, ['path/to/file1.ts', 'path/to/file2.ts'], 'path/to/project.tsconfig.json')
     *   .then(highlights => {
     *     console.log('Document highlights:', highlights);
     *   });
     * ```
     * This function is essential for features like symbol search in development environments,
     * where highlighting symbol occurrences enhances code understanding and navigation.
     */
    function documentHighlights(filePath, line, offset, filesToSearch, projectFileName = "") {
        const command = {
            command: "documentHighlights",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                filesToSearch: filesToSearch,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'reload' request to the TypeScript Server to reload the contents of a file from disk.
     * This command is useful for ensuring the server's view of a file is synchronized with the latest
     * content, particularly after external changes to the file.
     *
     * @param {string} filePath - The path to the file to be reloaded.
     * @param {string} tempFilePath - The path to a temporary file that contains the new content. This allows
     *                               reloading the file content without modifying the original file on disk.
     * @param {string} [projectFileName] - Optional. The name of the project file (absolute pathname required)
     *                                     that contains the TypeScript file. Providing this helps the TypeScript
     *                                     server accurately interpret the file in the context of the specified project.
     *
     * @returns {Promise<Object>} A promise that resolves with the server's response after the file has been
     *                            reloaded. The response typically includes a status indicating whether the
     *                            reload was successful.
     *
     * Example usage:
     * ```
     * reload('path/to/file.ts', 'path/to/tempFile.ts', 'path/to/project.tsconfig.json').then(response => {
     *   console.log('File reload response:', response);
     * });
     * ```
     * This function is essential in development environments where files are frequently modified
     * outside the editor and need to be synchronized with the TypeScript server.
     */
    function reload(filePath, tempFilePath, projectFileName = "") {
        const command = {
            command: "reload",
            arguments: {
                file: filePath,
                tmpfile: tempFilePath,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }


    /**
     * Sends a 'rename' request to the TypeScript Server to perform a comprehensive renaming operation
     * for a symbol at a specified location in a file. It updates references to the symbol across the
     * entire codebase, including in comments and strings if specified.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The line number where the symbol to be renamed is located.
     * @param {number} offset - The character offset (position) in the line where the symbol is located.
     * @param {boolean} [findInComments=false] - Whether to find/change the text in comments.
     * @param {boolean} [findInStrings=false] - Whether to find/change the text in strings.
     *
     * @returns {Promise<Object>} A promise that resolves with the rename information from tsserver.
     *                            The response object includes:
     *                            - `canRename`: A boolean indicating if the symbol can be renamed.
     *                            - `locs`: An array of location objects where each object represents
     *                                      a file with references to the symbol. Each location object includes:
     *                              - `file`: The file in which references are found.
     *                              - `locs`: An array of span objects representing the reference locations.
     *                                        Each span object includes:
     *                                 - `start`: The starting line and character position of the reference.
     *                                 - `end`: The ending line and character position of the reference.
     *                            - `displayName`: The full display name of the symbol.
     *                            - `fullDisplayName`: The full display name of the symbol with container information.
     *                            - `kind`: The kind of the symbol (e.g., 'variable', 'function').
     *                            - `kindModifiers`: The kind modifiers of the symbol (e.g., 'public', 'static').
     *
     * Example usage:
     * ```
     * rename('path/to/file.ts', 10, 5, true, true).then(renameInfo => {
     *   console.log('Rename information:', renameInfo);
     * });
     * ```
     * This function is essential for refactoring, providing a safe and consistent way to rename symbols
     * across a project, including their occurrences in comments and strings if required.
     */
    //TODO: check multi file rename and functional object rename for js without config
    function rename(filePath, line, offset, findInComments = false, findInStrings = false) {
        const command = {
            command: "rename",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                findInComments: findInComments,
                findInStrings: findInStrings
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'saveto' request to the TypeScript Server. This command instructs the server
     * to save the server's current view of a file's contents to a specified temporary file.
     * It's primarily used for debugging purposes. Note that the server does not send a response
     * to a "saveto" request.
     *
     * @param {string} filePath - The path to the original TypeScript file.
     * @param {string} tempFilePath - The path where the server's view of the file's current contents should be saved.
     * @param {string} [projectFileName] - Optional. The name of the project file (absolute pathname required)
     *                                     that contains the TypeScript file.
     *
     * Example usage:
     * ```
     * saveto('path/to/originalFile.ts', 'path/to/tempFile.ts', 'path/to/project.tsconfig.json');
     * ```
     * This command is useful for debugging, allowing the current state of the file as seen by the TypeScript server
     * to be saved to a specific location.
     */
    function saveto(filePath, tempFilePath, projectFileName = '') {
        const command = {
            command: "saveto",
            arguments: {
                file: filePath,
                tmpfile: tempFilePath,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'signatureHelp' request to the TypeScript Server. This command is used to obtain
     * information about the signature of a function or method at a specific position in a file.
     * The response includes details about the function signatures and their parameters.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The line number where the function or method is invoked.
     * @param {number} offset - The character offset in the line where the invocation occurs.
     * @param {Object} [triggerReason] - The reason why signature help was invoked, with properties:
     *                                   - `kind`: The type of trigger reason ('invoked', 'characterTyped', 'retrigger').
     *                                   - `triggerCharacter`: The character that triggered the help (for 'characterTyped').
     *
     * @returns {Promise<Object>} A promise that resolves with the signature help information, which includes:
     *                            - `items`: Array of objects representing each signature. Each object includes:
     *                              - `label`: String representation of the function signature.
     *                              - `documentation`: Optional documentation for the function.
     *                              - `parameters`: Array of parameter information objects, each with:
     *                                - `label`: The parameter name.
     *                                - `documentation`: Optional documentation for the parameter.
     *                            - `applicableSpan`: Object representing the span for which signature help is applicable.
     *                            - `selectedItemIndex`: Number indicating the default selected signature.
     *                            - `argumentIndex`: Number indicating the index of the argument where the cursor is located.
     *                            - `argumentCount`: Number indicating the total number of arguments in the function call.
     *
     * Example usage:
     * ```
     * signatureHelp('path/to/file.ts', 15, 10, { kind: 'characterTyped', triggerCharacter: '(' }).then(help => {
     *   console.log('Signature help:', help);
     * });
     * ```
     * This function is essential for providing inline function/method signature information in development environments.
     */
    //TODO: experiment usecases with different trigger reason
    function signatureHelp(filePath, line, offset, triggerReason) {
        const command = {
            command: "signatureHelp",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                triggerReason: triggerReason
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'status' request to the TypeScript Server. This command queries the current
     * status of the server, providing information about its operational state. This can
     * include details such as the server's version, the number of projects currently loaded,
     * and any ongoing operations.
     *
     * @returns {Promise<Object>} A promise that resolves with the status information from tsserver.
     *                            The response typically includes details about the server's state,
     *                            including its version and the status of loaded projects.
     *
     * Example usage:
     * ```
     * status().then(serverStatus => {
     *   console.log('TypeScript server status:', serverStatus);
     * });
     * ```
     * This function is useful for monitoring the TypeScript server and diagnosing issues with its operation.
     */
    function status() {
        const command = {
            command: "status"
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'typeDefinition' request to the TypeScript Server. This command is used to
     * find the type definition of a symbol at a specified location in a TypeScript file.
     * It is useful for navigating to the definition of the type of a symbol, such as
     * the type of a variable, parameter, or property.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The line number where the symbol is located.
     * @param {number} offset - The character offset (position) in the line where the symbol is located.
     *
     * @returns {Promise<Object>} A promise that resolves with the location of the symbol's type definition.
     *                            The response typically includes:
     *                            - `file`: The file path of the type definition.
     *                            - `start`: The starting position of the type definition (line and character).
     *                            - `end`: The ending position of the type definition (line and character).
     *
     * Example usage:
     * ```
     * typeDefinition('path/to/file.ts', 10, 5).then(definition => {
     *   console.log('Type definition location:', definition);
     * });
     * ```
     * This function is crucial for understanding and navigating to the types used in a TypeScript codebase.
     */
    function typeDefinition(filePath, line, offset) {
        const command = {
            command: "typeDefinition",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
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
        getErrors,
        getErrorsForProject,
        getSemanticDiagnosticsSync,
        getSyntacticDiagnosticsSync,
        getSuggestionDiagnosticsSync,
        getNavBar,
        navTo,
        getNavTree,
        getNavTreeFull,
        documentHighlights,
        reload,
        rename,
        saveto,
        signatureHelp,
        status,
        typeDefinition,
        exitServer
    };
}

export default createTSServerInstance;
