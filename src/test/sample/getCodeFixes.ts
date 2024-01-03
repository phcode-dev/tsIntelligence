// file.ts

class Greeter {
    constructor(private message: string) {}

    // Deliberate syntax error: Missing identifier (error code 1003)
    const x;
    

    // Deliberate syntax error: Missing semicolon (error code 1005)
    greet() {
        x = '1';
        console.log(this.message)
    }
}

// Correct usage to avoid errors in other parts
const greeter = new Greeter("Hello, world!");
greeter.greet();
