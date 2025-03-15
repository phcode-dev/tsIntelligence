#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import * as vscode from 'vscode-languageserver-protocol';
import { URI } from 'vscode-uri';
import { fileURLToPath } from 'url';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
if (process.argv.length !== 5) {
  console.error('Usage: node getCompletions.js /path/to/project /file/in/project.js line:character');
  process.exit(1);
}

const projectPath = path.resolve(process.argv[2]);
const filePath = path.resolve(process.argv[3]);
const [line, character] = process.argv[4].split(':').map(Number);

async function main() {
  let server = null;
  let hasError = false;
  try {
    console.log(`[INFO] Starting completion service for ${filePath} at position ${line}:${character}`);
    console.log(`[INFO] Project root: ${projectPath}`);

    // Initialize the language server
    console.log('[INFO] Starting TypeScript language server...');
    server = await startLanguageServer(projectPath);
    console.log('[INFO] Language server started successfully');

    // Initialize workspace
    console.log('[INFO] Initializing workspace...');
    await initializeServer(server, projectPath);
    console.log('[INFO] Workspace initialized');

    // We need to sync all imports to get proper completions
    console.log('[INFO] Scanning project directory for related files...');
    await syncRelatedFiles(server, projectPath, filePath);

    // Open the document
    console.log(`[INFO] Reading file: ${filePath}`);
    const documentText = fs.readFileSync(filePath, 'utf8');
    const documentUri = URI.file(filePath).toString();
    console.log(`[INFO] File URI: ${documentUri}`);

    console.log('[INFO] Opening document in language server...');
    await openDocument(server, documentUri, documentText);
    console.log('[INFO] Document opened');

    // Pause to give the server time to analyze the file
    console.log('[INFO] Waiting for server to analyze document...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Set up completion timeout
    console.log(`[INFO] Requesting completions at position ${line}:${character}...`);

    // Add a timeout to prevent hanging forever on a completion request
    const completionPromise = getCompletions(server, documentUri, line, character);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Completion request timed out after 10 seconds')), 10000)
    );

    // Race the completion against the timeout
    const completions = await Promise.race([completionPromise, timeoutPromise]);
    console.log('[INFO] Received completions from server');

    // Format and display the results
    displayCompletions(completions);

  } catch (err) {
    console.error('[ERROR] An error occurred:', err);
    hasError = true;
  } finally {
    // Always try to shutdown the server, even if there was an error
    if (server) {
      console.log('[INFO] Shutting down language server...');
      try {
        await shutdownServer(server);
        console.log('[INFO] Server shutdown complete');
      } catch (shutdownError) {
        console.error('[ERROR] Error shutting down server:', shutdownError);
        // Force kill the server process if shutdown fails
        if (server.connection && server.connection.process) {
          server.connection.process.kill('SIGKILL');
          console.log('[INFO] Server process forcibly terminated');
        }
      }
    }

    process.exit(hasError ? 1 : 0);
  }
}

// Helper function to sync related files to ensure imports are resolved
async function syncRelatedFiles(server, projectRoot, targetFile) {
  const directory = path.dirname(targetFile);
  try {
    // Read current directory
    const files = await fs.promises.readdir(directory, { withFileTypes: true });

    // Look for .js, .ts files that might be related
    for (const file of files) {
      if (!file.isDirectory() && /\.(js|ts|jsx|tsx)$/.test(file.name)) {
        const filePath = path.join(directory, file.name);

        // Skip the target file as we'll handle it separately
        if (filePath === targetFile) {
          continue;
        }

        try {
          console.log(`[INFO] Syncing related file: ${filePath}`);
          const content = await fs.promises.readFile(filePath, 'utf8');
          const uri = URI.file(filePath).toString();

          // Get the language ID based on file extension
          const ext = path.extname(filePath);
          let languageId = 'javascript';
          if (ext === '.ts') languageId = 'typescript';
          else if (ext === '.tsx') languageId = 'typescriptreact';
          else if (ext === '.jsx') languageId = 'javascriptreact';

          // Notify the server about this file
          server.connection.sendNotification('textDocument/didOpen', {
            textDocument: {
              uri,
              languageId,
              version: 1,
              text: content
            }
          });
        } catch (err) {
          console.warn(`[WARN] Failed to sync file ${filePath}: ${err.message}`);
        }
      }
    }

    // Check for tsconfig.json or jsconfig.json
    const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
    const jsconfigPath = path.join(projectRoot, 'jsconfig.json');

    if (fs.existsSync(tsconfigPath)) {
      console.log('[INFO] Found tsconfig.json, notifying server...');
      // We don't need to do anything special, the server will find it
    } else if (fs.existsSync(jsconfigPath)) {
      console.log('[INFO] Found jsconfig.json, notifying server...');
      // We don't need to do anything special, the server will find it
    } else {
      console.log('[INFO] No project configuration file found');
    }

  } catch (err) {
    console.warn(`[WARN] Error while syncing related files: ${err.message}`);
  }
}

async function startLanguageServer(projectPath) {
  // First check if typescript-language-server is installed
  try {
    // Check for local typescript-language-server
    let serverPath;
    const newServerPath = path.join(projectPath, 'node_modules/typescript-language-server/lib/cli.mjs');
    const oldServerPath = path.join(projectPath, 'node_modules/typescript-language-server/lib/cli.js');

    console.log('[INFO] Looking for typescript-language-server...');
    if (fs.existsSync(newServerPath)) {
      serverPath = newServerPath;
      console.log(`[INFO] Found local typescript-language-server at: ${serverPath} (new path)`);
    } else if (fs.existsSync(oldServerPath)) {
      serverPath = oldServerPath;
      console.log(`[INFO] Found local typescript-language-server at: ${serverPath} (old path)`);
    } else {
      // Using importlib approach to find modules in ES modules
      console.log('[INFO] Local typescript-language-server not found, checking global installation...');
      try {
        const { createRequire } = await import('module');
        const require = createRequire(import.meta.url);
        serverPath = require.resolve('typescript-language-server/lib/cli.mjs', { paths: [projectPath] });
        console.log(`[INFO] Found global typescript-language-server at: ${serverPath}`);
      } catch (err) {
        console.error('[ERROR] Could not find typescript-language-server');
        throw new Error('Could not find typescript-language-server. Please install it globally or in your project.');
      }
    }

    // Check if local TypeScript is installed
    console.log('[INFO] Checking for local TypeScript installation...');
    let tsdk = null;
    const yarnTsPath = path.join(projectPath, '.yarn/sdks/typescript/lib');
    const npmTsPath = path.join(projectPath, 'node_modules/typescript/lib');

    if (fs.existsSync(yarnTsPath)) {
      tsdk = '.yarn/sdks/typescript/lib';
      console.log(`[INFO] Found TypeScript in Yarn SDK: ${tsdk}`);
    } else if (fs.existsSync(npmTsPath)) {
      tsdk = 'node_modules/typescript/lib';
      console.log(`[INFO] Found TypeScript in node_modules: ${tsdk}`);
    } else {
      console.log('[INFO] No local TypeScript installation found, will use server bundled version');
    }

    // Start the server process
    console.log(`[INFO] Starting server process: node ${serverPath} --stdio`);
    const serverProcess = spawn('node', [serverPath, '--stdio']);

    // Set up communication with the server
    const connection = {
      process: serverProcess,
      nextRequestId: 1,
      pendingRequests: new Map(),

      sendRequest: function(method, params) {
        return new Promise((resolve, reject) => {
          const id = this.nextRequestId++;
          const message = {
            jsonrpc: '2.0',
            id,
            method,
            params
          };

          console.log(`[DEBUG] Sending request: ${method} (id: ${id})`);
          this.pendingRequests.set(id, { resolve, reject });

          const jsonMessage = JSON.stringify(message);
          const contentLength = Buffer.byteLength(jsonMessage, 'utf8');
          const header = `Content-Length: ${contentLength}\r\n\r\n`;

          serverProcess.stdin.write(header + jsonMessage);
        });
      },

      sendNotification: function(method, params) {
        const message = {
          jsonrpc: '2.0',
          method,
          params: params || {}
        };

        console.log(`[DEBUG] Sending notification: ${method}`);

        const jsonMessage = JSON.stringify(message);
        const contentLength = Buffer.byteLength(jsonMessage, 'utf8');
        const header = `Content-Length: ${contentLength}\r\n\r\n`;

        serverProcess.stdin.write(header + jsonMessage);
      },

      onMessage: function(message) {
        try {
          const parsed = JSON.parse(message);

          if (parsed.id) {
            console.log(`[DEBUG] Received response for request id: ${parsed.id}`);
            const request = this.pendingRequests.get(parsed.id);
            if (request) {
              this.pendingRequests.delete(parsed.id);
              if (parsed.error) {
                console.error(`[ERROR] Request error: ${JSON.stringify(parsed.error)}`);
                request.reject(new Error(parsed.error.message));
              } else {
                console.log(`[DEBUG] Request succeeded with result type: ${typeof parsed.result}`);
                request.resolve(parsed.result);
              }
            } else {
              console.log(`[WARN] Received response for unknown request id: ${parsed.id}`);
            }
          } else if (parsed.method) {
            // Handle server notifications if needed
            console.log(`[INFO] Server notification: ${parsed.method}`);
          }
        } catch (error) {
          console.error(`[ERROR] Failed to parse message: ${error.message}`);
          console.error(`[ERROR] Message content: ${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
        }
      }
    };

    // Handle server output using a more robust binary buffer approach
    let buffer = Buffer.alloc(0);
    let contentLength = -1;
    let headerProcessed = false;

    serverProcess.stdout.on('data', (chunk) => {
      // Append incoming data to our buffer (as binary)
      buffer = Buffer.concat([buffer, chunk]);
      console.log(`[DEBUG] Received data chunk from server (${chunk.length} bytes)`);

      // Process messages in the buffer
      while (buffer.length > 0) {
        // If we don't have a content length yet, try to parse the header
        if (contentLength === -1) {
          // Convert to string to search for header delimiter
          const headerStr = buffer.toString('utf8', 0, Math.min(buffer.length, 1000));
          const headerEnd = headerStr.indexOf('\r\n\r\n');

          if (headerEnd === -1) {
            // Don't have a complete header yet, wait for more data
            console.log('[DEBUG] Waiting for complete header');
            break;
          }

          // Parse the Content-Length header
          const header = headerStr.substring(0, headerEnd);
          const lengthMatch = header.match(/Content-Length: (\d+)/);
          if (lengthMatch) {
            contentLength = parseInt(lengthMatch[1], 10);
            console.log(`[DEBUG] Found message header with content length: ${contentLength}`);

            // Remove the header from the buffer (adding 4 for \r\n\r\n)
            buffer = buffer.slice(headerEnd + 4);
            headerProcessed = true;
          } else {
            console.error('[ERROR] Failed to parse Content-Length from header:', header);
            buffer = buffer.slice(headerEnd + 4);
          }
        }

        // If we have a content length, see if we have enough data for the full message
        if (contentLength !== -1) {
          if (buffer.length >= contentLength) {
            // We have a complete message
            const messageBuffer = buffer.slice(0, contentLength);
            buffer = buffer.slice(contentLength);

            // Convert message to string
            const message = messageBuffer.toString('utf8');

            // Reset for next message
            contentLength = -1;
            headerProcessed = false;

            // Process the message
            console.log(`[DEBUG] Processing complete message: ${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`);
            try {
              connection.onMessage(message);
            } catch (error) {
              console.error('[ERROR] Error processing message:', error);
            }

            // If this was a large message, log that we're done with it
            if (message.length > 10000) {
              console.log(`[DEBUG] Successfully processed large message (${message.length} bytes)`);
            }
          } else {
            // Don't have the full message yet
            const percentComplete = ((buffer.length / contentLength) * 100).toFixed(1);
            console.log(`[DEBUG] Waiting for more data. Have ${buffer.length} of ${contentLength} bytes (${percentComplete}%)`);

            // If we're waiting for a very large message, break the wait cycle
            if (contentLength > 100000 && buffer.length > contentLength * 0.95) {
              console.log(`[WARN] Very large message detected (${contentLength} bytes). Forcing timeout to prevent blocking.`);

              // Create a timeout to check again in a short while
              setTimeout(() => {
                if (buffer.length >= contentLength) {
                  console.log('[DEBUG] Buffer is now complete after timeout');
                  serverProcess.stdout.emit('data', Buffer.alloc(0)); // Trigger processing again
                }
              }, 100);

              break;
            }

            break;
          }
        } else {
          // Don't have a content length and no complete header in buffer
          break;
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[ERROR] Server error: ${data.toString()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`[INFO] Server process exited with code ${code}`);
    });

    return { connection, tsdk };

  } catch (error) {
    console.error('Failed to start language server:', error);
    throw error;
  }
}

async function initializeServer(server, projectPath) {
  console.log('[INFO] Preparing initialization parameters...');
  // Initialize the server with settings similar to Zed
  const initializeParams = {
    processId: process.pid,
    clientInfo: {
      name: 'zed-cli'
    },
    rootPath: projectPath,
    rootUri: URI.file(projectPath).toString(),
    capabilities: {
      textDocument: {
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
              valueSet: [1] // CompletionItemTag.Deprecated
            },
            insertReplaceSupport: true,
            resolveSupport: {
              properties: [
                'documentation',
                'detail',
                'additionalTextEdits',
                'tags',
                'insertTextFormat'
              ]
            },
            labelDetailsSupport: true
          },
          completionItemKind: {
            valueSet: Array.from({ length: 25 }, (_, i) => i + 1)
          },
          insertTextMode: 2, // asIs = 1, adjustIndentation = 2
          completionList: {
            itemDefaults: [
              'commitCharacters',
              'editRange',
              'insertTextFormat',
              'insertTextMode'
            ]
          }
        },
        synchronization: {
          dynamicRegistration: true,
          willSave: true,
          willSaveWaitUntil: true,
          didSave: true
        },
        diagnostic: {
          dynamicRegistration: true
        }
      },
      workspace: {
        workspaceFolders: true,
        configuration: true,
        didChangeConfiguration: {
          dynamicRegistration: true
        },
        didChangeWatchedFiles: {
          dynamicRegistration: true
        }
      }
    },
    workspaceFolders: [
      {
        uri: URI.file(projectPath).toString(),
        name: path.basename(projectPath)
      }
    ],
    initializationOptions: {
      provideFormatter: true,
      hostInfo: "zed",
      tsserver: {
        path: server.tsdk,
        useSyntaxServer: "auto",
        logVerbosity: "verbose"
      },
      preferences: {
        includeInlayParameterNameHints: "all",
        includeInlayParameterNameHintsWhenArgumentMatchesName: true,
        includeInlayFunctionParameterTypeHints: true,
        includeInlayVariableTypeHints: true,
        includeInlayVariableTypeHintsWhenTypeMatchesName: true,
        includeInlayPropertyDeclarationTypeHints: true,
        includeInlayFunctionLikeReturnTypeHints: true,
        includeInlayEnumMemberValueHints: true,
      }
    }
  };

  console.log('[INFO] Sending initialize request to server...');
  const result = await server.connection.sendRequest('initialize', initializeParams);
  console.log('[INFO] Server initialized with capabilities:', Object.keys(result.capabilities));

  console.log('[INFO] Sending initialized notification...');
  server.connection.sendNotification('initialized', {});

  // Configure the server with workspace settings
  console.log('[INFO] Configuring workspace settings...');
  const configurationParams = {
    settings: {
      completions: {
        completeFunctionCalls: true
      }
    }
  };

  server.connection.sendNotification('workspace/didChangeConfiguration', configurationParams);
  console.log('[INFO] Workspace configuration complete');

  return result;
}

async function openDocument(server, documentUri, documentText) {
  // Determine the language ID based on file extension
  const fileExtension = path.extname(URI.parse(documentUri).fsPath);
  let languageId;

  switch (fileExtension) {
    case '.ts':
      languageId = 'typescript';
      break;
    case '.tsx':
      languageId = 'typescriptreact';
      break;
    case '.js':
    default:
      languageId = 'javascript';
      break;
  }

  console.log(`[INFO] Opening document with language ID: ${languageId}`);

  // Notify the server that the document is open
  server.connection.sendNotification('textDocument/didOpen', {
    textDocument: {
      uri: documentUri,
      languageId,
      version: 1,
      text: documentText
    }
  });
}

async function getCompletions(server, documentUri, line, character) {
  // Request completions at the specified position
  const completionParams = {
    textDocument: {
      uri: documentUri
    },
    position: {
      line,
      character
    },
    context: {
      triggerKind: 1, // Invoked manually (1), TriggerCharacter (2), TriggerForIncompleteCompletions (3)
      triggerCharacter: "." // Include the trigger character - important for property completions
    }
  };

  console.log(`[INFO] Requesting completions at position ${line}:${character}`);
  console.log(`[DEBUG] Completion request params: ${JSON.stringify(completionParams, null, 2)}`);

  try {
    const result = await server.connection.sendRequest('textDocument/completion', completionParams);
    console.log(`[DEBUG] Received completion result with ${result?.items?.length || 0} items`);
    return result;
  } catch (error) {
    console.error('[ERROR] Failed to get completions:', error);
    return { items: [] };
  }
}

function displayCompletions(completions) {
  // Format and print the completion items
  const itemCount = completions?.items?.length || 0;
  console.log(`\n======= RESULTS =======`);
  console.log(`Found ${itemCount} completions:\n`);

  if (itemCount === 0) {
    console.log('No completions found at the specified position.');
    return;
  }

  console.log('isIncomplete:', completions.isIncomplete ? 'Yes (more results available)' : 'No (all results shown)');
  console.log('\n--- Completion Items ---');

  completions.items.forEach((item, index) => {
    const kind = getCompletionItemKindName(item.kind);
    const detail = item.detail ? ` - ${item.detail}` : '';
    const labelDetails = item.labelDetails ?
      ` ${item.labelDetails.detail || ''}${item.labelDetails.description ? ` (${item.labelDetails.description})` : ''}` :
      '';

    console.log(`${index + 1}. ${item.label}${labelDetails} [${kind}]${detail}`);
  });

  console.log('\n=======================');
}

function getCompletionItemKindName(kind) {
  const kinds = [
    'Text', 'Method', 'Function', 'Constructor', 'Field', 'Variable',
    'Class', 'Interface', 'Module', 'Property', 'Unit', 'Value',
    'Enum', 'Keyword', 'Snippet', 'Color', 'File', 'Reference',
    'Folder', 'EnumMember', 'Constant', 'Struct', 'Event',
    'Operator', 'TypeParameter'
  ];

  return kinds[kind - 1] || 'Unknown';
}

async function shutdownServer(server) {
  try {
    console.log('[INFO] Sending shutdown request to server...');
    await server.connection.sendRequest('shutdown');

    console.log('[INFO] Sending exit notification to server...');
    server.connection.sendNotification('exit');

    console.log('[INFO] Killing server process...');
    server.connection.process.kill();
  } catch (error) {
    console.error('[ERROR] Error shutting down server:', error);
  }
}

main().catch(console.error);
