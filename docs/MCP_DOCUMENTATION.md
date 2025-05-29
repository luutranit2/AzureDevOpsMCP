# Azure DevOps MCP Server - Comprehensive Documentation

## Overview

The Azure DevOps MCP (Model Context Protocol) Server is a Node.js application that provides seamless integration with Azure DevOps services. It allows AI assistants and other MCP clients to interact with Azure DevOps to manage work items, test cases, pull requests, and more.

## Features

### 🎯 Work Item Management
- Create and update user stories
- Link user stories to features
- Search work items using WIQL queries
- Get detailed work item information
- Create tasks with parent-child relationships

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
- Access commit history and work item associations

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
Links a user story to a feature as parent-child relationship.

**Parameters:**
- `userStoryId` (required): The ID of the user story
- `featureId` (required): The ID of the feature to link to

#### `search_work_items`
Searches for work items using WIQL (Work Item Query Language).

**Parameters:**
- `wiql` (required): WIQL query string

**Example WIQL:**
```sql
SELECT [System.Id], [System.Title], [System.State] 
FROM WorkItems 
WHERE [System.WorkItemType] = 'User Story' 
AND [System.State] = 'Active'
```

#### `create_task`
Creates a new task, optionally linked to a parent work item.

**Parameters:**
- `title` (required): The title of the task
- `description` (required): The description of the task
- `parentId` (optional): The ID of the parent work item
- `assignedTo` (optional): Email or display name of assignee
- `priority` (optional): Priority level (1-4)
- `originalEstimate` (optional): Original estimate in hours
- `activity` (optional): Activity type (Development, Testing, Design, etc.)

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
- `pullRequestId` (required): The ID of the pull request
- `includeDetails` (optional): Include detailed information (commits, work items) - default: true

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
- `pullRequestId` (required): The ID of the pull request

#### `add_pull_request_comment`
Adds a comment to a pull request file.

**Parameters:**
- `repositoryId` (required): The ID of the repository
- `pullRequestId` (required): The ID of the pull request
- `filePath` (required): Path to the file to comment on
- `comment` (required): The comment text
- `line` (optional): Line number for the comment

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
git clone <repository-url>
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
- Create an issue in the GitHub repository
- Check the troubleshooting section
- Review Azure DevOps documentation for API-specific questions
