/**
 * Azure DevOps HTTP Web Server
 * 
 * @file web-server.js - HTTP REST API wrapper for Azure DevOps MCP functionality
 * @description This module provides an HTTP/REST interface to the Azure DevOps MCP
 * integration, allowing web applications and HTTP clients to interact with Azure DevOps
 * services without needing to implement the MCP protocol directly. It includes a web
 * interface for testing and demonstration purposes.
 * 
 * Features:
 * - RESTful API endpoints for all Azure DevOps operations
 * - Web-based testing interface
 * - CORS support for cross-origin requests
 * - Request logging and error handling
 * - Static file serving for the web interface
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires express - Web server framework
 * @requires cors - Cross-Origin Resource Sharing middleware
 * @requires ../index.js - Azure DevOps integration module
 * @requires dotenv - Environment variable management
 * 
 * @example
 * // Start the web server
 * node src/web-server.js
 * 
 * // Access the web interface
 * http://localhost:3000
 * 
 * // API endpoints
 * GET  /health                           - Health check
 * POST /api/test-connection             - Test Azure DevOps connection
 * POST /api/work-items/user-stories     - Create user story
 * GET  /api/work-items/:id              - Get work item details
 * POST /api/test-cases                  - Create test case
 * GET  /api/pull-requests/:repo/:id     - Get pull request details
 */

import express from 'express';
import cors from 'cors';
import AzureDevOpsIntegration from '../index.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

/**
 * Azure DevOps Web Server Class
 * 
 * @class AzureDevOpsWebServer
 * @description HTTP server that exposes Azure DevOps MCP functionality through REST API
 * endpoints. Provides both programmatic access and a web interface for testing and
 * demonstration purposes.
 */
class AzureDevOpsWebServer {
    /**
     * Creates an instance of AzureDevOpsWebServer
     * 
     * @constructor
     * @description Initializes the Express.js server, sets up middleware, and configures
     * routes for Azure DevOps operations. The server will listen on the port specified
     * in the PORT environment variable or default to 3000.
     */
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.azureDevOps = null;
        this.setupMiddleware();
        this.setupRoutes();
    }    /**
     * Configures Express.js middleware for request processing
     * 
     * @method setupMiddleware
     * @description Sets up essential middleware including CORS for cross-origin requests,
     * JSON body parsing, static file serving, and request logging. This provides the
     * foundation for secure and observable API operations.
     */
    setupMiddleware() {
        // Enable CORS
        this.app.use(cors());
        
        // Parse JSON bodies
        this.app.use(express.json());
        
        // Serve static files
        this.app.use(express.static(path.join(__dirname, '../public')));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ status: 'OK', timestamp: new Date().toISOString() });
        });

        // Initialize connection
        this.app.post('/api/initialize', async (req, res) => {
            try {
                await this.ensureInitialized();
                res.json({ success: true, message: 'Azure DevOps connection initialized' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test connection
        this.app.get('/api/test-connection', async (req, res) => {
            try {
                await this.ensureInitialized();
                const isConnected = await this.azureDevOps.testConnection();
                const orgInfo = await this.azureDevOps.getOrganizationInfo();
                
                res.json({
                    connected: isConnected,
                    organization: orgInfo.name,
                    project: process.env.AZURE_DEVOPS_PROJECT
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Pull Request Routes
        this.app.get('/api/pullrequests/:repositoryId/:pullRequestId', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { repositoryId, pullRequestId } = req.params;
                const includeDetails = req.query.includeDetails !== 'false';
                
                const pr = await this.azureDevOps.getPullRequest(repositoryId, pullRequestId, includeDetails);
                res.json(pr);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/pullrequests/:repositoryId/:pullRequestId/comments', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { repositoryId, pullRequestId } = req.params;
                
                const comments = await this.azureDevOps.getPullRequestComments(repositoryId, pullRequestId);
                res.json(comments);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/pullrequests/:repositoryId/:pullRequestId/comments', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { repositoryId, pullRequestId } = req.params;
                const { filePath, line, content } = req.body;
                
                if (!filePath || !line || !content) {
                    return res.status(400).json({ error: 'filePath, line, and content are required' });
                }
                
                const result = await this.azureDevOps.addPullRequestComment(repositoryId, pullRequestId, filePath, line, content);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });        // Work Items Routes
        this.app.post('/api/workitems/user-story', async (req, res) => {
            try {
                await this.ensureInitialized();
                const workItem = await this.azureDevOps.createUserStory(req.body);
                res.json(workItem);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/workitems/task', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { title, description, ...options } = req.body;
                const task = await this.azureDevOps.createTask(title, description, options);
                res.json(task);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/workitems/:workItemId', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { workItemId } = req.params;
                
                const workItem = await this.azureDevOps.getWorkItem(workItemId);
                res.json(workItem);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/workitems/search', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { query } = req.body;
                
                if (!query) {
                    return res.status(400).json({ error: 'query is required' });
                }
                
                const results = await this.azureDevOps.searchWorkItems(query);
                res.json(results);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test Cases Routes
        this.app.post('/api/testcases', async (req, res) => {
            try {
                await this.ensureInitialized();
                const testCase = await this.azureDevOps.createTestCase(req.body);
                res.json(testCase);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.get('/api/testcases/:testCaseId', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { testCaseId } = req.params;
                
                const testCase = await this.azureDevOps.getTestCase(testCaseId);
                res.json(testCase);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        this.app.post('/api/testcases/:testCaseId/associate/:userStoryId', async (req, res) => {
            try {
                await this.ensureInitialized();
                const { testCaseId, userStoryId } = req.params;
                
                const result = await this.azureDevOps.associateTestCaseWithUserStory(testCaseId, userStoryId);
                res.json(result);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Repositories
        this.app.get('/api/repositories', async (req, res) => {
            try {
                await this.ensureInitialized();
                await this.azureDevOps.pullRequestManager.initialize();
                const repositories = await this.azureDevOps.pullRequestManager.gitApi.getRepositories(process.env.AZURE_DEVOPS_PROJECT);
                res.json(repositories.map(repo => ({
                    id: repo.id,
                    name: repo.name,
                    url: repo.webUrl,
                    defaultBranch: repo.defaultBranch
                })));
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Serve the web interface
        this.app.get('/', (req, res) => {
            res.sendFile(path.join(__dirname, '../public/index.html'));
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({ error: 'Route not found' });
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
            const isInitialized = await this.azureDevOps.initialize();
            if (!isInitialized) {
                throw new Error('Failed to initialize Azure DevOps integration');
            }
        }
    }

    start() {
        this.app.listen(this.port, () => {
            console.log(`🚀 Azure DevOps Web Server running at http://localhost:${this.port}`);
            console.log(`📋 API Documentation: http://localhost:${this.port}/api`);
            console.log(`🔧 Health Check: http://localhost:${this.port}/health`);
        });
    }
}

// Start the server
const webServer = new AzureDevOpsWebServer();
webServer.start();
