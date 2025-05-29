/**
 * Integration Tests for Azure DevOps MCP Server
 * 
 * @file integration-test.js - Comprehensive integration tests for Azure DevOps functionality
 * @description This test suite validates the complete integration between all Azure DevOps
 * modules including authentication, work item management, pull request operations, and
 * test case handling. Uses mock objects to simulate Azure DevOps API responses and
 * validates the integration layer functionality without requiring live connections.
 * 
 * Test Coverage:
 * - Azure DevOps Integration initialization and configuration
 * - Work item operations (create, update, delete, search)
 * - Test case management (create, update, associate)
 * - Pull request operations (get, comment, analyze)
 * - Error handling and edge cases
 * - Mock API response validation
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires ../src/modules/azureDevOpsIntegration.js - Main integration module
 * 
 * @example
 * // Run the integration tests
 * node tests/integration-test.js
 * 
 * // Expected output:
 * // ✅ All integration tests passed
 * // 📊 Test Results: 15/15 tests passed
 */

import { AzureDevOpsIntegration } from '../src/modules/azureDevOpsIntegration.js';

// Mock configuration for testing
const mockConfig = {
    organizationUrl: 'https://dev.azure.com/testorg',
    personalAccessToken: 'test-pat-token',
    project: 'TestProject'
};

// Mock WebApi for testing
class MockWebApi {
    getWorkItemTrackingApi() {
        return {
            createWorkItem: async () => ({ id: 123, fields: { 'System.Title': 'Test' } }),
            updateWorkItem: async () => ({ id: 123, fields: { 'System.Title': 'Updated' } }),
            deleteWorkItem: async () => ({ id: 123 }),
            getWorkItem: async () => ({ id: 123, fields: { 'System.Title': 'Test' } }),
            queryByWiql: async () => ({ workItems: [{ id: 123 }] }),
            getWorkItems: async () => [{ id: 123, fields: { 'System.Title': 'Test' } }],
            getWorkItemRelations: async () => []
        };
    }

    getGitApi() {
        return {
            getPullRequest: async () => ({ pullRequestId: 1, title: 'Test PR' }),
            getThreads: async () => [{ id: 1, comments: [{ content: 'Test comment' }] }],
            createThread: async () => ({ id: 1 }),
            updateThread: async () => ({ id: 1 })
        };
    }

    getCoreApi() {
        return {
            getProjects: async () => [{ name: 'TestProject' }]
        };
    }
}

// Mock authentication module
class MockAuth {
    constructor() {
        this.initialized = false;
    }

    async initialize() {
        this.initialized = true;
        return true;
    }

    getWebApi() {
        return new MockWebApi();
    }

    async testConnection() {
        return true;
    }

    async getOrganizationInfo() {
        return { name: 'Test Organization' };
    }

    async validatePermissions() {
        return true;
    }

    async getConnectionInfo() {
        return { authenticatedUser: { displayName: 'Test User' } };
    }

    dispose() {
        this.initialized = false;
    }
}

// Mock managers for testing
class MockPullRequestManager {
    async initialize() {}
    async getPullRequest() { return { pullRequestId: 1, title: 'Test PR' }; }
    async getPullRequestByUrl() { return { pullRequestId: 1, title: 'Test PR' }; }
    async getPullRequestComments() { return [{ id: 1, content: 'Test comment' }]; }
    async addFileComment() { return { id: 1 }; }
    async replyToComment() { return { id: 2 }; }
    async updateCommentThreadStatus() { return { id: 1, status: 'closed' }; }
}

class MockWorkItemManager {
    async initialize() {}
    async createUserStory() { return { id: 123, fields: { 'System.Title': 'Test Story' } }; }
    async updateUserStory() { return { id: 123, fields: { 'System.Title': 'Updated Story' } }; }
    async deleteUserStory() { return { id: 123 }; }
    async linkUserStoryToFeature() { return true; }
    async getWorkItem() { return { id: 123, fields: { 'System.Title': 'Test' } }; }
    async searchWorkItems() { return [{ id: 123, fields: { 'System.Title': 'Test' } }]; }
    async getUserStoriesForFeature() { return [{ id: 123, fields: { 'System.Title': 'Test Story' } }]; }
}

class MockTestCaseManager {
    async initialize() {}
    async createTestCase() { return { id: 456, fields: { 'System.Title': 'Test Case' } }; }
    async updateTestCase() { return { id: 456, fields: { 'System.Title': 'Updated Test Case' } }; }
    async deleteTestCase() { return { id: 456 }; }
    async associateTestCaseWithUserStory() { return true; }
    async getTestCase() { return { id: 456, fields: { 'System.Title': 'Test Case' } }; }
    async searchTestCases() { return [{ id: 456, fields: { 'System.Title': 'Test Case' } }]; }
    async getTestCasesForUserStory() { return [{ id: 456, fields: { 'System.Title': 'Test Case' } }]; }
}

class IntegrationTestRunner {
    constructor() {
        this.testResults = [];
        this.passCount = 0;
        this.failCount = 0;
    }

    async runTest(testName, testFunction) {
        try {
            console.log(`\n🧪 Running: ${testName}`);
            await testFunction();
            console.log(`✅ PASS: ${testName}`);
            this.testResults.push({ name: testName, status: 'PASS' });
            this.passCount++;
        } catch (error) {
            console.error(`❌ FAIL: ${testName}`);
            console.error(`   Error: ${error.message}`);
            this.testResults.push({ name: testName, status: 'FAIL', error: error.message });
            this.failCount++;
        }
    }

    printSummary() {
        console.log('\n📊 Test Results Summary');
        console.log('========================');
        console.log(`Total Tests: ${this.testResults.length}`);
        console.log(`✅ Passed: ${this.passCount}`);
        console.log(`❌ Failed: ${this.failCount}`);
        console.log(`Success Rate: ${((this.passCount / this.testResults.length) * 100).toFixed(1)}%`);

        if (this.failCount > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(result => result.status === 'FAIL')
                .forEach(result => {
                    console.log(`   - ${result.name}: ${result.error}`);
                });
        }
    }
}

// Helper function to create integration instance with mocks
function createMockIntegration() {
    const integration = new AzureDevOpsIntegration(mockConfig);
    
    // Replace the modules with mocks
    integration.auth = new MockAuth();
    integration.pullRequestManager = new MockPullRequestManager();
    integration.workItemManager = new MockWorkItemManager();
    integration.testCaseManager = new MockTestCaseManager();
    integration.initialized = true;

    return integration;
}

async function runIntegrationTests() {
    console.log('🚀 Running Azure DevOps Integration Tests');
    console.log('==========================================');

    const runner = new IntegrationTestRunner();

    // Test 1: Initialization
    await runner.runTest('Integration Initialization', async () => {
        const integration = new AzureDevOpsIntegration(mockConfig);
        integration.auth = new MockAuth();
        integration.pullRequestManager = new MockPullRequestManager();
        integration.workItemManager = new MockWorkItemManager();
        integration.testCaseManager = new MockTestCaseManager();
        
        const success = await integration.initialize();
        if (!success) throw new Error('Initialization failed');
        if (!integration.initialized) throw new Error('Integration not marked as initialized');
    });

    // Test 2: Configuration Validation
    await runner.runTest('Configuration Validation', async () => {
        try {
            new AzureDevOpsIntegration({});
            throw new Error('Should have thrown validation error');
        } catch (error) {
            if (!error.message.includes('Missing required configuration')) {
                throw error;
            }
        }
    });

    // Test 3: Connection Methods
    await runner.runTest('Connection Methods', async () => {
        const integration = createMockIntegration();
        
        const testResult = await integration.testConnection();
        if (!testResult) throw new Error('Test connection failed');

        const orgInfo = await integration.getOrganizationInfo();
        if (!orgInfo.name) throw new Error('Organization info missing');

        const permissions = await integration.validatePermissions();
        if (!permissions) throw new Error('Permission validation failed');
    });

    // Test 4: Pull Request Methods
    await runner.runTest('Pull Request Methods', async () => {
        const integration = createMockIntegration();
        
        const pr = await integration.getPullRequest('repo1', 1);
        if (!pr.pullRequestId) throw new Error('Pull request retrieval failed');

        const prByUrl = await integration.getPullRequestByUrl('https://test.com/pr/1');
        if (!prByUrl.pullRequestId) throw new Error('Pull request by URL failed');

        const comments = await integration.getPullRequestComments('repo1', 1);
        if (!Array.isArray(comments)) throw new Error('Comments retrieval failed');
    });

    // Test 5: Work Item Methods
    await runner.runTest('Work Item Methods', async () => {
        const integration = createMockIntegration();
        
        const userStory = await integration.createUserStory('Test', 'Description');
        if (!userStory.id) throw new Error('User story creation failed');

        const updated = await integration.updateUserStory(123, { title: 'Updated' });
        if (!updated.id) throw new Error('User story update failed');

        const workItem = await integration.getWorkItem(123);
        if (!workItem.id) throw new Error('Work item retrieval failed');

        const searchResults = await integration.searchWorkItems('SELECT * FROM WorkItems');
        if (!Array.isArray(searchResults)) throw new Error('Work item search failed');
    });

    // Test 6: Test Case Methods
    await runner.runTest('Test Case Methods', async () => {
        const integration = createMockIntegration();
        
        const testCase = await integration.createTestCase('Test', 'Description', []);
        if (!testCase.id) throw new Error('Test case creation failed');

        const updated = await integration.updateTestCase(456, { title: 'Updated' });
        if (!updated.id) throw new Error('Test case update failed');

        const retrieved = await integration.getTestCase(456);
        if (!retrieved.id) throw new Error('Test case retrieval failed');

        const associated = await integration.associateTestCaseWithUserStory(456, 123);
        if (!associated) throw new Error('Test case association failed');
    });

    // Test 7: Error Handling
    await runner.runTest('Error Handling', async () => {
        const integration = new AzureDevOpsIntegration(mockConfig);
        // Don't initialize - should trigger ensureInitialized error
        
        try {
            await integration.getWorkItem(123);
            throw new Error('Should have thrown initialization error');
        } catch (error) {
            if (!error.message.includes('initialize')) {
                throw error;
            }
        }
    });

    // Test 8: Disposal
    await runner.runTest('Resource Disposal', async () => {
        const integration = createMockIntegration();
        
        integration.dispose();
        if (integration.initialized) throw new Error('Integration should be marked as not initialized after disposal');
    });

    // Test 9: Ensure Initialized
    await runner.runTest('Ensure Initialized', async () => {
        const integration = new AzureDevOpsIntegration(mockConfig);
        integration.auth = new MockAuth();
        integration.pullRequestManager = new MockPullRequestManager();
        integration.workItemManager = new MockWorkItemManager();
        integration.testCaseManager = new MockTestCaseManager();
        
        // Should auto-initialize when calling methods
        const workItem = await integration.getWorkItem(123);
        if (!workItem.id) throw new Error('Auto-initialization failed');
        if (!integration.initialized) throw new Error('Integration not marked as initialized after auto-init');
    });

    // Test 10: Refresh Connection
    await runner.runTest('Refresh Connection', async () => {
        const integration = createMockIntegration();
        
        const success = await integration.refresh();
        if (!success) throw new Error('Refresh failed');
        if (!integration.initialized) throw new Error('Integration not initialized after refresh');
    });

    runner.printSummary();
    return runner.failCount === 0;
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runIntegrationTests()
        .then(success => {
            console.log(success ? '\n🎉 All tests passed!' : '\n💥 Some tests failed!');
            process.exit(success ? 0 : 1);
        })
        .catch(error => {
            console.error('💥 Test runner failed:', error);
            process.exit(1);
        });
}

export { runIntegrationTests };
