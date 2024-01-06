import {spawn} from 'child_process';
import path from 'path';
import {fileURLToPath} from 'url';

// @INCLUDE_IN_API_DOCS
/**
 * Creates a new instance of TypeScript Server.
 * @returns {Object} An object containing methods to interact with TypeScript Server.
 */
function createTSServerInstance(inferredProject = true) {
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
            tsserverProcess = spawn(nodePath, [tsserverPath, (inferredProject) ? '--useInferredProjectPerProjectRoot' : ""]);
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
        if (command.command === "open" || command.command === "geterr" || command.command === "geterrForProject"
            || command.command === "saveto" || command.command === "reloadProjects") {
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
     * Sends a 'projectInfo' request to the TypeScript Server to retrieve information about the TypeScript
     * project associated with a specific file. This includes details about the project's configuration,
     * the files included, and the status of the language service.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {boolean} needFileNameList - Indicates whether the list of file names in the project is needed.
     * @param {string} [projectFileName] - Optional. The name of the project file (absolute pathname required)
     *                                     that contains the TypeScript file.
     *
     * @returns {Promise<Object>} A promise that resolves with the project information, which includes:
     *                            - `configFileName`: A string representing the path to the project's
     *                                                configuration file (tsconfig.json), if available.
     *                            - `fileNames`: An array of strings representing the file names in the project,
     *                                           included if `needFileNameList` is true.
     *                            - `languageServiceDisabled`: A boolean indicating whether the language service
     *                                                         is disabled for this project.
     *
     * Example usage:
     * ```
     * projectInfo('path/to/file.ts', true, 'path/to/project.tsconfig.json').then(info => {
     *   console.log('Project information:', info);
     * });
     * ```
     * This function is useful for tools and IDEs to gain insights into the structure and configuration
     * of a TypeScript project.
     */
    function projectInfo(filePath, needFileNameList = false, projectFileName = "") {
        const command = {
            command: "projectInfo",
            arguments: {
                file: filePath,
                needFileNameList: needFileNameList,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'reloadProjects' request to the TypeScript Server. This command instructs
     * the server to reload all projects it has loaded. It is particularly useful when
     * project configurations or file structures have changed, ensuring that tsserver
     * is synchronized with the current state of the projects.
     *
     * @returns {Promise<void>} A promise that resolves when the server has reloaded the projects.
     *                          Note that there is no direct response from the server for this command,
     *                          so the promise resolves as soon as the command is sent.
     *
     * Example usage:
     * ```
     * reloadProjects().then(() => {
     *   console.log('All projects reloaded');
     * });
     * ```
     * This function is essential for maintaining project synchronization with tsserver, particularly
     * after significant changes to project configurations or file structures.
     */
    function reloadProjects() {
        const command = {
            command: "reloadProjects"
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'openExternalProject' request to the TypeScript Server. This command opens an external project
     * with the provided configuration, which includes the project's file name, root files, compiler options,
     * and type acquisition settings. The server responds with an acknowledgement.
     *
     * @param {Object} project - The external project configuration, which includes:
     *                           - `projectFileName`: The name or path of the project file.
     *                           - `rootFiles`: An array of objects representing the root files in the project.
     *                                         Each object includes `fileName` and other optional properties like
     *                                         `scriptKind` and `hasMixedContent`.
     *                           - `options`: The compiler options for the project.
     *                           - `typeAcquisition`: Optional type acquisition settings for the project.
     *
     * @returns {Promise<Object>} A promise that resolves when the server has acknowledged the opening of the external project.
     *                            The response object contains standard response fields such as:
     *                            - `success`: A boolean indicating whether the request was successful.
     *                            - `request_seq`: The sequence number of the request.
     *                            - `command`: The command requested.
     *                            - `message`: An optional success or error message.
     *
     * Example usage:
     * ```
     * const externalProject = {
     *   projectFileName: 'path/to/external/project',
     *   rootFiles: [{ fileName: 'path/to/rootFile1.ts', scriptKind: 'ts', hasMixedContent: true }],
     *   options: { noImplicitAny: true, strictNullChecks: true },
     *   typeAcquisition: { enable: true, include: ['node'] }
     * };
     * openExternalProject(externalProject).then(response => {
     *   console.log('External project opened:', response);
     * });
     * ```
     * This function is particularly useful for integrating tsserver with environments where
     * project configurations are defined externally.
     */
    function openExternalProject(project) {
        const command = {
            command: "openExternalProject",
            arguments: project
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'openExternalProjects' request to the TypeScript Server. This command is used to
     * open multiple external projects simultaneously. Each project configuration includes the
     * project's file name, root files, compiler options, and type acquisition settings. The server
     * responds with an acknowledgement.
     *
     * @param {Object[]} projects - An array of external project configurations. Each configuration includes:
     *                              - `projectFileName`: The name or path of the project file.
     *                              - `rootFiles`: An array of objects representing the root files in the project.
     *                              - `options`: The compiler options for the project.
     *                              - `typeAcquisition`: Optional type acquisition settings for the project.
     *
     * @returns {Promise<Object>} A promise that resolves when the server has acknowledged
     *                            opening the external projects. The response object contains
     *                            standard response fields like:
     *                            - `success`: A boolean indicating whether the request was successful.
     *                            - `request_seq`: The sequence number of the request.
     *                            - `command`: The command requested.
     *                            - `message`: An optional success or error message.
     *
     * Example usage:
     * ```
     * const externalProjects = [
     *   {
     *     projectFileName: 'path/to/external/project1',
     *     rootFiles: [{ fileName: 'path/to/rootFile1.ts', scriptKind: 'ts', hasMixedContent: true }],
     *     options: { noImplicitAny: true },
     *     typeAcquisition: { enable: true, include: ['node'] }
     *   },
     *   // ... more projects ...
     * ];
     * openExternalProjects(externalProjects).then(response => {
     *   console.log('External projects opened:', response);
     * });
     * ```
     * This function is especially useful for environments where multiple TypeScript projects are managed externally.
     */
    function openExternalProjects(projects) {
        const command = {
            command: "openExternalProjects",
            arguments: {projects: projects}
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'closeExternalProject' request to the TypeScript Server. This command closes an external project
     * that was previously opened. The server responds with an acknowledgement. Closing a project is important
     * for managing resources and keeping the server's context accurate, especially in dynamic environments.
     *
     * @param {string} projectFileName - The name or path of the external project file to close.
     *
     * @returns {Promise<Object>} A promise that resolves when the server has acknowledged closing the project.
     *                            The response object contains standard response fields such as:
     *                            - `success`: A boolean indicating whether the request was successful.
     *                            - `request_seq`: The sequence number of the request.
     *                            - `command`: The command requested.
     *                            - `message`: An optional success or error message.
     *
     * Example usage:
     * ```
     * closeExternalProject('path/to/external/project').then(response => {
     *   console.log('External project closed:', response);
     * });
     * ```
     * This function is essential for managing the lifecycle of external projects in various development environments.
     */
    function closeExternalProject(projectFileName) {
        const command = {
            command: "closeExternalProject",
            arguments: {projectFileName}
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'updateOpen' request to the TypeScript Server. This command updates the set of open files,
     * including newly opened files, changed files, and files to be closed. It synchronizes the server's
     * view of files with the current state in the development environment.
     *
     * @param {Object[]} openFiles - Array of objects for newly opened files. Each object includes:
     *                               - `fileName`: The file name.
     *                               - `fileContent`: (Optional) The current content of the file.
     *                               - `scriptKindName`: (Optional) The kind of script ('TS', 'JS', 'TSX', 'JSX').
     *                               - `projectRootPath`: (Optional) Root path for project configuration file search.
     * @param {Object[]} changedFiles - Array of objects for changed files. Each object includes:
     *                                  - `fileName`: The file name.
     *                                  - `textChanges`: Array of changes, each with `start`, `end`, and `newText`.
     * @param {string[]} closedFiles - Array of file names that should be closed.
     *
     * @returns {Promise<void>} A promise that resolves when the server has processed the update.
     *
     * Example usage:
     * ```
     * updateOpen(
     *   [{ fileName: 'path/to/openedFile.ts', fileContent: 'file content', scriptKindName: 'TS' }],
     *   [{ fileName: 'path/to/changedFile.ts', textChanges: [{ start: { line: 1, offset: 1 }, end: { line: 1, offset: 10 }, newText: 'updated content' }] }],
     *   ['path/to/closedFile.ts']
     * ).then(() => {
     *   console.log('Open files updated');
     * });
     * ```
     * This function is crucial for keeping the TypeScript server in sync with the file changes in the development environment.
     */
    // TODO: write working test case and figure out the behavior
    function updateOpen(openFiles, changedFiles, closedFiles) {
        const command = {
            command: "updateOpen",
            arguments: {
                openFiles,
                changedFiles,
                closedFiles
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getOutliningSpans' request to the TypeScript Server. This command retrieves outlining spans
     * (code folding regions) for a specified file. These spans help editors to create collapsible regions,
     * enhancing code readability and navigation, especially in large files.
     *
     * @param {string} fileName - The name of the file for which outlining spans are requested.
     *
     * @returns {Promise<Object[]>} A promise that resolves with an array of outlining span objects.
     *                              Each outlining span object includes:
     *                              - `textSpan`: The span of the document to collapse, with start and end locations.
     *                              - `hintSpan`: The span to display as a hint when the user hovers over the collapsed span.
     *                              - `bannerText`: The text to display in the editor for the collapsed region.
     *                              - `autoCollapse`: Indicates whether the region should automatically collapse in certain conditions.
     *                              - `kind`: The kind of outlining span, such as 'comment', 'region', 'code', or 'imports'.
     *
     * Example usage:
     * ```
     * getOutliningSpans('path/to/file.ts').then(spans => {
     *   console.log('Outlining spans:', spans);
     * });
     * ```
     * This function is vital for code editors, providing the necessary information for code folding features,
     * helping developers manage visibility in large code files.
     */
    function getOutliningSpans(fileName) {
        const command = {
            command: "getOutliningSpans",
            arguments: {file: fileName}
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'todoComments' request to the TypeScript Server. This command searches for TODO comments
     * in a specified file based on given descriptors. Each descriptor includes a text to match (like 'TODO')
     * and a priority level.
     *
     * @param {string} fileName - The name of the file to search for TODO comments.
     * @param {Object[]} descriptors - Array of descriptors for TODO comments. Each descriptor includes:
     *                                 - `text`: The text of the TODO comment (e.g., 'TODO', 'FIXME').
     *                                 - `priority`: The priority level of the comment.
     *
     * @returns {Promise<Object[]>} A promise that resolves with an array of TODO comment objects.
     *                              Each object includes:
     *                              - `descriptor`: The descriptor of the TODO comment.
     *                              - `message`: The text of the TODO comment.
     *                              - `position`: The position of the comment in the file.
     *
     * Example usage:
     * ```
     * todoComments('path/to/file.ts', [{ text: 'TODO', priority: 1 }, { text: 'FIXME', priority: 2 }])
     *   .then(comments => {
     *     console.log('TODO comments:', comments);
     *   });
     * ```
     * This function is useful for identifying and listing TODO comments and other annotations in the code.
     */
    function todoComments(fileName, descriptors) {
        const command = {
            command: "todoComments",
            arguments: {
                file: fileName,
                descriptors: descriptors
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'indentation' request to the TypeScript Server. This command calculates the indentation level
     * for a specific location in a file, taking into account optional editor settings. It's useful for maintaining
     * consistent formatting in code editors or IDEs.
     *
     * @param {string} fileName - The name of the file to calculate indentation for.
     * @param {number} line - The line number (1-based) to calculate the indentation.
     * @param {number} offset - The character offset (1-based) in the line for indentation calculation.
     * @param {Object} [options] - Optional editor settings to use for computing indentation. Includes:
     *                             - `baseIndentSize`: The base indent size in spaces.
     *                             - `indentSize`: The size of an indentation level in spaces.
     *                             - `tabSize`: The size of a tab character in spaces.
     *                             - `newLineCharacter`: The character(s) to use for a newline.
     *                             - `convertTabsToSpaces`: Whether to convert tabs to spaces.
     *                             - `indentStyle`: The style of indentation ('None', 'Block', 'Smart').
     *                             - `trimTrailingWhitespace`: Whether to trim trailing whitespace.
     *
     * @returns {Promise<Object>} A promise that resolves with the indentation result, including:
     *                            - `position`: The base position in the document for the indent.
     *                            - `indentation`: The number of columns for the indent relative to the position's column.
     *
     * Example usage:
     * ```
     * indentation('path/to/file.ts', 10, 4, { indentSize: 4, tabSize: 4, convertTabsToSpaces: true })
     *   .then(result => {
     *     console.log('Indentation result:', result);
     *   });
     * ```
     * This function assists in automating code formatting in development environments.
     */
    function indentation(fileName, line, offset, options) {
        const command = {
            command: "indentation",
            arguments: {
                file: fileName,
                line: line,
                offset: offset,
                options: options
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'docCommentTemplate' request to the TypeScript Server. This command generates a JSDoc comment template
     * at a specified line and character offset in a file. It's useful for quickly inserting standardized documentation comments.
     *
     * @param {string} fileName - The absolute path of the file in which to generate the comment template.
     * @param {number} line - The line number (1-based) where the template should be generated.
     * @param {number} offset - The character offset (1-based) on the line for the template.
     *
     * @returns {Promise<Object>} A promise that resolves with the generated comment template. The result includes:
     *                            - `newText`: The text of the generated documentation comment.
     *                            - `caretOffset`: The position in the newText where the caret should be placed.
     *
     * Example usage:
     * ```
     * docCommentTemplate('path/to/file.ts', 10, 5).then(template => {
     *   console.log('Documentation comment template:', template);
     * });
     * ```
     * This function assists developers in maintaining consistent documentation standards in their codebase.
     */
    function docCommentTemplate(fileName, line, offset) {
        const command = {
            command: "docCommentTemplate",
            arguments: {
                file: fileName,
                line: line,
                offset: offset
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'compilerOptionsForInferredProjects' request to the TypeScript Server. This command sets the compiler
     * options for inferred projects. An inferred project is created when a loose file, not part of any other project,
     * is opened. These projects are grouped based on their root directory if 'useInferredProjectPerProjectRoot' is enabled.
     *
     * When 'useInferredProjectPerProjectRoot' is enabled, the TypeScript server creates a separate inferred project for each
     * directory root. This allows for isolated handling of files in different folders, each treated as a distinct project
     * with its own settings. This setting is crucial for large workspaces or monorepos where different directories may have
     * different TypeScript configurations.
     *
     * @param {Object} options - Compiler options for inferred projects, similar to tsconfig.json settings.
     * @param {string} [projectRootPath] - Optional root path to scope the compiler options. Required if the server is started
     *                                    with 'useInferredProjectPerProjectRoot' enabled.
     *
     * @returns {Promise<void>} A promise that resolves when the server acknowledges the update.
     *
     * Example usage:
     * ```
     * const compilerOptions = {
     *   allowJs: true,
     *   strict: true,
     *   // ... other options
     * };
     * const projectRoot = 'path/to/project/root'; // Optional
     * setCompilerOptionsForInferredProjects(compilerOptions, projectRoot)
     *   .then(() => {
     *     console.log('Compiler options for inferred projects updated');
     *   });
     * ```
     * This function is essential for setting up appropriate behaviors for files in inferred projects,
     * especially in complex workspaces with multiple disjoint projects.
     */

    function setCompilerOptionsForInferredProjects(options, projectRootPath) {
        const command = {
            command: "compilerOptionsForInferredProjects",
            arguments: {
                options: options,
                projectRootPath: projectRootPath
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getCodeFixes' request to the TypeScript Server. This command fetches available code fixes
     * for a specified range in a file, targeting specific error codes. It's commonly used for automated correction
     * of code issues such as syntax errors or style violations.
     *
     * @param {string} fileName - The name of the file to get code fixes for.
     * @param {number} startLine - The starting line number of the range (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} endLine - The ending line number of the range (1-based).
     * @param {number} endOffset - The ending character offset on the end line (1-based).
     * @param {number[]} errorCodes - Array of error codes to get fixes for.
     *
     * @returns {Promise<Object>} A promise that resolves with an array of code fix objects. Each object may include
     *                            file changes and optional commands for applying these changes.
     *
     * Example usage:
     * ```
     * getCodeFixes('path/to/file.ts', 1, 1, 2, 1, [1003, 1005])
     *   .then(fixes => {
     *     console.log('Available code fixes:', fixes);
     *   });
     * ```
     * This function is invaluable in development environments for quickly addressing and correcting code issues.
     */

    // TODO: Find a working use case
    function getCodeFixes(fileName, startLine, startOffset, endLine, endOffset, errorCodes) {
        const command = {
            command: "getCodeFixes",
            arguments: {
                file: fileName,
                startLine: startLine,
                startOffset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                errorCodes: errorCodes
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to retrieve a set of code actions that can be applied as a single fix.
     * These actions address multiple related issues within a specified scope in a file. It's useful for applying a
     * comprehensive fix that spans multiple errors or issues.
     *
     * @param {Object} fixId - An object representing the identifier of the combined code fix. The structure of this
     *                         object depends on the types of fixes needed.
     * @param {Object} scope - The scope object defining the range or extent of the code for which fixes are sought.
     *                         Typically includes the file name and other contextual information.
     * @returns {Promise<Object>} A promise that resolves with the combined code fix actions. The resolved object
     *                            typically includes changes to be made to files and optional commands.
     * @throws {Error} Thrown if the request to the TypeScript server fails.
     *
     * @example
     * // Example usage of getCombinedCodeFix
     * getCombinedCodeFix('path/to/file.ts', { type: 'fixId' }, { type: 'file', args: { file: 'path/to/file.ts' } })
     *   .then(fix => {
     *     console.log('Combined code fix:', fix);
     *   })
     *   .catch(error => {
     *     console.error('Error getting combined code fix:', error);
     *   });
     */
    // ToDo: revisit
    function getCombinedCodeFix(fixId, scope) {
        const command = {
            command: "getCombinedCodeFix",
            arguments: {
                scope: scope,
                fixId: fixId
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getSupportedCodeFixes' request to the TypeScript Server. This command retrieves a list of error
     * codes that have associated code fixes available. It's useful to identify which errors in the code can be
     * automatically fixed by the server.
     * @param {string} file - fully path of a file in the project to query for code fixes
     * @returns {Promise<string[]>} A promise that resolves with an array of error code strings supported by the server for code fixes.
     *
     * @example
     * getSupportedCodeFixes("file.ts")
     *   .then(supportedCodes => {
     *     console.log('Supported error codes for code fixes:', supportedCodes);
     *   })
     *   .catch(error => {
     *     console.error('Error getting supported code fixes:', error);
     *   });
     */
    function getSupportedCodeFixes(file) {
        const command = {
            command: "getSupportedCodeFixes",
            arguments: {file: file} // Optional arguments based on Partial<FileRequestArgs>
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getApplicableRefactors' request to the TypeScript Server. This command retrieves a list of potential refactoring actions
     * applicable at a specific position or selection area in a TypeScript file. Each refactoring action is grouped under a parent refactoring.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file.
     * @param {number} offset - The 1-based character offset in the line.
     * @param {string} [triggerReason] - The reason for triggering the refactor, either 'implicit' or 'invoked'.
     * @param {string} [kind] - The kind of refactoring to apply.
     * @param {boolean} [includeInteractiveActions] - Include refactor actions that require additional arguments.
     * @returns {Promise<Object[]>} A promise that resolves with an array of applicable refactorings. Each object in the array represents a refactoring action and contains properties like `name`, `description`, `inlineable`, and `actions`.
     * @example
     * getApplicableRefactors('path/to/file.ts', 10, 15, 'invoked', null, true)
     *   .then(refactors => {
     *     console.log('Applicable refactors:', refactors);
     *   })
     *   .catch(error => {
     *     console.error('Error getting applicable refactors:', error);
     *   });
     */
    function getApplicableRefactors(filePath, line, offset, triggerReason, kind, includeInteractiveActions) {
        const command = {
            command: "getApplicableRefactors",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                triggerReason: triggerReason,
                kind: kind,
                includeInteractiveActions: includeInteractiveActions
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getEditsForRefactor' request to the TypeScript Server to retrieve the specific code edits
     * required to apply a chosen refactoring action to a given code range or location in a TypeScript file.
     * The function handles both FileLocationRequestArgs (for a single location) and FileRangeRequestArgs
     * (for a range of code).
     *
     * @param {string} filePath - The absolute path to the TypeScript file where the refactoring will be applied.
     * @param {string} refactor - The programmatic name of the refactoring. This should match one of the refactoring
     *                            names received from the TypeScript server in response to a 'getApplicableRefactors' request.
     *                            Examples of refactor names could include 'Extract Method', 'Extract Function',
     *                            'Move to a new file', etc.
     * @param {string} action - The specific refactoring action to apply. This corresponds to one of the action names
     *                          provided by the TypeScript server within a particular refactoring category. Each refactoring
     *                          can have multiple actions, and this parameter should specify which one to apply.
     *                          For example, under the 'Extract Method' refactoring, there could be actions like
     *                          'Extract to inner function in function 'x'' or 'Extract to method in class 'Y''.
     * @param {number} startLine - The 1-based line number in the file where the refactoring range starts.
     * @param {number} startOffset - The 1-based character offset on the start line for the refactoring range.
     * @param {number} [endLine] - The 1-based line number where the refactoring range ends. This parameter is
     *                             optional for FileLocationRequestArgs.
     * @param {number} [endOffset] - The 1-based character offset on the end line for the refactoring range.
     *                               This parameter is optional for FileLocationRequestArgs.
     * @param {Object} [interactiveRefactorArguments] - Optional. Arguments for interactive refactor actions,
     *                                                  providing additional information needed for these actions.
     * @returns {Promise<Object>} A promise that resolves with the edits necessary to implement the refactoring.
     *                            The structure of the returned object depends on the TypeScript server's response
     *                            format for refactoring edits.
     * @example
     * // Example of extracting a method from a range of code in a file
     * getEditsForRefactor('/path/to/file.ts', 'Extract Method', 'Extract to method in class "MyClass"', 5, 1, 7, 1)
     *   .then(edits => {
     *     console.log('Refactoring Edits:', edits);
     *   })
     *   .catch(error => {
     *     console.error('Error getting refactoring edits:', error);
     *   });
     */
    //TODO: Write working use case with editor
    function getEditsForRefactor(filePath, refactor, action, startLine, startOffset, endLine, endOffset, interactiveRefactorArguments) {
        const args = endLine !== undefined && endOffset !== undefined
            ? {startLine, startOffset, endLine, endOffset} // FileRangeRequestArgs
            : {line: startLine, offset: startOffset}; // FileLocationRequestArgs

        const command = {
            command: "getEditsForRefactor",
            arguments: {
                file: filePath,
                refactor: refactor,
                action: action,
                ...args,
                interactiveRefactorArguments: interactiveRefactorArguments
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'GetMoveToRefactoringFileSuggestions' request to the TypeScript Server. This command retrieves a list of
     * existing file paths as suggestions for moving a specific piece of code as part of a refactoring process.
     * The function handles both single-location requests (FileLocationRequestArgs) and range-based requests (FileRangeRequestArgs).
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} startLine - The starting line number of the range or location (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} [endLine] - The ending line number of the range (1-based). Optional for single location.
     * @param {number} [endOffset] - The ending character offset on the end line (1-based). Optional for single location.
     * @param {string} [kind] - Optional. The kind of refactoring to apply.
     * @returns {Promise<Object>} A promise that resolves with a list of file paths suggested for the refactoring.
     * @example
     * // Example usage for a range in a file
     * getMoveToRefactoringFileSuggestions('/path/to/file.ts', 5, 1, 7, 1)
     *   .then(suggestions => {
     *     console.log('Refactoring File Suggestions:', suggestions);
     *   })
     *   .catch(error => {
     *     console.error('Error getting file suggestions for refactoring:', error);
     *   });
     */
    function getMoveToRefactoringFileSuggestions(filePath, startLine, startOffset, endLine, endOffset, kind) {
        const args = endLine !== undefined && endOffset !== undefined
            ? {startLine, startOffset, endLine, endOffset} // FileRangeRequestArgs
            : {line: startLine, offset: startOffset}; // FileLocationRequestArgs

        const command = {
            command: "getMoveToRefactoringFileSuggestions",
            arguments: {
                file: filePath,
                ...args,
                kind: kind
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends an 'organizeImports' request to the TypeScript Server. This command organizes the imports in a TypeScript file by:
     *   1) Removing unused imports.
     *   2) Coalescing imports from the same module.
     *   3) Sorting imports.
     * The scope of the request is limited to a single file. The function allows specifying the mode of import organization.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {string} [mode] - The mode of import organization, which can be 'All', 'SortAndCombine', or 'RemoveUnused'. Default is 'All'.
     * @param {string} [projectFileName] - Optional. The name of the project that contains the file (e.g., path to 'tsconfig.json').
     * @returns {Promise<Object>} A promise that resolves with an array of file code edits suggested by the TypeScript server. Each edit includes the file name and an array of text changes.
     * @example
     * // Organizing imports in a file with all modes
     * organizeImports('/path/to/file.ts', 'All', '/path/to/project/tsconfig.json')
     *   .then(edits => {
     *     console.log('Organize Imports Edits:', edits);
     *   })
     *   .catch(error => {
     *     console.error('Error organizing imports:', error);
     *   });
     */
    function organizeImports(filePath, mode = 'All', projectFileName) {
        const command = {
            command: "organizeImports",
            arguments: {
                scope: {
                    type: "file",
                    args: {file: filePath, projectFileName: projectFileName}
                },
                mode: mode
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'getEditsForFileRename' request to the TypeScript Server. This function is used to retrieve
     * the necessary code edits required when a file is renamed. It updates import paths and references in
     * other files within the project to reflect the new file name.
     *
     * @param {string} oldFilePath - The original path of the file before renaming.
     * @param {string} newFilePath - The new path of the file after renaming.
     * @returns {Promise} A promise that resolves with an array of file code edits. Each element in the array
     *                    is an object containing the file name and an array of text changes. Each text change
     *                    is an object with 'start', 'end', and 'newText' properties indicating how the text
     *                    should be modified.
     * @example
     * getEditsForFileRename('/path/to/oldFile.ts', '/path/to/newFile.ts')
     *   .then(edits => {
     *     console.log('File Rename Edits:', edits);
     *   })
     *   .catch(error => {
     *     console.error('Error getting edits for file rename:', error);
     *   });
     */
    function getEditsForFileRename(oldFilePath, newFilePath) {
        const command = {
            command: "getEditsForFileRename",
            arguments: {
                oldFilePath: oldFilePath,
                newFilePath: newFilePath
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'configurePlugin' request to the TypeScript Server. This command is used to configure a specific
     * TypeScript language service plugin with provided options. The configuration can be any object structure
     * as required by the specific plugin being configured.
     *
     * @param {string} pluginName - The name of the plugin to configure.
     * @param {Object} configuration - The configuration settings for the plugin. This can be any object structure
     *                                 depending on what the plugin accepts.
     * @returns {Promise<void>} A promise that resolves when the plugin has been configured successfully. The promise
     *                          does not return any value upon resolution.
     * @example
     * configurePlugin('myPlugin', { option1: true, option2: 'value' })
     *   .then(() => {
     *     console.log('Plugin configured successfully.');
     *   })
     *   .catch(error => {
     *     console.error('Error configuring plugin:', error);
     *   });
     */
    //TODO: Test this code and identify use cases
    function configurePlugin(pluginName, configuration) {
        const command = {
            command: "configurePlugin",
            arguments: {
                pluginName: pluginName,
                configuration: configuration
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a 'selectionRange' request to the TypeScript Server. This function retrieves selection range
     * information for multiple specified locations in a TypeScript file. It is useful for features like
     * smart selection in editors, where the selected code block can be expanded or contracted based on
     * syntactic and semantic understanding of the code.
     *
     * @param {string} filePath - The path to the TypeScript file.
     * @param {Array} locations - An array of locations in the file. Each location should be an object
     *                            with 'line' and 'offset' properties indicating the position in the file.
     * @returns {Promise} A promise that resolves with an array of selection range information for each
     *                    location provided. Each element in the array is an object representing the
     *                    selection range for that location.
     * @example
     * // Example of getting selection ranges for two different locations in a file
     * selectionRange('/path/to/file.ts', [{ line: 10, offset: 15 }, { line: 12, offset: 5 }])
     *   .then(ranges => {
     *     console.log('Selection Ranges:', ranges);
     *   })
     *   .catch(error => {
     *     console.error('Error getting selection ranges:', error);
     *   });
     */
    function selectionRange(filePath, locations) {
        const command = {
            command: "selectionRange",
            arguments: {
                file: filePath,
                locations: locations
            }
        };
        return sendCommand(command);
    }

    /**
     * Toggles line comments for a specified range in a TypeScript file.
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} startLine - The starting line number for the range (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} endLine - The ending line number for the range (1-based).
     * @param {number} endOffset - The ending character offset on the end line (1-based).
     * @param {string} [projectFileName] - Optional. The name of the project that contains the file.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function toggleLineComment(filePath, startLine, startOffset, endLine, endOffset, projectFileName) {
        const command = {
            command: "toggleLineComment",
            arguments: {
                file: filePath,
                startLine: startLine,
                startOffset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Toggles multi-line comments for a specified range in a TypeScript file.
     * This function sends a request to `tsserver` to add or remove multi-line
     * comments (/* ... *\/) in the specified range of the file.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} startLine - The starting line number for the range (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} endLine - The ending line number for the range (1-based).
     * @param {number} endOffset - The ending character offset on the end line (1-based).
     * @param {string} [projectFileName] - Optional. The name of the project that contains the file.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function toggleMultilineComment(filePath, startLine, startOffset, endLine, endOffset, projectFileName) {
        const command = {
            command: "toggleMultilineComment",
            arguments: {
                file: filePath,
                startLine: startLine,
                startOffset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Comments a selected range in a TypeScript file.
     * This function sends a `CommentSelectionRequest` to `tsserver` to add line comments (//) to the specified range of the file.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} startLine - The starting line number for the selection (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} endLine - The ending line number for the selection (1-based).
     * @param {number} endOffset - The ending character offset on the end line (1-based).
     * @param {string} [projectFileName] - Optional. The name of the project that contains the file.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function commentSelection(filePath, startLine, startOffset, endLine, endOffset, projectFileName) {
        const command = {
            command: "commentSelection",
            arguments: {
                file: filePath,
                startLine: startLine,
                startOffset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Uncomments a selected range in a TypeScript file.
     * This function sends an `UncommentSelectionRequest` to `tsserver` to remove line comments (//) from the specified range of the file.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} startLine - The starting line number for the selection (1-based).
     * @param {number} startOffset - The starting character offset on the start line (1-based).
     * @param {number} endLine - The ending line number for the selection (1-based).
     * @param {number} endOffset - The ending character offset on the end line (1-based).
     * @param {string} [projectFileName] - Optional. The name of the project that contains the file.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function uncommentSelection(filePath, startLine, startOffset, endLine, endOffset, projectFileName) {
        const command = {
            command: "uncommentSelection",
            arguments: {
                file: filePath,
                startLine: startLine,
                startOffset: startOffset,
                endLine: endLine,
                endOffset: endOffset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server (`tsserver`) to prepare call hierarchy information at a specific location in a TypeScript file.
     * This feature is useful in IDEs and code editors for navigating through code and understanding
     * call relationships within the codebase, such as finding all calls to a particular function or method.
     *
     * The function constructs and sends a `prepareCallHierarchy` command to `tsserver`. The command includes
     * the file path and the position (line and offset) within the file where the call hierarchy analysis should start.
     * The response from `tsserver` will include information about the call hierarchy at the specified position.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file where the call hierarchy preparation should start.
     * @param {number} offset - The 1-based character offset on the specified line.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., `tsconfig.json`) that contains the TypeScript file.
     * @returns {Promise<Object>} A promise that resolves with the call hierarchy information from `tsserver`.
     *
     * @example
     * // Example of how to use prepareCallHierarchy function:
     * prepareCallHierarchy('/path/to/yourFile.ts', 10, 15, '/path/to/tsconfig.json')
     *   .then(response => {
     *     console.log('Call Hierarchy Information:', response);
     *   })
     *   .catch(error => {
     *     console.error('Error in preparing call hierarchy:', error);
     *   });
     */
    function prepareCallHierarchy(filePath, line, offset, projectFileName) {
        const command = {
            command: "prepareCallHierarchy",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to retrieve incoming call hierarchy information for a specific location in a TypeScript file.
     * This function is utilized to identify all the calls leading to a particular symbol (function or method) at the given position.
     *
     * The function sends a request to `tsserver` with the file path and position details (line and offset). The response from `tsserver` includes
     * details about each incoming call such as the caller's location and the span of the call in the source file.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file where the symbol is located.
     * @param {number} offset - The 1-based character offset on the specified line.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., `tsconfig.json`) that contains the TypeScript file.
     * @returns {Promise<Object>} - A promise that resolves to an object containing an array of incoming call information.
     *                              Each element in this array represents an incoming call and includes:
     *                              - `from`: An object representing the caller. This includes properties like:
     *                                - `name`: Name of the caller.
     *                                - `kind`: Kind of the caller (e.g., function, method).
     *                                - `file`: File path where the caller is located.
     *                                - `span`: Object representing the span of the call in the caller's file.
     *                                - `selectionSpan`: Object representing the span of the symbol being called.
     *                                - Additional properties as per the `CallHierarchyItem` interface.
     *                              - `fromSpans`: An array of objects, each representing the span of the call in the caller's source file.
     * @example
     * // How to use provideCallHierarchyIncomingCalls function:
     * provideCallHierarchyIncomingCalls('/path/to/yourFile.ts', 10, 15, '/path/to/tsconfig.json')
     *   .then(response => {
     *     console.log('Incoming Call Hierarchy Information:', response);
     *   })
     *   .catch(error => {
     *     console.error('Error in getting incoming call hierarchy:', error);
     *   });
     */

    function provideCallHierarchyIncomingCalls(filePath, line, offset, projectFileName) {
        const command = {
            command: "provideCallHierarchyIncomingCalls",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to retrieve outgoing call hierarchy information for a specific location in a TypeScript file.
     * This function is used to identify all the calls made from a particular symbol (function or method) at the given position.
     *
     * The function constructs a command object with the file path, line number, character offset, and optional project file name, and sends it
     * to `tsserver`. The server then responds with details about each outgoing call from the specified symbol. These details include the callee's
     * location and the text spans of the call in the source file.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file where the symbol is located.
     * @param {number} offset - The 1-based character offset on the specified line.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., `tsconfig.json`) that contains the TypeScript file.
     * @returns {Promise<Object>} A promise that resolves to an object containing an array of outgoing call information. Each element in this array
     *                            is an object representing an outgoing call and includes:
     *                            - `to`: An object representing the callee, detailed as:
     *                              - `name`: String. The name of the callee.
     *                              - `kind`: String. The kind of the callee, as per ScriptElementKind (e.g., 'function', 'method', 'class').
     *                              - `kindModifiers`: String. Optional. Modifiers of the callee kind (e.g., 'public', 'static').
     *                              - `file`: String. The file path where the callee is located.
     *                              - `span`: TextSpan. The text span representing the span of the callee's declaration in its file.
     *                              - `selectionSpan`: TextSpan. The text span representing the symbol's selection span.
     *                              - `containerName`: String. Optional. The name of the container (e.g., class or namespace) of the callee.
     *                            - `fromSpans`: Array of TextSpan. Each TextSpan represents the span of the call in the source file.
     * @example
     * // Example usage of provideCallHierarchyOutgoingCalls function:
     * provideCallHierarchyOutgoingCalls('/path/to/yourFile.ts', 10, 15, '/path/to/tsconfig.json')
     *   .then(response => {
     *     console.log('Outgoing Call Hierarchy Information:', response);
     *   })
     *   .catch(error => {
     *     console.error('Error in getting outgoing call hierarchy:', error);
     *   });
     */
    function provideCallHierarchyOutgoingCalls(filePath, line, offset, projectFileName) {
        const command = {
            command: "provideCallHierarchyOutgoingCalls",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to provide inlay hints for a specific range within a TypeScript file.
     * Inlay hints are annotations displayed inline in the code, providing additional information such as type hints,
     * parameter names, or enum values. This function enhances code readability by revealing implicit code aspects directly in the editor.
     *
     * The function constructs a command object specifying the file path, start position, and span length for which inlay hints are desired.
     * The request is sent to `tsserver`, and the server's response includes an array of inlay hints, each detailing the hint's content and location.
     *
     * @param {string} filePath - The absolute path to the TypeScript file for which inlay hints are requested.
     * @param {number} start - The start position in the file (character count from the beginning) for the range to retrieve hints.
     * @param {number} length - The length of the range (in characters) for which hints should be provided.
     * @param {string} [projectFileName] - Optional. The path to the project file (e.g., `tsconfig.json`) associated with the TypeScript file.
     * @returns {Promise<Object>} - A promise that resolves to an object containing:
     *                              - `body`: An array of objects, each representing an inlay hint with the following properties:
     *                                - `text`: The text of the inlay hint (string).
     *                                - `position`: The position within the file where the hint is located, specified as an object with line and character properties.
     *                                - `kind`: The kind of the inlay hint (string), such as 'Type', 'Parameter', or 'Enum'.
     *                                - `whitespaceBefore`: Optional boolean indicating if whitespace should precede the hint.
     *                                - `whitespaceAfter`: Optional boolean indicating if whitespace should follow the hint.
     *                                - `displayParts`: Optional array of objects representing additional parts of the hint, each with `text` and optionally `span`.
     * @example
     * // Example usage of provideInlayHints function:
     * provideInlayHints('/path/to/yourFile.ts', 0, 500, '/path/to/tsconfig.json')
     *   .then(response => {
     *     console.log('Inlay Hints:', response.body);
     *   })
     *   .catch(error => {
     *     console.error('Error in getting inlay hints:', error);
     *   });
     */
    //TODO : figure out how to make it work
    function provideInlayHints(filePath, start, length, projectFileName) {
        const command = {
            command: "provideInlayHints",
            arguments: {
                file: filePath,
                start: start,
                length: length,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a watch change request to the TypeScript Server.
     * This function is used to notify the server about file changes.
     *
     * @param {number} id - The identifier for the watch request.
     * @param {string} path - The path to the file that has changed.
     * @param {"create" | "delete" | "update"} eventType - The type of change event.
     */
    // TODO see why unknown json command response is returned from server
    function sendWatchChangeRequest(id, path, eventType) {
        const command = {
            command: "watchChange",
            arguments: {
                id: id,
                path: path,
                eventType: eventType
            }
        };

        // Assuming sendCommand is a function that sends a command to tsserver
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server (TSServer) to automatically insert a JSX closing tag in a JSX/TSX file.
     * This function is particularly useful in development environments or editors that support JSX/TSX syntax, as it
     * automates the process of closing tag insertion.
     *
     * The function returns a promise. When resolved successfully, the promise provides an object with details about the
     * inserted closing tag. This object contains the `newText` (the closing tag text) and `caretOffset` (the position where
     * the caret should be placed after insertion). If the request fails, the promise is rejected with the error details.
     *
     * @param {string} filePath - The absolute path to the JSX/TSX file where the closing tag will be inserted.
     * @param {number} line - The 1-based line number in the file where the closing tag should be inserted. Typically, this
     *                        is the line with the corresponding opening JSX tag.
     * @param {number} offset - The 1-based character offset on the specified line for the closing tag insertion.
     * @returns {Promise<{newText: string, caretOffset: number}>} A promise that resolves with an object containing:
     *                   - `newText`: String. The text of the inserted JSX closing tag.
     *                   - `caretOffset`: Number. The position in the newText where the caret should be placed after insertion.
     *                   If the operation fails, the promise is rejected with an error.
     *
     * @example
     * // Example usage of jsxClosingTag:
     * jsxClosingTag('/path/to/component.tsx', 10, 5)
     *   .then(response => console.log('JSX Closing Tag Inserted:', response))
     *   .catch(error => console.error('Error inserting JSX Closing Tag:', error));
     */
    function jsxClosingTag(filePath, line, offset) {
        const command = {
            command: "jsxClosingTag",
            arguments: {
                file: filePath,
                line: line,
                offset: offset
            }
        };

        // Return the promise created by sendCommand
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to obtain linked editing ranges for a specific location in a JSX/TSX file.
     * Linked editing ranges are useful for scenarios like editing paired tags, where changing one tag automatically updates the corresponding tag.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file.
     * @param {number} offset - The 1-based character offset in the line.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., tsconfig.json) that contains the TypeScript file.
     * @returns {Promise<Object>} A promise that resolves with linked editing range information from the TypeScript server.
     * The response includes:
     *  - `ranges`: Array of range objects (each range has `start` and `end` locations).
     *  - `wordPattern`: Optional regular expression pattern describing the allowable contents of the range.
     */
    function getLinkedEditingRange(filePath, line, offset, projectFileName) {
        const command = {
            command: "linkedEditingRange",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                projectFileName: projectFileName
            }
        };

        return sendCommand(command);
    }


    /**
     * Sends a "brace" command to the TypeScript Server to find the matching braces in the file at a specified location.
     * The function expects the absolute path of the file, along with the line number and character offset of the location.
     * It returns the locations of matching braces found in the file.
     *
     * @param {string} filePath - The absolute path to the file.
     * @param {number} line - The 1-based line number in the file.
     * @param {number} offset - The 1-based character offset in the line.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., tsconfig.json) that contains the TypeScript file.
     * @returns {Promise<Object>} A promise that resolves with an array of TextSpan objects, each representing a span of text where a matching brace is found.
     */

    function braceCommand(filePath, line, offset, projectFileName) {
        const command = {
            command: "brace",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                projectFileName: projectFileName
            }
        };

        return sendCommand(command);
    }

    /**
     * Sends a "braceCompletion" command to the TypeScript Server to determine if automatic brace completion is appropriate at a specified location.
     * This function is particularly useful for editor features like auto-inserting the corresponding closing brace when an opening brace is typed.
     *
     * @param {string} filePath - The absolute path to the TypeScript file where the opening brace was typed.
     * @param {number} line - The 1-based line number in the file where the opening brace was typed.
     * @param {number} offset - The 1-based character offset in the line just after the opening brace.
     * @param {string} openingBrace - The kind of opening brace (e.g., '{', '(', '[') for which completion is being requested.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., tsconfig.json) associated with the TypeScript file.
     * @returns {Promise<Object>} - A promise that resolves with the server's response. The structure of the response depends on the implementation in TSServer.
     *                              Typically, it might include a boolean indicating whether the closing brace should be automatically inserted.
     */
    // TODO: see working and non-working use case
    function braceCompletion(filePath, line, offset, openingBrace, projectFileName) {
        const command = {
            command: "braceCompletion",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                openingBrace: openingBrace,
                projectFileName: projectFileName
            }
        };
        return sendCommand(command);
    }

    /**
     * Sends a request to the TypeScript Server to determine if the caret is inside a comment, and if so, retrieves the span of the enclosing comment.
     * The function checks for comments at a specific location in a TypeScript file and returns the comment span if found.
     *
     * @param {string} filePath - The absolute path to the TypeScript file.
     * @param {number} line - The 1-based line number in the file where the caret is located.
     * @param {number} offset - The 1-based character offset (column number) in the line where the caret is located.
     * @param {boolean} onlyMultiLine - If true, the function requires that the enclosing span be a multi-line comment. Otherwise, the request returns undefined.
     * @param {string} [projectFileName] - Optional. The name of the project file (e.g., tsconfig.json) that contains the TypeScript file.
     * @returns {Promise<Object>} A promise that resolves with an object containing the span of the enclosing comment. The object has properties 'start' and 'end', each an object with 'line' and 'offset'. If no enclosing comment is found, or if the comment is not multi-line when 'onlyMultiLine' is true, the result is undefined.
     */
    function getSpanOfEnclosingComment(filePath, line, offset, onlyMultiLine, projectFileName) {
        const command = {
            command: "getSpanOfEnclosingComment",
            arguments: {
                file: filePath,
                line: line,
                offset: offset,
                onlyMultiLine: onlyMultiLine,
                projectFileName: projectFileName
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
            console.log('tsserver  terminated');
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
        projectInfo,
        reloadProjects,
        openExternalProject,
        openExternalProjects,
        closeExternalProject,
        updateOpen,
        getOutliningSpans,
        indentation,
        todoComments,
        docCommentTemplate,
        setCompilerOptionsForInferredProjects,
        getCodeFixes,
        getCombinedCodeFix,
        getSupportedCodeFixes,
        getApplicableRefactors,
        getEditsForRefactor,
        getMoveToRefactoringFileSuggestions,
        organizeImports,
        getEditsForFileRename,
        configurePlugin,
        selectionRange,
        toggleLineComment,
        toggleMultilineComment,
        commentSelection,
        uncommentSelection,
        prepareCallHierarchy,
        provideCallHierarchyIncomingCalls,
        provideCallHierarchyOutgoingCalls,
        provideInlayHints,
        sendWatchChangeRequest,
        jsxClosingTag,
        getLinkedEditingRange,
        braceCommand,
        braceCompletion,
        getSpanOfEnclosingComment,
        exitServer
    };
}

export default createTSServerInstance;
