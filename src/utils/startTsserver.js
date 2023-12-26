import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

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
            const nodePath = '/home/charly/.nvm/versions/node/v20.10.0/bin/node';
            tsserverProcess = spawn(nodePath, [tsserverPath]);
            tsserverProcess.stdout.setEncoding('utf8');

            tsserverProcess.stdout.on('data', (data) => {
                const lines = data.split('\n');
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
            console.log(line);
            const response = JSON.parse(line);
            // Check if it's a command response and has a matching sequence number
            if (response.request_seq !== undefined && pendingCommands.has(response.request_seq)) {
                const { resolve } = pendingCommands.get(response.request_seq);
                pendingCommands.delete(response.request_seq);
                resolve(response);
            } else if (response.type === 'event') {
                // Handle or log event messages from tsserver
                console.log('Event from tsserver:', response);
            }
        } catch (e) {
            console.error('Error parsing line from tsserver:', e);
        }
    }

    /**
     * Sends a command to the TypeScript Server.
     * @param {Object} command - The command object to send.
     * @param {number} [timeout=5000] - The timeout in milliseconds for the command.
     * @returns {Promise<Object>} A promise that resolves with the response from tsserver.
     */
    function sendCommand(command, timeout = 5000) {
        return new Promise((resolve, reject) => {
            if (!tsserverProcess) {
                reject(new Error('tsserver is not initialized'));
                return;
            }

            const seq = ++seqNumber;
            pendingCommands.set(seq, { resolve, reject });

            const timeoutId = setTimeout(() => {
                if (pendingCommands.has(seq)) {
                    pendingCommands.delete(seq);
                    reject(new Error('tsserver response timeout'));
                }
            }, timeout);

            command.seq = seq;
            command.type = 'request';
            console.log(command);

            if (tsserverProcess.stdin.writable) {
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
    function openFile(filePath, timeout) {
        const command = {
            command: 'open',
            arguments: { file: filePath }
        };
        return sendCommand(command, timeout);
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

    return { init: initTSServer, openFile, killServer: killTSServer };
}

export default createTSServerInstance;
