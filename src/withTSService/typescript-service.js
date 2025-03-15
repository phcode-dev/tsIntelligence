import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Client for TypeScript Language Server that requests code completions
 * at a specific position in a file, following LSP 3.17 specification
 */
class TypeScriptCompletionClient {
  constructor(projectPath) {
    this.projectPath = path.resolve(projectPath);
    this.messageId = 0;
    this.server = null;
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.defaultCommitCharacters = undefined;
  }

  /**
   * Start the TypeScript language server
   */
  async start() {
    try {
      // Use locally installed typescript-language-server
      const serverPath = path.resolve("./", 'node_modules', '.bin', 'typescript-language-server');
      this.server = spawn(serverPath, ['--stdio'], {
        cwd: this.projectPath,
        env: process.env
      });

      // Set up message handling
      this._setupMessageHandling();

      // Initialize the server and wait for it to be ready
      await this._initializeServer();

      return true;
    } catch (err) {
      console.error('Failed to start server:', err);
      this.dispose();
      throw err;
    }
  }

  /**
   * Set up message handling from the language server
   */
  _setupMessageHandling() {
    let buffer = '';

    this.server.stdout.on('data', (data) => {
      buffer += data.toString();

      // Process complete messages according to LSP spec
      while (buffer.length > 0) {
        // Check for Content-Length header
        const headerMatch = buffer.match(/Content-Length: (\d+)\r\n\r\n/);
        if (!headerMatch) {
          // We don't have a complete header yet
          break;
        }

        const contentLength = parseInt(headerMatch[1], 10);
        const headerEnd = headerMatch.index + headerMatch[0].length;

        // Check if we have the complete message
        if (buffer.length < headerEnd + contentLength) {
          // Wait for the complete message
          break;
        }

        // Extract the JSON message
        const jsonContent = buffer.substring(headerEnd, headerEnd + contentLength);
        buffer = buffer.substring(headerEnd + contentLength);

        try {
          const message = JSON.parse(jsonContent);
          this._handleMessage(message);
        } catch (err) {
          console.error('Error parsing message:', err);
          console.error('Message content:', jsonContent);
        }
      }
    });

    this.server.stderr.on('data', (data) => {
      console.error(`Server stderr: ${data.toString()}`);
    });

    this.server.on('error', (err) => {
      console.error('Server error:', err);
    });

    this.server.on('close', (code) => {
      console.log(`Language server exited with code ${code}`);
    });
  }

  /**
   * Handle a message from the language server
   */
  _handleMessage(message) {
    // Handle response messages (have an id that matches a pending request)
    if ('id' in message && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);

      if ('error' in message) {
        reject(new Error(message.error.message || JSON.stringify(message.error)));
      } else if ('result' in message) {
        resolve({
          type: 'response',
          body: message.result,
          metadata: message.metadata,
          performanceData: message.performanceData
        });
      } else {
        reject(new Error(`Invalid response message: ${JSON.stringify(message)}`));
      }
      return;
    }

    // Handle notification messages (have a method but no id)
    if ('method' in message && !('id' in message)) {
      this._handleNotification(message);
      return;
    }

    // Handle request messages (have an id and a method but we don't expect any from the server)
    if ('id' in message && 'method' in message) {
      console.log(`Unexpected request from server: ${message.method}`);
      // We could respond with a MethodNotFound error but most clients don't need to
      return;
    }

    console.log(`Unhandled message: ${JSON.stringify(message)}`);
  }

  /**
   * Handle a notification from the language server
   */
  _handleNotification(message) {
    switch (message.method) {
      case '$/typescriptVersion':
        if (message.params) {
          console.log(`TypeScript version: ${message.params.version} (${message.params.source})`);
        }
        break;

      case 'window/logMessage':
        if (message.params) {
          const levels = ['ERROR', 'WARNING', 'INFO', 'LOG'];
          const level = message.params.type > 0 && message.params.type <= levels.length
            ? levels[message.params.type - 1]
            : 'UNKNOWN';
          console.log(`[${level}] ${message.params.message}`);
        }
        break;

      case 'window/showMessage':
        if (message.params) {
          const levels = ['ERROR', 'WARNING', 'INFO', 'LOG'];
          const level = message.params.type > 0 && message.params.type <= levels.length
            ? levels[message.params.type - 1]
            : 'UNKNOWN';
          console.log(`[${level}] ${message.params.message}`);
        }
        break;

      case 'textDocument/publishDiagnostics':
        // Handle diagnostics (errors, warnings) if needed
        break;

      // These notifications are expected and don't need special handling
      case 'initialized':
      case 'exit':
        break;

      default:
        console.log(`Server notification: ${message.method}`);
    }
  }

  /**
   * Send a JSON-RPC request to the language server
   */
  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      if (!this.server || this.server.killed) {
        reject(new Error('Server is not running'));
        return;
      }

      const id = this.messageId++;
      this.pendingRequests.set(id, { resolve, reject });

      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      const content = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
      this.server.stdin.write(header + content);
    });
  }

  /**
   * Send a notification to the language server (no response expected)
   */
  sendNotification(method, params) {
    if (!this.server || this.server.killed) {
      console.error('Server is not running');
      return;
    }

    const notification = {
      jsonrpc: '2.0',
      method,
      params
    };

    const content = JSON.stringify(notification);
    const header = `Content-Length: ${Buffer.byteLength(content, 'utf8')}\r\n\r\n`;
    this.server.stdin.write(header + content);
  }

  /**
   * Initialize the language server according to LSP 3.17
   */
  async _initializeServer() {
    // Send initialize request
    const result = await this.sendRequest('initialize', {
      processId: process.pid,
      clientInfo: {
        name: 'typescript-completion-client',
        version: '1.0.0'
      },
      locale: 'en',
      rootPath: this.projectPath,
      rootUri: `file://${this.projectPath}`,
      capabilities: {
        workspace: {
          applyEdit: true,
          workspaceEdit: {
            documentChanges: true,
            resourceOperations: ['create', 'rename', 'delete']
          },
          didChangeConfiguration: { dynamicRegistration: true },
          didChangeWatchedFiles: { dynamicRegistration: true },
          symbol: { dynamicRegistration: true },
          executeCommand: { dynamicRegistration: true }
        },
        textDocument: {
          synchronization: {
            dynamicRegistration: true,
            willSave: true,
            willSaveWaitUntil: true,
            didSave: true
          },
          completion: {
            dynamicRegistration: true,
            contextSupport: true,
            completionItem: {
              snippetSupport: true,
              commitCharactersSupport: true,
              documentationFormat: ['markdown', 'plaintext'],
              deprecatedSupport: true,
              preselectSupport: true,
              tagSupport: {
                valueSet: [1] // Deprecated
              },
              insertReplaceSupport: true,
              resolveSupport: {
                properties: ['documentation', 'detail', 'additionalTextEdits']
              },
              insertTextModeSupport: {
                valueSet: [1, 2] // asIs, adjustIndentation
              }
            },
            completionItemKind: {
              valueSet: [
                1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25
              ]
            }
          },
          hover: {
            dynamicRegistration: true,
            contentFormat: ['markdown', 'plaintext']
          },
          signatureHelp: {
            dynamicRegistration: true,
            signatureInformation: {
              documentationFormat: ['markdown', 'plaintext'],
              parameterInformation: {
                labelOffsetSupport: true
              },
              activeParameterSupport: true
            }
          },
          declaration: {
            dynamicRegistration: true,
            linkSupport: true
          },
          definition: {
            dynamicRegistration: true,
            linkSupport: true
          },
          typeDefinition: {
            dynamicRegistration: true,
            linkSupport: true
          },
          implementation: {
            dynamicRegistration: true,
            linkSupport: true
          }
        }
      },
      initializationOptions: {
        preferences: {
          includeCompletionsForModuleExports: true,
          includeCompletionsForImportStatements: true,
          includeCompletionsWithSnippetText: true,
          includeAutomaticOptionalChainCompletions: true,
          includeCompletionsWithInsertText: true,
          includeCompletionsWithClassMemberSnippets: true,
          allowIncompleteCompletions: true,
          includeCompletionsWithObjectLiteralMethodSnippets: true
        }
      },
      workspaceFolders: [
        {
          uri: `file://${this.projectPath}`,
          name: path.basename(this.projectPath)
        }
      ]
    });

    // Send initialized notification (not a request, doesn't expect a response)
    this.sendNotification('initialized', {});

    this.isInitialized = true;
    return result;
  }

  /**
   * Checks if a file exists and normalizes the path
   * @private
   */
  _validateFilePath(filePath) {
    const absolutePath = path.resolve(this.projectPath, filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    return absolutePath;
  }

  /**
   * Notifies the server about an open file
   * @private
   */
  _notifyFileOpen(filePath, fileContent) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;
    const content = fileContent || fs.readFileSync(absolutePath, 'utf8');

    this.sendNotification('textDocument/didOpen', {
      textDocument: {
        uri: fileUri,
        languageId: path.extname(filePath) === '.ts' ? 'typescript' : 'javascript',
        version: 1,
        text: content
      }
    });

    return { fileUri, content };
  }

  /**
   * Detects relevant context information for a position in a file
   * @private
   */
  _detectCompletionContext(fileContent, line, character) {
    const lines = fileContent.split('\n');
    const lineText = lines[line] || '';

    // Is this a member completion? (after a dot)
    const isMemberCompletion = /\.\s*$/.test(lineText.substring(0, character));

    // Is this a new identifier location?
    const isNewIdentifierLocation = this._isLikelyNewIdentifierLocation(lineText, character);

    // Is this after an import statement?
    const isImportCompletion = /\bimport\s+$/.test(lineText.substring(0, character)) ||
                              /\bimport\s+{[^}]*$/.test(lineText.substring(0, character));

    // Get word range at position
    const wordRange = this._getWordRangeAtPosition(lineText, character);

    return {
      isMemberCompletion,
      isNewIdentifierLocation,
      isImportCompletion,
      lineText,
      wordRange
    };
  }

  /**
   * Checks if a position is likely a new identifier location
   * @private
   */
  _isLikelyNewIdentifierLocation(lineText, character) {
    // Simplified heuristic - can be improved
    const prefix = lineText.substring(0, character).trim();
    return /\b(const|let|var|function|class|interface|type|enum)\s+$/.test(prefix);
  }

  /**
   * Gets the word range at a position in a line of text
   * @private
   */
  _getWordRangeAtPosition(lineText, character) {
    // Basic word range detection
    let start = character;
    while (start > 0 && /[\w$]/.test(lineText[start - 1])) {
      start--;
    }

    let end = character;
    while (end < lineText.length && /[\w$]/.test(lineText[end])) {
      end++;
    }

    if (start === end) {
      return undefined;
    }

    return { start, end };
  }

  /**
   * Get Typescript completion trigger character
   * @private
   */
  _getTsTriggerCharacter(triggerCharacter) {
    switch (triggerCharacter) {
      case '@':
      case '#':
      case '.':
      case '"':
      case '\'':
      case '`':
      case '/':
      case '<':
        return triggerCharacter;
      case ' ':
        return ' '; // Only works in TS 4.3.0+
      default:
        return undefined;
    }
  }

  /**
   * Get completions at a specific position in a file
   */
  async getCompletions(filePath, line, character, triggerCharacter) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;
    const fileContent = fs.readFileSync(absolutePath, 'utf8');

    // Notify the server about the file
    this._notifyFileOpen(filePath, fileContent);

    // Detect context for better completions
    const context = this._detectCompletionContext(fileContent, line, character);

    // Request completions according to LSP 3.17
    const params = {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      },
      context: {
        triggerKind: triggerCharacter ? 2 : 1, // 1 = Invoked, 2 = TriggerCharacter
        triggerCharacter: this._getTsTriggerCharacter(triggerCharacter)
      }
    };

    const response = await this.sendRequest('textDocument/completion', params);

    if (response && response.type === 'response' && response.body) {
      // Preserve important completion context
      this.defaultCommitCharacters = response.body.defaultCommitCharacters || this.defaultCommitCharacters;

      // Process and enhance completion items
      const completions = this._processCompletionItems(
        response.body,
        context,
        { line: parseInt(line, 10), character: parseInt(character, 10) }
      );

      return {
        items: completions,
        isIncomplete: !!response.body.isIncomplete || (response.metadata && response.metadata.isIncomplete),
        metadata: response.metadata,
        performanceData: response.performanceData
      };
    }

    return response;
  }

  /**
   * Process and enhance completion items with additional information
   * @private
   */
  _processCompletionItems(completionInfo, context, position) {
    if (!completionInfo || !completionInfo.items) {
      return [];
    }

    return completionInfo.items.map(entry => {
      // Convert kind to more meaningful categorization
      const kind = entry.kind;

      // Process modifiers (deprecated, optional, etc)
      const modifiers = this._parseKindModifiers(entry.kindModifiers);

      // Extract detail from entry
      const detail = this._getCompletionItemDetail(entry);

      // Determine commit characters
      const commitCharacters = this._getCommitCharacters(entry, context);

      // Calculate sort priority
      const sortText = this._getSortText(entry, modifiers);

      // Handle filter text for better matching
      const filterText = this._getFilterText(entry, context);

      // Handle insert text
      const insertText = entry.insertText || entry.label;

      // Determine if this item should be preselected
      const preselect = !!entry.isRecommended;

      return {
        label: entry.label,
        kind,
        detail,
        documentation: undefined, // Will be resolved on demand
        deprecated: modifiers.has('deprecated'),
        preselect,
        sortText,
        filterText,
        insertText,
        commitCharacters,
        additionalTextEdits: undefined, // Will be resolved on demand
        data: {
          entryName: entry.label,
          source: entry.source,
          data: entry.data,
          position,
          uri: context.uri
        },
        tags: modifiers.has('deprecated') ? [1] : undefined, // 1 = Deprecated tag
        // Original entry for reference
        original: entry
      };
    });
  }

  /**
   * Convert TypeScript completion item kind to standard kind
   * @private
   */
  _convertCompletionItemKind(kind) {
    // These numbers correspond to CompletionItemKind enum in LSP spec
    switch (kind) {
      case 'primitive type':
      case 'keyword':
        return 14; // Keyword

      case 'const':
      case 'let':
      case 'var':
      case 'local variable':
      case 'alias':
      case 'parameter':
        return 6; // Variable

      case 'member':
      case 'member variable':
      case 'member get accessor':
      case 'member set accessor':
        return 5; // Field

      case 'function':
      case 'local function':
        return 3; // Function

      case 'method':
      case 'constructor signature':
      case 'call signature':
      case 'index signature':
        return 2; // Method

      case 'enum':
        return 13; // Enum

      case 'enum member':
        return 20; // EnumMember

      case 'module':
      case 'external module name':
        return 9; // Module

      case 'class':
      case 'type':
        return 7; // Class

      case 'interface':
        return 8; // Interface

      case 'warning':
        return 1; // Text

      case 'script':
        return 17; // File

      case 'directory':
        return 19; // Folder

      case 'string':
        return 15; // Constant

      default:
        return 10; // Property
    }
  }

  /**
   * Parse kindModifiers string into a Set of modifiers
   * @private
   */
  _parseKindModifiers(kindModifiers) {
    if (!kindModifiers) {
      return new Set();
    }

    return new Set(kindModifiers.split(','));
  }

  /**
   * Get detail text for completion item
   * @private
   */
  _getCompletionItemDetail(entry) {
    // For scripts, return file extension details
    if (entry.kind === 'script' && entry.kindModifiers) {
      const modifiers = this._parseKindModifiers(entry.kindModifiers);
      const fileExtensions = ['js', 'jsx', 'ts', 'tsx', 'd.ts'];

      for (const ext of fileExtensions) {
        if (modifiers.has(ext)) {
          return entry.label.endsWith(ext) ? entry.label : `${entry.label}.${ext}`;
        }
      }
    }

    return entry.kind || '';
  }

  /**
   * Get commit characters for a completion item
   * @private
   */
  _getCommitCharacters(entry, context) {
    // Use explicitly provided commit characters if available
    if (entry.commitCharacters) {
      return entry.commitCharacters;
    }

    if (this.defaultCommitCharacters) {
      const result = [...this.defaultCommitCharacters];

      // Add parentheses for function/method calls
      if (context && !context.isNewIdentifierLocation &&
          entry.kind !== 'warning' && entry.kind !== 'string' &&
          (entry.kind === 'function' || entry.kind === 'method' ||
           entry.kind === 'constructor signature' || entry.kind === 'call signature')) {
        if (!result.includes('(')) {
          result.push('(');
        }
      }

      return result;
    }

    // Provide sensible defaults if nothing else is available
    if (entry.kind === 'warning' || entry.kind === 'string') {
      return undefined;
    }

    const defaultChars = ['.', ',', ';'];

    // Add parentheses for function/method calls
    if (context && !context.isNewIdentifierLocation &&
        (entry.kind === 'function' || entry.kind === 'method' ||
         entry.kind === 'constructor signature' || entry.kind === 'call signature')) {
      defaultChars.push('(');
    }

    return defaultChars;
  }

  /**
   * Get sort text for completion item
   * @private
   */
  _getSortText(entry, modifiers) {
    // Auto-imports should be de-prioritized
    if (entry.source && entry.hasAction) {
      return '\uffff' + (entry.sortText || entry.label);
    }

    return entry.sortText || entry.label;
  }

  /**
   * Get filter text for better matching of completion items
   * @private
   */
  _getFilterText(entry, context) {
    // Use provided filter text if available
    if (entry.filterText) {
      return entry.filterText;
    }

    // Special case for private fields
    if (entry.label.startsWith('#')) {
      const wordRange = context.wordRange;
      if (wordRange) {
        // If we're already typing the '#', don't include it in filter text
        if (context.lineText[wordRange.start] === '#') {
          return entry.label;
        } else {
          // Otherwise allow matching without the '#'
          return entry.label.replace(/^#/, '');
        }
      }
    }

    // For 'this.' completions, don't set filter text to avoid overprioritization
    if (entry.insertText && entry.insertText.startsWith('this.')) {
      return undefined;
    }

    // Handle bracket accessors - use property name for filtering
    if (entry.insertText && entry.insertText.startsWith('[')) {
      return entry.insertText.replace(/^\[['"](.+)[['"]\]$/, '.$1');
    }

    return entry.insertText || entry.label;
  }

  /**
   * Get additional details for a completion item
   */
  async getCompletionDetails(filePath, position, entryName, source, data) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    const args = {
      file: absolutePath,
      line: position.line + 1, // Convert to 1-based
      offset: position.character + 1, // Convert to 1-based
      entryNames: [
        source || data ? {
          name: entryName,
          source,
          data
        } : entryName
      ]
    };

    const response = await this.sendRequest('completionEntryDetails', args);

    if (response.type === 'response' && response.body && response.body.length > 0) {
      const detail = response.body[0];

      return {
        detail: this._formatDetailDocumentation(detail.displayParts),
        documentation: this._formatDetailDocumentation(detail.documentation, detail.tags),
        additionalTextEdits: this._extractAdditionalTextEdits(detail.codeActions, absolutePath),
        requiredSnippet: this._createSnippetForFunctionCall(detail),
        isAutoImport: !!(detail.codeActions && detail.codeActions.length > 0 &&
                         detail.codeActions.some(action =>
                           action.description.includes('Import') ||
                           action.description.includes('Add import'))),
      };
    }

    return null;
  }

  /**
   * Format documentation parts into readable text
   * @private
   */
  _formatDetailDocumentation(parts, tags) {
    if (!parts || !parts.length) {
      return '';
    }

    let result = parts.map(p => p.text).join('');

    // Process JSDoc tags if available
    if (tags && tags.length) {
      result += '\n\n';

      for (const tag of tags) {
        if (tag.name === 'param' && tag.text) {
          result += `@param ${tag.text}\n`;
        } else if (tag.name === 'returns' && tag.text) {
          result += `@returns ${tag.text}\n`;
        } else if (tag.text) {
          result += `@${tag.name} ${tag.text}\n`;
        } else {
          result += `@${tag.name}\n`;
        }
      }
    }

    return result;
  }

  /**
   * Extract additional text edits from code actions
   * @private
   */
  _extractAdditionalTextEdits(codeActions, filePath) {
    if (!codeActions || !codeActions.length) {
      return undefined;
    }

    const edits = [];

    for (const action of codeActions) {
      if (action.changes) {
        for (const change of action.changes) {
          if (change.fileName === filePath && change.textChanges) {
            for (const textChange of change.textChanges) {
              edits.push({
                range: {
                  start: {
                    line: textChange.start.line - 1,
                    character: textChange.start.offset - 1
                  },
                  end: {
                    line: textChange.end.line - 1,
                    character: textChange.end.offset - 1
                  }
                },
                newText: textChange.newText
              });
            }
          }
        }
      }
    }

    return edits.length ? edits : undefined;
  }

  /**
   * Creates a snippet for function call completion
   * @private
   */
  _createSnippetForFunctionCall(detail) {
    if (!detail || !detail.displayParts) {
      return undefined;
    }

    // Simple parsing of function signature to create a snippet
    // This could be enhanced with more sophisticated signature parsing
    const signature = detail.displayParts.map(p => p.text).join('');
    const match = signature.match(/\((.*)\)/);

    if (!match) {
      return undefined;
    }

    const params = match[1].split(',').filter(Boolean);

    if (params.length === 0) {
      return '()';
    }

    // Create snippet with tab stops for each parameter
    let snippet = '(';
    params.forEach((param, i) => {
      if (i > 0) {
        snippet += ', ';
      }

      // Remove default values and type annotations for the snippet
      const paramName = param.trim().split(':')[0].split('=')[0].trim();
      snippet += `\${${i + 1}:${paramName}}`;
    });
    snippet += ')';

    return snippet;
  }

  /**
   * Get hover information at a specific position
   */
  async getHoverInfo(filePath, line, character) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/hover', {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      }
    });
  }

  /**
   * Get the definition of a symbol at a specific position
   */
  async getDefinition(filePath, line, character) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/definition', {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      }
    });
  }

  /**
   * Apply a completion's code action (for auto-imports or other refactorings)
   */
  async applyCompletionCodeAction(filePath, codeActions) {
    if (!codeActions || !codeActions.length) {
      return true;
    }

    for (const action of codeActions) {
      // Apply changes from the code action
      if (action.changes) {
        for (const change of action.changes) {
          const absolutePath = path.resolve(this.projectPath, change.fileName);
          const fileContent = fs.readFileSync(absolutePath, 'utf8');
          let newContent = fileContent;

          // Sort changes in reverse order to avoid position shifts
          const sortedChanges = [...change.textChanges].sort((a, b) => {
            if (a.start.line !== b.start.line) {
              return b.start.line - a.start.line;
            }
            return b.start.offset - a.start.offset;
          });

          for (const textChange of sortedChanges) {
            const lines = newContent.split('\n');

            // Convert file positions (1-based) to array indices (0-based)
            const startLine = textChange.start.line - 1;
            const startChar = textChange.start.offset - 1;
            const endLine = textChange.end.line - 1;
            const endChar = textChange.end.offset - 1;

            if (startLine === endLine) {
              // Single line change
              lines[startLine] =
                lines[startLine].substring(0, startChar) +
                textChange.newText +
                lines[startLine].substring(endChar);
            } else {
              // Multi-line change
              const startLineContent = lines[startLine].substring(0, startChar) + textChange.newText;
              const endLineContent = lines[endLine].substring(endChar);

              // Replace affected lines
              lines.splice(
                startLine,
                endLine - startLine + 1,
                startLineContent + endLineContent
              );
            }

            newContent = lines.join('\n');
          }

          // Write changes back to file
          fs.writeFileSync(absolutePath, newContent);
        }
      }

      // Execute any commands from the code action
      if (action.commands) {
        // Note: This would need to be implemented based on the specific commands
        // your language server supports. For now, we'll just log them.
        console.log('Code action commands:', action.commands);
      }
    }

    return true;
  }

  /**
   * Get signature help at a specific position
   */
  async getSignatureHelp(filePath, line, character) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/signatureHelp', {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      }
    });
  }

  /**
   * Notify the server that the content of a file has changed
   */
  notifyDocumentChanged(filePath, changes, version = 1) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    this.sendNotification('textDocument/didChange', {
      textDocument: {
        uri: fileUri,
        version: version
      },
      contentChanges: changes
    });
  }

  /**
   * Find all references of a symbol at a specific position
   */
  async findReferences(filePath, line, character, includeDeclaration = true) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/references', {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      },
      context: {
        includeDeclaration
      }
    });
  }

  /**
   * Get document formatting edits
   */
  async formatDocument(filePath, options = {}) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    // Default formatting options
    const defaultOptions = {
      tabSize: 2,
      insertSpaces: true,
      trimTrailingWhitespace: true,
      insertFinalNewline: true,
      trimFinalNewlines: true
    };

    return await this.sendRequest('textDocument/formatting', {
      textDocument: { uri: fileUri },
      options: { ...defaultOptions, ...options }
    });
  }

  /**
   * Get code actions at a specific position (e.g., for quickfixes)
   */
  async getCodeActions(filePath, range, context = { diagnostics: [] }) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/codeAction', {
      textDocument: { uri: fileUri },
      range,
      context
    });
  }

  /**
   * Get document symbols (for code outline)
   */
  async getDocumentSymbols(filePath) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/documentSymbol', {
      textDocument: { uri: fileUri }
    });
  }

  /**
   * Rename a symbol at the specified position
   */
  async renameSymbol(filePath, line, character, newName) {
    const absolutePath = this._validateFilePath(filePath);
    const fileUri = `file://${absolutePath}`;

    // Notify the server about the file
    this._notifyFileOpen(filePath);

    return await this.sendRequest('textDocument/rename', {
      textDocument: { uri: fileUri },
      position: {
        line: parseInt(line, 10),
        character: parseInt(character, 10)
      },
      newName
    });
  }


  /**
   * Properly shutdown and dispose of the client
   */
  async dispose() {
    if (!this.server || this.server.killed) {
      return;
    }

    try {
      // Send shutdown request
      await this.sendRequest('shutdown', null);

      // Send exit notification (no response expected)
      this.sendNotification('exit', null);
    } catch (err) {
      console.error('Error during shutdown:', err);
    } finally {
      if (this.server) {
        this.server.kill();
        this.server = null;
      }
    }
  }
}

// Example usage
async function main() {
  const args = process.argv.slice(2);
  const projectPath = args[0];
  const filePath = args[1];
  const position = args[2]; // format: "line:character"

  if (!projectPath || !filePath || !position) {
    console.error('Usage: node typescript-service.js <projectPath> <filePath> <line:character>');
    process.exit(1);
  }

  const [line, character] = position.split(':');

  const client = new TypeScriptCompletionClient(projectPath);

  try {
    await client.start();
    console.log('Server initialized successfully');

    console.log(`Getting completions for ${filePath} at position ${line}:${character}...`);
    const completions = await client.getCompletions(filePath, line, character);
    console.log('Completions:');
    console.log(JSON.stringify(completions, null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.dispose();
  }
}

// Run if this script is executed directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch(console.error);
}

export { TypeScriptCompletionClient };
