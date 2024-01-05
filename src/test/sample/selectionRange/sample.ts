class Example {
    greet(name: string): string {
        return `Hello, ${name}!`;
    }

    farewell(name: string): string {
        return `Goodbye, ${name}!`;
    }
}

const example = new Example();
console.log(example.greet('Alice'));
console.log(example.farewell('Bob'));
