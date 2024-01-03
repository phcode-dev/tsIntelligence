// sample.ts
class Greeter {
    greeting: string;

    constructor(message: string) {
        this.greeting = message;
    }

    greet() {
        // This block of code is a candidate for the "Extract Method" refactoring
        const greetingMessage = `Hello, ${this.greeting}`;
        console.log(greetingMessage);
        return greetingMessage;
    }
}

const greeter = new Greeter('world');
greeter.greet();
