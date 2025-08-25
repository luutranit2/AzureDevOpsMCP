# Azure DevOps MCP Server - Comprehensive Documentation

## Overview

The Azure DevOps MCP (Model Context Protocol) Server is a Node.js application that provides seamless integration with Azure DevOps services. It allows AI assistants and other MCP clients to interact with Azure DevOps to manage work items, test cases, pull requests, and more.

## Features

### 🎯 Work Item Management
- Create and update user stories
- Create and update bugs with comprehensive tracking
- Create tasks with parent-child relationships
- Link user stories to features
- Search work items using WIQL queries
- Get detailed work item information
- Priority and severity management for bugs
- Steps to reproduce and system information tracking
- **Add, retrieve, update, and delete work item comments**
- **Full comment thread management for all work item types**

### 🧪 Test Case Management
- Create and update test cases
- Associate test cases with user stories
- Define test steps with actions and expected results
- Manage automation status
- Retrieve test case details

### 🔄 Pull Request Management
- Retrieve pull request details and metadata
- Get pull request comments and threads
- Add comments to pull requests
- **Reply to existing comment threads** ✨ NEW
- Access commit history and work item associations

### 🔍 Code Review Analysis
- **Analyze code review comments in pull requests**
- **Generate actionable fix suggestions**
- **Categorize issues by type and severity**
- **Provide effort estimates and action items**
- **Track common issues and patterns**
- **Support for Azure DevOps pull request URLs**

### 🔧 System Operations
- Test Azure DevOps connection
- Error handling and retry mechanisms
- Authentication management

## Architecture

```
Azure DevOps MCP Server
├── src/
│   ├── server.js                    # Main MCP server implementation
│   ├── web-server.js               # Web interface (optional)
│   ├── modules/
│   │   ├── azureDevOpsIntegration.js # Core Azure DevOps integration
│   │   ├── workItemManager.js       # Work item operations
│   │   ├── testCaseManager.js       # Test case operations
│   │   ├── pullRequestManager.js    # Pull request operations
│   │   ├── codeReviewManager.js     # Code review analysis
│   │   └── auth.js                  # Authentication handling
│   └── utils/
│       └── helpers.js               # Utility functions
├── tests/                           # Comprehensive test suite
└── docs/                           # Documentation
```

## Available Tools

### Work Item Tools

#### `create_user_story`
Creates a new user story in Azure DevOps.

**Parameters:**
- `title` (required): The title of the user story
- `description` (required): The description of the user story
- `acceptanceCriteria` (optional): Acceptance criteria for the story
- `priority` (optional): Priority level (1-4)
- `storyPoints` (optional): Story points estimate
- `tags` (optional): Comma-separated tags

**Example Response:**
```json
{
  "id": 123,
  "title": "User Login Feature",
  "workItemType": "User Story",
  "state": "New",
  "url": "https://dev.azure.com/org/project/_workitems/edit/123"
}
```

#### `update_user_story`
Updates an existing user story.

**Parameters:**
- `workItemId` (required): The ID of the user story to update
- `title` (optional): New title
- `description` (optional): New description
- `acceptanceCriteria` (optional): New acceptance criteria
- `priority` (optional): New priority level (1-4)
- `storyPoints` (optional): New story points estimate
- `state` (optional): New state (New, Active, Resolved, Closed, etc.)

#### `get_user_story`
Retrieves details of a specific user story.

**Parameters:**
- `workItemId` (required): The ID of the user story to retrieve

#### `link_user_story_to_feature`
Links a user story to a feature as a parent-child relationship.

**Parameters:**
- `userStoryId` (required): The ID of the user story
- `featureId` (required): The ID of the feature to link to

### Work Item Comment Tools

#### `add_work_item_comment`
Adds a comment to any work item (bug, user story, task, etc.).

**Parameters:**
- `workItemId` (required): The ID of the work item to comment on
- `comment` (required): The comment text to add

**Example:**
```json
{
  "workItemId": 123,
  "comment": "This issue has been investigated and a fix is in progress."
}
```

**Response:**
```json
{
  "success": true,
  "comment": {
    "id": 456,
    "text": "This issue has been investigated and a fix is in progress.",
    "createdBy": "user@example.com",
    "createdDate": "2024-01-15T10:30:00Z"
  }
}
```

#### `get_work_item_comments`
Retrieves all comments for a work item.

**Parameters:**
- `workItemId` (required): The ID of the work item to get comments for
- `top` (optional): Maximum number of comments to retrieve
- `includeDeleted` (optional): Whether to include deleted comments
- `expand` (optional): What additional data to include (reactions, mentions, etc.)

**Example:**
```json
{
  "workItemId": 123,
  "top": 10,
  "includeDeleted": false
}
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "comments": [
    {
      "id": 456,
      "text": "This is the latest comment",
      "createdBy": {
        "displayName": "John Doe",
        "email": "john@example.com"
      },
      "createdDate": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### `update_work_item_comment`
Updates an existing work item comment.

**Parameters:**
- `workItemId` (required): The ID of the work item
- `commentId` (required): The ID of the comment to update
- `text` (required): The new comment text

**Example:**
```json
{
  "workItemId": 123,
  "commentId": 456,
  "text": "Updated comment text with additional information."
}
```

#### `delete_work_item_comment`
Deletes a work item comment.

**Parameters:**
- `workItemId` (required): The ID of the work item
- `commentId` (required): The ID of the comment to delete

**Example:**
```json
{
  "workItemId": 123,
  "commentId": 456
}
```

### Test Case Tools

#### `create_test_case`
Creates a new test case in Azure DevOps.

**Parameters:**
- `title` (required): The title of the test case
- `description` (required): The description of the test case
- `steps` (optional): Array of test steps with action and expected result
- `priority` (optional): Priority level (1-4)
- `automationStatus` (optional): Automation status (Not Automated, Planned, Automated)

**Example Steps Format:**
```json
[
  {
    "action": "Navigate to login page",
    "expectedResult": "Login page is displayed"
  },
  {
    "action": "Enter valid credentials",
    "expectedResult": "User is logged in successfully"
  }
]
```

#### `associate_test_case_with_user_story`
Associates a test case with a user story.

**Parameters:**
- `testCaseId` (required): The ID of the test case
- `userStoryId` (required): The ID of the user story

#### `get_test_case`
Retrieves details of a specific test case.

**Parameters:**
- `testCaseId` (required): The ID of the test case to retrieve

### Pull Request Tools

#### `get_pull_request`
Retrieves detailed information about a pull request.

**Parameters:**
- `repositoryId` (required): The ID of the repository
- `pullRequestId` (required): The ID of the pull request (accepts both number and string types)
- `includeDetails` (optional): Include detailed information (commits, work items) - default: true

**Note:** The `pullRequestId` parameter accepts both number and string types for flexibility, but is automatically converted to a number internally as required by the Azure DevOps API.

**Response includes:**
- Pull request metadata (title, description, status)
- Source and target branches
- Reviewer information
- Associated commits
- Linked work items
- Completion status

#### `get_pull_request_comments`
Retrieves comments from a pull request.

**Parameters:**
- `repositoryId` (required): The ID of the repository
- `pullRequestId` (required): The ID of the pull request (accepts both number and string types)

**Note:** The `pullRequestId` parameter accepts both number and string types for flexibility, but is automatically converted to a number internally as required by the Azure DevOps API.

#### `add_pull_request_comment`
Adds a comment to a pull request file.

**Parameters:**
- `repositoryId` (required): The ID of the repository
- `pullRequestId` (required): The ID of the pull request (accepts both number and string types)
- `filePath` (required): Path to the file to comment on
- `comment` (required): The comment text
- `line` (optional): Line number for the comment

**Note:** The `pullRequestId` parameter accepts both number and string types for flexibility, but is automatically converted to a number internally as required by the Azure DevOps API.

#### `reply_to_pull_request_comment`
Replies to an existing comment in a pull request thread, maintaining conversation flow.

**Parameters:**
- `repositoryId` (required): The ID of the repository
- `pullRequestId` (required): The ID of the pull request (accepts both number and string types)
- `parentCommentId` (required): The ID of the comment to reply to (accepts both number and string types)
- `reply` (required): The reply text

**Note:** Both `pullRequestId` and `parentCommentId` parameters accept both number and string types for flexibility, but are automatically converted to numbers internally as required by the Azure DevOps API.

**Example Usage:**
```javascript
// Reply to a code review comment
const result = await reply_to_pull_request_comment({
  repositoryId: '5d794f1b-8665-4880-93a3-7b23e129814e',
  pullRequestId: '123',
  parentCommentId: '456',
  reply: 'Thanks for the feedback! I will address this in the next iteration.'
});

console.log('Reply ID:', result.commentId);
console.log('Thread ID:', result.threadId);
```

### Code Review Analysis Tools

#### `analyze_code_review_comments`
Analyzes code review comments in an Azure DevOps pull request and generates actionable fix suggestions.

**Parameters:**
- `pullRequestUrl` (required): The full Azure DevOps pull request URL

**Example Usage:**
```javascript
// Analyze code review comments
const analysis = await analyze_code_review_comments({
  pullRequestUrl: 'https://dev.azure.com/org/project/_git/repo/pullrequest/123'
});

console.log('Fix suggestions:', analysis.fixSuggestions);
console.log('Priority items:', analysis.summary.priorityItems);
```

**Response Structure:**
```json
{
  "pullRequest": {
    "id": 123,
    "title": "Feature implementation",
    "url": "https://dev.azure.com/org/project/_git/repo/pullrequest/123",
    "repository": "repo-name",
    "status": "Active"
  },
  "analysis": {
    "totalThreads": 5,
    "activeThreads": 3,
    "actionableComments": 7,
    "commentsByFile": {
      "src/component.js": [/* comments */],
      "src/utils.js": [/* comments */]
    },
    "commonIssues": {
      "Code Quality": 3,
      "Bug": 2,
      "Security": 1
    }
  },
  "fixSuggestions": [
    {
      "commentId": 456,
      "threadId": 789,
      "filePath": "src/component.js",
      "line": 42,
      "issueType": "Code Quality",
      "severity": "Medium",
      "originalComment": "This function is too complex...",
      "author": "John Doe",
      "suggestion": "Consider refactoring this code to improve readability...",
      "actionItems": [
        "Review and understand the feedback",
        "Implement the suggested changes",
        "Test the changes thoroughly"
      ],
      "estimatedEffort": "Medium (2-4 hours)",
      "resources": [
        {
          "title": "Clean Code Principles",
          "url": "https://clean-code-developer.com/"
        }
      ]
    }
  ],
  "summary": {
    "overview": "Found 7 actionable comments across 2 files",
    "severityBreakdown": {
      "High": 1,
      "Medium": 4,
      "Low": 2
    },
    "mostCommonIssue": "Code Quality",
    "estimatedTotalTime": "8.5 hours",
    "priorityItems": [
      "Security in src/auth.js (line 15)"
    ],
    "recommendations": [
      "Address 1 high-priority issues first",
      "Security issues require immediate attention (1 found)",
      "Run automated tests after each fix to ensure no regressions"
    ]
  }
}
```

**Features:**
- **Automatic URL parsing**: Extracts organization, project, repository, and PR ID from Azure DevOps URLs
- **Smart comment analysis**: Identifies actionable comments vs. informational/positive feedback
- **Issue categorization**: Categorizes issues into types (Bug, Security, Performance, Code Quality, etc.)
- **Severity assessment**: Evaluates severity levels (High, Medium, Low) based on content analysis
- **Fix suggestions**: Generates specific, actionable suggestions for each comment
- **Effort estimation**: Provides time estimates for addressing each issue
- **Priority ranking**: Identifies high-priority items that need immediate attention
- **Resource recommendations**: Suggests relevant learning resources for each issue type
- **Comprehensive reporting**: Provides detailed analysis with actionable insights

**Use Cases:**
- **Automated code review assistance**: Help developers understand and prioritize reviewer feedback
- **Technical debt tracking**: Identify and categorize technical debt from code reviews
- **Team productivity**: Streamline the code review process with structured feedback
- **Quality assurance**: Ensure important issues are addressed before merging
- **Developer coaching**: Provide learning resources and best practices for common issues

**Example Request:**
```json
{
  "pullRequestUrl": "https://dev.azure.com/d2odevops/PMI/_git/PMI/pullrequest/10710"
}
```

This tool is perfect for the user's request: "Please help to fix all code review comments in this PR@https://dev.azure.com/d2odevops/PMI/_git/PMI/pullrequest/10710"

### System Tools

#### `test_connection`
Tests the connection to Azure DevOps and validates configuration.

**No parameters required.**

**Response includes:**
- Connection status
- Organization and project information
- Available APIs
- User permissions

## Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Azure DevOps Configuration
AZURE_DEVOPS_ORG_URL=https://dev.azure.com/your-organization
AZURE_DEVOPS_TOKEN=your-personal-access-token
AZURE_DEVOPS_PROJECT=your-project-name

# Optional: Web Server Configuration
WEB_PORT=3000
WEB_HOST=localhost

# Optional: Logging Configuration
LOG_LEVEL=info
```

### Azure DevOps Personal Access Token

1. Go to Azure DevOps → User Settings → Personal Access Tokens
2. Create a new token with the following scopes:
   - **Work Items**: Read & Write
   - **Code**: Read (for pull requests)
   - **Test Management**: Read & Write (for test cases)
   - **Build**: Read (optional)
   - **Release**: Read (optional)

## Installation & Setup

### Prerequisites
- Node.js 18+ 
- Azure DevOps organization and project
- Personal Access Token with appropriate permissions

### Installation Steps

1. **Clone the repository:**
```bash
git clone https://github.com/luutranit2/AzureDevOpsMCP.git
cd AzureDevOpsMCP
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Azure DevOps details
```

4. **Test the connection:**
```bash
npm run test-connection
```

5. **Start the MCP server:**
```bash
npm start
```

## Usage Examples

### Creating a User Story
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "create_user_story",
    "arguments": {
      "title": "Implement user authentication",
      "description": "As a user, I want to log in securely so that I can access my account",
      "acceptanceCriteria": "- User can enter username and password\n- System validates credentials\n- User is redirected to dashboard on success",
      "priority": 2,
      "storyPoints": 5,
      "tags": "authentication, security, login"
    }
  }
}
```

### Searching Work Items
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "search_work_items",
    "arguments": {
      "wiql": "SELECT [System.Id], [System.Title], [System.State] FROM WorkItems WHERE [System.WorkItemType] = 'User Story' AND [System.State] = 'Active' ORDER BY [System.CreatedDate] DESC"
    }
  }
}
```

### Creating a Test Case
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "create_test_case",
    "arguments": {
      "title": "Login functionality test",
      "description": "Test the user login process with valid credentials",
      "steps": [
        {
          "action": "Navigate to the login page",
          "expectedResult": "Login form is displayed with username and password fields"
        },
        {
          "action": "Enter valid username and password",
          "expectedResult": "Credentials are accepted without validation errors"
        },
        {
          "action": "Click the login button",
          "expectedResult": "User is successfully logged in and redirected to dashboard"
        }
      ],
      "priority": 2,
      "automationStatus": "Planned"
    }
  }
}
```

## Error Handling

The MCP server includes comprehensive error handling:

- **Connection Errors**: Automatic retry with exponential backoff
- **Authentication Errors**: Clear error messages for token issues
- **Validation Errors**: Detailed parameter validation
- **Rate Limiting**: Built-in request throttling
- **Network Timeouts**: Configurable timeout handling

## Development

### Running Tests
```bash
# Run all tests
npm test

# Run specific test modules
node tests/workItem-test.js
node tests/testCase-test.js
node tests/pullRequest-test.js
```

### Development Mode
```bash
# Start with auto-reload
npm run dev

# Start web interface in development
npm run dev-web
```

### Code Quality
```bash
# Run linting
npm run lint

# Format code
npm run format
```

## Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Verify your Personal Access Token is valid
   - Check token permissions include required scopes
   - Ensure organization URL is correct

2. **Project Not Found**
   - Verify project name in environment variables
   - Check if user has access to the specified project

3. **Connection Timeout**
   - Check network connectivity to Azure DevOps
   - Verify firewall settings allow outbound HTTPS

4. **Permission Denied**
   - Ensure token has appropriate permissions for the operation
   - Check if user is member of the project

### Debug Mode

Enable debug logging by setting:
```env
LOG_LEVEL=debug
```

## API Reference

For detailed API documentation of each tool, refer to the [API Reference](docs/api-reference.md).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run the test suite
6. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and questions:
- Create an issue in the [GitHub repository](https://github.com/luutranit2/AzureDevOpsMCP/issues)
- Check the troubleshooting section
- Review Azure DevOps documentation for API-specific questions
