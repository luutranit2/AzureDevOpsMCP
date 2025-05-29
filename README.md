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
git clone <repository-url>
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
