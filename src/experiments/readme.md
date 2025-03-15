# TypeScript Language Server Client

A Node.js CLI tool for getting TypeScript/JavaScript code completions using the Language Server Protocol (LSP), inspired by Zed editor's implementation.

## Quick Start

```bash
# Install dependencies
npm install vscode-languageserver-protocol vscode-uri

# Run the tool
node lsp.js /path/to/project /path/to/file.js 10:15
```

Where:
- `/path/to/project` is the root directory of your project
- `/path/to/file.js` is the specific file you want completions for
- `10:15` is the line and character position (zero-based) where you want completions

## Key Features

- Works with JavaScript, TypeScript, JSX, and TSX files
- Automatically detects project configuration (tsconfig.json/jsconfig.json)
- Uses locally installed TypeScript if available
- Falls back to typescript-language-server's bundled TypeScript if needed
- Provides proper property completions for imported modules
- Robust message handling for LSP communication
- Timeouts to prevent hanging on incomplete responses

## Common Challenges and Solutions

### 1. LSP Message Format

**Challenge**: The Language Server Protocol uses a specific message format with headers and JSON body.

**Solution**: Implemented proper binary buffer handling with Content-Length parsing:
```javascript
// Format for sending
const jsonMessage = JSON.stringify(message);
const contentLength = Buffer.byteLength(jsonMessage, 'utf8');
const header = `Content-Length: ${contentLength}\r\n\r\n`;
serverProcess.stdin.write(header + jsonMessage);

// Format for receiving
// Handle message header first, then read the exact number of bytes for content
```

### 2. Requests vs. Notifications

**Challenge**: LSP has two types of messages (requests that need responses and notifications that don't).

**Solution**: Implemented separate methods for each type:
```javascript
// For requests (require response)
sendRequest: function(method, params) {
  // Includes an ID and expects a response
}

// For notifications (no response)
sendNotification: function(method, params) {
  // No ID, no response expected
}
```

### 3. Large Message Handling

**Challenge**: The server sometimes sends very large messages that can cause the client to hang.

**Solution**: Implemented binary buffer handling with progress tracking and timeouts:
```javascript
// Binary buffer concatenation
buffer = Buffer.concat([buffer, chunk]);

// Progress tracking
const percentComplete = ((buffer.length / contentLength) * 100).toFixed(1);

// Timeout mechanism for completion requests
const completionPromise = getCompletions(server, documentUri, line, character);
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Completion request timed out')), 10000)
);
```

### 4. Import Resolution

**Challenge**: Code completions for imported modules weren't working initially.

**Solution**: While we implemented a `syncRelatedFiles` function to provide context to the language server, we discovered that this wasn't actually the main issue. The key fix was properly specifying the trigger character (see below).

**Note**: The file syncing code is currently prepared but may not be necessary in most cases as long as the trigger character is correctly specified:

```javascript
// Find and open all related files in the directory
async function syncRelatedFiles(server, projectRoot, targetFile) {
  // Opens JS/TS files in the same directory
}
```

### 5. Completion Parameters and Trigger Characters

**Challenge**: Property completions for object members weren't showing up at all. For example, with code like `config.se<cursor>rver.port`, no completions were being returned, even though VS Code would show property suggestions.

**Solution**: Adding the correct trigger character (".") to completion requests was critical:

```javascript
// Before (no completions returned)
{
  context: {
    triggerKind: 1, // Manual invocation
    // No trigger character specified
  }
}

// After (property completions now work)
{
  context: {
    triggerKind: 1, // Manual invocation
    triggerCharacter: "." // For property completions
  }
}
```

**Important**: The trigger character should match the character that triggered the completion:
- For property access (`config.se<cursor>rver`), the trigger character should be "."
- For regular identifier completions (`con<cursor>fig`), you should omit the trigger character
- Using the wrong trigger character can result in irrelevant completions or no completions at all

This was the single most important fix that made property completions work correctly.


### 6. TypeScript Detection

**Challenge**: Needed to detect and use the local project's TypeScript installation.

**Solution**: Checked common installation paths and provided fallbacks:
```javascript
// Check for TypeScript in common locations
const yarnTsPath = path.join(projectPath, '.yarn/sdks/typescript/lib');
const npmTsPath = path.join(projectPath, 'node_modules/typescript/lib');

if (fs.existsSync(yarnTsPath)) {
  tsdk = '.yarn/sdks/typescript/lib';
} else if (fs.existsSync(npmTsPath)) {
  tsdk = 'node_modules/typescript/lib';
}
```

## Key Implementation Details

### Trigger Kinds

The LSP defines three trigger kinds for completion requests:
1. **Invoked (1)**: Manual completion (Ctrl+Space)
2. **TriggerCharacter (2)**: Automatic completion after typing a specific character
3. **TriggerForIncompleteCompletions (3)**: Request for more items from a previous result

### Trigger Characters

Common trigger characters in TypeScript/JavaScript and when to use them:

| Character | Context | Example | When to Include |
|-----------|---------|---------|----------------|
| `.` | Property access | `object.prop` | When completing properties after a dot |
| `"`, `'` | String literals/imports | `import "./` | When completing paths in quotes |
| `/` | Path completions | `import "./folder/` | When completing folders/files |
| `@` | Decorators | `@Decorator` | When completing TypeScript decorators |
| `<` | JSX tags | `<Component` | When completing JSX/TSX tags |
| `(` | Function calls | `function(` | When completing function parameters |
| `[` | Bracket notation | `object[` | When completing key access |
| (none) | Regular identifiers | `cons` | When completing variable/function names |

**Important**: Do not include a trigger character for regular identifier completions - it will filter results incorrectly. Only include the trigger character that was actually typed by the user to trigger the completion.

## Next Steps

Potential improvements:
1. Add support for document changes (editing files)
2. Implement completion item resolution for more details
3. Add signature help support
4. Add hover information support
5. Improve error recovery and reconnection
6. Add support for multiple files and projects
7. Create a more robust CLI interface with more options

## References

- [Language Server Protocol Specification](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/)
- [TypeScript Language Server](https://github.com/typescript-language-server/typescript-language-server)
- [Zed Editor's TypeScript LSP implementation](https://github.com/zed-industries/zed/blob/148131786f5b15e8fdcb9e550abbf9edfd3dd0f8/crates/project/src/lsp_command.rs#L2035)
