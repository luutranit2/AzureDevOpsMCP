/**
 * Basic test to verify module structure and imports
 */

import { AzureDevOpsIntegration } from '../src/modules/azureDevOpsIntegration.js';
import { parseAzureDevOpsUrl } from '../src/utils/helpers.js';

console.log('🧪 Running basic structure tests...');

// Test 1: Check if classes can be imported
try {
    console.log('✅ AzureDevOpsIntegration class imported successfully');
} catch (error) {
    console.error('❌ Failed to import AzureDevOpsIntegration:', error.message);
}

// Test 2: Check utility functions
try {
    const testUrl = 'https://dev.azure.com/testorg/testproject/_git/testrepo/pullrequest/123';
    const parsed = parseAzureDevOpsUrl(testUrl);
    console.log('✅ URL parsing utility works:', parsed);
} catch (error) {
    console.error('❌ URL parsing failed:', error.message);
}

// Test 3: Check configuration validation
try {
    // This should throw an error due to missing config
    new AzureDevOpsIntegration({});
    console.log('❌ Configuration validation not working');
} catch (error) {
    console.log('✅ Configuration validation works:', error.message);
}

console.log('🎉 Basic structure tests completed!');
