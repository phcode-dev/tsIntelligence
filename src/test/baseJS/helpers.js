/**
 * Helper functions that depend on utils module
 * @module helpers
 */

import { add, subtract, User, config } from './utils.js';

/**
 * Multiplies two numbers
 * @param {number} a - First number to multiply
 * @param {number} b - Second number to multiply
 * @returns {number} The product of a and b
 */
export function multiply(a, b) {
    return a * b;
}

/**
 * Performs multiple arithmetic operations
 * @param {number} x - First operand
 * @param {number} y - Second operand
 * @returns {Object} Object containing results of various operations
 */
export function calculateAll(x, y) {
    return {
        sum: add(x, y),
        difference: subtract(x, y),
        product: multiply(x, y),
        quotient: x / y
    };
}

/**
 * Creates and processes user data
 * @param {string} name - User name
 * @param {number} age - User age
 * @returns {Object} Processed user data
 */
export function processUser(name, age) {
    const user = new User(name, age);

    return {
        profile: user.getProfile(),
        isAdult: user.isAdult(),
        nameLength: name.length,
        serverConfig: config.server
    };
}

/**
 * @typedef {Object} ServerOptions
 * @property {number} port - Server port
 * @property {string} host - Server hostname
 * @property {Object} settings - Additional settings
 */

/**
 * Gets server configuration from utils
 * @returns {ServerOptions} Server configuration options
 */
export function getServerConfig() {
    return config.server;
}

// Non-exported function for testing internal visibility
/**
 * Internal helper function not exported
 * @param {string} str - String to process
 * @returns {string} Processed string
 * @private
 */
function internalHelper(str) {
    return str.toUpperCase();
}
