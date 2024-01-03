class Calculator {
    // Deliberate error: 'num1' and 'num2' implicitly have an 'any' type.
    add(num1, num2) {
        return num1 + num2;
    }

    // Deliberate error: Unused local variable 'unusedVar'.
    unusedFunction() {
        const unusedVar = "This variable is unused";
        console.log("This function does nothing");
    }
}

const calc = new Calculator();
console.log(calc.add(5, 10));
