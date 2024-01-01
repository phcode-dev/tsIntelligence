// file.ts

export class ExampleClass {
    private value: number;
    constructor(value: number) {
        this.value = value;}

    /**
     * This is where we will want to generate a documentation template.
     * Let's assume our docCommentTemplate function targets this method.
     */
    addNumbers(a: number, b: number): number {
        return a + b;
    }
}
