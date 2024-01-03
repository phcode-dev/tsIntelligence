class Calculator {
    add(a: number, b: number): number {
        // This block of code can potentially be refactored into a separate method
        const result = a + b;
        console.log(`Adding ${a} and ${b} gives ${result}`);
        return result;
    }
}

const calc = new Calculator();
calc.add(5, 3);
