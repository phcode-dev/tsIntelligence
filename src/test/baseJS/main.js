/**
 * Main application entry point
 * @module main
 */

import { calculateAll, processUser, getServerConfig } from './helpers.js';
import { User, config } from './utils.js';

/**
 * Initializes the application with given parameters
 * @param {Object} options - Application options
 * @param {number} options.initialValue - Starting value
 * @param {string} options.userName - Default user name
 * @returns {Object} Initialized application state
 */
function initializeApp(options = {}) {
    const { initialValue = 10, userName = 'Guest' } = options;

    // Test code completion for imported functions
    const calculations = calculateAll(initialValue, 5);

    // Test code completion for imported class
    const defaultUser = new User(userName, 25);
    const userProfile = defaultUser.getProfile();

    // Test code completion for nested imported object properties
    const serverPort = config.server.port;
    const dbSettings = config.database;

    // Test code completion for functions from helpers
    const serverConfig = getServerConfig();

    // Process user data using helpers
    const processedData = processUser(userName, 30);

    return {
        initValue: initialValue,
        calculations,
        userProfile,
        serverInfo: {
            port: serverPort,
            settings: serverConfig.settings
        },
        database: dbSettings,
        processedData
    };
}

/**
 * Runs the application with specific settings
 * @param {string} mode - Application mode ('development' or 'production')
 */
function runApp(mode = 'development') {
    console.log(`Starting application in ${mode} mode`);

    const state = initializeApp({
        initialValue: 20,
        userName: 'TestUser'
    });

    console.log('Application initialized with state:', state);

    // Create a scenario to test peek definition
    // You should be able to peek at the definition of these imported items
    const userData = processUser('Alice', 22);
    getServerConfig();

    // This line tests dot notation completion for multiple levels
    const timeout = config.server.settings.timeout;

    console.log('User data:', userData);
    console.log('Server timeout:', timeout);
}

// Call the main function to run the application
runApp();

// Export for testing or importing elsewhere
export { initializeApp, runApp };
