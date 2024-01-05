// sample.ts
function calculateSum(a: number, b: number): number {
    let result = a + b;
    console.log(`The sum of ${a} and ${b} is ${result}`);
    return result;
}

const number1 = 5;
const number2 = 10;

const sum = calculateSum(number1, number2);
console.log(`Sum: ${sum}`);
