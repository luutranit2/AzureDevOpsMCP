# AzureDevOpsMCP

This project is a Node.js application that integrates with Azure DevOps.

## Project Structure

- \`index.js\`: Main entry point of the application.
- \`package.json\`: Defines project dependencies and scripts.
- \`docs/\`: Contains documentation for the project.
- \`public/\`: Contains public assets, like \`index.html\`.
- \`src/\`: Contains the source code for the application.
  - \`server.js\`: Main server logic.
  - \`web-server.js\`: Web server specific logic.
  - \`modules/\`: Contains different modules for functionalities like authentication, Azure DevOps integration, pull request management, test case management, and work item management.
  - \`utils/\`: Contains helper functions.
- \`tests/\`: Contains tests for the application.

## Getting Started

To get started with this project, clone the repository and install the dependencies:

```bash
git clone https://github.com/luutranit2/AzureDevOpsMCP.git
cd AzureDevOpsMCP
npm install
```

To run the application:

```bash
npm start
```

To run the tests:

```bash
npm test
```

## MCP Integration

This project is optimized for use with Claude Desktop and other MCP clients. When running as an MCP server:

- **Logging**: Automatically detects MCP mode and suppresses verbose console output to prevent notification popups
- **Environment Variables**: 
  - `AZURE_DEVOPS_LOG_LEVEL`: Controls logging verbosity (0=silent, 1=errors only, 2=warnings+errors, 3=info+warnings+errors, 4=debug+all)
  - `MCP_SERVER_MODE`: Set to 'true' to force MCP mode for testing
- **Performance**: Optimized for minimal console noise while maintaining error reporting

## Features

### 🎯 Work Item Management
- Create and update user stories, bugs, and tasks
- Link work items and manage relationships
- Search work items using WIQL queries
- Comprehensive comment management for all work item types

### 🧪 Test Case Management
- Create and update test cases with detailed steps
- Associate test cases with user stories
- Manage automation status and test execution

### 🔄 Pull Request Management
- Retrieve pull request details and metadata
- Manage pull request comments and threads
- **Reply to existing comment threads** ✨ NEW
- Access commit history and linked work items

### 🔍 Code Review Analysis ✨ NEW
- **Analyze code review comments and generate actionable fix suggestions**
- **Categorize issues by type (Bug, Security, Performance, etc.) and severity**
- **Provide effort estimates and prioritized action items**
- **Support for Azure DevOps pull request URLs**
- **Comprehensive reporting with recommendations**

### 🔧 System Operations
- Test Azure DevOps connectivity
- Robust error handling and retry mechanisms
- Secure authentication management

## Quick Start

### Code Review Analysis
The most powerful new feature helps you quickly understand and fix code review feedback:

```bash
# Test the new code review analysis feature
node test-code-review-analysis.js "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
```

This will:
- Parse the pull request URL and retrieve all comments
- Analyze comments to identify actionable issues
- Categorize issues by type and severity
- Generate specific fix suggestions with effort estimates
- Provide prioritized action items and recommendations

### MCP Usage
Use the new MCP tool to analyze code review comments:

```json
{
  "tool": "analyze_code_review_comments",
  "parameters": {
    "pullRequestUrl": "https://dev.azure.com/org/project/_git/repo/pullrequest/123"
  }
}
```

Perfect for requests like: *"Please help to fix all code review comments in this PR@https://dev.azure.com/org/project/_git/repo/pullrequest/123"*

## Use Cases

### For Developers
- **Code Review Assistance**: Get structured guidance on addressing reviewer feedback
- **Priority Management**: Understand which issues need immediate attention
- **Learning**: Get educational resources for improving code quality
- **Time Estimation**: Plan work based on effort estimates for each issue

### For Teams
- **Code Quality**: Systematically track and address technical debt
- **Process Improvement**: Identify common review patterns and areas for team training
- **Productivity**: Streamline the code review resolution process
- **Compliance**: Ensure security and critical issues are addressed first

### For Managers
- **Visibility**: Track code review feedback trends and resolution times
- **Resource Planning**: Understand effort required for code quality improvements
- **Team Development**: Identify training opportunities based on common issues
- **Quality Metrics**: Monitor code review effectiveness and outcomes
