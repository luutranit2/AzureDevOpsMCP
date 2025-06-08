#!/usr/bin/env node
/**
 * Azure DevOps MCP Server
 * 
 * @file server.js - Model Context Protocol server for Azure DevOps integration
 * @description This is the main MCP server implementation that provides a comprehensive
 * set of tools for interacting with Azure DevOps services. It implements the Model Context
 * Protocol specification and offers tools for work item management, pull request operations,
 * test case handling, and system connectivity testing.
 * 
 * The server supports 15 different tools covering:
 * - Work Item Operations: Create, update, search, and link user stories and tasks
 * - Test Case Management: Create, update, and associate test cases with user stories
 * - Pull Request Operations: Retrieve, comment on, and analyze pull requests
 * - System Operations: Test connectivity and validate configuration
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires @modelcontextprotocol/sdk - MCP SDK for server implementation
 * @requires ../index.js - Azure DevOps integration module
 * @requires dotenv - Environment variable management
 * 
 * @example
 * // Start the MCP server
 * node src/server.js
 * 
 * // Test connection via JSON-RPC
 * echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"test_connection","arguments":{}}}' | node src/server.js
 * 
 * // Create a user story
 * echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"create_user_story","arguments":{"title":"Login Feature","description":"User authentication"}}}' | node src/server.js
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { AzureDevOpsIntegration } from '../index.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Azure DevOps MCP Server Class
 * 
 * @class AzureDevOpsMCPServer
 * @description Main server class that implements the Model Context Protocol for Azure DevOps.
 * Handles tool registration, request routing, and maintains the connection to Azure DevOps
 * services. Provides comprehensive error handling and logging for all operations.
 */
class AzureDevOpsMCPServer {
  /**
   * Creates an instance of AzureDevOpsMCPServer
   * 
   * @constructor
   * @description Initializes the MCP server with Azure DevOps capabilities, sets up
   * tool handlers, and prepares the connection infrastructure.
   */
  constructor() {
    this.server = new Server(
      {
        name: 'azure-devops-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.azureDevOps = null;
    this.setupToolHandlers();
  }
  /**
   * Sets up all tool handlers for the MCP server
   * 
   * @method setupToolHandlers
   * @description Registers all available tools with their schemas and implements
   * the request handlers for both tool listing and tool execution. Defines the
   * complete API surface for Azure DevOps operations.
   * 
   * Tools are organized into categories:
   * - Work Item Management (6 tools)
   * - Test Case Management (3 tools) 
   * - Pull Request Operations (3 tools)
   * - System Operations (1 tool)
   */
  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_user_story',
            description: 'Create a new user story in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the user story',
                },
                description: {
                  type: 'string',
                  description: 'The description of the user story',
                },
                acceptanceCriteria: {
                  type: 'string',
                  description: 'The acceptance criteria for the user story',
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
                storyPoints: {
                  type: 'number',
                  description: 'Story points estimate',
                },
                tags: {
                  type: 'string',
                  description: 'Comma-separated tags',
                },
              },
              required: ['title', 'description'],
            },
          },
          {
            name: 'update_user_story',
            description: 'Update an existing user story',
            inputSchema: {
              type: 'object',
              properties: {                workItemId: {
                  type: ['number', 'string'],
                  description: 'The ID of the user story to update',
                },
                title: {
                  type: 'string',
                  description: 'New title',
                },
                description: {
                  type: 'string', 
                  description: 'New description',
                },
                acceptanceCriteria: {
                  type: 'string',
                  description: 'New acceptance criteria',
                },
                priority: {
                  type: 'number',
                  description: 'New priority level (1-4)',
                },
                storyPoints: {
                  type: 'number',
                  description: 'New story points estimate',
                },
                state: {
                  type: 'string',
                  description: 'New state (New, Active, Resolved, Closed, etc.)',
                },
              },
              required: ['workItemId'],
            },
          },
          {
            name: 'get_user_story',
            description: 'Get details of a user story',
            inputSchema: {
              type: 'object',
              properties: {                workItemId: {
                  type: ['number', 'string'],
                  description: 'The ID of the user story to retrieve',
                },
              },
              required: ['workItemId'],
            },
          },
          {
            name: 'link_user_story_to_feature',
            description: 'Link a user story to a feature as parent-child relationship',
            inputSchema: {
              type: 'object',
              properties: {                userStoryId: {
                  type: ['number', 'string'],
                  description: 'The ID of the user story',
                },
                featureId: {
                  type: ['number', 'string'],
                  description: 'The ID of the feature to link to',
                },
              },
              required: ['userStoryId', 'featureId'],
            },
          },
          {
            name: 'search_work_items',
            description: 'Search for work items using WIQL query',
            inputSchema: {
              type: 'object',
              properties: {
                wiql: {
                  type: 'string',
                  description: 'WIQL query string',
                },
              },
              required: ['wiql'],
            },
          },
          {
            name: 'create_test_case',
            description: 'Create a new test case in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the test case',
                },
                description: {
                  type: 'string',
                  description: 'The description of the test case',
                },
                steps: {
                  type: 'array',
                  description: 'Array of test steps',
                  items: {
                    type: 'object',
                    properties: {
                      action: {
                        type: 'string',
                        description: 'The action to perform',
                      },
                      expectedResult: {
                        type: 'string',
                        description: 'The expected result',
                      },
                    },
                    required: ['action', 'expectedResult'],
                  },
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
                automationStatus: {
                  type: 'string',
                  description: 'Automation status (Not Automated, Planned, Automated)',
                },
              },
              required: ['title', 'description'],
            },
          },
          {
            name: 'update_test_case',
            description: 'Update an existing test case in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                testCaseId: {
                  type: ['number', 'string'],
                  description: 'The ID of the test case to update',
                },
                title: {
                  type: 'string',
                  description: 'New title for the test case',
                },
                description: {
                  type: 'string',
                  description: 'New description for the test case',
                },
                steps: {
                  type: 'array',
                  description: 'New array of test steps to replace existing steps',
                  items: {
                    type: 'object',
                    properties: {
                      action: {
                        type: 'string',
                        description: 'The action to perform',
                      },
                      expectedResult: {
                        type: 'string',
                        description: 'The expected result',
                      },
                    },
                    required: ['action', 'expectedResult'],
                  },
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
                automationStatus: {
                  type: 'string',
                  description: 'Automation status (Not Automated, Planned, Automated)',
                },
                assignedTo: {
                  type: 'string',
                  description: 'Email or display name of the person to assign the test case to',
                },
                state: {
                  type: 'string',
                  description: 'New state (Active, Resolved, Closed, etc.)',
                },
              },
              required: ['testCaseId'],
            },
          },
          {
            name: 'associate_test_case_with_user_story',
            description: 'Associate a test case with a user story',
            inputSchema: {
              type: 'object',
              properties: {                testCaseId: {
                  type: ['number', 'string'],
                  description: 'The ID of the test case',
                },
                userStoryId: {
                  type: ['number', 'string'],
                  description: 'The ID of the user story',
                },
              },
              required: ['testCaseId', 'userStoryId'],
            },
          },
          {
            name: 'get_test_case',
            description: 'Get details of a test case',
            inputSchema: {
              type: 'object',
              properties: {                testCaseId: {
                  type: ['number', 'string'],
                  description: 'The ID of the test case to retrieve',
                },
              },
              required: ['testCaseId'],
            },
          },
          {
            name: 'get_pull_request',
            description: 'Get details of a pull request',
            inputSchema: {
              type: 'object',
              properties: {                repositoryId: {
                  type: 'string',
                  description: 'The ID of the repository',
                },
                pullRequestId: {
                  type: ['number', 'string'],
                  description: 'The ID of the pull request',
                },
                includeDetails: {
                  type: 'boolean',
                  description: 'Include detailed information (commits, work items)',
                  default: true,
                },
              },
              required: ['repositoryId', 'pullRequestId'],
            },
          },
          {
            name: 'get_pull_request_comments',
            description: 'Get comments from a pull request',
            inputSchema: {
              type: 'object',
              properties: {                repositoryId: {
                  type: 'string',
                  description: 'The ID of the repository',
                },
                pullRequestId: {
                  type: ['number', 'string'],
                  description: 'The ID of the pull request',
                },
              },
              required: ['repositoryId', 'pullRequestId'],
            },
          },
          {
            name: 'add_pull_request_comment',
            description: 'Add a comment to a pull request file',
            inputSchema: {
              type: 'object',
              properties: {
                repositoryId: {
                  type: 'string',
                  description: 'The ID of the repository',
                },                pullRequestId: {
                  type: ['number', 'string'],
                  description: 'The ID of the pull request',
                },
                filePath: {
                  type: 'string',
                  description: 'Path to the file to comment on',
                },
                comment: {
                  type: 'string',
                  description: 'The comment text',
                },
                line: {
                  type: 'number',
                  description: 'Line number for the comment',
                },
              },
              required: ['repositoryId', 'pullRequestId', 'filePath', 'comment'],
            },          },
          {
            name: 'create_task',
            description: 'Create a new task in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the task',
                },
                description: {
                  type: 'string',
                  description: 'The description of the task',
                },
                parentId: {
                  type: ['number', 'string'],
                  description: 'The ID of the parent work item (user story, feature, etc.)',
                },
                assignedTo: {
                  type: 'string',
                  description: 'Email or display name of the person to assign the task to',
                },
                originalEstimate: {
                  type: 'number',
                  description: 'Original estimate in hours',
                },
                activity: {
                  type: 'string',
                  description: 'Activity type (Development, Testing, Design, etc.)',
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
              },
              required: ['title', 'description'],
            },
          },
          {
            name: 'create_bug',
            description: 'Create a new bug in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'The title of the bug',
                },
                description: {
                  type: 'string',
                  description: 'The description of the bug',
                },
                parentId: {
                  type: ['number', 'string'],
                  description: 'The ID of the parent work item (user story, feature, etc.)',
                },
                assignedTo: {
                  type: 'string',
                  description: 'Email or display name of the person to assign the bug to',
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
                severity: {
                  type: 'string',
                  description: 'Severity level (1 - Critical, 2 - High, 3 - Medium, 4 - Low)',
                },
                reproSteps: {
                  type: 'string',
                  description: 'Steps to reproduce the bug',
                },
                foundIn: {
                  type: 'string',
                  description: 'Version or build where the bug was found',
                },
                systemInfo: {
                  type: 'string',
                  description: 'System information where the bug occurred',
                },
                tags: {
                  type: 'string',
                  description: 'Comma-separated tags',
                },
              },
              required: ['title', 'description'],
            },
          },
          {
            name: 'update_bug',
            description: 'Update an existing bug',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: ['number', 'string'],
                  description: 'The ID of the bug to update',
                },
                title: {
                  type: 'string',
                  description: 'New title',
                },
                description: {
                  type: 'string',
                  description: 'New description',
                },
                priority: {
                  type: 'number',
                  description: 'New priority level (1-4)',
                },
                severity: {
                  type: 'string',
                  description: 'New severity level (1 - Critical, 2 - High, 3 - Medium, 4 - Low)',
                },
                reproSteps: {
                  type: 'string',
                  description: 'New reproduction steps',
                },
                foundIn: {
                  type: 'string',
                  description: 'New version or build where the bug was found',
                },
                systemInfo: {
                  type: 'string',
                  description: 'New system information',
                },
                state: {
                  type: 'string',
                  description: 'New state (New, Active, Resolved, Closed, etc.)',
                },
                assignedTo: {
                  type: 'string',
                  description: 'New assignee email or display name',
                },
                tags: {
                  type: 'string',
                  description: 'New comma-separated tags',
                },
              },
              required: ['workItemId'],
            },
          },
          {
            name: 'test_connection',
            description: 'Test the connection to Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Initialize Azure DevOps connection if not already done
        await this.ensureInitialized();

        switch (name) {
          case 'create_user_story':
            return await this.createUserStory(args);
          case 'update_user_story':
            return await this.updateUserStory(args);
          case 'get_user_story':
            return await this.getUserStory(args);
          case 'link_user_story_to_feature':
            return await this.linkUserStoryToFeature(args);          case 'search_work_items':
            return await this.searchWorkItems(args);
          case 'create_task':
            return await this.createTask(args);
          case 'create_bug':
            return await this.createBug(args);
          case 'update_bug':
            return await this.updateBug(args);
          case 'create_test_case':
            return await this.createTestCase(args);
          case 'update_test_case':
            return await this.updateTestCase(args);
          case 'associate_test_case_with_user_story':
            return await this.associateTestCaseWithUserStory(args);
          case 'get_test_case':
            return await this.getTestCase(args);
          case 'get_pull_request':
            return await this.getPullRequest(args);
          case 'get_pull_request_comments':
            return await this.getPullRequestComments(args);
          case 'add_pull_request_comment':
            return await this.addPullRequestComment(args);
          case 'test_connection':
            return await this.testConnection(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async ensureInitialized() {
    if (!this.azureDevOps) {
      const config = {
        organizationUrl: process.env.AZURE_DEVOPS_ORG_URL,
        personalAccessToken: process.env.AZURE_DEVOPS_PAT,
        project: process.env.AZURE_DEVOPS_PROJECT,
      };

      if (!config.organizationUrl || !config.personalAccessToken || !config.project) {
        throw new Error('Missing required Azure DevOps configuration. Please set AZURE_DEVOPS_ORG_URL, AZURE_DEVOPS_PAT, and AZURE_DEVOPS_PROJECT environment variables.');
      }

      this.azureDevOps = new AzureDevOpsIntegration(config);
      const success = await this.azureDevOps.initialize();
      
      if (!success) {
        throw new Error('Failed to initialize Azure DevOps connection');
      }
    }
  }
  async createUserStory(args) {
    const { title, description, acceptanceCriteria, priority, storyPoints, tags } = args;
    
    // Convert newlines to HTML <br> tags for proper rendering in Azure DevOps
    const htmlDescription = description ? description.replace(/\n/g, '<br>') : description;
    
    const additionalFields = {};
    if (acceptanceCriteria) {
      additionalFields['Microsoft.VSTS.Common.AcceptanceCriteria'] = acceptanceCriteria.replace(/\n/g, '<br>');
    }
    if (priority) {
      additionalFields['Microsoft.VSTS.Common.Priority'] = priority;
    }
    if (storyPoints) {
      additionalFields['Microsoft.VSTS.Scheduling.StoryPoints'] = storyPoints;
    }
    if (tags) {
      additionalFields['System.Tags'] = tags;
    }
    
    const userStory = await this.azureDevOps.createUserStory(title, htmlDescription, additionalFields);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created user story #${userStory.id}: "${userStory.title}"`,
        },
      ],
    };
  }  async updateUserStory(args) {
    const { workItemId, ...updates } = args;
    
    // Convert newlines to HTML <br> tags for proper rendering in Azure DevOps
    if (updates.description) {
      updates.description = updates.description.replace(/\n/g, '<br>');
    }
    if (updates.acceptanceCriteria) {
      updates.acceptanceCriteria = updates.acceptanceCriteria.replace(/\n/g, '<br>');
    }
    
    // Pass the updates with HTML formatting to the work item manager
    const updatedStory = await this.azureDevOps.updateUserStory(workItemId, updates);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated user story #${updatedStory.id}: "${updatedStory.title}"`,
        },
      ],
    };
  }
  async getUserStory(args) {
    const { workItemId } = args;
    const userStory = await this.azureDevOps.getWorkItem(workItemId);
    
    const details = `
User Story #${userStory.id}
Title: ${userStory.title}
State: ${userStory.state}
Description: ${userStory.description || 'No description'}
Work Item Type: ${userStory.workItemType}
Priority: ${userStory.priority || 'Not set'}
Story Points: ${userStory.storyPoints || 'Not set'}
Acceptance Criteria: ${userStory.acceptanceCriteria || 'Not set'}
Tags: ${userStory.tags || 'No tags'}
Assigned To: ${userStory.assignedTo || 'Unassigned'}
Created: ${userStory.createdDate}
Modified: ${userStory.changedDate}
URL: ${userStory.url}
`;

    return {
      content: [
        {
          type: 'text',
          text: details,
        },
      ],
    };
  }

  async linkUserStoryToFeature(args) {
    const { userStoryId, featureId } = args;
    await this.azureDevOps.linkUserStoryToFeature(userStoryId, featureId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully linked user story #${userStoryId} to feature #${featureId}`,
        },
      ],
    };
  }

  async searchWorkItems(args) {
    const { wiql } = args;
    const workItems = await this.azureDevOps.searchWorkItems(wiql);
      let resultText = `Found ${workItems.length} work items:\n\n`;
    workItems.forEach(item => {
      resultText += `#${item.id}: ${item.title} (${item.workItemType}) - ${item.state}\n`;
    });

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],    };
  }

  async createTask(args) {
    const { title, description, parentId, assignedTo, originalEstimate, activity, priority } = args;
    
    const options = {};
    if (parentId) {
      options.parentId = parentId;
    }
    if (assignedTo) {
      options.assignedTo = assignedTo;
    }
    if (originalEstimate) {
      options.originalEstimate = originalEstimate;
    }
    if (activity) {
      options.activity = activity;
    }
    if (priority) {
      options.priority = priority;
    }

    const task = await this.azureDevOps.createTask(title, description, options);
      return {
      content: [
        {
          type: 'text',
          text: `Successfully created task #${task.id}: "${task.title}"${parentId ? ` under parent work item #${parentId}` : ''}`,
        },
      ],
    };
  }

  async createBug(args) {
    const { title, description, parentId, assignedTo, priority, severity, reproSteps, foundIn, systemInfo, tags } = args;
    
    const additionalFields = {};
    if (parentId) {
      additionalFields.parentId = parentId;
    }
    if (assignedTo) {
      additionalFields.assignedTo = assignedTo;
    }
    if (priority) {
      additionalFields.priority = priority;
    }
    if (severity) {
      additionalFields.severity = severity;
    }
    if (reproSteps) {
      additionalFields.reproSteps = reproSteps;
    }
    if (foundIn) {
      additionalFields.foundIn = foundIn;
    }
    if (systemInfo) {
      additionalFields.systemInfo = systemInfo;
    }
    if (tags) {
      additionalFields.tags = tags;
    }

    const bug = await this.azureDevOps.createBug(title, description, additionalFields);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created bug #${bug.id}: "${bug.title}"${parentId ? ` under parent work item #${parentId}` : ''}`,
        },
      ],
    };
  }

  async updateBug(args) {
    const { workItemId, title, description, priority, severity, reproSteps, foundIn, systemInfo, state, assignedTo, tags } = args;
    
    const updates = {};
    if (title !== undefined) {
      updates.title = title;
    }
    if (description !== undefined) {
      updates.description = description;
    }
    if (priority !== undefined) {
      updates.priority = priority;
    }
    if (severity !== undefined) {
      updates.severity = severity;
    }
    if (reproSteps !== undefined) {
      updates.reproSteps = reproSteps;
    }
    if (foundIn !== undefined) {
      updates.foundIn = foundIn;
    }
    if (systemInfo !== undefined) {
      updates.systemInfo = systemInfo;
    }
    if (state !== undefined) {
      updates.state = state;
    }
    if (assignedTo !== undefined) {
      updates.assignedTo = assignedTo;
    }
    if (tags !== undefined) {
      updates.tags = tags;
    }

    const updatedBug = await this.azureDevOps.updateBug(workItemId, updates);
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated bug #${updatedBug.id}: "${updatedBug.title}"`,
        },
      ],
    };
  }

  async createTestCase(args) {
    const { title, description, steps = [], priority, automationStatus } = args;
    
    // Convert newlines to HTML <br> tags for proper rendering in Azure DevOps
    const htmlTitle = title ? title.replace(/\n/g, '<br>') : title;
    const htmlDescription = description ? description.replace(/\n/g, '<br>') : description;
    
    // Convert newlines in step actions and expected results to HTML
    const htmlSteps = steps.map(step => ({
      action: step.action ? step.action.replace(/\n/g, '<br>') : step.action,
      expectedResult: step.expectedResult ? step.expectedResult.replace(/\n/g, '<br>') : step.expectedResult
    }));
    
    const additionalFields = {};
    if (priority) {
      additionalFields['Microsoft.VSTS.Common.Priority'] = priority;
    }
    if (automationStatus) {
      additionalFields['Microsoft.VSTS.TCM.AutomationStatus'] = automationStatus;
    }

    const testCase = await this.azureDevOps.createTestCase(htmlTitle, htmlDescription, htmlSteps, additionalFields);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully created test case #${testCase.id}: "${testCase.title}" with ${htmlSteps.length} test steps`,
        },
      ],
    };
  }
  async updateTestCase(args) {
    const { testCaseId, title, description, steps, priority, automationStatus, assignedTo, state } = args;
    
    const updates = {};
    
    // Convert newlines to HTML <br> tags for proper rendering in Azure DevOps
    if (title) {
      updates.title = title.replace(/\n/g, '<br>');
    }
    if (description) {
      updates.description = description.replace(/\n/g, '<br>');
    }
    if (steps) {
      // Convert newlines in step actions and expected results to HTML
      updates.steps = steps.map(step => ({
        action: step.action ? step.action.replace(/\n/g, '<br>') : step.action,
        expectedResult: step.expectedResult ? step.expectedResult.replace(/\n/g, '<br>') : step.expectedResult
      }));
    }
    if (priority) {
      updates.priority = priority;
    }
    if (automationStatus) {
      updates.automationStatus = automationStatus;
    }
    if (assignedTo) {
      updates.assignedTo = assignedTo;
    }
    if (state) {
      updates.state = state;
    }

    const updatedTestCase = await this.azureDevOps.updateTestCase(testCaseId, updates);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully updated test case #${updatedTestCase.id}: "${updatedTestCase.title}"${steps ? ` with ${steps.length} test steps` : ''}`,
        },
      ],
    };
  }

  async associateTestCaseWithUserStory(args) {
    const { testCaseId, userStoryId } = args;
    await this.azureDevOps.associateTestCaseWithUserStory(testCaseId, userStoryId);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully associated test case #${testCaseId} with user story #${userStoryId}`,
        },
      ],
    };
  }

  async getTestCase(args) {
    const { testCaseId } = args;
    const testCase = await this.azureDevOps.getTestCase(testCaseId);
      const details = `
Test Case #${testCase.id}
Title: ${testCase.title}
State: ${testCase.state}
Description: ${testCase.description || 'No description'}
Priority: ${testCase.priority || 'Not set'}
Automation Status: ${testCase.automationStatus || 'Not set'}
Test Steps: ${testCase.steps ? testCase.steps.length : 0} steps
Created: ${testCase.createdDate}
Modified: ${testCase.changedDate}
`;

    return {
      content: [
        {
          type: 'text',
          text: details,
        },
      ],
    };
  }
  async getPullRequest(args) {
    const { repositoryId, pullRequestId, includeDetails = true } = args;
    const pr = await this.azureDevOps.getPullRequest(repositoryId, pullRequestId, includeDetails);
    
    const details = `
Pull Request #${pr.id}
Title: ${pr.title}
Status: ${pr.status}
Source: ${pr.sourceBranch} → Target: ${pr.targetBranch}
Created by: ${pr.createdBy.displayName}
Created: ${pr.creationDate}
Description: ${pr.description || 'No description'}
`;

    return {
      content: [
        {
          type: 'text',
          text: details,
        },
      ],
    };
  }

  async getPullRequestComments(args) {
    const { repositoryId, pullRequestId } = args;
    const comments = await this.azureDevOps.getPullRequestComments(repositoryId, pullRequestId);
    
    let resultText = `Found ${comments.length} comment threads:\n\n`;
    comments.forEach((thread, index) => {
      resultText += `Thread ${index + 1} (${thread.status}):\n`;
      thread.comments.forEach(comment => {
        resultText += `  - ${comment.author.displayName}: ${comment.content}\n`;
      });
      resultText += '\n';
    });

    return {
      content: [
        {
          type: 'text',
          text: resultText,
        },
      ],
    };
  }

  async addPullRequestComment(args) {
    const { repositoryId, pullRequestId, filePath, comment, line } = args;
    const result = await this.azureDevOps.addFileComment(repositoryId, pullRequestId, filePath, comment, line);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully added comment to file ${filePath} in pull request #${pullRequestId}`,
        },
      ],
    };
  }

  async testConnection(args) {
    const isConnected = await this.azureDevOps.testConnection();
    const orgInfo = await this.azureDevOps.getOrganizationInfo();
    
    return {
      content: [
        {
          type: 'text',
          text: `Connection test: ${isConnected ? 'SUCCESS' : 'FAILED'}\nOrganization: ${orgInfo.name}\nProject: ${process.env.AZURE_DEVOPS_PROJECT}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Azure DevOps MCP server running on stdio');
  }
}

const server = new AzureDevOpsMCPServer();
server.run().catch(console.error);
