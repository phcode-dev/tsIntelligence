// file.ts
export class MathOperations {
    /**
     * Calculates the sum of two numbers.
     * @param a The first number.
     * @param b The second number.
     * @returns The sum of a and b.
     */
    static add(a: number, b: number): number {
        return a + b;
    }

    /**
     * Demonstrates a call to the add function.
     */
    static demoAddition() {
        const result = this.add(5, 3);
        console.log(`The result is ${result}`);
    }
}

// Calling the demoAddition method
MathOperations.demoAddition();
