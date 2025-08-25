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
 * The server supports 16 different tools covering:
 * - Work Item Operations: Create, update, search, and link user stories and tasks
 * - Test Case Management: Create, update, and associate test cases with user stories
 * - Pull Request Operations: Retrieve, comment on, reply to comments, and analyze pull requests
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
import AzureDevOpsIntegration from '../index.js';
import { CodeReviewManager } from './modules/codeReviewManager.js';
import { configureMCPLogging } from './utils/logger.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configure logging for MCP mode to prevent popups in Claude Desktop
configureMCPLogging();

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
    this.codeReviewManager = null;
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
   * - Pull Request Operations (4 tools)
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
                  type: 'string',
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
                  type: 'string',
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
                  type: 'string',
                  description: 'The ID of the user story',
                },
                featureId: {
                  type: 'string',
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
            },          },
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
                assignedTo: {
                  type: 'string',
                  description: 'Email or display name of the person to assign the bug to',
                },
                priority: {
                  type: 'number',
                  description: 'Priority level (1-4)',
                },
                severity: {
                  type: 'number',
                  description: 'Severity level (1-4)',
                },
                stepsToReproduce: {
                  type: 'string',
                  description: 'Steps to reproduce the bug',
                },
                systemInfo: {
                  type: 'string',
                  description: 'System information where the bug occurs',
                },
                acceptanceCriteria: {
                  type: 'string',
                  description: 'Acceptance criteria for fixing the bug',
                },
                foundInBuild: {
                  type: 'string',
                  description: 'Build number where the bug was found',
                },
                activity: {
                  type: 'string',
                  description: 'Activity type (Development, Testing, Design, etc.)',
                },
                parentId: {
                  type: 'string',
                  description: 'The ID of the parent work item (user story, feature, etc.)',
                },
                iterationPath: {
                  type: 'string',
                  description: 'Iteration path for the bug',
                },
                areaPath: {
                  type: 'string',
                  description: 'Area path for the bug',
                },
                tags: {
                  type: 'string',
                  description: 'Comma-separated tags',
                },
              },
              required: ['title', 'description'],            },
          },
          {
            name: 'update_bug',
            description: 'Update an existing bug in Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  description: 'The ID of the bug to update',
                },
                title: {
                  type: 'string',
                  description: 'The updated title of the bug',
                },
                description: {
                  type: 'string',
                  description: 'The updated description of the bug',
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
                  type: 'number',
                  description: 'Severity level (1-4)',
                },
                stepsToReproduce: {
                  type: 'string',
                  description: 'Steps to reproduce the bug',
                },
                systemInfo: {
                  type: 'string',
                  description: 'System information where the bug occurs',
                },
                acceptanceCriteria: {
                  type: 'string',
                  description: 'Acceptance criteria for fixing the bug',
                },
                foundInBuild: {
                  type: 'string',
                  description: 'Build number where the bug was found',
                },
                activity: {
                  type: 'string',
                  description: 'Activity type (Development, Testing, Design, etc.)',
                },
                parentId: {
                  type: 'string',
                  description: 'The ID of the parent work item (user story, feature, etc.)',
                },
                iterationPath: {
                  type: 'string',
                  description: 'Iteration path for the bug',
                },
                areaPath: {
                  type: 'string',
                  description: 'Area path for the bug',
                },
                tags: {
                  type: 'string',
                  description: 'Comma-separated tags',
                },
                state: {
                  type: 'string',
                  description: 'State of the bug (New, Active, Resolved, Closed)',
                },
                reason: {
                  type: 'string',
                  description: 'Reason for the state change',
                },
              },
              required: ['id'],
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
                  type: 'string',
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
                  type: 'string',
                  description: 'The ID of the test case',
                },
                userStoryId: {
                  type: 'string',
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
                  type: 'string',
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
                  type: 'string',
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
                  type: 'string',
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
                  type: 'string',
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
            name: 'reply_to_pull_request_comment',
            description: 'Reply to an existing comment in a pull request thread',
            inputSchema: {
              type: 'object',
              properties: {
                repositoryId: {
                  type: 'string',
                  description: 'The ID of the repository',
                },
                pullRequestId: {
                  type: 'string',
                  description: 'The ID of the pull request',
                },
                parentCommentId: {
                  type: 'string',
                  description: 'The ID of the comment to reply to',
                },
                reply: {
                  type: 'string',
                  description: 'The reply text',
                },
              },
              required: ['repositoryId', 'pullRequestId', 'parentCommentId', 'reply'],
            },
          },
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
                  type: 'string',
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
          },          {
            name: 'test_connection',
            description: 'Test the connection to Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'add_work_item_comment',
            description: 'Add a comment to a work item (bug, user story, task, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'string',
                  description: 'The ID of the work item to comment on',
                },
                comment: {
                  type: 'string',
                  description: 'The comment text to add',
                },
              },
              required: ['workItemId', 'comment'],
            },
          },
          {
            name: 'get_work_item_comments',
            description: 'Get comments for a work item',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'string',
                  description: 'The ID of the work item to get comments for',
                },
                top: {
                  type: 'number',
                  description: 'Maximum number of comments to retrieve',
                },
                includeDeleted: {
                  type: 'boolean',
                  description: 'Whether to include deleted comments',
                },
                expand: {
                  type: 'string',
                  description: 'What additional data to include (reactions, mentions, etc.)',
                },
              },
              required: ['workItemId'],
            },
          },
          {
            name: 'update_work_item_comment',
            description: 'Update an existing work item comment',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'string',
                  description: 'The ID of the work item',
                },
                commentId: {
                  type: 'string',
                  description: 'The ID of the comment to update',
                },
                text: {
                  type: 'string',
                  description: 'The new comment text',
                },
              },
              required: ['workItemId', 'commentId', 'text'],
            },
          },
          {
            name: 'delete_work_item_comment',
            description: 'Delete a work item comment',
            inputSchema: {
              type: 'object',
              properties: {
                workItemId: {
                  type: 'string',
                  description: 'The ID of the work item',
                },
                commentId: {
                  type: 'string',
                  description: 'The ID of the comment to delete',
                },
              },
              required: ['workItemId', 'commentId'],
            },
          },
          {
            name: 'analyze_code_review_comments',
            description: 'Analyze code review comments in a pull request and generate fix suggestions',
            inputSchema: {
              type: 'object',
              properties: {
                pullRequestUrl: {
                  type: 'string',
                  description: 'The full Azure DevOps pull request URL (e.g., https://dev.azure.com/org/project/_git/repo/pullrequest/123)',
                },
              },
              required: ['pullRequestUrl'],
            },
          },
          {
            name: 'delete_test_case',
            description: 'Delete a test case permanently from Azure DevOps',
            inputSchema: {
              type: 'object',
              properties: {
                testCaseId: {
                  type: 'string',
                  description: 'The ID of the test case to delete',
                },
              },
              required: ['testCaseId'],
            },
          },
          {
            name: 'remove_test_case_from_user_story',
            description: 'Remove the association between a test case and a user story',
            inputSchema: {
              type: 'object',
              properties: {
                testCaseId: {
                  type: 'string',
                  description: 'The ID of the test case to disassociate',
                },
                userStoryId: {
                  type: 'string',
                  description: 'The ID of the user story to disassociate from',
                },
              },
              required: ['testCaseId', 'userStoryId'],
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
            return await this.searchWorkItems(args);          case 'create_bug':
            return await this.createBug(args);
          case 'update_bug':
            return await this.updateBug(args);
          case 'create_task':
            return await this.createTask(args);
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
          case 'reply_to_pull_request_comment':
            return await this.replyToPullRequestComment(args);
          case 'test_connection':
            return await this.testConnection(args);
          case 'add_work_item_comment':
            return await this.addWorkItemComment(args);
          case 'get_work_item_comments':
            return await this.getWorkItemComments(args);
          case 'update_work_item_comment':
            return await this.updateWorkItemComment(args);
          case 'delete_work_item_comment':
            return await this.deleteWorkItemComment(args);
          case 'analyze_code_review_comments':
            return await this.analyzeCodeReviewComments(args);
          case 'delete_test_case':
            return await this.deleteTestCase(args);
          case 'remove_test_case_from_user_story':
            return await this.removeTestCaseFromUserStory(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        console.error(`Error calling tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Error calling tool ${name}: ${error.message}`
        );
      }
    });
  }

  /**
   * Validates and converts a parameter that can be either a number or string to the appropriate type
   * @param {*} value - The value to validate and convert
   * @param {string} paramName - The name of the parameter for error messages
   * @param {string} expectedType - The expected type ('number' or 'string')
   * @returns {number|string} - The validated and converted value
   * @throws {Error} - If the value is invalid
   */
  validateParameter(value, paramName, expectedType = 'number') {
    if (value === null || value === undefined) {
      throw new Error(`Parameter '${paramName}' is required`);
    }

    if (expectedType === 'number') {
      // Convert to number if it's a string that represents a number
      const numericValue = typeof value === 'string' ? parseInt(value, 10) : value;
      if (isNaN(numericValue) || !Number.isInteger(numericValue)) {
        throw new Error(`Parameter '${paramName}' must be a valid integer, got: ${value}`);
      }
      return numericValue;
    } else if (expectedType === 'string') {
      // Convert to string if it's a number
      return String(value);
    }

    throw new Error(`Unsupported expected type: ${expectedType}`);
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

      // Initialize code review manager
      this.codeReviewManager = new CodeReviewManager(this.azureDevOps.webApi, config.project);
      await this.codeReviewManager.initialize();
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
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    
    // Convert newlines to HTML <br> tags for proper rendering in Azure DevOps
    if (updates.description) {
      updates.description = updates.description.replace(/\n/g, '<br>');
    }
    if (updates.acceptanceCriteria) {
      updates.acceptanceCriteria = updates.acceptanceCriteria.replace(/\n/g, '<br>');
    }
    
    // Pass the updates with HTML formatting to the work item manager
    const updatedStory = await this.azureDevOps.updateUserStory(validatedWorkItemId, updates);
    
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
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    
    const userStory = await this.azureDevOps.getWorkItem(validatedWorkItemId);
    
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
    
    // Validate parameters
    const validatedUserStoryId = this.validateParameter(userStoryId, 'userStoryId', 'number');
    const validatedFeatureId = this.validateParameter(featureId, 'featureId', 'number');
    
    await this.azureDevOps.linkUserStoryToFeature(validatedUserStoryId, validatedFeatureId);
    
    return {
              content: [
          {
            type: 'text',
            text: `Successfully linked user story #${validatedUserStoryId} to feature #${validatedFeatureId}`,
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
    
    // Validate required parameters
    if (!title || typeof title !== 'string') {
      throw new Error('Parameter \'title\' is required and must be a string');
    }
    if (!description || typeof description !== 'string') {
      throw new Error('Parameter \'description\' is required and must be a string');
    }
    
    const options = {};
    if (parentId !== undefined && parentId !== null) {
      options.parentId = this.validateParameter(parentId, 'parentId', 'number');
    }
    if (assignedTo) {
      options.assignedTo = assignedTo;
    }
    if (originalEstimate !== undefined && originalEstimate !== null) {
      options.originalEstimate = this.validateParameter(originalEstimate, 'originalEstimate', 'number');
    }
    if (activity && typeof activity === 'string') {
      options.activity = activity;
    }
    if (priority !== undefined && priority !== null) {
      options.priority = this.validateParameter(priority, 'priority', 'number');
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
    
    // Validate parameters
    const validatedTestCaseId = this.validateParameter(testCaseId, 'testCaseId', 'number');
    
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

    const updatedTestCase = await this.azureDevOps.updateTestCase(validatedTestCaseId, updates);
    
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
    
    // Validate parameters
    const validatedTestCaseId = this.validateParameter(testCaseId, 'testCaseId', 'number');
    const validatedUserStoryId = this.validateParameter(userStoryId, 'userStoryId', 'number');
    
    await this.azureDevOps.associateTestCaseWithUserStory(validatedTestCaseId, validatedUserStoryId);
    
    return {
              content: [
          {
            type: 'text',
            text: `Successfully associated test case #${validatedTestCaseId} with user story #${validatedUserStoryId}`,
          },
        ],
    };
  }

  async getTestCase(args) {
    const { testCaseId } = args;
    
    // Validate parameters
    const validatedTestCaseId = this.validateParameter(testCaseId, 'testCaseId', 'number');
    
    const testCase = await this.azureDevOps.getTestCase(validatedTestCaseId);
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
    
    // Validate parameters
    const validatedPullRequestId = this.validateParameter(pullRequestId, 'pullRequestId', 'number');
    
    if (!repositoryId || typeof repositoryId !== 'string') {
      throw new Error('Parameter \'repositoryId\' is required and must be a string');
    }
    
    const pr = await this.azureDevOps.getPullRequest(repositoryId, validatedPullRequestId, includeDetails);
    
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
    
    // Validate parameters
    const validatedPullRequestId = this.validateParameter(pullRequestId, 'pullRequestId', 'number');
    
    if (!repositoryId || typeof repositoryId !== 'string') {
      throw new Error('Parameter \'repositoryId\' is required and must be a string');
    }
    
    const comments = await this.azureDevOps.getPullRequestComments(repositoryId, validatedPullRequestId);
    
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
    
    // Validate parameters
    const validatedPullRequestId = this.validateParameter(pullRequestId, 'pullRequestId', 'number');
    
    if (!repositoryId || typeof repositoryId !== 'string') {
      throw new Error('Parameter \'repositoryId\' is required and must be a string');
    }
    
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Parameter \'filePath\' is required and must be a string');
    }
    
    if (!comment || typeof comment !== 'string') {
      throw new Error('Parameter \'comment\' is required and must be a string');
    }
    
    // Line parameter is optional, but if provided should be a number
    let validatedLine = null;
    if (line !== undefined && line !== null) {
      validatedLine = this.validateParameter(line, 'line', 'number');
    }
    
    const result = await this.azureDevOps.addFileComment(repositoryId, validatedPullRequestId, filePath, comment, validatedLine);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully added comment to file ${filePath} in pull request #${validatedPullRequestId}`,
        },
      ],
    };
  }

  async replyToPullRequestComment(args) {
    const { repositoryId, pullRequestId, parentCommentId, reply } = args;
    
    // Validate parameters
    const validatedPullRequestId = this.validateParameter(pullRequestId, 'pullRequestId', 'number');
    const validatedParentCommentId = this.validateParameter(parentCommentId, 'parentCommentId', 'number');
    
    if (!repositoryId || typeof repositoryId !== 'string') {
      throw new Error('Parameter \'repositoryId\' is required and must be a string');
    }
    
    if (!reply || typeof reply !== 'string') {
      throw new Error('Parameter \'reply\' is required and must be a string');
    }
    
    const result = await this.azureDevOps.replyToComment(repositoryId, validatedPullRequestId, validatedParentCommentId, reply);
    
    return {
      content: [
        {
          type: 'text',
          text: `Successfully replied to comment ${validatedParentCommentId} in pull request #${validatedPullRequestId}. Reply ID: ${result.commentId}`,
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

  async addWorkItemComment(args) {
    const { workItemId, comment } = args;
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    
    if (!comment || typeof comment !== 'string') {
      throw new Error('Parameter \'comment\' is required and must be a string');
    }
    
    const result = await this.azureDevOps.addWorkItemComment(validatedWorkItemId, comment);
    
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Successfully added comment to work item #${validatedWorkItemId}`,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async getWorkItemComments(args) {
    const { workItemId, top, includeDeleted, expand } = args;
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    
    const options = {};
    
    if (top !== undefined && top !== null) {
      options.top = this.validateParameter(top, 'top', 'number');
    }
    if (includeDeleted !== undefined) {
      options.includeDeleted = Boolean(includeDeleted);
    }
    if (expand !== undefined && expand !== null) {
      if (typeof expand !== 'string') {
        throw new Error('Parameter \'expand\' must be a string');
      }
      options.expand = expand;
    }
    
    const result = await this.azureDevOps.getWorkItemComments(validatedWorkItemId, options);
    
          if (result.success) {
        const comments = result.comments.comments || [];
        let responseText = `Work Item #${validatedWorkItemId} Comments (${result.count} total):\n\n`;
      
      if (comments.length === 0) {
        responseText += 'No comments found.';
      } else {
        comments.forEach((comment, index) => {
          responseText += `Comment #${comment.id} by ${comment.createdBy.displayName}\n`;
          responseText += `Created: ${new Date(comment.createdDate).toLocaleString()}\n`;
          responseText += `${comment.text}\n`;
          if (index < comments.length - 1) responseText += '\n---\n\n';
        });
      }
      
      return {
        content: [
          {
            type: 'text',
            text: responseText,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async updateWorkItemComment(args) {
    const { workItemId, commentId, text } = args;
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    const validatedCommentId = this.validateParameter(commentId, 'commentId', 'number');
    
    if (!text || typeof text !== 'string') {
      throw new Error('Parameter \'text\' is required and must be a string');
    }
    
    const result = await this.azureDevOps.updateWorkItemComment(validatedWorkItemId, validatedCommentId, text);
    
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Successfully updated comment #${validatedCommentId} on work item #${validatedWorkItemId}`,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async deleteWorkItemComment(args) {
    const { workItemId, commentId } = args;
    
    // Validate parameters
    const validatedWorkItemId = this.validateParameter(workItemId, 'workItemId', 'number');
    const validatedCommentId = this.validateParameter(commentId, 'commentId', 'number');
    
    const result = await this.azureDevOps.deleteWorkItemComment(validatedWorkItemId, validatedCommentId);
    
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted comment #${validatedCommentId} from work item #${validatedWorkItemId}`,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async analyzeCodeReviewComments(args) {
    try {
      const { pullRequestUrl } = args;
      
      // Validate parameters
      if (!pullRequestUrl || typeof pullRequestUrl !== 'string') {
        throw new Error('Parameter \'pullRequestUrl\' is required and must be a string');
      }
      
      // Validate URL format
      if (!pullRequestUrl.includes('dev.azure.com') || !pullRequestUrl.includes('pullrequest')) {
        throw new Error('pullRequestUrl must be a valid Azure DevOps pull request URL (e.g., https://dev.azure.com/org/project/_git/repo/pullrequest/123)');
      }

              // Progress logging suppressed for MCP mode

      const analysis = await this.codeReviewManager.analyzeCodeReviewComments(pullRequestUrl);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(analysis, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error(`❌ Failed to analyze code review comments:`, error.message);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to analyze code review comments: ${error.message}`
      );
    }
  }

  async deleteTestCase(args) {
    const { testCaseId } = args;
    
    // Validate parameters
    const validatedTestCaseId = this.validateParameter(testCaseId, 'testCaseId', 'number');
    
    const result = await this.azureDevOps.deleteTestCase(validatedTestCaseId);
    
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted test case #${validatedTestCaseId}: "${result.title}"`,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async removeTestCaseFromUserStory(args) {
    const { testCaseId, userStoryId } = args;
    
    // Validate parameters
    const validatedTestCaseId = this.validateParameter(testCaseId, 'testCaseId', 'number');
    const validatedUserStoryId = this.validateParameter(userStoryId, 'userStoryId', 'number');
    
    const result = await this.azureDevOps.removeTestCaseFromUserStory(validatedTestCaseId, validatedUserStoryId);
    
    if (result.success) {
      return {
        content: [
          {
            type: 'text',
            text: `Successfully removed association between test case #${validatedTestCaseId} "${result.testCaseTitle}" and user story #${validatedUserStoryId} "${result.userStoryTitle}"`,
          },
        ],
      };
    } else {
      throw new Error(result.error);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    // Server status logging suppressed for MCP mode to prevent popups
  }
}

const server = new AzureDevOpsMCPServer();
server.run().catch(console.error);
