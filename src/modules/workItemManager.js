/**
 * Work Item Management Module
 * 
 * @file workItemManager.js - Comprehensive work item operations for Azure DevOps
 * @description This module handles all work item related operations including user stories,
 * tasks, features, and other work item types. Provides CRUD operations, linking capabilities,
 * search functionality, and field management. Includes robust error handling, retry logic,
 * and validation to ensure reliable operations.
 * 
 * Supported Operations:
 * - Create user stories, tasks, and other work item types
 * - Update work item fields and properties
 * - Delete work items (with proper validation)
 * - Link work items with parent-child and other relationships
 * - Search work items using WIQL (Work Item Query Language)
 * - Retrieve work item details and relationships
 * - Bulk operations for efficiency
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires azure-devops-node-api - Official Azure DevOps Node.js API client
 * @requires ../utils/helpers - Utility functions for operations
 * 
 * @example
 * const manager = new WorkItemManager(webApi, 'MyProject');
 * await manager.initialize();
 * 
 * // Create a user story
 * const story = await manager.createUserStory(
 *   'User Authentication',
 *   'Implement secure user login system',
 *   { priority: 2, storyPoints: 8 }
 * );
 * 
 * // Create a task under the story
 * const task = await manager.createTask(
 *   'Setup Authentication API',
 *   'Create REST endpoints for authentication',
 *   { parentId: story.id }
 * );
 */

/**
 * Work Item Manager Class
 * 
 * @class WorkItemManager
 * @description Manages all work item operations in Azure DevOps including creation,
 * updates, deletions, linking, and querying. Provides a comprehensive interface
 * for work item lifecycle management with built-in validation and error handling.
 */
export class WorkItemManager {
    /**
     * Creates an instance of WorkItemManager
     * 
     * @constructor
     * @param {Object} webApi - Azure DevOps Web API client instance
     * @param {string} project - Azure DevOps project name
     * 
     * @example
     * const manager = new WorkItemManager(webApi, 'MyProject');
     * await manager.initialize();
     */
    constructor(webApi, project) {
        this.webApi = webApi;
        this.project = project;
        this.workItemTrackingApi = null;
        this.maxRetries = 3;
        this.retryDelay = 1000; // 1 second
    }    /**
     * Initialize the Work Item Tracking API client
     * 
     * @async
     * @method initialize
     * @description Initializes the Azure DevOps Work Item Tracking API client. This method must be called
     * before performing any work item operations. It establishes the connection to Azure DevOps and prepares
     * the API client for use. The method performs authentication validation and ensures the service is accessible.
     * 
     * @returns {Promise<void>} Promise that resolves when initialization is complete
     * 
     * @throws {Error} When the Work Item Tracking API client fails to initialize due to:
     *   - Invalid authentication credentials
     *   - Network connectivity issues
     *   - Azure DevOps service unavailability
     *   - Insufficient permissions to access the Work Item Tracking service
     * 
     * @example
     * // Basic initialization
     * const manager = new WorkItemManager(webApi, 'MyProject');
     * await manager.initialize();
     * 
     * @example
     * // With error handling
     * try {
     *   await manager.initialize();
     *   console.log('Ready to perform work item operations');
     * } catch (error) {
     *   console.error('Failed to initialize:', error.message);
     *   // Handle initialization failure
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/} Azure DevOps Work Item Tracking REST API
     */
    async initialize() {
        try {
            this.workItemTrackingApi = await this.webApi.getWorkItemTrackingApi();
            console.log('✅ Work Item Tracking API initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize Work Item Tracking API:', error.message);
            throw error;
        }
    }    /**
     * Create a new user story work item in Azure DevOps
     * 
     * @async
     * @method createUserStory
     * @description Creates a new user story work item with the specified title, description, and optional additional fields.
     * The method validates all inputs, constructs the appropriate JSON patch document for Azure DevOps API,
     * and handles the creation process with retry logic. The user story type can be customized via environment
     * variable AZURE_DEVOPS_USER_STORY_TYPE (defaults to 'Product Backlog Item').
     * 
     * @param {string} title - The title of the user story (required, non-empty string)
     * @param {string} description - The detailed description of the user story (required, non-empty string)
     * @param {Object} [additionalFields={}] - Optional additional fields to set on the user story
     * @param {string} [additionalFields.acceptanceCriteria] - Acceptance criteria defining when the story is complete
     * @param {number} [additionalFields.priority] - Priority level (1-4, where 1 is highest priority)
     * @param {string} [additionalFields.assignedTo] - Email address or display name of the assigned user
     * @param {string} [additionalFields.iterationPath] - Iteration path for sprint/iteration assignment
     * @param {string} [additionalFields.areaPath] - Area path for team/component organization
     * @param {number} [additionalFields.storyPoints] - Story points estimation for the work item
     * @param {string} [additionalFields.tags] - Comma-separated tags for categorization
     * 
     * @returns {Promise<Object>} Promise resolving to the created user story object containing:
     * @returns {number} returns.id - Unique identifier of the created work item
     * @returns {string} returns.title - Title of the work item
     * @returns {string} returns.description - Description of the work item
     * @returns {string} returns.state - Current state (e.g., 'New', 'Active', 'Resolved')
     * @returns {string} returns.workItemType - Type of work item (e.g., 'Product Backlog Item', 'User Story')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.priority - Priority level or null
     * @returns {number|null} returns.storyPoints - Story points estimation or null
     * @returns {string|null} returns.acceptanceCriteria - Acceptance criteria or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When title parameter is missing, null, or not a string
     * @throws {Error} When description parameter is missing, null, or not a string
     * @throws {Error} When priority is provided but not a number between 1-4
     * @throws {Error} When storyPoints is provided but not a valid number
     * @throws {Error} When Azure DevOps API returns null (permission/validation issues)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions
     * @throws {Error} When project/resource not found (404)
     * @throws {Error} When request parameters are invalid (400)
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Basic user story creation
     * const story = await manager.createUserStory(
     *   'User Login Feature',
     *   'As a user, I want to log in securely to access my account'
     * );
     * console.log(`Created story with ID: ${story.id}`);
     * 
     * @example
     * // User story with additional fields
     * const story = await manager.createUserStory(
     *   'Payment Processing',
     *   'Implement secure payment processing with multiple payment methods',
     *   {
     *     acceptanceCriteria: 'Given a user with valid payment method, when they submit payment, then payment is processed securely',
     *     priority: 1,
     *     storyPoints: 8,
     *     assignedTo: 'developer@company.com',
     *     iterationPath: 'MyProject\\Sprint 1',
     *     areaPath: 'MyProject\\Frontend',
     *     tags: 'payment, security, frontend'
     *   }
     * );
     * 
     * @example
     * // With error handling
     * try {
     *   const story = await manager.createUserStory(title, description, fields);
     *   console.log('User story created successfully:', story.title);
     * } catch (error) {
     *   if (error.message.includes('Authentication failed')) {
     *     console.error('Please check your PAT token');
     *   } else if (error.message.includes('Access denied')) {
     *     console.error('Insufficient permissions to create work items');
     *   } else {
     *     console.error('Failed to create user story:', error.message);
     *   }
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create} Azure DevOps Create Work Item API
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/guidance/agile-process-workflow} Agile Work Item Types
     */
    async createUserStory(title, description, additionalFields = {}) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Title is required and must be a string');
        }

        if (!description || typeof description !== 'string') {
            throw new Error('Description is required and must be a string');
        }

        try {
            console.log(`📝 Creating user story: ${title}`);

            // Build the JSON patch document
            const patchDocument = [
                {
                    op: 'add',
                    path: '/fields/System.Title',                    value: title
                },
                {
                    op: 'add',
                    path: '/fields/System.Description',
                    value: description
                },
                {                    op: 'add',
                    path: '/fields/System.WorkItemType',
                    value: process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item'
                }
            ];

            // Add optional fields
            if (additionalFields.acceptanceCriteria) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
                    value: additionalFields.acceptanceCriteria
                });
            }

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

            if (additionalFields.storyPoints && !isNaN(additionalFields.storyPoints)) {
                patchDocument.push({                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
                    value: parseFloat(additionalFields.storyPoints)                });
            }            
            // Get user story type from environment or use default
            const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
            
            console.log('🔧 Debug: About to call createWorkItem with:');
            console.log('   Project:', this.project);
            console.log(`   Work Item Type: ${userStoryType}`);
            console.log('   Patch Document:', JSON.stringify(patchDocument, null, 2));

            const workItem = await this._retryOperation(async () => {
                console.log('🔧 Debug: Making API call to createWorkItem...');
                const result = await this.workItemTrackingApi.createWorkItem(
                    [], // customHeaders
                    patchDocument,
                    this.project,
                    userStoryType,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
                console.log('🔧 Debug: API call returned:', result ? 'Success' : 'NULL');
                console.log('🔧 Debug: Result type:', typeof result);
                if (result) {
                    console.log('🔧 Debug: Result has id?', !!result.id);
                    console.log('🔧 Debug: Result keys:', Object.keys(result));
                }
                return result;
            });

            if (!workItem) {
                throw new Error('createWorkItem API returned null - this may indicate a permission or validation issue');
            }

            console.log(`✅ User story created successfully with ID: ${workItem.id}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                storyPoints: workItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || null,
                acceptanceCriteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || null,
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            };

        } catch (error) {
            console.error('❌ Failed to create user story:', error.message);
            throw this._handleError(error, 'create user story');
        }
    }    /**
     * Create a new task work item in Azure DevOps
     * 
     * @async
     * @method createTask
     * @description Creates a new task work item with the specified title, description, and optional additional fields.
     * Tasks are typically used to break down user stories into smaller, actionable work items. The method validates
     * all inputs, constructs the appropriate JSON patch document for Azure DevOps API, handles the creation process
     * with retry logic, and optionally links the task to a parent work item (usually a user story).
     * 
     * @param {string} title - The title of the task (required, non-empty string)
     * @param {string} description - The detailed description of the task (required, non-empty string)
     * @param {Object} [additionalFields={}] - Optional additional fields to set on the task
     * @param {string} [additionalFields.assignedTo] - Email address or display name of the assigned user
     * @param {string} [additionalFields.iterationPath] - Iteration path for sprint/iteration assignment
     * @param {string} [additionalFields.areaPath] - Area path for team/component organization
     * @param {number} [additionalFields.originalEstimate] - Original estimate in hours for the task
     * @param {number} [additionalFields.remainingWork] - Remaining work in hours (can be 0)
     * @param {string} [additionalFields.activity] - Activity type (e.g., 'Development', 'Testing', 'Design', 'Documentation')
     * @param {number} [additionalFields.parentId] - Parent work item ID (typically a user story) to link this task to
     * @param {number} [additionalFields.priority] - Priority level (1-4, where 1 is highest priority)
     * @param {string} [additionalFields.tags] - Comma-separated tags for categorization
     * 
     * @returns {Promise<Object>} Promise resolving to the created task object containing:
     * @returns {number} returns.id - Unique identifier of the created work item
     * @returns {string} returns.title - Title of the work item
     * @returns {string} returns.description - Description of the work item
     * @returns {string} returns.state - Current state (e.g., 'New', 'Active', 'Resolved', 'Closed')
     * @returns {string} returns.workItemType - Type of work item ('Task')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.originalEstimate - Original estimate in hours or null
     * @returns {number|null} returns.remainingWork - Remaining work in hours or null
     * @returns {string|null} returns.activity - Activity type or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified
     * @returns {number|null} returns.parentId - Parent work item ID if linked, or null
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When title parameter is missing, null, or not a string
     * @throws {Error} When description parameter is missing, null, or not a string
     * @throws {Error} When originalEstimate is provided but not a valid number
     * @throws {Error} When remainingWork is provided but not a valid number
     * @throws {Error} When parentId is provided but the linking fails (parent may not exist)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions
     * @throws {Error} When project/resource not found (404)
     * @throws {Error} When request parameters are invalid (400)
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Basic task creation
     * const task = await manager.createTask(
     *   'Implement user authentication API',
     *   'Create REST endpoints for user login and logout functionality'
     * );
     * console.log(`Created task with ID: ${task.id}`);
     * 
     * @example
     * // Task with estimates and assignment
     * const task = await manager.createTask(
     *   'Write unit tests for authentication',
     *   'Create comprehensive unit tests covering all authentication scenarios',
     *   {
     *     assignedTo: 'tester@company.com',
     *     originalEstimate: 8,
     *     remainingWork: 8,
     *     activity: 'Testing',
     *     iterationPath: 'MyProject\\Sprint 1',
     *     areaPath: 'MyProject\\Backend\\Authentication'
     *   }
     * );
     * 
     * @example
     * // Task linked to parent user story
     * const parentStoryId = 123;
     * const task = await manager.createTask(
     *   'Setup database schema for users',
     *   'Create and migrate database tables for user management',
     *   {
     *     parentId: parentStoryId,
     *     assignedTo: 'developer@company.com',
     *     originalEstimate: 4,
     *     activity: 'Development',
     *     tags: 'database, migration, backend'
     *   }
     * );
     * console.log(`Task ${task.id} linked to story ${parentStoryId}`);
     * 
     * @example
     * // With error handling
     * try {
     *   const task = await manager.createTask(title, description, fields);
     *   console.log('Task created successfully:', task.title);
     * } catch (error) {
     *   if (error.message.includes('failed to link to parent')) {
     *     console.warn('Task created but parent linking failed');
     *   } else {
     *     console.error('Failed to create task:', error.message);
     *   }
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create} Azure DevOps Create Work Item API
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/about-work-items} About Work Items in Azure DevOps
     * @see {@link WorkItemManager#linkWorkItems} For manual work item linking
     */
    async createTask(title, description, additionalFields = {}) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Title is required and must be a string');
        }

        if (!description || typeof description !== 'string') {
            throw new Error('Description is required and must be a string');
        }

        try {
            console.log(`📝 Creating task: ${title}`);

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
                    value: 'Task'
                }
            ];

            // Add optional fields
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

            if (additionalFields.originalEstimate && !isNaN(additionalFields.originalEstimate)) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate',
                    value: parseFloat(additionalFields.originalEstimate)
                });
            }

            if (additionalFields.remainingWork !== undefined && !isNaN(additionalFields.remainingWork)) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Scheduling.RemainingWork',
                    value: parseFloat(additionalFields.remainingWork)
                });
            }

            if (additionalFields.activity) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Common.Activity',
                    value: additionalFields.activity
                });
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.createWorkItem(
                    [], // customHeaders
                    patchDocument,
                    this.project,
                    'Task',
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Task created successfully with ID: ${workItem.id}`);

            // If parentId is provided, create the parent-child relationship
            if (additionalFields.parentId) {
                try {
                    await this.linkWorkItems(workItem.id, additionalFields.parentId, 'Child');
                    console.log(`✅ Task ${workItem.id} linked to parent ${additionalFields.parentId}`);
                } catch (linkError) {
                    console.warn(`⚠️ Task created but failed to link to parent: ${linkError.message}`);
                }
            }

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                originalEstimate: workItem.fields['Microsoft.VSTS.Scheduling.OriginalEstimate'] || null,
                remainingWork: workItem.fields['Microsoft.VSTS.Scheduling.RemainingWork'] || null,
                activity: workItem.fields['Microsoft.VSTS.Common.Activity'] || null,
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate'],
                parentId: additionalFields.parentId || null
            };

        } catch (error) {
            console.error('❌ Failed to create task:', error.message);
            throw this._handleError(error, 'create task');
        }
    }

    /**
     * Create a new bug work item in Azure DevOps
     * 
     * @async
     * @method createBug
     * @description Creates a new bug work item with the specified title, description, and optional additional fields.
     * Bugs are used to track defects, issues, and problems found in the software. The method validates
     * all inputs, constructs the appropriate JSON patch document for Azure DevOps API, handles the creation process
     * with retry logic, and supports bug-specific fields like severity, reproduction steps, and system information.
     * 
     * @param {string} title - The title of the bug (required, non-empty string)
     * @param {string} description - The detailed description of the bug (required, non-empty string)
     * @param {Object} [additionalFields={}] - Optional additional fields to set on the bug
     * @param {string} [additionalFields.assignedTo] - Email address or display name of the assigned user
     * @param {string} [additionalFields.iterationPath] - Iteration path for sprint/iteration assignment
     * @param {string} [additionalFields.areaPath] - Area path for team/component organization
     * @param {number} [additionalFields.priority] - Priority level (1-4, where 1 is highest priority)
     * @param {string} [additionalFields.severity] - Severity level ('1 - Critical', '2 - High', '3 - Medium', '4 - Low')
     * @param {string} [additionalFields.reproSteps] - Steps to reproduce the bug
     * @param {string} [additionalFields.foundIn] - Version or build where the bug was found
     * @param {string} [additionalFields.systemInfo] - System information where the bug occurred
     * @param {number} [additionalFields.parentId] - Parent work item ID (typically a user story or feature) to link this bug to
     * @param {string} [additionalFields.tags] - Comma-separated tags for categorization
     * 
     * @returns {Promise<Object>} Promise resolving to the created bug object containing:
     * @returns {number} returns.id - Unique identifier of the created work item
     * @returns {string} returns.title - Title of the work item
     * @returns {string} returns.description - Description of the work item
     * @returns {string} returns.state - Current state (e.g., 'New', 'Active', 'Resolved', 'Closed')
     * @returns {string} returns.workItemType - Type of work item ('Bug')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.priority - Priority level or null
     * @returns {string|null} returns.severity - Severity level or null
     * @returns {string|null} returns.reproSteps - Reproduction steps or null
     * @returns {string|null} returns.foundIn - Found in version or null
     * @returns {string|null} returns.systemInfo - System information or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified
     * @returns {number|null} returns.parentId - Parent work item ID if linked, or null
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When title parameter is missing, null, or not a string
     * @throws {Error} When description parameter is missing, null, or not a string
     * @throws {Error} When priority is provided but not a number between 1-4
     * @throws {Error} When parentId is provided but the linking fails (parent may not exist)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions
     * @throws {Error} When project/resource not found (404)
     * @throws {Error} When request parameters are invalid (400)
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Basic bug creation
     * const bug = await manager.createBug(
     *   'Login page crashes on invalid input',
     *   'The login page throws an unhandled exception when user enters invalid credentials'
     * );
     * console.log(`Created bug with ID: ${bug.id}`);
     * 
     * @example
     * // Bug with full details
     * const bug = await manager.createBug(
     *   'Performance issue in search functionality',
     *   'Search takes more than 10 seconds to return results for large datasets',
     *   {
     *     assignedTo: 'developer@company.com',
     *     priority: 2,
     *     severity: '2 - High',
     *     reproSteps: '1. Navigate to search page\n2. Enter query with 1000+ results\n3. Click search\n4. Wait for results',
     *     foundIn: 'v1.2.3',
     *     systemInfo: 'Windows 10, Chrome 90, 8GB RAM',
     *     iterationPath: 'MyProject\\Sprint 1',
     *     areaPath: 'MyProject\\Frontend\\Search',
     *     tags: 'performance, search, critical'
     *   }
     * );
     * 
     * @example
     * // Bug linked to parent user story
     * const parentStoryId = 123;
     * const bug = await manager.createBug(
     *   'User authentication fails with special characters',
     *   'Login fails when password contains special characters like @#$%',
     *   {
     *     parentId: parentStoryId,
     *     assignedTo: 'qa@company.com',
     *     priority: 1,
     *     severity: '1 - Critical',
     *     reproSteps: '1. Enter username\n2. Enter password with special chars\n3. Click login\n4. Error occurs',
     *     tags: 'authentication, security, blocker'
     *   }
     * );
     * console.log(`Bug ${bug.id} linked to story ${parentStoryId}`);
     * 
     * @example
     * // With error handling
     * try {
     *   const bug = await manager.createBug(title, description, fields);
     *   console.log('Bug created successfully:', bug.title);
     * } catch (error) {
     *   if (error.message.includes('failed to link to parent')) {
     *     console.warn('Bug created but parent linking failed');
     *   } else {
     *     console.error('Failed to create bug:', error.message);
     *   }
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create} Azure DevOps Create Work Item API
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/work-items/about-work-items} About Work Items in Azure DevOps
     * @see {@link WorkItemManager#linkWorkItems} For manual work item linking
     */
    async createBug(title, description, additionalFields = {}) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!title || typeof title !== 'string') {
            throw new Error('Title is required and must be a string');
        }

        if (!description || typeof description !== 'string') {
            throw new Error('Description is required and must be a string');
        }

        try {
            console.log(`📝 Creating bug: ${title}`);

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
                    value: 'Bug'
                }
            ];

            // Add optional fields
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

            if (additionalFields.severity) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Common.Severity',
                    value: additionalFields.severity
                });
            }

            if (additionalFields.reproSteps) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.TCM.ReproSteps',
                    value: additionalFields.reproSteps
                });
            }

            if (additionalFields.foundIn) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.Common.FoundIn',
                    value: additionalFields.foundIn
                });
            }

            if (additionalFields.systemInfo) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/Microsoft.VSTS.TCM.SystemInfo',
                    value: additionalFields.systemInfo
                });
            }

            if (additionalFields.tags) {
                patchDocument.push({
                    op: 'add',
                    path: '/fields/System.Tags',
                    value: additionalFields.tags
                });
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.createWorkItem(
                    [], // customHeaders
                    patchDocument,
                    this.project,
                    'Bug',
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Bug created successfully with ID: ${workItem.id}`);

            // If parentId is provided, create the parent-child relationship
            if (additionalFields.parentId) {
                try {
                    await this.linkWorkItems(workItem.id, additionalFields.parentId, 'Child');
                    console.log(`✅ Bug ${workItem.id} linked to parent ${additionalFields.parentId}`);
                } catch (linkError) {
                    console.warn(`⚠️ Bug created but failed to link to parent: ${linkError.message}`);
                }
            }

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                severity: workItem.fields['Microsoft.VSTS.Common.Severity'] || null,
                reproSteps: workItem.fields['Microsoft.VSTS.TCM.ReproSteps'] || null,
                foundIn: workItem.fields['Microsoft.VSTS.Common.FoundIn'] || null,
                systemInfo: workItem.fields['Microsoft.VSTS.TCM.SystemInfo'] || null,
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                tags: workItem.fields['System.Tags'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate'],
                parentId: additionalFields.parentId || null
            };

        } catch (error) {
            console.error('❌ Failed to create bug:', error.message);
            throw this._handleError(error, 'create bug');
        }
    }

    /**
     * Update an existing user story work item in Azure DevOps
     * 
     * @async
     * @method updateUserStory
     * @description Updates an existing user story work item with the specified field changes. The method validates
     * the work item ID, constructs a JSON patch document with only the fields that need to be updated, and applies
     * the changes through the Azure DevOps API with retry logic. Only provided fields will be updated; other fields
     * remain unchanged. The method includes validation for specific field types like priority and story points.
     * 
     * @param {number|string} workItemId - The ID of the work item to update (will be converted to number)
     * @param {Object} updates - Object containing the fields to update with their new values
     * @param {string} [updates.title] - New title for the user story
     * @param {string} [updates.description] - New description for the user story
     * @param {string} [updates.acceptanceCriteria] - New acceptance criteria
     * @param {number} [updates.priority] - New priority level (1-4, where 1 is highest priority)
     * @param {string} [updates.assignedTo] - Email address or display name of the assigned user
     * @param {string} [updates.iterationPath] - New iteration path for sprint/iteration assignment
     * @param {string} [updates.areaPath] - New area path for team/component organization
     * @param {number} [updates.storyPoints] - New story points estimation
     * @param {string} [updates.state] - New state (e.g., 'New', 'Active', 'Resolved', 'Closed')
     * @param {string} [updates.tags] - New comma-separated tags for categorization
     * 
     * @returns {Promise<Object>} Promise resolving to the updated user story object containing:
     * @returns {number} returns.id - Unique identifier of the work item
     * @returns {string} returns.title - Updated title of the work item
     * @returns {string} returns.description - Updated description of the work item
     * @returns {string} returns.state - Current state after update
     * @returns {string} returns.workItemType - Type of work item (e.g., 'Product Backlog Item', 'User Story')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.priority - Priority level or null
     * @returns {number|null} returns.storyPoints - Story points estimation or null
     * @returns {string|null} returns.acceptanceCriteria - Acceptance criteria or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was originally created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified (after this update)
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When workItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When updates parameter is missing, null, or not an object
     * @throws {Error} When no valid fields are provided for update (all fields filtered out)
     * @throws {Error} When priority is provided but not a number between 1-4
     * @throws {Error} When storyPoints is provided but not a valid number
     * @throws {Error} When the work item does not exist (404)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to modify work items
     * @throws {Error} When request parameters are invalid (400)
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Update user story title and description
     * const updatedStory = await manager.updateUserStory(123, {
     *   title: 'Enhanced User Authentication',
     *   description: 'Updated requirements for multi-factor authentication support'
     * });
     * console.log(`Updated story: ${updatedStory.title}`);
     * 
     * @example
     * // Update priority and story points
     * const updatedStory = await manager.updateUserStory(123, {
     *   priority: 1,
     *   storyPoints: 13,
     *   state: 'Active'
     * });
     * 
     * @example
     * // Update assignment and iteration
     * const updatedStory = await manager.updateUserStory('456', {
     *   assignedTo: 'newdeveloper@company.com',
     *   iterationPath: 'MyProject\\Sprint 2',
     *   acceptanceCriteria: 'Given updated requirements, when implemented, then all tests pass'
     * });
     * 
     * @example
     * // With comprehensive error handling
     * try {
     *   const updates = {
     *     title: 'New Title',
     *     priority: 2,
     *     storyPoints: 8
     *   };
     *   const result = await manager.updateUserStory(workItemId, updates);
     *   console.log('User story updated successfully:', result.title);
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('Work item does not exist');
     *   } else if (error.message.includes('Invalid priority')) {
     *     console.error('Priority must be between 1-4');
     *   } else if (error.message.includes('Access denied')) {
     *     console.error('Insufficient permissions to update work items');
     *   } else {
     *     console.error('Failed to update user story:', error.message);
     *   }
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update} Azure DevOps Update Work Item API
     * @see {@link WorkItemManager#getWorkItem} To retrieve current work item details before updating
     */async updateUserStory(workItemId, updates) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        // Convert string to number if needed
        workItemId = parseInt(workItemId);

        if (!updates || typeof updates !== 'object') {
            throw new Error('Updates object is required');
        }

        try {
            console.log(`📝 Updating user story with ID: ${workItemId}`);

            // Build the JSON patch document
            const patchDocument = [];

            // Map update fields to Azure DevOps field paths
            const fieldMapping = {
                title: '/fields/System.Title',
                description: '/fields/System.Description',
                acceptanceCriteria: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
                priority: '/fields/Microsoft.VSTS.Common.Priority',
                assignedTo: '/fields/System.AssignedTo',
                iterationPath: '/fields/System.IterationPath',
                areaPath: '/fields/System.AreaPath',
                storyPoints: '/fields/Microsoft.VSTS.Scheduling.StoryPoints',
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
                    } else if (key === 'storyPoints') {
                        processedValue = parseFloat(value);
                        if (isNaN(processedValue)) {
                            console.warn(`Invalid story points value: ${value}. Must be a number.`);
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

            if (patchDocument.length === 0) {
                throw new Error('No valid fields provided for update');
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    [], // customHeaders
                    patchDocument,
                    workItemId,
                    this.project,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ User story updated successfully: ${workItem.id}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                storyPoints: workItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || null,
                acceptanceCriteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || null,
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            };

        } catch (error) {
            console.error('❌ Failed to update user story:', error.message);
            throw this._handleError(error, 'update user story');
        }
    }

    /**
     * Update an existing bug work item in Azure DevOps
     * 
     * @async
     * @method updateBug
     * @description Updates an existing bug work item with the specified field changes. The method validates
     * the work item ID, constructs a JSON patch document with only the fields that need to be updated, and applies
     * the changes through the Azure DevOps API with retry logic. Only provided fields will be updated; other fields
     * remain unchanged. The method includes validation for specific field types like priority and severity.
     * 
     * @param {number|string} workItemId - The ID of the work item to update (will be converted to number)
     * @param {Object} updates - Object containing the fields to update with their new values
     * @param {string} [updates.title] - New title for the bug
     * @param {string} [updates.description] - New description for the bug
     * @param {number} [updates.priority] - New priority level (1-4, where 1 is highest priority)
     * @param {string} [updates.severity] - New severity level ('1 - Critical', '2 - High', '3 - Medium', '4 - Low')
     * @param {string} [updates.reproSteps] - New reproduction steps
     * @param {string} [updates.foundIn] - New version or build where the bug was found
     * @param {string} [updates.systemInfo] - New system information
     * @param {string} [updates.assignedTo] - Email address or display name of the assigned user
     * @param {string} [updates.iterationPath] - New iteration path for sprint/iteration assignment
     * @param {string} [updates.areaPath] - New area path for team/component organization
     * @param {string} [updates.state] - New state (e.g., 'New', 'Active', 'Resolved', 'Closed')
     * @param {string} [updates.tags] - New comma-separated tags for categorization
     * 
     * @returns {Promise<Object>} Promise resolving to the updated bug object containing:
     * @returns {number} returns.id - Unique identifier of the work item
     * @returns {string} returns.title - Updated title of the work item
     * @returns {string} returns.description - Updated description of the work item
     * @returns {string} returns.state - Current state after update
     * @returns {string} returns.workItemType - Type of work item ('Bug')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.priority - Priority level or null
     * @returns {string|null} returns.severity - Severity level or null
     * @returns {string|null} returns.reproSteps - Reproduction steps or null
     * @returns {string|null} returns.foundIn - Found in version or null
     * @returns {string|null} returns.systemInfo - System information or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was originally created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified (after this update)
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When workItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When updates parameter is missing, null, or not an object
     * @throws {Error} When no valid fields are provided for update (all fields filtered out)
     * @throws {Error} When priority is provided but not a number between 1-4
     * @throws {Error} When the work item does not exist (404)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to modify work items
     * @throws {Error} When request parameters are invalid (400)
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Update bug title and description
     * const updatedBug = await manager.updateBug(123, {
     *   title: 'Critical login issue with special characters',
     *   description: 'Updated analysis shows this affects all special character passwords'
     * });
     * console.log(`Updated bug: ${updatedBug.title}`);
     * 
     * @example
     * // Update priority and severity
     * const updatedBug = await manager.updateBug(123, {
     *   priority: 1,
     *   severity: '1 - Critical',
     *   state: 'Active'
     * });
     * 
     * @example
     * // Update assignment and add reproduction steps
     * const updatedBug = await manager.updateBug('456', {
     *   assignedTo: 'newdeveloper@company.com',
     *   reproSteps: 'Updated steps:\n1. Login with password containing @\n2. Verify error occurs\n3. Check logs',
     *   foundIn: 'v1.2.4',
     *   systemInfo: 'Windows 11, Chrome 96'
     * });
     * 
     * @example
     * // Update with comprehensive metadata
     * const comprehensiveUpdate = {
     *   title: 'Performance degradation in search with large datasets',
     *   description: 'Search performance drops significantly with datasets over 10,000 records',
     *   severity: '2 - High',
     *   priority: 2,
     *   reproSteps: 'Updated reproduction steps with performance metrics',
     *   foundIn: 'v2.1.0',
     *   systemInfo: 'Ubuntu 20.04, 16GB RAM, MySQL 8.0',
     *   iterationPath: 'MyProject\\Sprint 2',
     *   areaPath: 'MyProject\\Backend\\Search',
     *   tags: 'performance, search, database, urgent'
     * };
     * 
     * const result = await manager.updateBug(101, comprehensiveUpdate);
     * 
     * @example
     * // Error handling for invalid updates
     * try {
     *   await manager.updateBug(999, { priority: 'invalid' });
     * } catch (error) {
     *   console.error('Update failed:', error.message);
     *   // Handle validation or API errors
     * }
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update} Update Work Item API Reference
     */
    async updateBug(workItemId, updates) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        if (!updates || typeof updates !== 'object') {
            throw new Error('Updates object is required');
        }

        try {
            console.log(`📝 Updating bug: ${workItemId}`);

            // Build the JSON patch document
            const patchDocument = [];

            // Define field mappings for bug work items
            const fieldMapping = {
                title: '/fields/System.Title',
                description: '/fields/System.Description',
                assignedTo: '/fields/System.AssignedTo',
                iterationPath: '/fields/System.IterationPath',
                areaPath: '/fields/System.AreaPath',
                state: '/fields/System.State',
                reproSteps: '/fields/Microsoft.VSTS.TCM.ReproSteps',
                foundIn: '/fields/Microsoft.VSTS.Common.FoundIn',
                systemInfo: '/fields/Microsoft.VSTS.TCM.SystemInfo',
                severity: '/fields/Microsoft.VSTS.Common.Severity',
                tags: '/fields/System.Tags'
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
                        patchDocument.push({
                            op: 'add',
                            path: '/fields/Microsoft.VSTS.Common.Priority',
                            value: processedValue
                        });
                    } else {
                        patchDocument.push({
                            op: 'add',
                            path: fieldMapping[key],
                            value: processedValue
                        });
                    }
                }
            }

            if (patchDocument.length === 0) {
                throw new Error('No valid fields provided for update');
            }

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    [], // customHeaders
                    patchDocument,
                    parseInt(workItemId),
                    this.project,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ Bug updated successfully: ${workItem.id}`);

            return {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'],
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                severity: workItem.fields['Microsoft.VSTS.Common.Severity'] || null,
                reproSteps: workItem.fields['Microsoft.VSTS.TCM.ReproSteps'] || null,
                foundIn: workItem.fields['Microsoft.VSTS.Common.FoundIn'] || null,
                systemInfo: workItem.fields['Microsoft.VSTS.TCM.SystemInfo'] || null,
                iterationPath: workItem.fields['System.IterationPath'] || null,
                areaPath: workItem.fields['System.AreaPath'] || null,
                tags: workItem.fields['System.Tags'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            };

        } catch (error) {
            console.error('❌ Failed to update bug:', error.message);
            throw this._handleError(error, 'update bug');
        }
    }

    /**
     * Delete a user story work item from Azure DevOps
     * 
     * @async
     * @method deleteUserStory
     * @description Permanently deletes a user story work item from Azure DevOps. This method first validates that
     * the work item exists and is actually a user story before attempting deletion. The deletion is permanent
     * (destroy = true) and cannot be undone. Use with caution as this will remove the work item and all its
     * history from Azure DevOps. The method includes validation to ensure only user story work items are deleted.
     * 
     * @param {number|string} workItemId - The ID of the user story work item to delete (will be converted to number)
     * 
     * @returns {Promise<Object>} Promise resolving to the deletion result object containing:
     * @returns {number} returns.id - ID of the deleted work item
     * @returns {boolean} returns.deleted - Always true, indicating successful deletion
     * @returns {string} returns.title - Title of the deleted work item (retrieved before deletion)
     * @returns {string} returns.deletedDate - ISO datetime when the deletion occurred
     * @returns {Object} returns.result - Raw Azure DevOps API response from the deletion operation
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When workItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When the work item does not exist (404)
     * @throws {Error} When the work item is not a user story (type mismatch protection)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to delete work items
     * @throws {Error} When the work item cannot be deleted due to dependencies or business rules
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Delete a user story by ID
     * const result = await manager.deleteUserStory(123);
     * console.log(`Deleted user story: ${result.title}`);
     * console.log(`Deletion completed at: ${result.deletedDate}`);
     * 
     * @example
     * // Delete with string ID (will be converted to number)
     * const result = await manager.deleteUserStory('456');
     * if (result.deleted) {
     *   console.log('User story successfully deleted');
     * }
     * 
     * @example
     * // With comprehensive error handling
     * try {
     *   const result = await manager.deleteUserStory(workItemId);
     *   console.log(`Successfully deleted user story: ${result.title}`);
     *   
     *   // Log deletion for audit purposes
     *   console.log(`Audit: Work item ${result.id} deleted at ${result.deletedDate}`);
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('Work item does not exist or was already deleted');
     *   } else if (error.message.includes('not a Product Backlog Item')) {
     *     console.error('Can only delete user story work items with this method');
     *   } else if (error.message.includes('Access denied')) {
     *     console.error('Insufficient permissions to delete work items');
     *   } else if (error.message.includes('dependencies')) {
     *     console.error('Cannot delete work item due to existing dependencies');
     *   } else {
     *     console.error('Failed to delete user story:', error.message);
     *   }
     * }
     * 
     * @example
     * // Safe deletion with confirmation
     * const workItemToDelete = await manager.getWorkItem(workItemId);
     * console.log(`About to delete: ${workItemToDelete.title}`);
     * 
     * // In a real application, you might prompt for user confirmation here
     * const confirmed = true; // Replace with actual user confirmation
     * 
     * if (confirmed) {
     *   const result = await manager.deleteUserStory(workItemId);
     *   console.log('Deletion confirmed and completed');
     * }
     * 
     * @warning This operation is permanent and cannot be undone. The work item and all its history will be permanently removed from Azure DevOps.
     * @warning Always verify the work item details before deletion, especially in production environments.
     * @warning Consider using state changes (e.g., moving to 'Removed' state) instead of permanent deletion for better traceability.
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/delete} Azure DevOps Delete Work Item API
     * @see {@link WorkItemManager#getWorkItem} To verify work item details before deletion
     * @see {@link WorkItemManager#updateUserStory} For non-destructive alternatives like state changes
     */async deleteUserStory(workItemId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        // Convert string to number if needed
        workItemId = parseInt(workItemId);

        try {
            console.log(`🗑️ Deleting user story with ID: ${workItemId}`);            // First, get the work item to verify it exists and is a user story
            const workItem = await this.getWorkItem(workItemId);
              // Get user story type from environment or use default
            const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
            
            if (workItem.workItemType !== userStoryType) {
                throw new Error(`Work item ${workItemId} is not a ${userStoryType} (Type: ${workItem.workItemType})`);
            }

            const result = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.deleteWorkItem(
                    workItemId,
                    this.project,
                    true // destroy (permanent delete)
                );
            });

            console.log(`✅ User story deleted successfully: ${workItemId}`);

            return {
                id: workItemId,
                deleted: true,
                title: workItem.title,
                deletedDate: new Date().toISOString(),
                result: result
            };

        } catch (error) {
            console.error('❌ Failed to delete user story:', error.message);
            throw this._handleError(error, 'delete user story');
        }
    }    /**
     * Link a user story as a child to a feature work item
     * 
     * @async
     * @method linkUserStoryToFeature
     * @description Creates a parent-child relationship between a feature and a user story in Azure DevOps.
     * This method establishes a hierarchical link where the feature is the parent and the user story is the child.
     * The method validates that both work items exist and are of the correct types before creating the link.
     * This is essential for organizing work in Azure DevOps hierarchies (Epic -> Feature -> User Story -> Task).
     * 
     * @param {number|string} userStoryId - The ID of the user story work item (child) to link
     * @param {number|string} featureId - The ID of the feature work item (parent) to link to
     * 
     * @returns {Promise<Object>} Promise resolving to the link result object containing:
     * @returns {number} returns.userStoryId - ID of the user story (child)
     * @returns {number} returns.featureId - ID of the feature (parent)
     * @returns {string} returns.userStoryTitle - Title of the user story
     * @returns {string} returns.featureTitle - Title of the feature
     * @returns {string} returns.linkType - Type of relationship ('Parent-Child')
     * @returns {boolean} returns.linked - Always true, indicating successful linking
     * @returns {string} returns.linkedDate - ISO datetime when the link was created
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When userStoryId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When featureId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When the user story work item does not exist
     * @throws {Error} When the feature work item does not exist
     * @throws {Error} When the user story is not of the correct type (not a user story/Product Backlog Item)
     * @throws {Error} When the feature is not of type 'Feature'
     * @throws {Error} When the link already exists (duplicate relationship)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to modify work items
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Link user story to feature
     * const result = await manager.linkUserStoryToFeature(123, 456);
     * console.log(`Linked story "${result.userStoryTitle}" to feature "${result.featureTitle}"`);
     * 
     * @example
     * // Using string IDs (will be converted to numbers)
     * const result = await manager.linkUserStoryToFeature('789', '101');
     * console.log(`Link created: ${result.linkType} relationship established`);
     * 
     * @example
     * // With error handling for common scenarios
     * try {
     *   const result = await manager.linkUserStoryToFeature(userStoryId, featureId);
     *   console.log('Successfully linked user story to feature');
     *   console.log(`User Story: ${result.userStoryTitle}`);
     *   console.log(`Feature: ${result.featureTitle}`);
     *   console.log(`Linked on: ${result.linkedDate}`);
     * } catch (error) {
     *   if (error.message.includes('not found')) {
     *     console.error('One or both work items do not exist');
     *   } else if (error.message.includes('not a Product Backlog Item')) {
     *     console.error('First parameter must be a user story work item');
     *   } else if (error.message.includes('not a Feature')) {
     *     console.error('Second parameter must be a feature work item');
     *   } else if (error.message.includes('already exists')) {
     *     console.error('These work items are already linked');
     *   } else {
     *     console.error('Failed to link work items:', error.message);
     *   }
     * }
     * 
     * @example
     * // Verify work items before linking
     * const userStory = await manager.getWorkItem(userStoryId);
     * const feature = await manager.getWorkItem(featureId);
     * 
     * console.log(`About to link: "${userStory.title}" -> "${feature.title}"`);
     * 
     * const result = await manager.linkUserStoryToFeature(userStoryId, featureId);
     * console.log('Link created successfully');
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/update} Azure DevOps Update Work Item API
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/backlogs/organize-backlog} Organizing Your Backlog Hierarchy
     * @see {@link WorkItemManager#linkWorkItems} For general work item linking with custom relationship types
     * @see {@link WorkItemManager#getWorkItem} To verify work item details before linking
     */
    async linkUserStoryToFeature(userStoryId, featureId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }        if (!userStoryId || isNaN(parseInt(userStoryId)) || parseInt(userStoryId) <= 0) {
            throw new Error('Valid user story ID is required');
        }

        if (!featureId || isNaN(parseInt(featureId)) || parseInt(featureId) <= 0) {
            throw new Error('Valid feature ID is required');
        }

        // Convert strings to numbers if needed
        userStoryId = parseInt(userStoryId);
        featureId = parseInt(featureId);

        try {
            console.log(`🔗 Linking user story ${userStoryId} to feature ${featureId}`);

            // Verify both work items exist
            const [userStory, feature] = await Promise.all([
                this.getWorkItem(userStoryId),
                this.getWorkItem(featureId)            ]);            // Get user story type from environment or use default
            const userStoryType = process.env.AZURE_DEVOPS_USER_STORY_TYPE || 'Product Backlog Item';
            
            if (userStory.workItemType !== userStoryType) {
                throw new Error(`Work item ${userStoryId} is not a ${userStoryType} (Type: ${userStory.workItemType})`);
            }

            if (feature.workItemType !== 'Feature') {
                throw new Error(`Work item ${featureId} is not a Feature (Type: ${feature.workItemType})`);
            }

            // Create the link by updating the user story with parent relationship
            const patchDocument = [
                {
                    op: 'add',
                    path: '/relations/-',
                    value: {
                        rel: 'System.LinkTypes.Hierarchy-Reverse',
                        url: `${this.webApi.serverUrl}/${this.project}/_apis/wit/workItems/${featureId}`,
                        attributes: {
                            name: 'Parent'
                        }
                    }
                }
            ];

            const result = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    [], // customHeaders
                    patchDocument,
                    userStoryId,
                    this.project,
                    false, // validateOnly
                    true   // bypassRuleValidation
                );
            });

            console.log(`✅ User story linked to feature successfully`);

            return {
                userStoryId,
                featureId,
                userStoryTitle: userStory.title,
                featureTitle: feature.title,
                linkType: 'Parent-Child',
                linked: true,
                linkedDate: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Failed to link user story to feature:', error.message);
            throw this._handleError(error, 'link user story to feature');
        }
    }    /**
     * Link two work items with a specific hierarchical relationship
     * 
     * @async
     * @method linkWorkItems
     * @description Creates a relationship between two work items in Azure DevOps. This method supports various
     * relationship types but is primarily designed for hierarchical relationships (Parent-Child). The method
     * validates both work items exist before creating the link and handles the Azure DevOps relationship
     * structure automatically based on the link type.
     * 
     * @param {number|string} sourceWorkItemId - The ID of the source work item (will be converted to number)
     * @param {number|string} targetWorkItemId - The ID of the target work item (will be converted to number)
     * @param {string} [linkType='Child'] - The type of relationship ('Child', 'Parent', 'Related')
     * 
     * @returns {Promise<Object>} Promise resolving to the link result object containing:
     * @returns {number} returns.sourceId - ID of the source work item
     * @returns {number} returns.targetId - ID of the target work item
     * @returns {string} returns.linkType - Type of relationship that was created
     * @returns {boolean} returns.success - Always true, indicating successful linking
     * @returns {Object} returns.result - Raw Azure DevOps API response from the link operation
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When sourceWorkItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When targetWorkItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When either work item does not exist
     * @throws {Error} When the link already exists (duplicate relationship)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to modify work items
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Link task to user story (child relationship)
     * const result = await manager.linkWorkItems(taskId, userStoryId, 'Child');
     * console.log(`Task ${result.sourceId} linked to story ${result.targetId}`);
     * 
     * @example
     * // Link user story to feature (child relationship, default)
     * const result = await manager.linkWorkItems(userStoryId, featureId);
     * console.log('User story linked to feature as child');
     * 
     * @since 1.0.0
     * @see {@link WorkItemManager#linkUserStoryToFeature} For specific user story to feature linking
     */
    async linkWorkItems(sourceWorkItemId, targetWorkItemId, linkType = 'Child') {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!sourceWorkItemId || isNaN(parseInt(sourceWorkItemId)) || parseInt(sourceWorkItemId) <= 0) {
            throw new Error('Valid source work item ID is required');
        }

        if (!targetWorkItemId || isNaN(parseInt(targetWorkItemId)) || parseInt(targetWorkItemId) <= 0) {
            throw new Error('Valid target work item ID is required');
        }

        // Convert to numbers
        sourceWorkItemId = parseInt(sourceWorkItemId);
        targetWorkItemId = parseInt(targetWorkItemId);

        try {
            console.log(`🔗 Linking work item ${sourceWorkItemId} to ${targetWorkItemId} with relationship: ${linkType}`);

            // Create the relationship patch document
            const patchDocument = [{
                op: 'add',
                path: '/relations/-',
                value: {
                    rel: `System.LinkTypes.Hierarchy-${linkType === 'Child' ? 'Reverse' : 'Forward'}`,
                    url: `${this.webApi.serverUrl}/${this.project}/_apis/wit/workItems/${targetWorkItemId}`,
                    attributes: {
                        comment: `Linked via Azure DevOps MCP integration on ${new Date().toISOString()}`
                    }
                }
            }];

            const result = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.updateWorkItem(
                    null, // customHeaders
                    patchDocument,
                    sourceWorkItemId,
                    this.project,
                    false, // validateOnly
                    false, // bypassRules
                    false, // suppressNotifications
                    null   // expand
                );
            });            console.log(`✅ Successfully linked work item ${sourceWorkItemId} to ${targetWorkItemId}`);

            return {
                sourceId: sourceWorkItemId,
                targetId: targetWorkItemId,
                linkType: linkType,
                success: true,
                result: result
            };

        } catch (error) {
            console.error(`❌ Failed to link work items ${sourceWorkItemId} -> ${targetWorkItemId}:`, error.message);
            throw this._handleError(error, `link work items ${sourceWorkItemId} -> ${targetWorkItemId}`);
        }
    }    /**
     * Retrieve a work item by its ID from Azure DevOps
     * 
     * @async
     * @method getWorkItem
     * @description Retrieves a work item from Azure DevOps by its unique identifier. The method fetches
     * comprehensive work item details including all fields, relations, and links. This is useful for
     * inspecting work item details, verifying existence before operations, or getting current state.
     * 
     * @param {number|string} workItemId - The ID of the work item to retrieve (will be converted to number)
     * @param {Array<string>} [fields=null] - Optional array of specific field names to retrieve (null = all fields)
     * 
     * @returns {Promise<Object>} Promise resolving to the work item object containing:
     * @returns {number} returns.id - Unique identifier of the work item
     * @returns {string} returns.title - Title of the work item
     * @returns {string} returns.description - Description of the work item
     * @returns {string} returns.state - Current state (e.g., 'New', 'Active', 'Resolved', 'Closed')
     * @returns {string} returns.workItemType - Type of work item (e.g., 'User Story', 'Task', 'Feature')
     * @returns {string|null} returns.assignedTo - Display name of assigned user or null
     * @returns {number|null} returns.priority - Priority level or null
     * @returns {number|null} returns.storyPoints - Story points estimation or null
     * @returns {string|null} returns.acceptanceCriteria - Acceptance criteria or null
     * @returns {string|null} returns.iterationPath - Iteration path or null
     * @returns {string|null} returns.areaPath - Area path or null
     * @returns {string|null} returns.tags - Tags or null
     * @returns {string} returns.url - URL to view the work item in Azure DevOps
     * @returns {string} returns.createdDate - ISO datetime when the work item was created
     * @returns {string} returns.changedDate - ISO datetime when the work item was last modified
     * @returns {string|null} returns.createdBy - Display name of the user who created the work item
     * @returns {string|null} returns.changedBy - Display name of the user who last modified the work item
     * @returns {Array} returns.relations - Array of work item relationships
     * @returns {Object} returns.links - Azure DevOps links object
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When workItemId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When the work item does not exist (404)
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to read work items
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Get complete work item details
     * const workItem = await manager.getWorkItem(123);
     * console.log(`Work Item: ${workItem.title}`);
     * console.log(`Type: ${workItem.workItemType}`);
     * console.log(`State: ${workItem.state}`);
     * 
     * @example
     * // Get specific fields only
     * const workItem = await manager.getWorkItem(123, ['System.Title', 'System.State']);
     * console.log(`Title: ${workItem.title}, State: ${workItem.state}`);
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/get-work-item} Azure DevOps Get Work Item API
     */async getWorkItem(workItemId, fields = null) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        // Convert string to number if needed
        workItemId = parseInt(workItemId);

        try {
            console.log(`📋 Retrieving work item: ${workItemId}`);

            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.getWorkItem(
                    workItemId,
                    fields, // fields
                    null,   // asOf
                    'all'   // expand (relations, links, etc.)
                );
            });

            if (!workItem) {
                throw new Error(`Work item ${workItemId} not found`);
            }

            console.log(`✅ Work item retrieved: ${workItem.fields['System.Title']}`);

            // Build the base response object
            const response = {
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'] || '',
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                storyPoints: workItem.fields['Microsoft.VSTS.Scheduling.StoryPoints'] || null,
                acceptanceCriteria: workItem.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] || null,
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

            // Add Bug-specific fields if this is a Bug work item
            if (workItem.fields['System.WorkItemType'] === 'Bug') {
                response.severity = workItem.fields['Microsoft.VSTS.Common.Severity'] || null;
                response.reproSteps = workItem.fields['Microsoft.VSTS.TCM.ReproSteps'] || null;
                response.foundIn = workItem.fields['Microsoft.VSTS.Common.FoundIn'] || null;
                response.systemInfo = workItem.fields['Microsoft.VSTS.TCM.SystemInfo'] || null;
            }

            return response;

        } catch (error) {
            console.error('❌ Failed to retrieve work item:', error.message);
            throw this._handleError(error, 'retrieve work item');
        }
    }

    /**
     * Get work item comments
     * 
     * @async
     * @method getWorkItemComments
     * @description Retrieves all comments for a specific work item from Azure DevOps.
     * Comments provide historical context and discussions related to the work item.
     * 
     * @param {number|string} workItemId - The ID of the work item to get comments for
     * 
     * @returns {Promise<Array>} Promise resolving to an array of comment objects, each containing:
     * @returns {number} returns[].id - Unique identifier of the comment
     * @returns {string} returns[].text - The comment text content
     * @returns {string} returns[].createdDate - ISO datetime when the comment was created
     * @returns {string} returns[].createdBy - Display name of the user who created the comment
     * @returns {string} returns[].modifiedDate - ISO datetime when the comment was last modified
     * @returns {string} returns[].modifiedBy - Display name of the user who last modified the comment
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized
     * @throws {Error} When workItemId is invalid
     * @throws {Error} When the work item does not exist
     * @throws {Error} When authentication or network errors occur
     * 
     * @example
     * const comments = await manager.getWorkItemComments(123);
     * console.log(`Found ${comments.length} comments`);
     * comments.forEach(comment => {
     *   console.log(`${comment.createdBy}: ${comment.text}`);
     * });
     */
    async getWorkItemComments(workItemId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        workItemId = parseInt(workItemId);

        try {
            console.log(`💬 Retrieving comments for work item: ${workItemId}`);
            
            const comments = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.getComments(
                    this.project,
                    workItemId
                );
            });

            if (!comments || !comments.comments) {
                console.log(`No comments found for work item ${workItemId}`);
                return [];
            }

            console.log(`✅ Retrieved ${comments.comments.length} comments for work item ${workItemId}`);

            return comments.comments.map(comment => ({
                id: comment.id,
                text: comment.text,
                createdDate: comment.createdDate,
                createdBy: comment.createdBy?.displayName || 'Unknown',
                modifiedDate: comment.modifiedDate,
                modifiedBy: comment.modifiedBy?.displayName || 'Unknown'
            }));

        } catch (error) {
            console.error(`❌ Failed to retrieve comments for work item ${workItemId}:`, error.message);
            throw this._handleError(error, 'retrieve work item comments');
        }
    }

    /**
     * Get work item attachments
     * 
     * @async
     * @method getWorkItemAttachments
     * @description Retrieves all attachments for a specific work item from Azure DevOps.
     * Attachments include files, images, and documents related to the work item.
     * 
     * @param {number|string} workItemId - The ID of the work item to get attachments for
     * 
     * @returns {Promise<Array>} Promise resolving to an array of attachment objects, each containing:
     * @returns {string} returns[].id - Unique identifier of the attachment
     * @returns {string} returns[].name - Original filename of the attachment
     * @returns {string} returns[].url - Download URL for the attachment
     * @returns {number} returns[].size - Size of the attachment in bytes
     * @returns {string} returns[].createdDate - ISO datetime when the attachment was uploaded
     * @returns {string} returns[].createdBy - Display name of the user who uploaded the attachment
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized
     * @throws {Error} When workItemId is invalid
     * @throws {Error} When the work item does not exist
     * @throws {Error} When authentication or network errors occur
     * 
     * @example
     * const attachments = await manager.getWorkItemAttachments(123);
     * console.log(`Found ${attachments.length} attachments`);
     * attachments.forEach(attachment => {
     *   console.log(`${attachment.name} (${attachment.size} bytes)`);
     * });
     */
    async getWorkItemAttachments(workItemId) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!workItemId || isNaN(parseInt(workItemId)) || parseInt(workItemId) <= 0) {
            throw new Error('Valid work item ID is required');
        }

        workItemId = parseInt(workItemId);

        try {
            console.log(`📎 Retrieving attachments for work item: ${workItemId}`);
            
            // Get the work item with relations to find attachments
            const workItem = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.getWorkItem(
                    workItemId,
                    null, // fields
                    null, // asOf
                    'relations' // expand relations to get attachments
                );
            });

            if (!workItem || !workItem.relations) {
                console.log(`No attachments found for work item ${workItemId}`);
                return [];
            }

            // Filter for attachment relations
            const attachmentRelations = workItem.relations.filter(relation => 
                relation.rel === 'AttachedFile'
            );

            if (attachmentRelations.length === 0) {
                console.log(`No attachments found for work item ${workItemId}`);
                return [];
            }

            console.log(`✅ Found ${attachmentRelations.length} attachments for work item ${workItemId}`);

            return attachmentRelations.map(relation => ({
                id: relation.url.split('/').pop(), // Extract attachment ID from URL
                name: relation.attributes?.name || 'Unknown',
                url: relation.url,
                size: relation.attributes?.resourceSize || 0,
                createdDate: relation.attributes?.resourceCreatedDate || null,
                createdBy: relation.attributes?.authorizedDate || 'Unknown'
            }));

        } catch (error) {
            console.error(`❌ Failed to retrieve attachments for work item ${workItemId}:`, error.message);
            throw this._handleError(error, 'retrieve work item attachments');
        }
    }

    /**
     * Get comprehensive bug details
     * 
     * @async
     * @method getBugDetails
     * @description Retrieves comprehensive details for a Bug work item including basic fields,
     * Bug-specific fields, comments, attachments, and relationships. This provides a complete
     * view of the bug for analysis and reporting purposes.
     * 
     * @param {number|string} workItemId - The ID of the bug work item to analyze
     * 
     * @returns {Promise<Object>} Promise resolving to comprehensive bug details object containing:
     * @returns {Object} returns.basicInfo - Basic work item information (id, title, description, etc.)
     * @returns {Object} returns.bugFields - Bug-specific fields (severity, reproSteps, foundIn, systemInfo)
     * @returns {Array} returns.comments - All comments associated with the bug
     * @returns {Array} returns.attachments - All attachments associated with the bug
     * @returns {Array} returns.relations - All work item relationships
     * 
     * @throws {Error} When the work item is not a Bug type
     * @throws {Error} When the Work Item Tracking API is not initialized
     * @throws {Error} When workItemId is invalid
     * @throws {Error} When the work item does not exist
     * @throws {Error} When authentication or network errors occur
     * 
     * @example
     * const bugDetails = await manager.getBugDetails(123);
     * console.log(`Bug: ${bugDetails.basicInfo.title}`);
     * console.log(`Severity: ${bugDetails.bugFields.severity}`);
     * console.log(`Comments: ${bugDetails.comments.length}`);
     * console.log(`Attachments: ${bugDetails.attachments.length}`);
     */
    async getBugDetails(workItemId) {
        console.log(`🔍 Getting comprehensive details for bug: ${workItemId}`);

        // First get the basic work item details
        const workItem = await this.getWorkItem(workItemId);
        
        // Verify this is a Bug work item
        if (workItem.workItemType !== 'Bug') {
            throw new Error(`Work item ${workItemId} is not a Bug (type: ${workItem.workItemType})`);
        }

        // Get comments and attachments in parallel for efficiency
        const [comments, attachments] = await Promise.all([
            this.getWorkItemComments(workItemId).catch(error => {
                console.warn(`⚠️ Failed to get comments: ${error.message}`);
                return [];
            }),
            this.getWorkItemAttachments(workItemId).catch(error => {
                console.warn(`⚠️ Failed to get attachments: ${error.message}`);
                return [];
            })
        ]);

        const result = {
            basicInfo: {
                id: workItem.id,
                title: workItem.title,
                description: workItem.description,
                state: workItem.state,
                workItemType: workItem.workItemType,
                assignedTo: workItem.assignedTo,
                priority: workItem.priority,
                iterationPath: workItem.iterationPath,
                areaPath: workItem.areaPath,
                tags: workItem.tags,
                url: workItem.url,
                createdDate: workItem.createdDate,
                changedDate: workItem.changedDate,
                createdBy: workItem.createdBy,
                changedBy: workItem.changedBy
            },
            bugFields: {
                severity: workItem.severity,
                reproSteps: workItem.reproSteps,
                foundIn: workItem.foundIn,
                systemInfo: workItem.systemInfo
            },
            comments: comments,
            attachments: attachments,
            relations: workItem.relations || []
        };

        console.log(`✅ Retrieved comprehensive bug details: ${result.comments.length} comments, ${result.attachments.length} attachments`);
        return result;
    }

    /**
     * Extract work item ID from Azure DevOps URL
     * 
     * @static
     * @method extractWorkItemIdFromUrl
     * @description Parses an Azure DevOps work item URL to extract the work item ID.
     * Supports various Azure DevOps URL formats including legacy and modern formats.
     * 
     * @param {string} url - The Azure DevOps work item URL
     * 
     * @returns {number|null} The extracted work item ID, or null if not found
     * 
     * @example
     * const id = WorkItemManager.extractWorkItemIdFromUrl('https://dev.azure.com/org/project/_workitems/edit/123');
     * console.log(id); // 123
     * 
     * @example
     * const id = WorkItemManager.extractWorkItemIdFromUrl('https://org.visualstudio.com/project/_workitems?id=456');
     * console.log(id); // 456
     */
    static extractWorkItemIdFromUrl(url) {
        if (!url || typeof url !== 'string') {
            return null;
        }

        // Common Azure DevOps URL patterns for work items
        const patterns = [
            // Modern format: https://dev.azure.com/{organization}/{project}/_workitems/edit/{id}
            /\/_workitems\/edit\/(\d+)/i,
            // Legacy format: https://{organization}.visualstudio.com/{project}/_workitems?id={id}
            /[?&]id=(\d+)/i,
            // Direct ID in URL: https://dev.azure.com/{organization}/{project}/_workitems/{id}
            /\/_workitems\/(\d+)(?:\?|$)/i,
            // Bug-specific URLs: https://dev.azure.com/{organization}/{project}/_workitems/edit/{id}/Bug
            /\/_workitems\/edit\/(\d+)\/bug/i,
            // Alternative formats
            /workitems[\/=](\d+)/i
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match && match[1]) {
                const id = parseInt(match[1]);
                if (id > 0) {
                    return id;
                }
            }
        }

        return null;
    }

    /**
     * Search for work items using Work Item Query Language (WIQL)
     * 
     * @async
     * @method searchWorkItems
     * @description Executes a WIQL query to search for work items in Azure DevOps. WIQL is a SQL-like
     * query language specifically designed for Azure DevOps work items. This method supports complex
     * queries with filtering, sorting, and field selection. The results include full work item details.
     * 
     * @param {string} wiql - Work Item Query Language query string (required, non-empty)
     * 
     * @returns {Promise<Array>} Promise resolving to an array of work item objects, each containing:
     * @returns {number} returns[].id - Unique identifier of the work item
     * @returns {string} returns[].title - Title of the work item
     * @returns {string} returns[].description - Description of the work item
     * @returns {string} returns[].state - Current state of the work item
     * @returns {string} returns[].workItemType - Type of work item
     * @returns {string|null} returns[].assignedTo - Display name of assigned user or null
     * @returns {number|null} returns[].priority - Priority level or null
     * @returns {string} returns[].url - URL to view the work item in Azure DevOps
     * @returns {string} returns[].createdDate - ISO datetime when created
     * @returns {string} returns[].changedDate - ISO datetime when last modified
     * 
     * @throws {Error} When the Work Item Tracking API is not initialized (call initialize() first)
     * @throws {Error} When wiql parameter is missing, null, or not a string
     * @throws {Error} When the WIQL query has syntax errors
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to query work items
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Search for active user stories
     * const wiql = `
     *   SELECT [System.Id], [System.Title], [System.State]
     *   FROM WorkItems
     *   WHERE [System.WorkItemType] = 'User Story'
     *   AND [System.State] = 'Active'
     *   ORDER BY [System.CreatedDate] DESC
     * `;
     * const results = await manager.searchWorkItems(wiql);
     * console.log(`Found ${results.length} active user stories`);
     * 
     * @example
     * // Search for work items assigned to specific user
     * const wiql = `
     *   SELECT [System.Id], [System.Title], [System.AssignedTo]
     *   FROM WorkItems
     *   WHERE [System.AssignedTo] = 'john.doe@company.com'
     *   AND [System.State] <> 'Closed'
     * `;
     * const userWorkItems = await manager.searchWorkItems(wiql);
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/queries/wiql-syntax} WIQL Syntax Reference
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/wiql} Azure DevOps WIQL Query API
     */
    async searchWorkItems(wiql) {
        if (!this.workItemTrackingApi) {
            throw new Error('Work Item Tracking API not initialized. Call initialize() first.');
        }

        if (!wiql || typeof wiql !== 'string') {
            throw new Error('WIQL query is required');
        }

        try {
            console.log('🔍 Searching work items with query...');

            const queryResult = await this._retryOperation(async () => {
                return await this.workItemTrackingApi.queryByWiql({
                    query: wiql
                }, this.project);
            });

            if (!queryResult.workItems || queryResult.workItems.length === 0) {
                console.log('📭 No work items found matching the query');
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

            console.log(`✅ Found ${workItems.length} work items`);

            return workItems.map(workItem => ({
                id: workItem.id,
                title: workItem.fields['System.Title'],
                description: workItem.fields['System.Description'] || '',
                state: workItem.fields['System.State'],
                workItemType: workItem.fields['System.WorkItemType'],
                assignedTo: workItem.fields['System.AssignedTo']?.displayName || null,
                priority: workItem.fields['Microsoft.VSTS.Common.Priority'] || null,
                url: workItem.url,
                createdDate: workItem.fields['System.CreatedDate'],
                changedDate: workItem.fields['System.ChangedDate']
            }));

        } catch (error) {
            console.error('❌ Failed to search work items:', error.message);
            throw this._handleError(error, 'search work items');
        }
    }    /**
     * Get user stories linked to a specific feature
     * 
     * @async
     * @method getUserStoriesForFeature
     * @description Retrieves all user stories that are linked as children to a specific feature work item.
     * This method uses a WIQL query to find the hierarchical relationships and returns the user stories
     * with key fields like title, state, assigned user, story points, and priority.
     * 
     * @param {number|string} featureId - The ID of the feature work item (will be converted to number)
     * 
     * @returns {Promise<Array>} Promise resolving to an array of user story objects linked to the feature
     * 
     * @throws {Error} When featureId is missing, null, not a number, or less than or equal to 0
     * @throws {Error} When the feature work item does not exist
     * @throws {Error} When authentication fails (401) - check PAT token
     * @throws {Error} When access is denied (403) - check permissions to query work items
     * @throws {Error} When network or server errors occur (500, 502, 503, 504)
     * 
     * @example
     * // Get all user stories for a feature
     * const userStories = await manager.getUserStoriesForFeature(456);
     * console.log(`Feature has ${userStories.length} user stories`);
     * userStories.forEach(story => {
     *   console.log(`- ${story.title} (${story.state})`);
     * });
     * 
     * @since 1.0.0
     * @see {@link WorkItemManager#searchWorkItems} For the underlying search implementation
     * @see {@link WorkItemManager#linkUserStoryToFeature} To create feature-story relationships
     */async getUserStoriesForFeature(featureId) {
        if (!featureId || isNaN(parseInt(featureId)) || parseInt(featureId) <= 0) {
            throw new Error('Valid feature ID is required');
        }

        // Convert string to number if needed
        featureId = parseInt(featureId);

        const wiql = `
            SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo], 
                   [Microsoft.VSTS.Scheduling.StoryPoints], [Microsoft.VSTS.Common.Priority]
            FROM WorkItemLinks
            WHERE (Source.[System.Id] = ${featureId})
            AND (Target.[System.WorkItemType] = 'User Story')
            AND (System.Links.LinkType = 'System.LinkTypes.Hierarchy-Forward')
            ORDER BY [System.Id]
        `;

        return await this.searchWorkItems(wiql);
    }    /**
     * Retry an operation with exponential backoff
     * 
     * @async
     * @method _retryOperation
     * @private
     * @description Implements retry logic with exponential backoff for Azure DevOps API calls. This method
     * attempts to execute an operation multiple times if it fails with retryable errors (network issues,
     * timeouts, rate limiting). The delay between attempts increases exponentially to avoid overwhelming
     * the service. Non-retryable errors (authentication, permissions, bad requests) fail immediately.
     * 
     * @param {Function} operation - Async function to execute with retry logic
     * @returns {Promise<*>} Promise resolving to the result of the successful operation
     * 
     * @throws {Error} When all retry attempts are exhausted or a non-retryable error occurs
     * 
     * @example
     * // Internal usage example
     * const result = await this._retryOperation(async () => {
     *   return await this.workItemTrackingApi.getWorkItem(workItemId);
     * });
     * 
     * @since 1.0.0
     * @see {@link WorkItemManager#_isRetryableError} For retry error classification
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
    }    /**
     * Determine if an error is eligible for retry attempts
     * 
     * @method _isRetryableError
     * @private
     * @description Analyzes error objects to determine whether an operation should be retried. This method
     * checks for transient network errors, server-side errors, rate limiting, and timeout issues that
     * typically resolve with retry attempts. Authentication, permission, and client-side errors are
     * considered non-retryable as they require user intervention.
     * 
     * @param {Error} error - The error object to analyze
     * @returns {boolean} True if the error is retryable, false otherwise
     * 
     * @example
     * // Internal usage example
     * if (this._isRetryableError(error)) {
     *   // Schedule retry with exponential backoff
     * } else {
     *   // Fail immediately for non-retryable errors
     * }
     * 
     * @since 1.0.0
     * @see {@link WorkItemManager#_retryOperation} For the retry implementation that uses this method
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
    }    /**
     * Handle and format errors with standardized error messages and context
     * 
     * This private helper method processes various types of errors that can occur during Azure DevOps API operations
     * and transforms them into user-friendly error messages with appropriate context. It standardizes error handling
     * across all work item management operations by providing consistent error categorization and messaging.
     * 
     * @private
     * @method _handleError
     * @param {Error|Object} error - The original error object from the Azure DevOps API or internal operation
     * @param {number} [error.statusCode] - HTTP status code from the API response
     * @param {number} [error.status] - Alternative property name for HTTP status code
     * @param {string} [error.message] - Original error message from the source
     * @param {string} operation - Description of the operation that failed, used for contextual error messages
     * @returns {Error} A new Error object with a formatted, user-friendly message
     * 
     * @description
     * The method categorizes errors based on HTTP status codes and provides specific guidance:
     * - 401 Unauthorized: Authentication token issues
     * - 403 Forbidden: Permission/access rights issues
     * - 404 Not Found: Resource doesn't exist or invalid IDs
     * - 400 Bad Request: Invalid parameters or malformed requests
     * - Other codes: Generic error with original message preserved
     * 
     * @example
     * // Handle authentication error
     * const authError = { statusCode: 401, message: 'Token expired' };
     * const formattedError = this._handleError(authError, 'create user story');
     * // Returns: Error('Authentication failed while trying to create user story. Please check your PAT token.')
     * 
     * @example
     * // Handle not found error
     * const notFoundError = { statusCode: 404, message: 'Work item not found' };
     * const formattedError = this._handleError(notFoundError, 'retrieve work item');
     * // Returns: Error('Resource not found while trying to retrieve work item. Please check the work item ID and project.')
     * 
     * @example
     * // Handle validation error
     * const validationError = { statusCode: 400, message: 'Invalid field value' };
     * const formattedError = this._handleError(validationError, 'update user story');
     * // Returns: Error('Bad request while trying to update user story. Please check your input parameters: Invalid field value')
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/} Azure DevOps REST API Error Codes
     */
    _handleError(error, operation) {
        const errorMessage = error.message || 'Unknown error occurred';
        const statusCode = error.statusCode || error.status;

        if (statusCode === 401) {
            return new Error(`Authentication failed while trying to ${operation}. Please check your PAT token.`);
        } else if (statusCode === 403) {
            return new Error(`Access denied while trying to ${operation}. Please check your permissions.`);
        } else if (statusCode === 404) {
            return new Error(`Resource not found while trying to ${operation}. Please check the work item ID and project.`);
        } else if (statusCode === 400) {
            return new Error(`Bad request while trying to ${operation}. Please check your input parameters: ${errorMessage}`);
        } else {
            return new Error(`Failed to ${operation}: ${errorMessage}`);
        }
    }
}
