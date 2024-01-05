export class Calculator {
    /**
     * Adds two numbers together.
     * @param a The first number.
     * @param b The second number.
     * @returns The sum of a and b.
     */
    add(a: number, b: number): number {
        return a + b;
    }

    /**
     * Multiplies two numbers.
     * @param a The first number.
     * @param b The second number.
     * @returns The product of a and b.
     */
    multiply(a: number, b: number): number {
        return a * b;
    }

    /**
     * Subtracts the second number from the first.
     * @param a The number to subtract from.
     * @param b The number to subtract.
     * @returns The difference between a and b.
     */
    subtract(a: number, b: number): number {
        return a - b;
    }

    /**
     * Divides the first number by the second.
     * @param a The dividend.
     * @param b The divisor.
     * @returns The quotient of a and b.
     */
    divide(a: number, b: number): number {
        if (b === 0) {
            throw new Error("Cannot divide by zero.");
        }
        return a / b;
    }
}

// Usage of Calculator
const calc = new Calculator();
const sum = calc.add(5, 3);
console.log(`Sum: ${sum}`);
