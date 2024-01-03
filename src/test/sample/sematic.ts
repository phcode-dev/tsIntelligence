// sample.ts
function greet(name: string) {
    console.log('Hello, ' + name);
}

let x;
x = 1;
greet(x);  // Intentionally passing a number to cause a semantic error.
