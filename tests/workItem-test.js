/**
 * Work Item Manager Tests
 * Tests for user story operations and work item management
 */

import { WorkItemManager } from '../src/modules/workItemManager.js';
import { AzureDevOpsAuth } from '../src/modules/auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Mock data for testing
 */
const mockUserStory = {
    title: 'Test User Story',
    description: 'This is a test user story for automated testing',
    acceptanceCriteria: 'Given a test scenario, when executed, then it should pass',
    priority: 2,
    storyPoints: 5
};

const mockFeature = {
    title: 'Test Feature',
    description: 'This is a test feature for linking user stories'
};

const mockBug = {
    title: 'Test Bug',
    description: 'This is a test bug for automated testing',
    priority: 2,
    severity: '2 - High',
    reproSteps: '1. Navigate to login page\n2. Enter invalid credentials\n3. Click submit\n4. Observe error',
    foundIn: 'v1.0.0',
    systemInfo: 'Windows 10, Chrome 91, 8GB RAM',
    tags: 'login, authentication, critical'
};

/**
 * Test configuration
 */
const testConfig = {
    organizationUrl: process.env.AZURE_DEVOPS_ORG_URL || 'https://dev.azure.com/test-org',
    project: process.env.AZURE_DEVOPS_PROJECT || 'TestProject',
    personalAccessToken: process.env.AZURE_DEVOPS_PAT || 'mock-pat-token',
    useMockData: !process.env.AZURE_DEVOPS_PAT // Use mock if no real PAT is provided
};

/**
 * Mock Work Item Tracking API for testing without real Azure DevOps connection
 */
class MockWorkItemTrackingApi {
    constructor() {
        this.mockWorkItems = new Map();
        this.nextId = 1000;
    }

    async createWorkItem(customHeaders, patchDocument, project, workItemType, validateOnly, bypassRuleValidation) {
        const id = this.nextId++;
        const workItem = {
            id,
            fields: {},
            url: `https://dev.azure.com/test-org/TestProject/_apis/wit/workItems/${id}`,
            _links: {}
        };

        // Process patch document
        patchDocument.forEach(patch => {
            if (patch.op === 'add' && patch.path.startsWith('/fields/')) {
                const fieldName = patch.path.replace('/fields/', '');
                workItem.fields[fieldName] = patch.value;
            }
        });

        // Set default fields
        workItem.fields['System.WorkItemType'] = workItemType;
        workItem.fields['System.State'] = 'New';
        workItem.fields['System.CreatedDate'] = new Date().toISOString();
        workItem.fields['System.ChangedDate'] = new Date().toISOString();

        this.mockWorkItems.set(id, workItem);
        console.log(`🔄 Mock: Created ${workItemType} with ID ${id}`);
        return workItem;
    }

    async updateWorkItem(customHeaders, patchDocument, workItemId, project, validateOnly, bypassRuleValidation) {
        const workItem = this.mockWorkItems.get(workItemId);
        if (!workItem) {
            throw new Error(`Work item ${workItemId} not found`);
        }

        // Process patch document
        patchDocument.forEach(patch => {
            if (patch.op === 'add' && patch.path.startsWith('/fields/')) {
                const fieldName = patch.path.replace('/fields/', '');
                workItem.fields[fieldName] = patch.value;
            } else if (patch.op === 'add' && patch.path === '/relations/-') {
                if (!workItem.relations) workItem.relations = [];
                workItem.relations.push(patch.value);
            }
        });

        workItem.fields['System.ChangedDate'] = new Date().toISOString();
        console.log(`🔄 Mock: Updated work item ${workItemId}`);
        return workItem;
    }

    async deleteWorkItem(workItemId, project, destroy) {
        const workItem = this.mockWorkItems.get(workItemId);
        if (!workItem) {
            throw new Error(`Work item ${workItemId} not found`);
        }

        this.mockWorkItems.delete(workItemId);
        console.log(`🔄 Mock: Deleted work item ${workItemId}`);
        return { id: workItemId, code: 200 };
    }

    async getWorkItem(workItemId, fields, asOf, expand) {
        const workItem = this.mockWorkItems.get(workItemId);
        if (!workItem) {
            throw new Error(`Work item ${workItemId} not found`);
        }

        console.log(`🔄 Mock: Retrieved work item ${workItemId}`);
        return workItem;
    }

    async getWorkItems(workItemIds, fields, asOf, expand) {
        const workItems = [];
        workItemIds.forEach(id => {
            const workItem = this.mockWorkItems.get(id);
            if (workItem) {
                workItems.push(workItem);
            }
        });

        console.log(`🔄 Mock: Retrieved ${workItems.length} work items`);
        return workItems;
    }

    async queryByWiql(wiql, project) {
        // Simple mock query - return all work items
        const workItems = Array.from(this.mockWorkItems.values()).map(wi => ({ id: wi.id }));
        console.log(`🔄 Mock: Query returned ${workItems.length} work items`);
        return { workItems };
    }
}

/**
 * Mock Web API for testing
 */
class MockWebApi {
    constructor() {
        this.serverUrl = 'https://dev.azure.com/test-org';
        this.mockApi = new MockWorkItemTrackingApi();
    }

    async getWorkItemTrackingApi() {
        return this.mockApi;
    }
}

/**
 * Test runner class
 */
class WorkItemManagerTester {
    constructor() {
        this.testResults = {
            passed: 0,
            failed: 0,
            total: 0,
            details: []
        };
    }

    /**
     * Run a test and track results
     */
    async runTest(testName, testFunction) {
        this.testResults.total++;
        console.log(`\n🧪 Running test: ${testName}`);
        
        try {
            await testFunction();
            this.testResults.passed++;
            this.testResults.details.push({ name: testName, status: 'PASSED', error: null });
            console.log(`✅ Test passed: ${testName}`);
        } catch (error) {
            this.testResults.failed++;
            this.testResults.details.push({ name: testName, status: 'FAILED', error: error.message });
            console.error(`❌ Test failed: ${testName} - ${error.message}`);
        }
    }

    /**
     * Print test summary
     */
    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log('WORK ITEM MANAGER TEST SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total tests: ${this.testResults.total}`);
        console.log(`Passed: ${this.testResults.passed}`);
        console.log(`Failed: ${this.testResults.failed}`);
        console.log(`Success rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`);

        if (this.testResults.failed > 0) {
            console.log('\nFailed tests:');
            this.testResults.details
                .filter(test => test.status === 'FAILED')
                .forEach(test => {
                    console.log(`❌ ${test.name}: ${test.error}`);
                });
        }

        console.log('='.repeat(60));
    }
}

/**
 * Test functions
 */
async function testInitialization(workItemManager) {
    await workItemManager.initialize();
    
    if (!workItemManager.workItemTrackingApi) {
        throw new Error('Work Item Tracking API was not initialized');
    }
}

async function testCreateUserStory(workItemManager) {
    const userStory = await workItemManager.createUserStory(
        mockUserStory.title,
        mockUserStory.description,
        {
            acceptanceCriteria: mockUserStory.acceptanceCriteria,
            priority: mockUserStory.priority,
            storyPoints: mockUserStory.storyPoints
        }
    );

    if (!userStory.id) {
        throw new Error('User story was not created - missing ID');
    }

    if (userStory.title !== mockUserStory.title) {
        throw new Error('User story title does not match');
    }    // Get user story type from environment or use default for tests
    const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
    
    if (userStory.workItemType !== userStoryType) {
        throw new Error(`Work item type is not ${userStoryType}`);
    }

    // Store for other tests
    testCreateUserStory.createdUserStoryId = userStory.id;
    return userStory;
}

async function testGetWorkItem(workItemManager) {
    if (!testCreateUserStory.createdUserStoryId) {
        throw new Error('No user story ID available from previous test');
    }

    const workItem = await workItemManager.getWorkItem(testCreateUserStory.createdUserStoryId);

    if (!workItem.id) {
        throw new Error('Work item was not retrieved - missing ID');
    }

    if (workItem.title !== mockUserStory.title) {
        throw new Error('Retrieved work item title does not match');
    }
}

async function testUpdateUserStory(workItemManager) {
    if (!testCreateUserStory.createdUserStoryId) {
        throw new Error('No user story ID available from previous test');
    }

    const updates = {
        title: 'Updated Test User Story',
        description: 'Updated description for testing',
        priority: 1,
        storyPoints: 8
    };

    const updatedUserStory = await workItemManager.updateUserStory(
        testCreateUserStory.createdUserStoryId,
        updates
    );

    if (updatedUserStory.title !== updates.title) {
        throw new Error('User story title was not updated');
    }

    if (updatedUserStory.priority !== updates.priority) {
        throw new Error('User story priority was not updated');
    }
}

async function testCreateFeatureForLinking(workItemManager) {
    // Create a feature to link user stories to
    const feature = await workItemManager.workItemTrackingApi.createWorkItem(
        [],
        [
            { op: 'add', path: '/fields/System.Title', value: mockFeature.title },
            { op: 'add', path: '/fields/System.Description', value: mockFeature.description },
            { op: 'add', path: '/fields/System.WorkItemType', value: 'Feature' }
        ],
        testConfig.project,
        'Feature',
        false,
        true
    );

    testCreateFeatureForLinking.createdFeatureId = feature.id;
    return feature;
}

async function testLinkUserStoryToFeature(workItemManager) {
    if (!testCreateUserStory.createdUserStoryId) {
        throw new Error('No user story ID available from previous test');
    }

    if (!testCreateFeatureForLinking.createdFeatureId) {
        throw new Error('No feature ID available from previous test');
    }

    const linkResult = await workItemManager.linkUserStoryToFeature(
        testCreateUserStory.createdUserStoryId,
        testCreateFeatureForLinking.createdFeatureId
    );

    if (!linkResult.linked) {
        throw new Error('User story was not linked to feature');
    }

    if (linkResult.userStoryId !== testCreateUserStory.createdUserStoryId) {
        throw new Error('Link result does not contain correct user story ID');
    }
}

async function testSearchWorkItems(workItemManager) {    const wiql = `
        SELECT [System.Id], [System.Title], [System.WorkItemType] 
        FROM WorkItems 
        WHERE [System.WorkItemType] = '${process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item'}' 
        ORDER BY [System.Id]
    `;

    const workItems = await workItemManager.searchWorkItems(wiql);

    if (!Array.isArray(workItems)) {
        throw new Error('Search did not return an array');
    }

    // Should have at least the user story we created
    if (workItems.length === 0) {
        console.log('⚠️ Warning: No work items found in search (may be expected in mock mode)');
    }
}

async function testErrorHandling(workItemManager) {
    // Test invalid work item ID
    try {
        await workItemManager.getWorkItem(-1);
        throw new Error('Should have thrown error for invalid work item ID');
    } catch (error) {
        if (!error.message.includes('not found') && !error.message.includes('required')) {
            throw new Error(`Unexpected error message: ${error.message}`);
        }
    }

    // Test invalid user story creation
    try {
        await workItemManager.createUserStory('', '');
        throw new Error('Should have thrown error for empty title and description');
    } catch (error) {
        if (!error.message.includes('required')) {
            throw new Error(`Unexpected error message: ${error.message}`);
        }
    }
}

async function testDeleteUserStory(workItemManager) {
    if (!testCreateUserStory.createdUserStoryId) {
        throw new Error('No user story ID available from previous test');
    }

    const deleteResult = await workItemManager.deleteUserStory(testCreateUserStory.createdUserStoryId);

    if (!deleteResult.deleted) {
        throw new Error('User story was not deleted');
    }

    if (deleteResult.id !== testCreateUserStory.createdUserStoryId) {
        throw new Error('Delete result does not contain correct user story ID');
    }
}

async function testCreateBug(workItemManager) {
    const bug = await workItemManager.createBug(
        mockBug.title,
        mockBug.description,
        {
            priority: mockBug.priority,
            severity: mockBug.severity,
            reproSteps: mockBug.reproSteps,
            foundIn: mockBug.foundIn,
            systemInfo: mockBug.systemInfo,
            tags: mockBug.tags
        }
    );

    if (!bug.id) {
        throw new Error('Bug was not created - missing ID');
    }

    if (bug.title !== mockBug.title) {
        throw new Error('Bug title does not match');
    }

    if (bug.workItemType !== 'Bug') {
        throw new Error('Work item type is not Bug');
    }

    if (bug.priority !== mockBug.priority) {
        throw new Error('Bug priority does not match');
    }

    if (bug.severity !== mockBug.severity) {
        throw new Error('Bug severity does not match');
    }

    // Store for other tests
    testCreateBug.createdBugId = bug.id;
    return bug;
}

async function testUpdateBug(workItemManager) {
    if (!testCreateBug.createdBugId) {
        throw new Error('No bug ID available from creation test');
    }

    const updatedBug = await workItemManager.updateBug(testCreateBug.createdBugId, {
        title: 'Updated Bug Title',
        severity: '1 - Critical',
        state: 'Active',
        reproSteps: 'Updated reproduction steps:\n1. New step 1\n2. New step 2'
    });

    if (updatedBug.title !== 'Updated Bug Title') {
        throw new Error('Bug title was not updated');
    }

    if (updatedBug.severity !== '1 - Critical') {
        throw new Error('Bug severity was not updated');
    }

    if (updatedBug.state !== 'Active') {
        throw new Error('Bug state was not updated');
    }

    return updatedBug;
}

async function testCreateBugWithParent(workItemManager) {
    if (!testCreateUserStory.createdUserStoryId) {
        throw new Error('No user story ID available from creation test');
    }

    const parentLinkedBug = await workItemManager.createBug(
        'Bug linked to user story',
        'This bug is linked to a parent user story',
        {
            parentId: testCreateUserStory.createdUserStoryId,
            priority: 1,
            severity: '1 - Critical',
            reproSteps: 'Steps related to parent user story functionality'
        }
    );

    if (!parentLinkedBug.id) {
        throw new Error('Parent-linked bug was not created - missing ID');
    }

    if (parentLinkedBug.parentId !== testCreateUserStory.createdUserStoryId) {
        throw new Error('Bug parent ID does not match user story ID');
    }

    // Store for cleanup
    testCreateBugWithParent.createdBugId = parentLinkedBug.id;
    return parentLinkedBug;
}

async function testBugErrorHandling(workItemManager) {
    // Test invalid bug ID update
    try {
        await workItemManager.updateBug(999999, { title: 'Should fail' });
        throw new Error('Expected error for invalid bug ID was not thrown');
    } catch (error) {
        if (!error.message.includes('not found') && !error.message.includes('does not exist')) {
            throw new Error(`Unexpected error message: ${error.message}`);
        }
    }

    // Test invalid priority
    try {
        await workItemManager.createBug('Test', 'Test description', { priority: 10 });
        // This should not throw an error but should warn and skip the invalid priority
        console.log('   ⚠️  Invalid priority was handled gracefully (expected behavior)');
    } catch (error) {
        throw new Error(`Unexpected error for invalid priority: ${error.message}`);
    }
}

/**
 * Main test execution
 */
async function runWorkItemManagerTests() {
    console.log('🚀 Starting Work Item Manager Tests');
    console.log(`📊 Test mode: ${testConfig.useMockData ? 'Mock' : 'Live Azure DevOps'}`);
    console.log(`🏢 Organization: ${testConfig.organizationUrl}`);
    console.log(`📁 Project: ${testConfig.project}`);

    const tester = new WorkItemManagerTester();
    let workItemManager;

    try {
        // Setup
        if (testConfig.useMockData) {
            console.log('\n🔧 Setting up mock environment...');
            const mockWebApi = new MockWebApi();
            workItemManager = new WorkItemManager(mockWebApi, testConfig.project);        } else {
            console.log('\n🔧 Setting up Azure DevOps connection...');
            const authManager = new AzureDevOpsAuth(
                testConfig.organizationUrl,
                testConfig.personalAccessToken
            );
            const webApi = await authManager.getWebApi();
            workItemManager = new WorkItemManager(webApi, testConfig.project);
        }

        // Run tests in sequence (some tests depend on previous ones)
        await tester.runTest('Initialization', () => testInitialization(workItemManager));
        await tester.runTest('Create User Story', () => testCreateUserStory(workItemManager));
        await tester.runTest('Get Work Item', () => testGetWorkItem(workItemManager));
        await tester.runTest('Update User Story', () => testUpdateUserStory(workItemManager));
        await tester.runTest('Create Feature for Linking', () => testCreateFeatureForLinking(workItemManager));
        await tester.runTest('Link User Story to Feature', () => testLinkUserStoryToFeature(workItemManager));
        await tester.runTest('Search Work Items', () => testSearchWorkItems(workItemManager));
        await tester.runTest('Error Handling', () => testErrorHandling(workItemManager));
        
        // Bug tests
        await tester.runTest('Create Bug', () => testCreateBug(workItemManager));
        await tester.runTest('Update Bug', () => testUpdateBug(workItemManager));
        await tester.runTest('Create Bug with Parent', () => testCreateBugWithParent(workItemManager));
        await tester.runTest('Bug Error Handling', () => testBugErrorHandling(workItemManager));
        
        // Delete test should be last as it removes the created work item
        await tester.runTest('Delete User Story', () => testDeleteUserStory(workItemManager));

    } catch (error) {
        console.error('❌ Test setup failed:', error.message);
    }

    // Print results
    tester.printSummary();

    return tester.testResults;
}

/**
 * Export for use in other test files
 */
export {
    WorkItemManagerTester,
    runWorkItemManagerTests,
    testConfig
};

/**
 * Run tests if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    runWorkItemManagerTests()
        .then(results => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error);
            process.exit(1);
        });
}
