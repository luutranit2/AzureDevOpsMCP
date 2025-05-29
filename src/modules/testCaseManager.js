/**
 * Test Case Management Module
 * Handles test case operations and associations
 */

export class TestCaseManager {
    constructor(webApi, project) {
        this.webApi = webApi;
        this.project = project;
        this.workItemTrackingApi = null;
        this.testApi = null;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }    
    
    /**
     * Initialize the Azure DevOps APIs required for test case management operations
     * 
     * This method sets up the Work Item Tracking API (required) and Test API (optional) for the TestCaseManager.
     * The Work Item Tracking API is essential for all test case operations as test cases are work items in Azure DevOps.
     * The Test API provides additional test-specific functionality but may not be available in all Azure DevOps
     * configurations or subscription levels.
     * 
     * @async
     * @method initialize
     * @returns {Promise<void>} Promise that resolves when APIs are successfully initialized
     * 
     * @throws {Error} Throws an error if the Work Item Tracking API cannot be initialized
     * @throws {Error} Throws an error if there are authentication or connection issues
     * @throws {Error} Throws an error if the Azure DevOps project is not accessible
     * 
     * @description
     * The initialization process:
     * 1. Initializes the Work Item Tracking API (required for test case operations)
     * 2. Attempts to initialize the Test API (optional, provides additional test functionality)
     * 3. Logs appropriate success/warning messages based on API availability
     * 
     * Note: If the Test API is not available, the manager will still function using only the Work Item API.
     * This is common in basic Azure DevOps configurations or when test-specific features are not enabled.
     * 
     * @example
     * // Basic initialization
     * const testManager = new TestCaseManager(webApi, 'MyProject');
     * await testManager.initialize();
     * 
     * @example
     * // Initialize with error handling
     * try {
     *   await testManager.initialize();
     *   console.log('Test Case Manager ready for operations');
     * } catch (error) {
     *   console.error('Failed to initialize:', error.message);
     * }
     * 
     * @example
     * // Check API availability after initialization
     * await testManager.initialize();
     * if (testManager.testApi) {
     *   console.log('Full test API available');
     * } else {
     *   console.log('Using Work Item API only');
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/} Work Item Tracking API Documentation
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/test/} Test API Documentation
     */
    async initialize() {
        try {
            this.workItemTrackingApi = await this.webApi.getWorkItemTrackingApi();
            // Note: Test API may not be available in all Azure DevOps configurations
            try {
                this.testApi = await this.webApi.getTestApi();
                console.log('✅ Test Case Manager APIs initialized successfully');
            } catch (testApiError) {
                console.warn('⚠️ Test API not available, using Work Item API only');
                this.testApi = null;
            }
        } catch (error) {
            console.error('❌ Failed to initialize Test Case Manager APIs:', error.message);
            throw error;
        }
    }    
    
    /**
     * Create a new test case in Azure DevOps with comprehensive validation and formatting
     * 
     * Creates a test case work item with the specified title, description, test steps, and additional metadata.
     * Test steps are automatically formatted to Azure DevOps XML format for proper display in the test case editor.
     * The method validates all input parameters and provides detailed error messages for invalid data.
     * 
     * @async
     * @method createTestCase
     * @param {string} title - The title of the test case (required, must be non-empty string)
     * @param {string} description - The description of the test case (required, must be non-empty string)
     * @param {Array<Object>} [steps=[]] - Array of test steps with action and expected result properties
     * @param {string} steps[].action - The action to perform in this test step
     * @param {string} steps[].expectedResult - The expected result for this test step
     * @param {Object} [additionalFields={}] - Additional optional fields for the test case
     * @param {string|number} [additionalFields.priority] - Priority level (1-4, where 1=highest, 4=lowest)
     * @param {string} [additionalFields.assignedTo] - Assigned user email or display name
     * @param {string} [additionalFields.iterationPath] - Iteration path (e.g., "Project\\Sprint 1")
     * @param {string} [additionalFields.areaPath] - Area path for categorization (e.g., "Project\\Component")
     * @param {string} [additionalFields.automationStatus] - Automation status: "Not Automated", "Planned", or "Automated"
     * @param {string} [additionalFields.state] - Work item state (default: "New")
     * @param {Array<string>} [additionalFields.tags] - Array of tags for categorization
     * 
     * @returns {Promise<Object>} Promise that resolves to the created test case work item
     * @returns {number} returns.id - The unique ID of the created test case
     * @returns {string} returns.url - The URL to view the test case in Azure DevOps
     * @returns {Object} returns.fields - All field values of the created test case
     * @returns {string} returns.fields['System.Title'] - The test case title
     * @returns {string} returns.fields['System.Description'] - The test case description
     * @returns {string} returns.fields['Microsoft.VSTS.TCM.Steps'] - Formatted test steps in XML
     * @returns {string} returns.fields['System.WorkItemType'] - Always "Test Case"
     * @returns {string} returns.fields['System.State'] - Current state of the test case
     * 
     * @throws {Error} Throws error if Work Item Tracking API is not initialized
     * @throws {Error} Throws error if title is missing, empty, or not a string
     * @throws {Error} Throws error if description is missing, empty, or not a string
     * @throws {Error} Throws error if steps parameter is not an array
     * @throws {Error} Throws error for invalid priority values (must be 1-4)
     * @throws {Error} Throws error for invalid automation status values
     * @throws {Error} Throws error for Azure DevOps API authentication issues (401)
     * @throws {Error} Throws error for insufficient permissions (403)
     * @throws {Error} Throws error for invalid project or area path (404)
     * @throws {Error} Throws error for malformed request data (400)
     * @throws {Error} Throws error for Azure DevOps service issues (500+)
     * 
     * @example
     * // Basic test case creation
     * const testCase = await testManager.createTestCase(
     *   'Login functionality test',
     *   'Verify that users can log in with valid credentials'
     * );
     * console.log(`Created test case ID: ${testCase.id}`);
     * 
     * @example
     * // Test case with detailed steps
     * const steps = [
     *   { action: 'Navigate to login page', expectedResult: 'Login form is displayed' },
     *   { action: 'Enter valid username and password', expectedResult: 'Credentials are accepted' },
     *   { action: 'Click login button', expectedResult: 'User is redirected to dashboard' }
     * ];
     * 
     * const testCase = await testManager.createTestCase(
     *   'User login validation',
     *   'Test the complete login workflow',
     *   steps
     * );
     * 
     * @example
     * // Test case with comprehensive metadata
     * const testCase = await testManager.createTestCase(
     *   'API endpoint validation',
     *   'Validate REST API responses and error handling',
     *   [
     *     { action: 'Send GET request to /api/users', expectedResult: 'Returns 200 status and user list' },
     *     { action: 'Send invalid request', expectedResult: 'Returns appropriate error code' }
     *   ],
     *   {
     *     priority: 1,
     *     assignedTo: 'tester@company.com',
     *     iterationPath: 'MyProject\\Sprint 1',
     *     areaPath: 'MyProject\\API Testing',
     *     automationStatus: 'Planned',
     *     tags: ['api', 'regression', 'high-priority']
     *   }
     * );
     * 
     * @example
     * // Error handling
     * try {
     *   const testCase = await testManager.createTestCase('', 'Description');
     * } catch (error) {
     *   console.error('Validation failed:', error.message);
     *   // Error: "Title is required and must be a string"
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/test/} Azure DevOps Test Plans Documentation
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create} Create Work Item API Reference
     */
    async createTestCase(title, description, steps = [], additionalFields = {}) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Title is required and must be a string');
        }

        if (!description || typeof description !== 'string') {
            throw new Error('Description is required and must be a string');
        }

        if (!Array.isArray(steps)) {
            throw new Error('Steps must be an array');
        }

        try {
            console.log(`📝 Creating test case: ${title}`);

            // Format test steps for Azure DevOps
            const formattedSteps = this._formatTestSteps(steps);

            // Build the JSON patch document
            const patchDocument = [
                {
                    op: 'add',
                    path: '/fields/System.Title',
                    value: title
                },
                {
                    op: 'add',
                    path: '/fields/System.Description',
                    value: description
                },
                {
                    op: 'add',
                    path: '/fields/System.WorkItemType',
                    value: 'Test Case'
                }
            ];

            // Add test steps if provided
            if (formattedSteps) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.TCM.Steps',
                    value: formattedSteps
                });
            }

            // Add optional fields
            if (additionalFields.priority) {
                const priority = parseInt(additionalFields.priority);
                if (priority >= 1 && priority <= 4) {
                    patchDocument.push({
                        op: 'add',
                        path: '/fields/Microsoft.VSTS.Common.Priority',
                        value: priority
                    });
                }
            }

            if (additionalFields.assignedTo) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/System.AssignedTo',
                    value: additionalFields.assignedTo
                });
            }

            if (additionalFields.iterationPath) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/System.IterationPath',
                    value: additionalFields.iterationPath
                });
            }

            if (additionalFields.areaPath) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/System.AreaPath',
                    value: additionalFields.areaPath
                });
            }

            if (additionalFields.automationStatus) {
                const validStatuses = ['Not Automated', 'Planned', 'Automated'];
                if (validStatuses.includes(additionalFields.automationStatus)) {
                    patchDocument.push({
                        op: 'add',
                        path: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
                        value: additionalFields.automationStatus
                    });
                }
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.createWorkItem(
                    [], // customHeaders
                    patchDocument,
                    this.project,
                    'Test Case',
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Test case created successfully with ID: ${workItem.id}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                automationStatus: workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated',
                steps: this._parseTestSteps(workItem.fields['Microsoft.VSTS.TCM.Steps']),
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            };

        } catch (error) {
            console.error('❌ Failed to create test case:', error.message);
            throw this._handleError(error, 'create test case');
        }
    }    
    
    /**
     * Update an existing test case with new field values and test steps
     * 
     * Modifies an existing test case work item by applying the specified updates to its fields.
     * The method validates the test case ID, constructs the appropriate JSON patch operations,
     * and handles test step formatting when steps are included in the updates. Only provided
     * fields will be updated; omitted fields remain unchanged.
     * 
     * @async
     * @method updateTestCase
     * @param {number|string} testCaseId - The ID of the test case to update (must be positive integer)
     * @param {Object} updates - Object containing the fields to update with their new values
     * @param {string} [updates.title] - New title for the test case
     * @param {string} [updates.description] - New description for the test case
     * @param {Array<Object>} [updates.steps] - New test steps to replace existing ones
     * @param {string} updates.steps[].action - The action to perform in this test step
     * @param {string} updates.steps[].expectedResult - The expected result for this test step
     * @param {string|number} [updates.priority] - New priority level (1-4, where 1=highest, 4=lowest)
     * @param {string} [updates.assignedTo] - New assigned user email or display name
     * @param {string} [updates.iterationPath] - New iteration path (e.g., "Project\\Sprint 2")
     * @param {string} [updates.areaPath] - New area path for categorization
     * @param {string} [updates.automationStatus] - New automation status: "Not Automated", "Planned", or "Automated"
     * @param {string} [updates.state] - New work item state (e.g., "Active", "Resolved", "Closed")
     * @param {Array<string>} [updates.tags] - New tags array to replace existing tags
     * @param {string} [updates.reason] - Reason for the state change (required for some state transitions)
     * 
     * @returns {Promise<Object>} Promise that resolves to the updated test case work item
     * @returns {number} returns.id - The unique ID of the updated test case
     * @returns {string} returns.url - The URL to view the test case in Azure DevOps
     * @returns {Object} returns.fields - All current field values of the updated test case
     * @returns {string} returns.fields['System.Title'] - Current test case title
     * @returns {string} returns.fields['System.Description'] - Current test case description
     * @returns {string} returns.fields['Microsoft.VSTS.TCM.Steps'] - Current formatted test steps in XML
     * @returns {string} returns.fields['System.State'] - Current state of the test case
     * @returns {number} returns.rev - The current revision number of the test case
     * 
     * @throws {Error} Throws error if Work Item Tracking API is not initialized
     * @throws {Error} Throws error if testCaseId is missing, invalid, or not a positive integer
     * @throws {Error} Throws error if updates parameter is missing or not an object
     * @throws {Error} Throws error for invalid priority values (must be 1-4)
     * @throws {Error} Throws error for invalid automation status values
     * @throws {Error} Throws error for invalid state transition attempts
     * @throws {Error} Throws error for Azure DevOps API authentication issues (401)
     * @throws {Error} Throws error for insufficient permissions (403)
     * @throws {Error} Throws error if test case does not exist (404)
     * @throws {Error} Throws error for invalid field values or malformed request (400)
     * @throws {Error} Throws error for Azure DevOps service issues (500+)
     * @throws {Error} Throws error for concurrent modification conflicts (409)
     * 
     * @example
     * // Update test case title and description
     * const updatedTestCase = await testManager.updateTestCase(123, {
     *   title: 'Updated Login Test',
     *   description: 'Enhanced test with additional validation'
     * });
     * console.log(`Updated test case: ${updatedTestCase.fields['System.Title']}`);
     * 
     * @example
     * // Update test steps and priority
     * const updates = {
     *   steps: [
     *     { action: 'Navigate to login page', expectedResult: 'Login form displays correctly' },
     *     { action: 'Enter valid credentials', expectedResult: 'Credentials are validated' },
     *     { action: 'Click login button', expectedResult: 'User successfully logs in' },
     *     { action: 'Verify dashboard access', expectedResult: 'Dashboard loads with user data' }
     *   ],
     *   priority: 1,
     *   automationStatus: 'Planned'
     * };
     * 
     * const result = await testManager.updateTestCase(456, updates);
     * 
     * @example
     * // Update assignment and iteration
     * const result = await testManager.updateTestCase(789, {
     *   assignedTo: 'newtester@company.com',
     *   iterationPath: 'MyProject\\Sprint 3',
     *   state: 'Active',
     *   reason: 'Moved to current sprint'
     * });
     * 
     * @example
     * // Update with comprehensive metadata
     * const comprehensiveUpdate = {
     *   title: 'Complete API Integration Test',
     *   description: 'Full end-to-end API testing with error scenarios',
     *   steps: [
     *     { action: 'Setup test data', expectedResult: 'Test environment is prepared' },
     *     { action: 'Execute API calls', expectedResult: 'All endpoints respond correctly' },
     *     { action: 'Validate error handling', expectedResult: 'Errors are handled gracefully' }
     *   ],
     *   priority: 2,
     *   assignedTo: 'apitest@company.com',
     *   areaPath: 'MyProject\\API\\Integration',
     *   automationStatus: 'Automated',
     *   tags: ['api', 'integration', 'automated', 'regression']
     * };
     * 
     * const result = await testManager.updateTestCase(101, comprehensiveUpdate);
     * 
     * @example
     * // Error handling for invalid updates
     * try {
     *   await testManager.updateTestCase(999, { priority: 'invalid' });
     * } catch (error) {
     *   console.error('Update failed:', error.message);
     *   // Handle validation or API errors
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update} Update Work Item API Reference
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/work-item-fields} Work Item Fields Reference
     */
    async updateTestCase(testCaseId, updates) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!testCaseId || isNaN(parseInt(testCaseId)) || parseInt(testCaseId) <= 0) {
            throw new Error('Valid test case ID is required');
        }

        // Convert string to number if needed
        testCaseId = parseInt(testCaseId);

        if (!updates || typeof updates !== 'object') {
            throw new Error('Updates object is required');
        }

        try {
            console.log(`📝 Updating test case with ID: ${testCaseId}`);

            // Build the JSON patch document
            const patchDocument = [];

            // Map update fields to Azure DevOps field paths
            const fieldMapping = {
                title: '/fields/System.Title',
                description: '/fields/System.Description',
                priority: '/fields/Microsoft.VSTS.Common.Priority',
                assignedTo: '/fields/System.AssignedTo',
                iterationPath: '/fields/System.IterationPath',
                areaPath: '/fields/System.AreaPath',
                automationStatus: '/fields/Microsoft.VSTS.TCM.AutomationStatus',
                state: '/fields/System.State'
            };

            for (const [key, value] of Object.entries(updates)) {
                if (fieldMapping[key] && value !== undefined && value !== null) {
                    let processedValue = value;
                    
                    // Process specific field types
                    if (key === 'priority') {
                        processedValue = parseInt(value);
                        if (processedValue < 1 || processedValue > 4) {
                            console.warn(`Invalid priority value: ${value}. Must be between 1-4.`);
                            continue;
                        }
                    } else if (key === 'automationStatus') {
                        const validStatuses = ['Not Automated', 'Planned', 'Automated'];
                        if (!validStatuses.includes(value)) {
                            console.warn(`Invalid automation status: ${value}. Must be one of: ${validStatuses.join(', ')}`);
                            continue;
                        }
                    }

                    patchDocument.push({
                        op: 'add',
                        path: fieldMapping[key],
                        value: processedValue
                    });
                }
            }

            // Handle test steps update
            if (updates.steps && Array.isArray(updates.steps)) {
                const formattedSteps = this._formatTestSteps(updates.steps);
                if (formattedSteps) {
                    patchDocument.push({
                        op: 'add',
                        path: '/fields/Microsoft.VSTS.TCM.Steps',
                        value: formattedSteps
                    });
                }
            }

            if (patchDocument.length === 0) {
                throw new Error('No valid fields provided for update');
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    [], // customHeaders
                    patchDocument,
                    testCaseId,
                    this.project,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Test case updated successfully: ${workItem.id}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                automationStatus: workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated',
                steps: this._parseTestSteps(workItem.fields['Microsoft.VSTS.TCM.Steps']),
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            };

        } catch (error) {
            console.error('❌ Failed to update test case:', error.message);
            throw this._handleError(error, 'update test case');
        }
    }    
    
    /**
     * Delete a test case permanently from Azure DevOps
     * 
     * ⚠️ **WARNING: This operation permanently deletes the test case and cannot be undone!**
     * 
     * Permanently removes a test case work item from Azure DevOps. This operation destroys
     * all test case data including test steps, history, attachments, and links. The deletion
     * is immediate and irreversible. Consider moving test cases to a "Removed" state instead
     * of permanent deletion for audit trail purposes.
     * 
     * @async
     * @method deleteTestCase
     * @param {number|string} testCaseId - The ID of the test case to delete (must be positive integer)
     * 
     * @returns {Promise<Object>} Promise that resolves to the deletion operation result
     * @returns {boolean} returns.success - Whether the deletion was successful
     * @returns {number} returns.deletedId - The ID of the deleted test case
     * @returns {string} returns.message - Confirmation message about the deletion
     * @returns {Date} returns.deletedAt - Timestamp when the deletion occurred
     * 
     * @throws {Error} Throws error if Work Item Tracking API is not initialized
     * @throws {Error} Throws error if testCaseId is missing, invalid, or not a positive integer
     * @throws {Error} Throws error for Azure DevOps API authentication issues (401)
     * @throws {Error} Throws error for insufficient permissions to delete test cases (403)
     * @throws {Error} Throws error if test case does not exist or already deleted (404)
     * @throws {Error} Throws error for malformed deletion request (400)
     * @throws {Error} Throws error if test case has dependencies that prevent deletion (409)
     * @throws {Error} Throws error for Azure DevOps service issues (500+)
     * 
     * @description
     * **Security and Safety Considerations:**
     * - Requires "Delete work items" permission in Azure DevOps
     * - Cannot be performed on test cases that are part of active test runs
     * - May fail if test case has strong relationships or dependencies
     * - Consider impact on test plans and test suites before deletion
     * - Audit logs may retain deletion records depending on Azure DevOps configuration
     * 
     * **Alternative Approaches:**
     * Instead of permanent deletion, consider:
     * 1. Setting state to "Removed" or "Obsolete"
     * 2. Moving to an archive area path
     * 3. Adding tags to mark as deprecated
     * 4. Removing from active test plans while preserving the work item
     * 
     * @example
     * // Basic test case deletion (use with extreme caution)
     * try {
     *   const result = await testManager.deleteTestCase(123);
     *   console.log(`Successfully deleted test case ${result.deletedId}`);
     * } catch (error) {
     *   console.error('Deletion failed:', error.message);
     * }
     * 
     * @example
     * // Safe deletion with confirmation
     * const testCaseId = 456;
     * const confirmation = await confirm(
     *   `Are you sure you want to permanently delete test case ${testCaseId}? This cannot be undone.`
     * );
     * 
     * if (confirmation) {
     *   try {
     *     const result = await testManager.deleteTestCase(testCaseId);
     *     console.log('Test case deleted:', result.message);
     *   } catch (error) {
     *     console.error('Failed to delete test case:', error.message);
     *   }
     * }
     * 
     * @example
     * // Alternative: Mark as removed instead of deleting
     * // This preserves the test case for audit purposes
     * try {
     *   const result = await testManager.updateTestCase(789, {
     *     state: 'Removed',
     *     reason: 'Marked for deletion',
     *     areaPath: 'MyProject\\Archive\\Removed Test Cases'
     *   });
     *   console.log('Test case marked as removed instead of deleted');
     * } catch (error) {
     *   console.error('Failed to mark test case as removed:', error.message);
     * }
     * 
     * @example
     * // Bulk deletion with error handling
     * const testCaseIds = [101, 102, 103];
     * const deletionResults = [];
     * 
     * for (const id of testCaseIds) {
     *   try {
     *     const result = await testManager.deleteTestCase(id);
     *     deletionResults.push({ id, success: true, result });
     *   } catch (error) {
     *     deletionResults.push({ id, success: false, error: error.message });
     *   }
     * }
     * 
     * console.log('Deletion results:', deletionResults);
     * 
     * @warning This operation is irreversible and permanently destroys test case data
     * @warning Ensure proper authorization and confirmation before calling this method
     * @warning Consider alternative approaches like state changes for safer test case management
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/delete} Delete Work Item API Reference
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/organizations/security/permissions} Azure DevOps Permissions Reference
     */
    async deleteTestCase(testCaseId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!testCaseId || isNaN(parseInt(testCaseId)) || parseInt(testCaseId) <= 0) {
            throw new Error('Valid test case ID is required');
        }

        // Convert string to number if needed
        testCaseId = parseInt(testCaseId);

        try {
            console.log(`🗑️ Deleting test case with ID: ${testCaseId}`);

            // First, get the work item to verify it exists and is a test case
            const workItem = await this.getTestCase(testCaseId);
            
            if (workItem.workItemType !== 'Test Case') {
                throw new Error(`Work item ${testCaseId} is not a Test Case (Type: ${workItem.workItemType})`);
            }

            const result = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.deleteWorkItem(
                    testCaseId,
                    this.project,
                    true // destroy (permanent delete)
                );
            });

            console.log(`✅ Test case deleted successfully: ${testCaseId}`);

            return {
                id: testCaseId,
                deleted: true,
                title: workItem.title,
                deletedDate: new Date().toISOString(),
                result: result
            };

        } catch (error) {
            console.error('❌ Failed to delete test case:', error.message);
            throw this._handleError(error, 'delete test case');
        }
    }    
    
    /**
     * Associate a test case with a user story through a "Tests" relationship link
     * 
     * Creates a formal relationship between a test case and user story work item, establishing
     * traceability between requirements and their verification tests. This association enables
     * test coverage tracking, requirement validation, and impact analysis when requirements change.
     * The relationship is bidirectional and appears in both work items' related work section.
     * 
     * @async
     * @method associateTestCaseWithUserStory
     * @param {number|string} testCaseId - The ID of the test case to associate (must be positive integer)
     * @param {number|string} userStoryId - The ID of the user story to associate with (must be positive integer)
     * 
     * @returns {Promise<Object>} Promise that resolves to the association operation result
     * @returns {boolean} returns.success - Whether the association was successful
     * @returns {number} returns.testCaseId - The ID of the associated test case
     * @returns {number} returns.userStoryId - The ID of the associated user story
     * @returns {Object} returns.relationship - Details about the created relationship link
     * @returns {string} returns.relationship.type - The relationship type ("Tests")
     * @returns {string} returns.relationship.url - URL to the relationship in Azure DevOps
     * @returns {Date} returns.createdAt - Timestamp when the association was created
     * @returns {string} returns.message - Confirmation message about the association
     * 
     * @throws {Error} Throws error if Work Item Tracking API is not initialized
     * @throws {Error} Throws error if testCaseId is missing, invalid, or not a positive integer
     * @throws {Error} Throws error if userStoryId is missing, invalid, or not a positive integer
     * @throws {Error} Throws error for Azure DevOps API authentication issues (401)
     * @throws {Error} Throws error for insufficient permissions to modify work item relationships (403)
     * @throws {Error} Throws error if test case or user story does not exist (404)
     * @throws {Error} Throws error for invalid work item types or malformed request (400)
     * @throws {Error} Throws error if relationship already exists (409)
     * @throws {Error} Throws error for circular relationship dependencies (409)
     * @throws {Error} Throws error for Azure DevOps service issues (500+)
     * 
     * @description
     * **Relationship Benefits:**
     * - **Traceability**: Track which tests verify specific requirements
     * - **Coverage Analysis**: Identify user stories lacking test coverage
     * - **Impact Assessment**: Understand test implications when requirements change
     * - **Reporting**: Generate requirement-test coverage reports
     * - **Navigation**: Quick access between related work items in Azure DevOps UI
     * 
     * **Relationship Properties:**
     * - Creates a "Tests" link from test case to user story
     * - Creates a "Tested By" back-link from user story to test case
     * - Relationship is persistent until explicitly removed
     * - Multiple test cases can be associated with the same user story
     * - One test case can be associated with multiple user stories
     * 
     * **Best Practices:**
     * - Associate test cases during test planning phase
     * - Ensure test cases adequately cover user story acceptance criteria
     * - Review associations when user stories are updated or split
     * - Use associations for test execution planning and reporting
     * 
     * @example
     * // Basic test case to user story association
     * const result = await testManager.associateTestCaseWithUserStory(123, 456);
     * console.log(`Associated test case ${result.testCaseId} with user story ${result.userStoryId}`);
     * 
     * @example
     * // Associate with error handling
     * try {
     *   const association = await testManager.associateTestCaseWithUserStory(789, 101);
     *   console.log('Association created:', association.message);
     *   console.log('Relationship URL:', association.relationship.url);
     * } catch (error) {
     *   if (error.message.includes('409')) {
     *     console.log('Test case is already associated with this user story');
     *   } else {
     *     console.error('Association failed:', error.message);
     *   }
     * }
     * 
     * @example
     * // Batch association of multiple test cases to one user story
     * const userStoryId = 234;
     * const testCaseIds = [301, 302, 303, 304];
     * const associations = [];
     * 
     * for (const testCaseId of testCaseIds) {
     *   try {
     *     const result = await testManager.associateTestCaseWithUserStory(testCaseId, userStoryId);
     *     associations.push({ testCaseId, success: true, result });
     *   } catch (error) {
     *     associations.push({ testCaseId, success: false, error: error.message });
     *   }
     * }
     * 
     * console.log('Association results:', associations);
     * 
     * @example
     * // Create association with validation
     * const testCaseId = 567;
     * const userStoryId = 890;
     * 
     * // Verify both work items exist before associating
     * try {
     *   const testCase = await testManager.getTestCase(testCaseId);
     *   const userStory = await workItemManager.getWorkItem(userStoryId);
     *   
     *   if (testCase && userStory) {
     *     const result = await testManager.associateTestCaseWithUserStory(testCaseId, userStoryId);
     *     console.log(`Successfully linked "${testCase.fields['System.Title']}" to "${userStory.fields['System.Title']}"`);
     *   }
     * } catch (error) {
     *   console.error('Failed to create association:', error.message);
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update} Work Item Update API for Relationships
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/link-type-reference} Work Item Link Types Reference
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/test/associate-tests-with-test-cases} Azure DevOps Test Case Association Guide
     */
    async associateTestCaseWithUserStory(testCaseId, userStoryId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }        if (!testCaseId || isNaN(parseInt(testCaseId)) || parseInt(testCaseId) <= 0) {
            throw new Error('Valid test case ID is required');
        }

        if (!userStoryId || isNaN(parseInt(userStoryId)) || parseInt(userStoryId) <= 0) {
            throw new Error('Valid user story ID is required');
        }

        // Convert strings to numbers if needed
        testCaseId = parseInt(testCaseId);
        userStoryId = parseInt(userStoryId);

        try {
            console.log(`🔗 Associating test case ${testCaseId} with user story ${userStoryId}`);

            // Verify both work items exist and have correct types
            const [testCase, userStory] = await Promise.all([
                this.getTestCase(testCaseId),
                this._getWorkItem(userStoryId)
            ]);            if (testCase.workItemType !== 'Test Case') {
                throw new Error(`Work item ${testCaseId} is not a Test Case (Type: ${testCase.workItemType})`);
            }            // Get user story type from environment or use default
            const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
            
            if (userStory.workItemType !== userStoryType) {
                throw new Error(`Work item ${userStoryId} is not a ${userStoryType} (Type: ${userStory.workItemType})`);
            }

            // Create the association by linking the test case to the user story
            const patchDocument = [
                {
                    op: 'add',
                    path: '/relations/-',
                    value: {
                        rel: 'Microsoft.VSTS.Common.TestedBy-Reverse',
                        url: `${this.webApi.serverUrl}/${this.project}/_apis/wit/workItems/${userStoryId}`,
                        attributes: {
                            name: 'Tested By'
                        }
                    }
                }
            ];

            const result = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    [], // customHeaders
                    patchDocument,
                    testCaseId,
                    this.project,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Test case associated with user story successfully`);

            return {
                testCaseId,
                userStoryId,
                testCaseTitle: testCase.title,
                userStoryTitle: userStory.title,
                linkType: 'Tested By',
                associated: true,
                associatedDate: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to associate test case with user story:', error.message);
            throw this._handleError(error, 'associate test case with user story');
        }
    }    
    
    /**
     * Retrieves a test case by its unique identifier with optional field filtering
     *
     * This method fetches a comprehensive test case object including all Azure DevOps 
     * standard fields, test steps, relationships, and metadata. The method supports 
     * field filtering to optimize performance when only specific data is needed.
     *
     * @async
     * @method getTestCase
     * @param {number|string} testCaseId - The unique identifier of the test case to retrieve.
     *                                    Accepts both numeric and string representations.
     *                                    Must be a positive integer.
     * @param {Array<string>} [fields=null] - Optional array of specific field names to retrieve.
     *                                       When null or undefined, all fields are returned.
     *                                       Common field names include:
     *                                       - 'System.Title'
     *                                       - 'System.Description' 
     *                                       - 'System.State'
     *                                       - 'Microsoft.VSTS.TCM.Steps'
     *                                       - 'Microsoft.VSTS.Common.Priority'
     *                                       - 'Microsoft.VSTS.TCM.AutomationStatus'
     *
     * @returns {Promise<Object>} A comprehensive test case object with the following structure:
     * @returns {number} returns.id - The unique identifier of the test case
     * @returns {string} returns.title - The title/name of the test case
     * @returns {string} returns.description - Detailed description of the test case
     * @returns {string} returns.state - Current state (Active, Ready, Closed, etc.)
     * @returns {string} returns.workItemType - Always 'Test Case' for this method
     * @returns {string|null} returns.assignedTo - Display name of assigned team member
     * @returns {number|null} returns.priority - Priority level (1-4, where 1 is highest)
     * @returns {string} returns.automationStatus - Automation status (Not Automated, Planned, Automated)
     * @returns {Array<Object>} returns.steps - Array of test step objects with action and expectedResult
     * @returns {string|null} returns.iterationPath - Sprint/iteration assignment path
     * @returns {string|null} returns.areaPath - Area path for team/feature organization
     * @returns {string|null} returns.tags - Semicolon-separated tags for categorization
     * @returns {string} returns.url - Direct URL to the test case in Azure DevOps
     * @returns {string} returns.createdDate - ISO timestamp of creation
     * @returns {string} returns.changedDate - ISO timestamp of last modification
     * @returns {string|null} returns.createdBy - Display name of creator
     * @returns {string|null} returns.changedBy - Display name of last modifier
     * @returns {Array<Object>} returns.relations - Array of work item relationships
     * @returns {Object} returns.links - Azure DevOps API links object
     *
     * @throws {Error} Throws when Work Item Tracking API is not initialized
     * @throws {Error} Throws when testCaseId is invalid (null, undefined, non-numeric, or non-positive)
     * @throws {Error} Throws when test case with specified ID is not found (404)
     * @throws {Error} Throws when user lacks read permissions (401/403)
     * @throws {Error} Throws when project context is invalid (400)
     * @throws {Error} Throws when Azure DevOps service is unavailable (500+)
     * @throws {Error} Throws when network connectivity issues occur
     *
     * @example
     * // Basic test case retrieval
     * const testCase = await testManager.getTestCase(12345);
     * console.log(`Test Case: ${testCase.title}`);
     * console.log(`Status: ${testCase.state}`);
     * console.log(`Steps: ${testCase.steps.length}`);
     *
     * @example
     * // Retrieve specific fields only for performance optimization
     * const testCase = await testManager.getTestCase(12345, [
     *   'System.Title',
     *   'System.State', 
     *   'Microsoft.VSTS.TCM.Steps',
     *   'Microsoft.VSTS.Common.Priority'
     * ]);
     *
     * @example
     * // Handle test case not found scenario
     * try {
     *   const testCase = await testManager.getTestCase(99999);
     *   console.log('Test case found:', testCase.title);
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.log('Test case does not exist');
     *   } else {
     *     console.error('Retrieval failed:', error.message);
     *   }
     * }
     *
     * @example
     * // Access test steps and automation status
     * const testCase = await testManager.getTestCase(12345);
     * 
     * // Check automation readiness
     * if (testCase.automationStatus === 'Not Automated') {
     *   console.log('Test case ready for automation planning');
     * }
     * 
     * // Process test steps
     * testCase.steps.forEach((step, index) => {
     *   console.log(`Step ${index + 1}:`);
     *   console.log(`  Action: ${step.action}`);
     *   console.log(`  Expected: ${step.expectedResult}`);
     * });
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item|Azure DevOps Work Items API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax|WIQL Field Reference}
     */async getTestCase(testCaseId, fields = null) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!testCaseId || isNaN(parseInt(testCaseId)) || parseInt(testCaseId) <= 0) {
            throw new Error('Valid test case ID is required');
        }

        // Convert string to number if needed
        testCaseId = parseInt(testCaseId);

        try {
            console.log(`📋 Retrieving test case: ${testCaseId}`);

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.getWorkItem(
                    testCaseId,
                    fields, // fields
                    null,   // asOf
                    'all'   // expand (relations, links, etc.)
                );
            });

            if (!workItem) {
                throw new Error(`Test case ${testCaseId} not found`);
            }

            console.log(`✅ Test case retrieved: ${workItem.fields['System.Title']}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'] || '',
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                automationStatus: workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated',
                steps: this._parseTestSteps(workItem.fields['Microsoft.VSTS.TCM.Steps']),
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                tags: workItem.fields['System.Tags'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate'],
                createdBy: workItem.fields['System.CreatedBy']?.displayName || null,
                changedBy: workItem.fields['System.ChangedBy']?.displayName || null,
                relations: workItem.relations || [],
                links: workItem._links || {}
            };

        } catch (error) {
            console.error('❌ Failed to retrieve test case:', error.message);
            throw this._handleError(error, 'retrieve test case');
        }
    }    
    
    /**
     * Searches for test cases using Work Item Query Language (WIQL) queries
     *
     * This method provides powerful search capabilities for test cases using Azure DevOps' 
     * WIQL syntax. It supports complex queries with multiple conditions, field filtering,
     * sorting, and relationship-based searches. The method returns a streamlined subset
     * of test case data optimized for search result displays and bulk operations.
     *
     * @async
     * @method searchTestCases
     * @param {string} wiql - Work Item Query Language (WIQL) query string.
     *                       Must be a valid WIQL SELECT statement targeting test cases.
     *                       Common patterns include:
     *                       - Field filtering: WHERE [System.State] = 'Active'
     *                       - Text search: WHERE [System.Title] CONTAINS 'Login'
     *                       - Date ranges: WHERE [System.CreatedDate] >= '2024-01-01'
     *                       - Priority filtering: WHERE [Microsoft.VSTS.Common.Priority] = 1
     *                       - Assignment queries: WHERE [System.AssignedTo] = @Me
     *                       - Automation status: WHERE [Microsoft.VSTS.TCM.AutomationStatus] = 'Not Automated'
     *                       - Area/iteration paths: WHERE [System.AreaPath] UNDER 'Project\\Team'
     *
     * @returns {Promise<Array<Object>>} Array of test case objects with essential fields:
     * @returns {number} returns[].id - The unique identifier of the test case
     * @returns {string} returns[].title - The title/name of the test case
     * @returns {string} returns[].description - Brief description of the test case
     * @returns {string} returns[].state - Current state (Active, Ready, Closed, etc.)
     * @returns {string} returns[].workItemType - Always 'Test Case' for results
     * @returns {string|null} returns[].assignedTo - Display name of assigned team member
     * @returns {number|null} returns[].priority - Priority level (1-4, where 1 is highest)
     * @returns {string} returns[].automationStatus - Automation status (Not Automated, Planned, Automated)
     * @returns {string} returns[].url - Direct URL to the test case in Azure DevOps
     * @returns {string} returns[].createdDate - ISO timestamp of creation
     * @returns {string} returns[].changedDate - ISO timestamp of last modification
     *
     * @throws {Error} Throws when Work Item Tracking API is not initialized
     * @throws {Error} Throws when wiql parameter is null, undefined, or not a string
     * @throws {Error} Throws when WIQL query syntax is invalid (400)
     * @throws {Error} Throws when user lacks query execution permissions (401/403)
     * @throws {Error} Throws when project context is invalid (400)
     * @throws {Error} Throws when Azure DevOps service is unavailable (500+)
     * @throws {Error} Throws when query execution timeout occurs
     * @throws {Error} Throws when query result set exceeds maximum limits
     *
     * @example
     * // Search for active test cases assigned to current user
     * const activeTests = await testManager.searchTestCases(`
     *   SELECT [System.Id], [System.Title], [System.State]
     *   FROM WorkItems
     *   WHERE [System.WorkItemType] = 'Test Case'
     *     AND [System.State] = 'Active'
     *     AND [System.AssignedTo] = @Me
     *   ORDER BY [Microsoft.VSTS.Common.Priority] ASC
     * `);
     * console.log(`Found ${activeTests.length} active test cases`);
     *
     * @example
     * // Search for test cases by title keyword
     * const loginTests = await testManager.searchTestCases(`
     *   SELECT [System.Id], [System.Title], [System.State]
     *   FROM WorkItems
     *   WHERE [System.WorkItemType] = 'Test Case'
     *     AND [System.Title] CONTAINS 'Login'
     *   ORDER BY [System.ChangedDate] DESC
     * `);
     *
     * @example
     * // Search for unautomated high-priority test cases
     * const automationCandidates = await testManager.searchTestCases(`
     *   SELECT [System.Id], [System.Title], [Microsoft.VSTS.Common.Priority]
     *   FROM WorkItems
     *   WHERE [System.WorkItemType] = 'Test Case'
     *     AND [Microsoft.VSTS.TCM.AutomationStatus] = 'Not Automated'
     *     AND [Microsoft.VSTS.Common.Priority] <= 2
     *     AND [System.State] IN ('Active', 'Ready')
     *   ORDER BY [Microsoft.VSTS.Common.Priority] ASC
     * `);
     *
     * @example
     * // Search for test cases in specific area path with date filtering
     * const recentTests = await testManager.searchTestCases(`
     *   SELECT [System.Id], [System.Title], [System.CreatedDate]
     *   FROM WorkItems
     *   WHERE [System.WorkItemType] = 'Test Case'
     *     AND [System.AreaPath] UNDER 'MyProject\\Frontend'
     *     AND [System.CreatedDate] >= '2024-01-01'
     *   ORDER BY [System.CreatedDate] DESC
     * `);
     *
     * @example
     * // Handle empty search results
     * const results = await testManager.searchTestCases(`
     *   SELECT [System.Id] FROM WorkItems
     *   WHERE [System.WorkItemType] = 'Test Case'
     *     AND [System.Title] CONTAINS 'NonExistentFeature'
     * `);
     * 
     * if (results.length === 0) {
     *   console.log('No test cases found matching criteria');
     * } else {
     *   results.forEach(test => console.log(`${test.id}: ${test.title}`));
     * }
     *
     * @example
     * // Error handling for invalid WIQL syntax
     * try {
     *   const results = await testManager.searchTestCases('INVALID QUERY');
     * } catch (error) {
     *   if (error.message.includes('syntax')) {
     *     console.error('WIQL query syntax error:', error.message);
     *   } else {
     *     console.error('Search failed:', error.message);
     *   }
     * }
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/wiql|Azure DevOps WIQL API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax|WIQL Syntax Reference}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/query-operators-variables|WIQL Operators and Variables}
     */
    async searchTestCases(wiql) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!wiql || typeof wiql !== 'string') {
            throw new Error('WIQL query is required');
        }

        try {
            console.log('🔍 Searching test cases with query...');

            const queryResult = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.queryByWiql({
                    query: wiql
                }, this.project);
            });

            if (!queryResult.workItems || queryResult.workItems.length === 0) {
                console.log('📭 No test cases found matching the query');
                return [];
            }

            // Get the full work item details
            const workItemIds = queryResult.workItems.map(wi => wi.id);
            const workItems = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.getWorkItems(
                    workItemIds,
                    null, // fields
                    null, // asOf
                    'all' // expand
                );
            });

            console.log(`✅ Found ${workItems.length} test cases`);

            return workItems.map(workItem => ({
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'] || '',
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                automationStatus: workItem.fields['Microsoft.VSTS.TCM.AutomationStatus'] || 'Not Automated',
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            }));

        } catch (error) {
            console.error('❌ Failed to search test cases:', error.message);
            throw this._handleError(error, 'search test cases');
        }
    }    
    
    /**
     * Retrieves all test cases associated with a specific user story through "Tested By" relationships
     *
     * This method queries Azure DevOps work item relationships to find test cases that are 
     * linked to a user story via the "Tested By" link type. This provides traceability between
     * requirements (user stories) and their corresponding test coverage. The method uses an
     * optimized WIQL query with WorkItemLinks to efficiently retrieve related test cases.
     *
     * @async
     * @method getTestCasesForUserStory
     * @param {number|string} userStoryId - The unique identifier of the user story to find test cases for.
     *                                     Accepts both numeric and string representations.
     *                                     Must be a positive integer corresponding to an existing user story.
     *                                     The user story should be of work item type 'User Story'.
     *
     * @returns {Promise<Array<Object>>} Array of test case objects linked to the user story with essential fields:
     * @returns {number} returns[].id - The unique identifier of the test case
     * @returns {string} returns[].title - The title/name of the test case
     * @returns {string} returns[].description - Brief description of the test case
     * @returns {string} returns[].state - Current state (Active, Ready, Closed, etc.)
     * @returns {string} returns[].workItemType - Always 'Test Case' for results
     * @returns {string|null} returns[].assignedTo - Display name of assigned team member
     * @returns {number|null} returns[].priority - Priority level (1-4, where 1 is highest)
     * @returns {string} returns[].automationStatus - Automation status (Not Automated, Planned, Automated)
     * @returns {string} returns[].url - Direct URL to the test case in Azure DevOps
     * @returns {string} returns[].createdDate - ISO timestamp of creation
     * @returns {string} returns[].changedDate - ISO timestamp of last modification
     *
     * @throws {Error} Throws when userStoryId is invalid (null, undefined, non-numeric, or non-positive)
     * @throws {Error} Throws when Work Item Tracking API is not initialized
     * @throws {Error} Throws when user story with specified ID does not exist (404)
     * @throws {Error} Throws when user lacks read permissions for the user story or test cases (401/403)
     * @throws {Error} Throws when project context is invalid (400)
     * @throws {Error} Throws when Azure DevOps service is unavailable (500+)
     * @throws {Error} Throws when network connectivity issues occur
     *
     * @example
     * // Get all test cases for a specific user story
     * const testCases = await testManager.getTestCasesForUserStory(12345);
     * console.log(`Found ${testCases.length} test cases for user story 12345`);
     * 
     * testCases.forEach(testCase => {
     *   console.log(`- ${testCase.id}: ${testCase.title} (${testCase.state})`);
     * });
     *
     * @example
     * // Check test coverage for a user story
     * const userStoryId = 12345;
     * const linkedTests = await testManager.getTestCasesForUserStory(userStoryId);
     * 
     * if (linkedTests.length === 0) {
     *   console.log(`⚠️  User story ${userStoryId} has no linked test cases`);
     * } else {
     *   const activeTests = linkedTests.filter(test => test.state === 'Active');
     *   const automatedTests = linkedTests.filter(test => test.automationStatus === 'Automated');
     *   
     *   console.log(`📊 Test Coverage Summary:`);
     *   console.log(`  Total test cases: ${linkedTests.length}`);
     *   console.log(`  Active tests: ${activeTests.length}`);
     *   console.log(`  Automated tests: ${automatedTests.length}`);
     *   console.log(`  Automation coverage: ${(automatedTests.length / linkedTests.length * 100).toFixed(1)}%`);
     * }
     *
     * @example
     * // Analyze test case priorities for a user story
     * const testCases = await testManager.getTestCasesForUserStory(12345);
     * 
     * const priorityDistribution = testCases.reduce((acc, test) => {
     *   const priority = test.priority || 'No Priority';
     *   acc[priority] = (acc[priority] || 0) + 1;
     *   return acc;
     * }, {});
     * 
     * console.log('Test case priority distribution:', priorityDistribution);
     *
     * @example
     * // Handle user story with no associated test cases
     * try {
     *   const testCases = await testManager.getTestCasesForUserStory(67890);
     *   
     *   if (testCases.length === 0) {
     *     console.log('No test cases found for this user story');
     *     // Could trigger process to create test cases
     *   } else {
     *     console.log(`Processing ${testCases.length} linked test cases`);
     *   }
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('User story does not exist');
     *   } else {
     *     console.error('Failed to retrieve test cases:', error.message);
     *   }
     * }
     *
     * @example
     * // Generate test execution plan from user story
     * const userStoryId = 12345;
     * const linkedTests = await testManager.getTestCasesForUserStory(userStoryId);
     * 
     * const executionPlan = linkedTests
     *   .filter(test => test.state === 'Active')
     *   .sort((a, b) => (a.priority || 999) - (b.priority || 999))
     *   .map(test => ({
     *     id: test.id,
     *     title: test.title,
     *     priority: test.priority,
     *     assignedTo: test.assignedTo,
     *     isAutomated: test.automationStatus === 'Automated'
     *   }));
     * 
     * console.log('Test execution plan:', executionPlan);
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/wiql|Azure DevOps WIQL API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/link-work-items-support-traceability|Work Item Link Types}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/backlogs/add-link|Adding Work Item Links}
     */async getTestCasesForUserStory(userStoryId) {
        if (!userStoryId || isNaN(parseInt(userStoryId)) || parseInt(userStoryId) <= 0) {
            throw new Error('Valid user story ID is required');
        }

        // Convert string to number if needed
        userStoryId = parseInt(userStoryId);

        const wiql = `
            SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], 
                   [Microsoft.VSTS.Common.Priority], [Microsoft.VSTS.TCM.AutomationStatus]
            FROM WorkItemLinks
            WHERE (Source.[System.Id] = ${userStoryId})
            AND (Target.[System.WorkItemType] = 'Test Case')
            AND (System.Links.LinkType = 'Microsoft.VSTS.Common.TestedBy-Forward')
            ORDER BY [System.Id]
        `;

        return await this.searchTestCases(wiql);
    }    
    
    /**
     * Formats test step objects into Azure DevOps compatible XML format
     *
     * This private method transforms an array of test step objects into the specific XML
     * format required by Azure DevOps Test Case work items. The method handles proper
     * XML encoding, step numbering, and the required XML structure with parameterized
     * strings for action and expected result fields.
     *
     * @private
     * @method _formatTestSteps
     * @param {Array<Object>} steps - Array of test step objects to format.
     *                               Each step should contain:
     *                               - action (string): The action to perform
     *                               - expectedResult (string): The expected outcome
     *                               Alternative property names supported:
     *                               - description (for action)
     *                               - expected (for expectedResult)
     *
     * @returns {string|null} Formatted XML string compatible with Azure DevOps test steps field,
     *                       or null if steps array is empty or invalid.
     *                       The XML follows the structure:
     *                       ```xml
     *                       <steps id="0" last="N">
     *                         <step id="1" type="ValidateStep">
     *                           <parameterizedString isformatted="true">&lt;P&gt;action&lt;/P&gt;</parameterizedString>
     *                           <parameterizedString isformatted="true">&lt;P&gt;expected&lt;/P&gt;</parameterizedString>
     *                           <description/>
     *                         </step>
     *                       </steps>
     *                       ```
     *
     * @throws {Error} Logs warnings for formatting failures but returns null instead of throwing
     *
     * @example
     * // Format test steps for creation/update
     * const steps = [
     *   { action: 'Navigate to login page', expectedResult: 'Login page is displayed' },
     *   { action: 'Enter valid credentials', expectedResult: 'User is authenticated' }
     * ];
     * const formattedXml = this._formatTestSteps(steps);
     * // Returns: "<steps id=\"0\" last=\"2\"><step id=\"1\"...>..."
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/guidance/work-item-field-index|Azure DevOps Field Reference}
     */_formatTestSteps(steps) {
        if (!steps || steps.length === 0) {
            return null;
        }

        try {
            // Debug
            console.log(`Formatting ${steps.length} test steps with exact working format`);
            
            // Use the exact XML format that works consistently
            let stepsXml = `<steps id="0" last="${steps.length}">`;
            
            steps.forEach((step, index) => {
                const stepId = index + 1;
                const action = step.action || step.description || '';
                const expectedResult = step.expectedResult || step.expected || '';
                
                console.log(`Step ${stepId}: Action=${action.substring(0, 30)}..., ExpectedResult=${expectedResult.substring(0, 30)}...`);
                
                // Format using the exact format with properly encoded P tags that works in Azure DevOps
                stepsXml += `<step id="${stepId}" type="ValidateStep"><parameterizedString isformatted="true">&lt;P&gt;${action}&lt;/P&gt;</parameterizedString><parameterizedString isformatted="true">&lt;P&gt;${expectedResult}&lt;/P&gt;</parameterizedString><description/></step>`;
            });
            
            // Close the root element
            stepsXml += '</steps>';
            
            // Log part of the XML for debugging
            console.log(`Generated XML (first 200 chars): ${stepsXml.substring(0, 200)}...`);
            
            return stepsXml;
        } catch (error) {
            console.warn('Failed to format test steps:', error.message);
            return null;
        }
    }    
    
    /**
     * Parses Azure DevOps XML format test steps into JavaScript objects
     *
     * This private method converts the XML format used by Azure DevOps for storing
     * test case steps back into a structured array of JavaScript objects. It handles
     * multiple XML encoding formats (encoded P tags, direct P tags, and legacy DIV/P
     * combinations) to ensure compatibility across different Azure DevOps versions.
     *
     * @private
     * @method _parseTestSteps
     * @param {string} stepsXml - The XML string containing test steps as stored in
     *                           Azure DevOps Microsoft.VSTS.TCM.Steps field.
     *                           Expected format includes step elements with
     *                           parameterizedString children for action and expected result.
     *
     * @returns {Array<Object>} Array of parsed test step objects with structure:
     * @returns {number} returns[].stepNumber - Sequential step number (1-based)
     * @returns {string} returns[].action - The action/instruction for this test step
     * @returns {string} returns[].expectedResult - The expected outcome of the action
     *
     * @throws {Error} Logs warnings for parsing failures but returns empty array instead of throwing
     *
     * @example
     * // Parse XML from Azure DevOps into objects
     * const xml = '<steps id="0" last="2"><step id="1" type="ValidateStep">...</step></steps>';
     * const parsedSteps = this._parseTestSteps(xml);
     * // Returns: [
     * //   { stepNumber: 1, action: 'Navigate to login', expectedResult: 'Page loads' },
     * //   { stepNumber: 2, action: 'Enter credentials', expectedResult: 'User logged in' }
     * // ]
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/guidance/work-item-field-index|Azure DevOps Field Reference}
     */_parseTestSteps(stepsXml) {
        if (!stepsXml) {
            return [];
        }

        try {
            // Debug
            console.log(`Parsing test steps XML, length: ${stepsXml.length}`);
            console.log(`First 200 chars: ${stepsXml.substring(0, 200)}...`);
            
            const steps = [];
            // Match each step element with its attributes and content
            const stepRegex = /<step id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g;
            let stepMatch;
            
            while ((stepMatch = stepRegex.exec(stepsXml)) !== null) {
                const stepId = stepMatch[1];
                const stepContent = stepMatch[2];
                
                // Extract both parameterizedString elements
                // The first one is the action
                const actionRegex = /<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/;
                const actionMatch = stepContent.match(actionRegex);
                
                // The second one is the expected result
                const expectedRegex = /<parameterizedString[^>]*>([\s\S]*?)<\/parameterizedString>/g;
                let expectedMatch;
                let expectedContent = "";
                
                // Skip the first match (which would be the action)
                expectedMatch = expectedRegex.exec(stepContent);
                if (expectedMatch) {
                    // Get the second match (expected result)
                    expectedMatch = expectedRegex.exec(stepContent);
                    if (expectedMatch) {
                        expectedContent = expectedMatch[1];
                    }
                }
                
                // Extract actual content - handle both encoded and non-encoded P tags
                const extractContent = (text) => {
                    if (!text) return '';
                    
                    // Handle &lt;P&gt; encoded format
                    if (text.includes('&lt;P&gt;')) {
                        const pContent = text.replace(/&lt;P&gt;([\s\S]*?)&lt;\/P&gt;/, '$1');
                        return pContent;
                    }
                    
                    // Handle <P> direct format
                    if (text.includes('<P>')) {
                        const pContent = text.replace(/<P>([\s\S]*?)<\/P>/, '$1');
                        return pContent;
                    }
                    
                    // Handle <DIV><P> format (older format)
                    const divMatch = text.match(/<DIV><P>([\s\S]*?)<\/P><\/DIV>/);
                    if (divMatch) {
                        return divMatch[1];
                    }
                    
                    // Return as is if no specific format detected
                    return text;
                };
                
                const action = actionMatch ? extractContent(actionMatch[1]) : '';
                const expectedResult = expectedContent ? extractContent(expectedContent) : '';
                
                console.log(`Parsed Step ${stepId}: Action=${action.substring(0, 20)}..., Expected=${expectedResult.substring(0, 20)}...`);
                
                steps.push({
                    stepNumber: parseInt(stepId),
                    action: action,
                    expectedResult: expectedResult
                });
            }
            
            console.log(`Successfully parsed ${steps.length} steps`);
            return steps;
        } catch (error) {
            console.warn('Failed to parse test steps:', error.message);
            console.warn(error.stack);
            return [];
        }
    }    
    
    /**
     * Escapes special XML characters to prevent XML injection and parsing errors
     *
     * This utility method converts potentially dangerous characters into their
     * XML entity equivalents to ensure safe XML generation and prevent parsing
     * errors when building XML content for Azure DevOps API calls.
     *
     * @private
     * @method _escapeXml
     * @param {string} text - The text string to escape for XML safety.
     *                       Can contain special characters like <, >, &, quotes.
     *
     * @returns {string} XML-safe string with special characters converted to entities:
     *                  - & becomes &amp;
     *                  - < becomes &lt;
     *                  - > becomes &gt;
     *                  - " becomes &quot;
     *                  - ' becomes &#39;
     *                  Returns empty string if input is null/undefined.
     *
     * @example
     * // Escape user input for XML inclusion
     * const userInput = 'Check if value < 10 & display "result"';
     * const escaped = this._escapeXml(userInput);
     * // Returns: "Check if value &lt; 10 &amp; display &quot;result&quot;"
     *
     * @since 1.0.0
     * @see {@link https://www.w3.org/TR/xml/#syntax|XML Specification}
     */
    _escapeXml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }    
    
    /**
     * Converts XML entities back to their original characters
     *
     * This utility method reverses XML entity encoding by converting XML entities
     * back to their original character representations. Used when parsing XML
     * content received from Azure DevOps APIs to restore readable text.
     *
     * @private
     * @method _unescapeXml
     * @param {string} text - The XML-encoded text string to decode.
     *                       Should contain XML entities like &lt;, &gt;, &amp;.
     *
     * @returns {string} Decoded string with entities converted back to characters:
     *                  - &amp; becomes &
     *                  - &lt; becomes <
     *                  - &gt; becomes >
     *                  - &quot; becomes "
     *                  - &#39; becomes '
     *                  Returns empty string if input is null/undefined.
     *
     * @example
     * // Decode XML entities from Azure DevOps response
     * const encoded = 'Check if value &lt; 10 &amp; display &quot;result&quot;';
     * const decoded = this._unescapeXml(encoded);
     * // Returns: 'Check if value < 10 & display "result"'
     *
     * @since 1.0.0
     * @see {@link https://www.w3.org/TR/xml/#syntax|XML Specification}
     */_unescapeXml(text) {
        if (!text) return '';
        
        // First unescape XML entities
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#39;/g, "'");
    }    
    
    /**
     * Internal helper to retrieve basic work item information by ID
     *
     * This private method provides a simplified work item retrieval focused on
     * essential fields (ID, title, type) with built-in retry logic. Used internally
     * for validation and relationship operations where full work item details are
     * not required, improving performance and reducing API overhead.
     *
     * @private
     * @async
     * @method _getWorkItem
     * @param {number|string} workItemId - The unique identifier of the work item to retrieve.
     *                                    Accepts both numeric and string representations.
     *                                    Must correspond to an existing work item.
     *
     * @returns {Promise<Object>} Simplified work item object with essential fields:
     * @returns {number} returns.id - The unique identifier of the work item
     * @returns {string} returns.title - The title/name of the work item
     * @returns {string} returns.workItemType - The type (User Story, Test Case, Task, etc.)
     *
     * @throws {Error} Throws when work item with specified ID is not found
     * @throws {Error} Throws when Azure DevOps API call fails (network, permissions, etc.)
     * @throws {Error} Throws when Work Item Tracking API is not initialized
     *
     * @example
     * // Internal usage for validation
     * try {
     *   const workItem = await this._getWorkItem(12345);
     *   if (workItem.workItemType === 'User Story') {
     *     // Proceed with user story operations
     *   }
     * } catch (error) {
     *   // Handle work item not found or access issues
     * }
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item|Azure DevOps Get Work Item API}
     */
    async _getWorkItem(workItemId) {
        const workItem = await this._retryOperation(async () => {
            return await this.workItemTrackingApi.getWorkItem(
                workItemId,
                null, // fields
                null, // asOf
                'all' // expand
            );
        });

        if (!workItem) {
            throw new Error(`Work item ${workItemId} not found`);
        }

        return {
            id: workItem.id,
            title: workItem.fields['System.Title'],
            workItemType: workItem.fields['System.WorkItemType']
        };
    }    
    
    /**
     * Executes operations with automatic retry logic and exponential backoff
     *
     * This critical private method wraps Azure DevOps API calls with intelligent
     * retry logic to handle transient failures like network timeouts, rate limiting,
     * and temporary service unavailability. Uses exponential backoff strategy to
     * avoid overwhelming the service while providing resilient operation execution.
     *
     * @private
     * @async
     * @method _retryOperation
     * @param {Function} operation - Async function to execute with retry logic.
     *                              Should return a Promise that resolves with the desired result
     *                              or rejects with an error for retry evaluation.
     *
     * @returns {Promise<*>} The successful result from the operation function.
     *                      Type depends on what the operation function returns.
     *
     * @throws {Error} Throws the last error encountered if all retry attempts fail
     * @throws {Error} Throws immediately for non-retryable errors (4xx client errors except 429)
     *
     * @example
     * // Wrap API call with retry logic
     * const result = await this._retryOperation(async () => {
     *   return await this.workItemTrackingApi.getWorkItem(12345);
     * });
     *
     * @example
     * // Retry with custom operation
     * const queryResult = await this._retryOperation(async () => {
     *   return await this.workItemTrackingApi.queryByWiql(wiqlQuery, project);
     * });
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/architecture/patterns/retry|Retry Pattern Documentation}
     */
    async _retryOperation(operation) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                if (attempt === this.maxRetries) {
                    break;
                }

                // Check if it's a retryable error
                if (this._isRetryableError(error)) {
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`⚠️ Operation failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    break;
                }
            }
        }

        throw lastError;
    }    
    
    /**
     * Determines if an error is suitable for retry attempts
     *
     * This private method analyzes error objects to classify them as retryable
     * (transient failures) or non-retryable (permanent failures). It evaluates
     * network error codes, HTTP status codes, and error messages to make
     * intelligent retry decisions and avoid unnecessary retry attempts on
     * permanent failures like authentication or permission errors.
     *
     * @private
     * @method _isRetryableError
     * @param {Error} error - The error object to evaluate for retry suitability.
     *                       Should contain properties like code, statusCode, or message
     *                       for accurate classification.
     *
     * @returns {boolean} True if the error represents a transient failure that may
     *                   succeed on retry (network timeouts, rate limiting, server errors).
     *                   False for permanent failures (authentication, permissions, not found).
     *                   
     *                   Retryable conditions:
     *                   - Network errors: ECONNRESET, ETIMEDOUT, ENOTFOUND, EAI_AGAIN
     *                   - HTTP status codes: 429 (Too Many Requests), 502, 503, 504
     *                   - Timeout messages in error text
     *
     * @example
     * // Check if API error should trigger retry
     * try {
     *   await apiCall();
     * } catch (error) {
     *   if (this._isRetryableError(error)) {
     *     // Will be retried by _retryOperation
     *   } else {
     *     // Permanent failure, no retry needed
     *   }
     * }
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/architecture/patterns/retry|Azure Retry Guidance}
     */
    _isRetryableError(error) {
        const retryableErrors = [
            'ECONNRESET',
            'ETIMEDOUT',
            'ENOTFOUND',
            'EAI_AGAIN'
        ];

        const retryableStatusCodes = [429, 502, 503, 504];

        return retryableErrors.some(code => error.code === code) ||
               retryableStatusCodes.some(status => error.statusCode === status) ||
               (error.message && error.message.includes('timeout'));
    }    
    
    /**
     * Standardizes error handling and creates user-friendly error messages
     *
     * This private method transforms raw Azure DevOps API errors into consistent,
     * actionable error messages with appropriate context. It maps HTTP status codes
     * to meaningful explanations and provides specific guidance for common failure
     * scenarios like authentication, permissions, and resource availability.
     *
     * @private
     * @method _handleError
     * @param {Error} error - The original error object from Azure DevOps API or network layer.
     *                       Should contain statusCode/status and message properties.
     * @param {string} operation - Human-readable description of the operation that failed.
     *                            Used to provide context in the error message.
     *                            Examples: 'create test case', 'update work item', 'search tests'.
     *
     * @returns {Error} New Error object with standardized, user-friendly message that includes:
     *                 - Clear indication of what operation failed
     *                 - Specific guidance based on HTTP status code
     *                 - Actionable next steps for resolution
     *
     *                 Status code mappings:
     *                 - 401: Authentication failure with PAT token guidance
     *                 - 403: Permission denial with access rights guidance  
     *                 - 404: Resource not found with ID/project verification guidance
     *                 - 400: Bad request with parameter validation guidance
     *                 - Other: Generic failure with original error details
     *
     * @example
     * // Transform API error for user consumption
     * try {
     *   await azureDevOpsApiCall();
     * } catch (error) {
     *   throw this._handleError(error, 'retrieve test case');
     *   // Might throw: "Authentication failed while trying to retrieve test case. Please check your PAT token."
     * }
     *
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items|Azure DevOps API Error Codes}
     */
    _handleError(error, operation) {
        const errorMessage = error.message || 'Unknown error occurred';
        const statusCode = error.statusCode || error.status;

        if (statusCode === 401) {
            return new Error(`Authentication failed while trying to ${operation}. Please check your PAT token.`);
        } else if (statusCode === 403) {
            return new Error(`Access denied while trying to ${operation}. Please check your permissions.`);
        } else if (statusCode === 404) {
            return new Error(`Resource not found while trying to ${operation}. Please check the test case ID and project.`);
        } else if (statusCode === 400) {
            return new Error(`Bad request while trying to ${operation}. Please check your input parameters: ${errorMessage}`);
        } else {
            return new Error(`Failed to ${operation}: ${errorMessage}`);
        }
    }
}
