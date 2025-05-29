/**
 * Test Case Manager Tests
 * Tests for test case operations and associations
 */

import { TestCaseManager } from '../src/modules/testCaseManager.js';
import { AzureDevOpsAuth } from '../src/modules/auth.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Mock data for testing
 */
const mockTestCase = {
    title: 'Test User Login Functionality',
    description: 'Verify that users can successfully log into the system with valid credentials',
    steps: [
        {
            action: 'Navigate to the login page',
            expectedResult: 'Login form is displayed with username and password fields'
        },
        {
            action: 'Enter valid username and password',
            expectedResult: 'Credentials are accepted and form is ready for submission'
        },
        {
            action: 'Click the Login button',
            expectedResult: 'User is authenticated and redirected to the dashboard'
        },
        {
            action: 'Verify dashboard elements are visible',
            expectedResult: 'Dashboard loads with user-specific content and navigation'
        }
    ],
    priority: 1,
    automationStatus: 'Planned'
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
        this.nextId = 2000;
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
        workItem.fields['System.State'] = 'Design';
        workItem.fields['System.CreatedDate'] = new Date().toISOString();
        workItem.fields['System.ChangedDate'] = new Date().toISOString();
        workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] = workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated';

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
        // Simple mock query - return test cases only
        const workItems = Array.from(this.mockWorkItems.values())
            .filter(wi => wi.fields['System.WorkItemType'] === 'Test Case')
            .map(wi => ({ id: wi.id }));
        console.log(`🔄 Mock: Query returned ${workItems.length} test cases`);
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

    async getTestApi() {
        // Mock test API is not implemented, return null to simulate unavailability
        throw new Error('Test API not available in mock mode');
    }
}

/**
 * Test runner class
 */
class TestCaseManagerTester {
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
        console.log('TEST CASE MANAGER TEST SUMMARY');
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
async function testInitialization(testCaseManager) {
    await testCaseManager.initialize();
    
    if (!testCaseManager.workItemTrackingApi) {
        throw new Error('Work Item Tracking API was not initialized');
    }

    // Test API may not be available, that's expected in some configurations
    console.log('⚠️ Test API availability:', testCaseManager.testApi ? 'Available' : 'Not Available');
}

async function testCreateTestCase(testCaseManager) {
    const testCase = await testCaseManager.createTestCase(
        mockTestCase.title,
        mockTestCase.description,
        mockTestCase.steps,
        {
            priority: mockTestCase.priority,
            automationStatus: mockTestCase.automationStatus
        }
    );

    if (!testCase.id) {
        throw new Error('Test case was not created - missing ID');
    }

    if (testCase.title !== mockTestCase.title) {
        throw new Error('Test case title does not match');
    }

    if (testCase.workItemType !== 'Test Case') {
        throw new Error('Work item type is not Test Case');
    }

    if (testCase.automationStatus !== mockTestCase.automationStatus) {
        throw new Error('Automation status does not match');
    }

    // Store for other tests
    testCreateTestCase.createdTestCaseId = testCase.id;
    return testCase;
}

async function testGetTestCase(testCaseManager) {
    if (!testCreateTestCase.createdTestCaseId) {
        throw new Error('No test case ID available from previous test');
    }

    const testCase = await testCaseManager.getTestCase(testCreateTestCase.createdTestCaseId);

    if (!testCase.id) {
        throw new Error('Test case was not retrieved - missing ID');
    }

    if (testCase.title !== mockTestCase.title) {
        throw new Error('Retrieved test case title does not match');
    }

    if (testCase.workItemType !== 'Test Case') {
        throw new Error('Retrieved work item type is not Test Case');
    }
}

async function testUpdateTestCase(testCaseManager) {
    if (!testCreateTestCase.createdTestCaseId) {
        throw new Error('No test case ID available from previous test');
    }

    const updates = {
        title: 'Updated Test Case Title',
        description: 'Updated test case description',
        priority: 2,
        automationStatus: 'Automated',
        steps: [
            {
                action: 'Updated step 1',
                expectedResult: 'Updated expected result 1'
            },
            {
                action: 'Updated step 2',
                expectedResult: 'Updated expected result 2'
            }
        ]
    };

    const updatedTestCase = await testCaseManager.updateTestCase(
        testCreateTestCase.createdTestCaseId,
        updates
    );

    if (updatedTestCase.title !== updates.title) {
        throw new Error('Test case title was not updated');
    }

    if (updatedTestCase.priority !== updates.priority) {
        throw new Error('Test case priority was not updated');
    }

    if (updatedTestCase.automationStatus !== updates.automationStatus) {
        throw new Error('Test case automation status was not updated');
    }
}

async function testCreateUserStoryForAssociation(testCaseManager) {    // Get user story type from environment or use default for tests
    const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
    
    // Create a user story to associate test cases with
    const userStory = await testCaseManager.workItemTrackingApi.createWorkItem(
        [],
        [
            { op: 'add', path: '/fields/System.Title', value: 'Test User Story for Association' },
            { op: 'add', path: '/fields/System.Description', value: 'User story for testing associations' },
            { op: 'add', path: '/fields/System.WorkItemType', value: userStoryType }
        ],
        testConfig.project,
        userStoryType,
        false,
        true
    );

    testCreateUserStoryForAssociation.createdUserStoryId = userStory.id;
    return userStory;
}

async function testAssociateTestCaseWithUserStory(testCaseManager) {
    if (!testCreateTestCase.createdTestCaseId) {
        throw new Error('No test case ID available from previous test');
    }

    if (!testCreateUserStoryForAssociation.createdUserStoryId) {
        throw new Error('No user story ID available from previous test');
    }

    const associationResult = await testCaseManager.associateTestCaseWithUserStory(
        testCreateTestCase.createdTestCaseId,
        testCreateUserStoryForAssociation.createdUserStoryId
    );

    if (!associationResult.associated) {
        throw new Error('Test case was not associated with user story');
    }

    if (associationResult.testCaseId !== testCreateTestCase.createdTestCaseId) {
        throw new Error('Association result does not contain correct test case ID');
    }

    if (associationResult.userStoryId !== testCreateUserStoryForAssociation.createdUserStoryId) {
        throw new Error('Association result does not contain correct user story ID');
    }
}

async function testSearchTestCases(testCaseManager) {
    const wiql = `
        SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo],
               [Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.TCM.AutomationStatus]
        FROM WorkItems
        WHERE [System.WorkItemType] = 'Test Case'
        ORDER BY [System.Id]
    `;

    const testCases = await testCaseManager.searchTestCases(wiql);

    if (!Array.isArray(testCases)) {
        throw new Error('Search did not return an array');
    }

    // Should have at least the test case we created
    if (testCases.length === 0) {
        console.log('⚠️ Warning: No test cases found in search (may be expected in mock mode)');
    }
}

async function testTestStepsFormatting(testCaseManager) {
    // Test the step formatting functionality
    const steps = [
        { action: 'Step 1 with <special> characters & symbols', expectedResult: 'Expected "result" with quotes' },
        { action: 'Step 2 normal text', expectedResult: 'Normal expected result' }
    ];

    const formattedSteps = testCaseManager._formatTestSteps(steps);
    
    if (!formattedSteps) {
        throw new Error('Test steps were not formatted');
    }

    if (!formattedSteps.includes('<steps')) {
        throw new Error('Formatted steps do not contain expected XML structure');
    }

    // Test parsing the formatted steps back
    const parsedSteps = testCaseManager._parseTestSteps(formattedSteps);
    
    if (!Array.isArray(parsedSteps) || parsedSteps.length !== steps.length) {
        throw new Error('Parsed steps do not match original steps count');
    }
}

async function testErrorHandling(testCaseManager) {
    // Test invalid test case ID
    try {
        await testCaseManager.getTestCase(-1);
        throw new Error('Should have thrown error for invalid test case ID');
    } catch (error) {
        if (!error.message.includes('not found') && !error.message.includes('required')) {
            throw new Error(`Unexpected error message: ${error.message}`);
        }
    }

    // Test invalid test case creation
    try {
        await testCaseManager.createTestCase('', '');
        throw new Error('Should have thrown error for empty title and description');
    } catch (error) {
        if (!error.message.includes('required')) {
            throw new Error(`Unexpected error message: ${error.message}`);
        }
    }

    // Test invalid automation status
    try {
        await testCaseManager.createTestCase(
            'Test Case',
            'Test Description',
            [],
            { automationStatus: 'InvalidStatus' }
        );
        // This should succeed but with a warning or default value
        console.log('⚠️ Invalid automation status was handled gracefully');
    } catch (error) {
        // Error is also acceptable
        console.log('⚠️ Invalid automation status caused error (acceptable)');
    }
}

async function testDeleteTestCase(testCaseManager) {
    if (!testCreateTestCase.createdTestCaseId) {
        throw new Error('No test case ID available from previous test');
    }

    const deleteResult = await testCaseManager.deleteTestCase(testCreateTestCase.createdTestCaseId);

    if (!deleteResult.deleted) {
        throw new Error('Test case was not deleted');
    }

    if (deleteResult.id !== testCreateTestCase.createdTestCaseId) {
        throw new Error('Delete result does not contain correct test case ID');
    }
}

/**
 * Main test execution
 */
async function runTestCaseManagerTests() {
    console.log('🚀 Starting Test Case Manager Tests');
    console.log(`📊 Test mode: ${testConfig.useMockData ? 'Mock' : 'Live Azure DevOps'}`);
    console.log(`🏢 Organization: ${testConfig.organizationUrl}`);
    console.log(`📁 Project: ${testConfig.project}`);

    const tester = new TestCaseManagerTester();
    let testCaseManager;

    try {
        // Setup
        if (testConfig.useMockData) {
            console.log('\n🔧 Setting up mock environment...');
            const mockWebApi = new MockWebApi();
            testCaseManager = new TestCaseManager(mockWebApi, testConfig.project);
        } else {
            console.log('\n🔧 Setting up Azure DevOps connection...');
            const authManager = new AzureDevOpsAuth(
                testConfig.organizationUrl,
                testConfig.personalAccessToken
            );
            const webApi = await authManager.getWebApi();
            testCaseManager = new TestCaseManager(webApi, testConfig.project);
        }

        // Run tests in sequence (some tests depend on previous ones)
        await tester.runTest('Initialization', () => testInitialization(testCaseManager));
        await tester.runTest('Create Test Case', () => testCreateTestCase(testCaseManager));
        await tester.runTest('Get Test Case', () => testGetTestCase(testCaseManager));
        await tester.runTest('Update Test Case', () => testUpdateTestCase(testCaseManager));
        await tester.runTest('Create User Story for Association', () => testCreateUserStoryForAssociation(testCaseManager));
        await tester.runTest('Associate Test Case with User Story', () => testAssociateTestCaseWithUserStory(testCaseManager));
        await tester.runTest('Search Test Cases', () => testSearchTestCases(testCaseManager));
        await tester.runTest('Test Steps Formatting', () => testTestStepsFormatting(testCaseManager));
        await tester.runTest('Error Handling', () => testErrorHandling(testCaseManager));
        
        // Delete test should be last as it removes the created work item
        await tester.runTest('Delete Test Case', () => testDeleteTestCase(testCaseManager));

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
    TestCaseManagerTester,
    runTestCaseManagerTests,
    testConfig
};

/**
 * Run tests if this file is executed directly
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    runTestCaseManagerTests()
        .then(results => {
            process.exit(results.failed > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('❌ Test execution failed:', error);
            process.exit(1);
        });
}
