// example-usage.js
import { initProject } from './typescript-service.js';

// Example usage
try {
    // Initialize project - works with both JS and TS projects
    const tsService = initProject('/home/home/Documents/code/tsIntelligence/src/test/baseJS/');

    // Example: Get code hints at a specific position in a JavaScript file
    const jsFilePath = '/home/home/Documents/code/tsIntelligence/src/test/baseJS/main.js';
    const jsHints = tsService.getCodeHints(
        jsFilePath,
        10,  // line number (0-based)
        15   // character position (0-based)
    );

    console.log('Code hints for JS file:', jsHints);

    // Example: Get diagnostics (errors and warnings) for a file
    const diagnostics = tsService.getDiagnostics(jsFilePath);
    console.log('Diagnostics:', diagnostics);

    // Example: Update a file with new content
    const newContent = `
    // Updated content using ES modules
    export function calculateTotal(items) {
      return items.reduce((sum, item) => sum + item.price, 0);
    }

    export function formatPrice(price) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(price);
    }
  `;

    tsService.updateFile(jsFilePath, newContent);
    console.log('File updated successfully');

    // Example: Get hover information
    const hoverInfo = tsService.getHoverInfo(
        jsFilePath,
        2,  // line with calculateTotal function
        18  // position over "items" parameter
    );

    console.log('Hover info:', hoverInfo);

    // Example: Get symbol definitions
    const definitions = tsService.getDefinitions(
        jsFilePath,
        2,  // line with calculateTotal function
        18  // position over "items" parameter
    );

    console.log('Definitions:', definitions);

} catch (error) {
    console.error('Error:', error.message);
}
