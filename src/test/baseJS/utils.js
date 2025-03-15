/**
 * Utility functions module for testing language server features
 * @module utils
 */

/**
 * Calculates the sum of two numbers
 * @param {number} a - First number to add
 * @param {number} b - Second number to add
 * @returns {number} The sum of a and b
 */
export function add(a, b) {
    return a + b;
}

/**
 * Calculates the difference between two numbers
 * @param {number} a - Number to subtract from
 * @param {number} b - Number to subtract
 * @returns {number} The difference between a and b
 */
export function subtract(a, b) {
    return a - b;
}

/**
 * User class for testing complex type definitions
 * @class
 */
export class User {
    /**
   * Create a user
   * @param {string} name - The user's name
   * @param {number} age - The user's age
   */
    constructor(name, age) {
        this.name = name;
        this.age = age;
    }

    /**
   * Get user's full profile information
   * @returns {Object} User profile object
   */
    getProfile() {
        return {
            name: this.name,
            age: this.age,
            createdAt: new Date()
        };
    }

    /**
   * Check if user is an adult
   * @returns {boolean} True if user is 18 or older
   */
    isAdult() {
        return this.age >= 18;
    }
}

/**
 * Object with nested properties for testing dot notation completion
 */
export const config = {
    server: {
        port: 3000,
        host: 'localhost',
        settings: {
            timeout: 5000,
            maxConnections: 100
        }
    },
    database: {
        url: 'mongodb://localhost:27017',
        name: 'testdb'
    }
};
