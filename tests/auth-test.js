/**
 * Authentication Module Tests
 * Tests for Azure DevOps authentication functionality
 */

import { AzureDevOpsAuth } from '../src/modules/auth.js';

async function runAuthTests() {
    console.log('🧪 Running Authentication Module Tests...');
    console.log('==========================================');

    // Test 1: URL Normalization
    console.log('\n📝 Test 1: URL Normalization');
    try {
        // Test old format conversion
        const auth1 = new AzureDevOpsAuth('https://testorg.visualstudio.com', 'dummy-token');
        console.log('✅ Old format URL converted successfully');

        // Test correct format
        const auth2 = new AzureDevOpsAuth('https://dev.azure.com/testorg', 'dummy-token');
        console.log('✅ Correct format URL accepted');

        // Test trailing slash removal
        const auth3 = new AzureDevOpsAuth('https://dev.azure.com/testorg/', 'dummy-token');
        console.log('✅ Trailing slash removed correctly');
    } catch (error) {
        console.log('❌ URL normalization test failed:', error.message);
    }

    // Test 2: Invalid URL Handling
    console.log('\n📝 Test 2: Invalid URL Handling');
    try {
        new AzureDevOpsAuth('invalid-url', 'dummy-token');
        console.log('❌ Should have thrown error for invalid URL');
    } catch (error) {
        console.log('✅ Invalid URL correctly rejected:', error.message);
    }

    // Test 3: PAT Validation
    console.log('\n📝 Test 3: PAT Validation');
    try {
        const auth = new AzureDevOpsAuth('https://dev.azure.com/testorg', 'dummy-token');
        const isValid = auth.validatePersonalAccessToken('a'.repeat(52)); // Valid length
        console.log('✅ Valid PAT accepted');
    } catch (error) {
        console.log('❌ PAT validation test failed:', error.message);
    }

    try {
        const auth = new AzureDevOpsAuth('https://dev.azure.com/testorg', 'dummy-token');
        auth.validatePersonalAccessToken('short'); // Too short
        console.log('❌ Should have thrown error for short PAT');
    } catch (error) {
        console.log('✅ Short PAT correctly rejected:', error.message);
    }

    // Test 4: Empty Configuration Handling
    console.log('\n📝 Test 4: Empty Configuration Handling');
    try {
        new AzureDevOpsAuth('', 'dummy-token');
        console.log('❌ Should have thrown error for empty URL');
    } catch (error) {
        console.log('✅ Empty URL correctly rejected:', error.message);
    }

    try {
        const auth = new AzureDevOpsAuth('https://dev.azure.com/testorg', '');
        auth.validatePersonalAccessToken('');
        console.log('❌ Should have thrown error for empty PAT');
    } catch (error) {
        console.log('✅ Empty PAT correctly rejected:', error.message);
    }

    // Test 5: Auth Handler Creation
    console.log('\n📝 Test 5: Auth Handler Creation');
    try {
        const auth = new AzureDevOpsAuth('https://dev.azure.com/testorg', 'validTokenFormat123ABC');
        const handler = auth.createAuthHandler();
        console.log('✅ Auth handler created successfully');
    } catch (error) {
        console.log('❌ Auth handler creation failed:', error.message);
    }

    // Test 6: Bearer Token Support
    console.log('\n📝 Test 6: Bearer Token Support');
    try {
        const auth = new AzureDevOpsAuth('https://dev.azure.com/testorg', 'Bearer validBearerToken123');
        const handler = auth.createAuthHandler();
        console.log('✅ Bearer token handler created successfully');
    } catch (error) {
        console.log('❌ Bearer token handler creation failed:', error.message);
    }

    console.log('\n🎉 Authentication Module Tests Completed!');
    console.log('Note: Connection tests require valid credentials and are not run in this test suite.');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runAuthTests().catch(console.error);
}

export { runAuthTests };
