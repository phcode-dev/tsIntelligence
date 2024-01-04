class MathOperations {
    // This method is a good candidate to be moved to a separate utility file
    static add(a: number, b: number): number {
        return a + b;
    }

    // This method might stay within this class
    static subtract(a: number, b: number): number {
        return a - b;
    }
}

// Usage of the class methods
console.log(MathOperations.add(5, 3));
console.log(MathOperations.subtract(10, 4));
