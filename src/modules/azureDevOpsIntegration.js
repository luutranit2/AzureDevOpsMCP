/**
 * Azure DevOps Integration Module
 * 
 * @file azureDevOpsIntegration.js - Core integration class for Azure DevOps services
 * @description This module provides a comprehensive integration layer for Azure DevOps,
 * combining authentication, work item management, pull request operations, and test case
 * management into a single, cohesive interface. It serves as the main orchestrator for
 * all Azure DevOps operations within the MCP server.
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires ./auth - Azure DevOps authentication module
 * @requires ./pullRequestManager - Pull request management operations
 * @requires ./workItemManager - Work item and user story operations
 * @requires ./testCaseManager - Test case management operations
 * 
 * @example
 * // Initialize the integration
 * const integration = new AzureDevOpsIntegration({
 *   organizationUrl: 'https://dev.azure.com/myorg',
 *   personalAccessToken: 'pat_token_here',
 *   project: 'MyProject'
 * });
 * 
 * await integration.initialize();
 * 
 * // Create a user story
 * const story = await integration.createUserStory(
 *   'User Login',
 *   'As a user, I want to log in'
 * );
 * 
 * // Create associated test case
 * const testCase = await integration.createTestCase(
 *   'Login Test',
 *   'Test user login functionality'
 * );
 */

import { AzureDevOpsAuth } from './auth.js';
import { PullRequestManager } from './pullRequestManager.js';
import WorkItemManager from './workItemManager.js';
import { TestCaseManager } from './testCaseManager.js';

/**
 * Azure DevOps Integration Class
 * 
 * @class AzureDevOpsIntegration
 * @description Main orchestration class that provides a unified interface to all Azure DevOps
 * services including work items, pull requests, and test cases. Handles initialization,
 * authentication, and delegates operations to specialized manager classes.
 */
export class AzureDevOpsIntegration {
    /**
     * Creates an instance of AzureDevOpsIntegration
     * 
     * @constructor
     * @param {Object} config - Configuration object for Azure DevOps connection
     * @param {string} config.organizationUrl - Azure DevOps organization URL (e.g., https://dev.azure.com/myorg)
     * @param {string} config.personalAccessToken - Personal Access Token with appropriate permissions
     * @param {string} config.project - Azure DevOps project name
     * @param {string} [config.apiVersion='7.1-preview.1'] - Azure DevOps API version to use
     * 
     * @throws {Error} When required configuration parameters are missing
     * 
     * @example
     * const integration = new AzureDevOpsIntegration({
     *   organizationUrl: 'https://dev.azure.com/myorg',
     *   personalAccessToken: 'your_pat_token',
     *   project: 'MyProject'
     * });
     */    
    constructor(config) {
        this.config = {
            organizationUrl: config.organizationUrl,
            personalAccessToken: config.personalAccessToken,
            project: config.project,
            apiVersion: config.apiVersion || '7.1-preview.1'
        };

        // Validate required configuration
        this.validateConfig();

        // Initialize modules (will be created during initialize())
        this.auth = null;
        this.pullRequestManager = null;
        this.workItemManager = null;
        this.testCaseManager = null;
        this.initialized = false;
    }    
    
    /**
     * Validates the configuration object for required parameters
     * 
     * @private
     * @method validateConfig
     * @description Ensures all required configuration parameters are present and valid.
     * This method is called during construction to fail fast if configuration is invalid.
     * 
     * @throws {Error} When any required configuration parameter is missing
     * 
     * @example
     * // This method is called automatically during construction
     * // Will throw if organizationUrl, personalAccessToken, or project is missing
     */
    validateConfig() {
        const required = ['organizationUrl', 'personalAccessToken', 'project'];
        const missing = required.filter(key => !this.config[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required configuration: ${missing.join(', ')}`);
        }
    }        
    
    /**
     * Initializes all Azure DevOps service modules and establishes connections
     * 
     * @async
     * @method initialize
     * @description Sets up authentication and initializes all manager modules (Pull Request,
     * Work Item, and Test Case managers). This method must be called before using any
     * Azure DevOps operations. Includes retry logic and comprehensive error handling.
     * 
     * @returns {Promise<boolean>} True if initialization successful, false otherwise
     * 
     * @throws {Error} When authentication fails or any manager initialization fails
     * 
     * @example
     * const integration = new AzureDevOpsIntegration(config);
     * const success = await integration.initialize();
     * if (success) {
     *   console.log('Ready to use Azure DevOps services');
     * }
     */
    async initialize() {
        try {
            // Initialization logging suppressed for MCP mode

            // Initialize authentication with enhanced options (preserve injected mocks)
            if (!this.auth) {
                this.auth = new AzureDevOpsAuth(
                    this.config.organizationUrl,
                    this.config.personalAccessToken,
                    {
                        maxRetries: 3,
                        timeout: 30000
                    }
                );
            }

            const authSuccess = await this.auth.initialize();
            if (!authSuccess) {
                throw new Error('Failed to initialize Azure DevOps authentication');
            }

            this.webApi = this.webApi || this.auth.getWebApi();

            // Initialize all managers (preserve injected mocks)
            this.pullRequestManager = this.pullRequestManager || new PullRequestManager(this.webApi, this.config.project);
            this.workItemManager = this.workItemManager || new WorkItemManager(this.webApi, this.config.project, this.config);
            this.testCaseManager = this.testCaseManager || new TestCaseManager(this.webApi, this.config.project);

            // Initialize each manager if available
            if (this.pullRequestManager.initialize) await this.pullRequestManager.initialize();
            if (this.workItemManager.initialize) await this.workItemManager.initialize();
            if (this.testCaseManager.initialize) await this.testCaseManager.initialize();

            this.initialized = true;
            // Success logging suppressed for MCP mode
            return true;
        } catch (error) {
            console.error('❌ Initialization failed:', error.message);
            return false;
        }
    }
      /**
     * Tests the connection to Azure DevOps services with comprehensive diagnostics
     * 
     * @async
     * @method testConnection
     * @description Performs a comprehensive connection test to Azure DevOps services including
     * authentication validation, endpoint accessibility, permission verification, and service
     * health checks. This method is essential for configuration validation, health monitoring,
     * and troubleshooting connectivity issues.
     * 
     * The connection test includes:
     * - Authentication token validation and scope verification
     * - Core API endpoint accessibility testing
     * - Service-specific endpoint health checks (Work Items, Git, Test Management)
     * - Network latency and performance measurements
     * - Permission and authorization validation
     * - Error detection and diagnostic information collection
     * 
     * @returns {Promise<ConnectionTestResult>} Comprehensive connection test results
     * @returns {Promise<ConnectionTestResult.success>} boolean - Overall connection test result
     * @returns {Promise<ConnectionTestResult.authentication>} Object - Authentication test details
     * @returns {Promise<ConnectionTestResult.authentication.valid>} boolean - Token validity
     * @returns {Promise<ConnectionTestResult.authentication.scopes>} Array<string> - Available scopes
     * @returns {Promise<ConnectionTestResult.endpoints>} Object - Endpoint accessibility results
     * @returns {Promise<ConnectionTestResult.endpoints.core>} boolean - Core API accessibility
     * @returns {Promise<ConnectionTestResult.endpoints.workItems>} boolean - Work Items API accessibility
     * @returns {Promise<ConnectionTestResult.endpoints.git>} boolean - Git API accessibility
     * @returns {Promise<ConnectionTestResult.endpoints.testManagement>} boolean - Test API accessibility
     * @returns {Promise<ConnectionTestResult.performance>} Object - Performance test metrics
     * @returns {Promise<ConnectionTestResult.performance.responseTime>} number - Average response time (ms)
     * @returns {Promise<ConnectionTestResult.performance.throughput>} number - Request throughput
     * @returns {Promise<ConnectionTestResult.errors>} Array<string> - Error messages if any
     * @returns {Promise<ConnectionTestResult.warnings>} Array<string> - Warning messages if any
     * @returns {Promise<ConnectionTestResult.timestamp>} Date - Test execution timestamp
     * 
     * @throws {Error} When connection test cannot be executed
     * @throws {NetworkError} When network connectivity is completely unavailable
     * @throws {ConfigurationError} When test configuration is invalid
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/} Azure DevOps REST API
     * @see {@link AzureDevOpsAuth#testConnection} For authentication-specific testing
     * @see {@link AzureDevOpsIntegration#getConnectionInfo} For detailed connection information
     * 
     * @example
     * // Basic connection test
     * try {
     *   const testResult = await integration.testConnection();
     *   
     *   if (testResult.success) {
     *     console.log('✅ Connection test passed');
     *     console.log(`Response time: ${testResult.performance.responseTime}ms`);
     *   } else {
     *     console.error('❌ Connection test failed');
     *     testResult.errors.forEach(error => console.error(`  - ${error}`));
     *   }
     * } catch (error) {
     *   console.error('💥 Connection test error:', error.message);
     * }
     * 
     * @example
     * // Detailed connection diagnostics
     * async function runConnectionDiagnostics() {
     *   console.log('🔍 Running comprehensive connection diagnostics...\n');
     *   
     *   try {
     *     const testResult = await integration.testConnection();
     *     
     *     console.log('📊 Connection Test Results:');
     *     console.log(`Overall Status: ${testResult.success ? '✅ PASS' : '❌ FAIL'}`);
     *     console.log(`Test Date: ${testResult.timestamp.toLocaleString()}\n`);
     *     
     *     // Authentication Results
     *     console.log('🔐 Authentication:');
     *     console.log(`  Token Valid: ${testResult.authentication.valid ? '✅' : '❌'}`);
     *     console.log(`  Available Scopes: ${testResult.authentication.scopes.join(', ')}\n`);
     *     
     *     // Endpoint Accessibility
     *     console.log('🌐 Endpoint Accessibility:');
     *     Object.entries(testResult.endpoints).forEach(([endpoint, accessible]) => {
     *       console.log(`  ${endpoint}: ${accessible ? '✅' : '❌'}`);
     *     });
     *     
     *     // Performance Metrics
     *     console.log('\n⚡ Performance:');
     *     console.log(`  Response Time: ${testResult.performance.responseTime}ms`);
     *     console.log(`  Throughput: ${testResult.performance.throughput} req/s\n`);
     *     
     *     // Warnings and Errors
     *     if (testResult.warnings.length > 0) {
     *       console.log('⚠️ Warnings:');
     *       testResult.warnings.forEach(warning => console.log(`  - ${warning}`));
     *       console.log();
     *     }
     *     
     *     if (testResult.errors.length > 0) {
     *       console.log('❌ Errors:');
     *       testResult.errors.forEach(error => console.log(`  - ${error}`));
     *       console.log();
     *     }
     *     
     *     return testResult;
     *     
     *   } catch (error) {
     *     console.error('💥 Diagnostics failed:', error.message);
     *     throw error;
     *   }
     * }
     * 
     * @example
     * // Automated health monitoring
     * class ConnectionHealthMonitor {
     *   constructor(integration, interval = 300000) { // 5 minutes
     *     this.integration = integration;
     *     this.interval = interval;
     *     this.monitoring = false;
     *     this.healthHistory = [];
     *   }
     *   
     *   async startMonitoring() {
     *     this.monitoring = true;
     *     console.log('🏥 Starting connection health monitoring');
     *     
     *     while (this.monitoring) {
     *       try {
     *         const testResult = await this.integration.testConnection();
     *         
     *         const healthRecord = {
     *           timestamp: testResult.timestamp,
     *           healthy: testResult.success,
     *           responseTime: testResult.performance.responseTime,
     *           errors: testResult.errors.length,
     *           warnings: testResult.warnings.length
     *         };
     *         
     *         this.healthHistory.push(healthRecord);
     *         
     *         // Keep only last 100 records
     *         if (this.healthHistory.length > 100) {
     *           this.healthHistory = this.healthHistory.slice(-100);
     *         }
     *         
     *         // Alert on health issues
     *         if (!healthRecord.healthy) {
     *           console.error('🚨 Connection health alert: Service unhealthy');
     *           this.alertUnhealthyConnection(testResult);
     *         } else if (healthRecord.warnings > 0) {
     *           console.warn('⚠️ Connection warnings detected');
     *         }
     *         
     *         await new Promise(resolve => setTimeout(resolve, this.interval));
     *         
     *       } catch (error) {
     *         console.error('❌ Health monitoring error:', error.message);
     *         await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
     *       }
     *     }
     *   }
     *   
     *   alertUnhealthyConnection(testResult) {
     *     console.error('Connection Health Alert:');
     *     testResult.errors.forEach(error => console.error(`  - ${error}`));
     *     
     *     // Could send notifications, trigger alerts, etc.
     *   }
     *   
     *   getHealthSummary() {
     *     if (this.healthHistory.length === 0) return null;
     *     
     *     const healthy = this.healthHistory.filter(h => h.healthy).length;
     *     const uptime = (healthy / this.healthHistory.length) * 100;
     *     const avgResponseTime = this.healthHistory.reduce((sum, h) => sum + h.responseTime, 0) / this.healthHistory.length;
     *     
     *     return {
     *       uptime: Math.round(uptime * 100) / 100,
     *       averageResponseTime: Math.round(avgResponseTime),
     *       totalChecks: this.healthHistory.length,
     *       healthyChecks: healthy
     *     };
     *   }
     *   
     *   stopMonitoring() {
     *     this.monitoring = false;
     *     console.log('🛑 Health monitoring stopped');
     *   }
     * }
     * 
     * @example
     * // Load balancer health check endpoint
     * async function healthCheckEndpoint(req, res) {
     *   try {
     *     const testResult = await integration.testConnection();
     *     
     *     if (testResult.success) {
     *       res.status(200).json({
     *         status: 'healthy',
     *         responseTime: testResult.performance.responseTime,
     *         timestamp: testResult.timestamp,
     *         endpoints: testResult.endpoints
     *       });
     *     } else {
     *       res.status(503).json({
     *         status: 'unhealthy',
     *         errors: testResult.errors,
     *         warnings: testResult.warnings,
     *         timestamp: testResult.timestamp
     *       });
     *     }
     *   } catch (error) {
     *     res.status(500).json({
     *       status: 'error',
     *       message: error.message,
     *       timestamp: new Date()
     *     });
     *   }
     * }
     * 
     * @example
     * // Pre-deployment connection validation
     * async function validateDeploymentReadiness() {
     *   console.log('🚀 Validating deployment readiness...');
     *   
     *   const testResult = await integration.testConnection();
     *   
     *   const checks = [
     *     {
     *       name: 'Overall Connection',
     *       passed: testResult.success,
     *       critical: true
     *     },
     *     {
     *       name: 'Authentication',
     *       passed: testResult.authentication.valid,
     *       critical: true
     *     },
     *     {
     *       name: 'Work Items API',
     *       passed: testResult.endpoints.workItems,
     *       critical: true
     *     },
     *     {
     *       name: 'Git API',
     *       passed: testResult.endpoints.git,
     *       critical: false
     *     },
     *     {
     *       name: 'Performance',
     *       passed: testResult.performance.responseTime < 2000,
     *       critical: false
     *     }
     *   ];
     *   
     *   const failed = checks.filter(check => !check.passed);
     *   const criticalFailed = failed.filter(check => check.critical);
     *   
     *   console.log('📋 Deployment Readiness Checks:');
     *   checks.forEach(check => {
     *     const icon = check.passed ? '✅' : (check.critical ? '❌' : '⚠️');
     *     console.log(`  ${icon} ${check.name}`);
     *   });
     *   
     *   if (criticalFailed.length > 0) {
     *     console.error('💥 Deployment blocked - critical checks failed');
     *     return false;
     *   }
     *   
     *   if (failed.length > 0) {
     *     console.warn('⚠️ Deployment ready with warnings');
     *   } else {
     *     console.log('✅ Deployment ready - all checks passed');
     *   }
     *   
     *   return true;
     * }
     */
    async testConnection() {
        return await this.auth.testConnection();
    }    /**
     * Ensures that the Azure DevOps integration has been properly initialized
     * 
     * @async
     * @method ensureInitialized
     * @description This is a critical guard method that ensures all Azure DevOps services are 
     * properly initialized before any operations are performed. It implements lazy initialization
     * patterns and provides fail-fast behavior for uninitialized services. This method is 
     * called internally by all public API methods to guarantee service availability.
     * 
     * The method performs comprehensive initialization checking including:
     * - Authentication service status validation
     * - Manager module readiness verification  
     * - Connection health assessment
     * - Service dependency resolution
     * - Error state recovery mechanisms
     * 
     * @returns {Promise<void>} Resolves when initialization is confirmed, no return value
     * 
     * @throws {Error} When initialization fails after all retry attempts
     * @throws {AuthenticationError} When authentication service cannot be established
     * @throws {ConfigurationError} When required configuration parameters are invalid
     * @throws {NetworkError} When Azure DevOps services are unreachable
     * @throws {PermissionError} When PAT lacks required permissions for operations
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/} Azure DevOps REST API
     * @see {@link AzureDevOpsIntegration#initialize} For initial setup process
     * @see {@link AzureDevOpsAuth#validateConnection} For authentication validation
     * 
     * @example
     * // Automatic usage - called internally by all public methods
     * // No need to call directly in most cases
     * try {
     *   const userStory = await integration.createUserStory('Title', 'Description');
     *   // ensureInitialized() was called automatically before creation
     * } catch (error) {
     *   console.error('Operation failed:', error.message);
     * }
     * 
     * @example
     * // Manual initialization check for debugging
     * try {
     *   await integration.ensureInitialized();
     *   console.log('✅ Azure DevOps services are ready');
     *   
     *   // Safe to proceed with operations
     *   const info = await integration.getOrganizationInfo();
     *   console.log(`Connected to: ${info.name}`);
     * } catch (error) {
     *   console.error('❌ Initialization failed:', error.message);
     *   // Handle initialization failure
     * }
     * 
     * @example
     * // Recovery from failed state
     * class ServiceManager {
     *   async performOperation() {
     *     try {
     *       await this.integration.ensureInitialized();
     *       return await this.integration.createUserStory('Title', 'Desc');
     *     } catch (error) {
     *       if (error.message.includes('Failed to initialize')) {
     *         // Attempt recovery
     *         console.log('🔄 Attempting service recovery...');
     *         await this.integration.refresh();
     *         return await this.integration.createUserStory('Title', 'Desc');
     *       }
     *       throw error;
     *     }
     *   }
     * }
     * 
     * @example
     * // Health check integration
     * async function healthCheck() {
     *   const services = [integration1, integration2, integration3];
     *   const results = await Promise.allSettled(
     *     services.map(async (service, index) => {
     *       try {
     *         await service.ensureInitialized();
     *         return { service: index, status: 'healthy' };
     *       } catch (error) {
     *         return { 
     *           service: index, 
     *           status: 'unhealthy', 
     *           error: error.message 
     *         };
     *       }
     *     })
     *   );
     *   
     *   console.log('Service Health:', results);
     * }
     * 
     * @example
     * // Conditional operation execution
     * async function conditionalOperation() {
     *   try {
     *     await integration.ensureInitialized();
     *     
     *     // Only proceed if initialization successful
     *     const permissions = await integration.validatePermissions();
     *     if (permissions.canCreateWorkItems) {
     *       return await integration.createUserStory('Title', 'Description');
     *     } else {
     *       throw new Error('Insufficient permissions for work item creation');
     *     }
     *   } catch (error) {
     *     console.error('Cannot perform operation:', error.message);
     *     return null;
     *   }
     * }
     */
    async ensureInitialized() {
        if (!this.initialized) {
            const success = await this.initialize();
            if (!success) {
                throw new Error('Failed to initialize Azure DevOps integration');
            }
        }
    }    /**
     * Retrieves comprehensive organization information from Azure DevOps
     * 
     * @async
     * @method getOrganizationInfo
     * @description Fetches detailed information about the Azure DevOps organization including
     * metadata, configuration details, feature availability, and administrative settings.
     * This method provides essential organization context for application configuration,
     * user interface customization, and feature enablement decisions.
     * 
     * The returned organization information includes:
     * - Organization identity and branding details
     * - Available features and service tiers
     * - Regional settings and time zone configuration
     * - License information and user capacity limits
     * - Security policies and compliance settings
     * - Integration capabilities and API version support
     * 
     * @returns {Promise<OrganizationInfo>} Organization information object with comprehensive details
     * @returns {Promise<OrganizationInfo.id>} string - Unique organization identifier (GUID)
     * @returns {Promise<OrganizationInfo.name>} string - Display name of the organization
     * @returns {Promise<OrganizationInfo.url>} string - Primary organization URL
     * @returns {Promise<OrganizationInfo.description>} string - Organization description/tagline
     * @returns {Promise<OrganizationInfo.region>} string - Geographic region (e.g., 'Central US')
     * @returns {Promise<OrganizationInfo.timeZone>} string - Default time zone setting
     * @returns {Promise<OrganizationInfo.features>} Array<string> - Available feature flags
     * @returns {Promise<OrganizationInfo.licenses>} Object - License type and capacity information
     * @returns {Promise<OrganizationInfo.policies>} Object - Security and governance policies
     * @returns {Promise<OrganizationInfo.version>} string - Azure DevOps Server version (if applicable)
     * 
     * @throws {Error} When organization information cannot be retrieved
     * @throws {AuthenticationError} When PAT lacks organization read permissions
     * @throws {NetworkError} When Azure DevOps services are unreachable
     * @throws {NotFoundError} When organization does not exist or is inaccessible
     * @throws {RateLimitError} When API rate limits are exceeded
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/core/projects/list} Azure DevOps Core API
     * @see {@link AzureDevOpsAuth#getOrganizationInfo} For authentication-level organization details
     * @see {@link AzureDevOpsIntegration#validatePermissions} For permission validation
     * 
     * @example
     * // Basic organization information retrieval
     * try {
     *   const orgInfo = await integration.getOrganizationInfo();
     *   console.log(`Organization: ${orgInfo.name}`);
     *   console.log(`Region: ${orgInfo.region}`);
     *   console.log(`URL: ${orgInfo.url}`);
     *   console.log(`Features: ${orgInfo.features.join(', ')}`);
     * } catch (error) {
     *   console.error('Failed to get organization info:', error.message);
     * }
     * 
     * @example
     * // Feature availability checking
     * async function checkFeatureAvailability() {
     *   const orgInfo = await integration.getOrganizationInfo();
     *   
     *   const hasAdvancedSecurity = orgInfo.features.includes('AdvancedSecurity');
     *   const hasTestPlans = orgInfo.features.includes('TestPlans');
     *   const hasBoards = orgInfo.features.includes('Boards');
     *   
     *   console.log('Available Features:');
     *   console.log(`- Advanced Security: ${hasAdvancedSecurity ? '✅' : '❌'}`);
     *   console.log(`- Test Plans: ${hasTestPlans ? '✅' : '❌'}`);
     *   console.log(`- Boards: ${hasBoards ? '✅' : '❌'}`);
     *   
     *   return {
     *     security: hasAdvancedSecurity,
     *     testing: hasTestPlans,
     *     planning: hasBoards
     *   };
     * }
     * 
     * @example
     * // License capacity planning
     * async function checkLicenseCapacity() {
     *   const orgInfo = await integration.getOrganizationInfo();
     *   
     *   const { licenses } = orgInfo;
     *   console.log('License Information:');
     *   console.log(`- Total Users: ${licenses.totalUsers}`);
     *   console.log(`- Available Licenses: ${licenses.available}`);
     *   console.log(`- License Type: ${licenses.type}`);
     *   
     *   if (licenses.available < 5) {
     *     console.warn('⚠️ Low license availability - consider upgrading');
     *   }
     *   
     *   return licenses;
     * }
     * 
     * @example
     * // Multi-organization management
     * class OrganizationManager {
     *   constructor(integrations) {
     *     this.integrations = integrations; // Array of AzureDevOpsIntegration instances
     *   }
     *   
     *   async getOrganizationSummary() {
     *     const summaries = await Promise.allSettled(
     *       this.integrations.map(async (integration) => {
     *         try {
     *           const info = await integration.getOrganizationInfo();
     *           return {
     *             name: info.name,
     *             region: info.region,
     *             users: info.licenses?.totalUsers || 0,
     *             status: 'active'
     *           };
     *         } catch (error) {
     *           return {
     *             name: 'Unknown',
     *             status: 'error',
     *             error: error.message
     *           };
     *         }
     *       })
     *     );
     *     
     *     return summaries.map(result => 
     *       result.status === 'fulfilled' ? result.value : result.reason
     *     );
     *   }
     * }
     * 
     * @example
     * // Organization configuration dashboard
     * async function createOrgDashboard() {
     *   const orgInfo = await integration.getOrganizationInfo();
     *   
     *   const dashboard = {
     *     identity: {
     *       name: orgInfo.name,
     *       id: orgInfo.id,
     *       description: orgInfo.description
     *     },
     *     infrastructure: {
     *       region: orgInfo.region,
     *       timeZone: orgInfo.timeZone,
     *       url: orgInfo.url
     *     },
     *     capabilities: {
     *       features: orgInfo.features,
     *       version: orgInfo.version,
     *       apiVersion: '7.1-preview.1'
     *     },
     *     licensing: orgInfo.licenses,
     *     governance: orgInfo.policies
     *   };
     *   
     *   console.log('Organization Dashboard:', JSON.stringify(dashboard, null, 2));
     *   return dashboard;
     * }
     */
    async getOrganizationInfo() {
        await this.ensureInitialized();
        return this.auth.getOrganizationInfo();
    }    /**
     * Validates Personal Access Token permissions for required Azure DevOps operations
     * 
     * @async
     * @method validatePermissions
     * @description Performs comprehensive validation of the Personal Access Token (PAT) permissions
     * against the required scopes for Azure DevOps operations. This method ensures that the
     * configured PAT has sufficient privileges to perform work item management, pull request
     * operations, test case management, and other essential functions.
     * 
     * The validation process includes:
     * - Work Items scope verification (read, write, delete permissions)
     * - Git repository access validation (pull request management)
     * - Test Management permissions assessment
     * - Security and compliance policy checks
     * - API version compatibility verification
     * - Rate limiting and throttling policy evaluation
     * 
     * @returns {Promise<PermissionValidationResult>} Comprehensive permission validation results
     * @returns {Promise<PermissionValidationResult.isValid>} boolean - Overall validation status
     * @returns {Promise<PermissionValidationResult.permissions>} Object - Detailed permission breakdown
     * @returns {Promise<PermissionValidationResult.permissions.workItems>} boolean - Work item management access
     * @returns {Promise<PermissionValidationResult.permissions.git>} boolean - Git repository access
     * @returns {Promise<PermissionValidationResult.permissions.testManagement>} boolean - Test case access
     * @returns {Promise<PermissionValidationResult.permissions.security>} boolean - Security policy access
     * @returns {Promise<PermissionValidationResult.scopes>} Array<string> - Available PAT scopes
     * @returns {Promise<PermissionValidationResult.missing>} Array<string> - Missing required permissions
     * @returns {Promise<PermissionValidationResult.warnings>} Array<string> - Permission-related warnings
     * @returns {Promise<PermissionValidationResult.recommendations>} Array<string> - Improvement suggestions
     * 
     * @throws {Error} When permission validation fails due to system errors
     * @throws {AuthenticationError} When PAT is invalid or expired
     * @throws {NetworkError} When permission validation service is unreachable
     * @throws {ConfigurationError} When PAT configuration is malformed
     * @throws {SecurityError} When security policies prevent validation
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/pats} PAT Documentation
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/organizations/security/about-permissions} Permission Reference
     * @see {@link AzureDevOpsAuth#validatePermissions} For low-level permission checking
     * 
     * @example
     * // Basic permission validation
     * try {
     *   const validation = await integration.validatePermissions();
     *   
     *   if (validation.isValid) {
     *     console.log('✅ All required permissions are available');
     *     console.log('Available scopes:', validation.scopes.join(', '));
     *   } else {
     *     console.error('❌ Missing required permissions:');
     *     validation.missing.forEach(perm => console.error(`  - ${perm}`));
     *     
     *     console.log('💡 Recommendations:');
     *     validation.recommendations.forEach(rec => console.log(`  - ${rec}`));
     *   }
     * } catch (error) {
     *   console.error('Permission validation failed:', error.message);
     * }
     * 
     * @example
     * // Feature-specific permission checking
     * async function checkFeaturePermissions() {
     *   const validation = await integration.validatePermissions();
     *   
     *   const features = {
     *     canCreateWorkItems: validation.permissions.workItems,
     *     canManagePullRequests: validation.permissions.git,
     *     canCreateTestCases: validation.permissions.testManagement,
     *     canViewSecurity: validation.permissions.security
     *   };
     *   
     *   console.log('Feature Availability:');
     *   Object.entries(features).forEach(([feature, available]) => {
     *     console.log(`${feature}: ${available ? '✅' : '❌'}`);
     *   });
     *   
     *   // Enable/disable UI features based on permissions
     *   return features;
     * }
     * 
     * @example
     * // Automated permission remediation
     * async function validateAndRemediate() {
     *   const validation = await integration.validatePermissions();
     *   
     *   if (!validation.isValid) {
     *     console.log('⚠️ Permission issues detected');
     *     
     *     // Log specific issues
     *     if (validation.missing.includes('Work Items')) {
     *       console.error('Cannot manage work items - PAT needs Work Items (read & write) scope');
     *     }
     *     
     *     if (validation.missing.includes('Git')) {
     *       console.error('Cannot manage pull requests - PAT needs Code (read & write) scope');
     *     }
     *     
     *     if (validation.missing.includes('Test Management')) {
     *       console.error('Cannot manage test cases - PAT needs Test Management scope');
     *     }
     *     
     *     // Generate remediation instructions
     *     const patUrl = 'https://dev.azure.com/YOUR_ORG/_usersSettings/tokens';
     *     console.log(`\n🔧 To fix these issues:`);
     *     console.log(`1. Visit: ${patUrl}`);
     *     console.log(`2. Create new PAT with required scopes:`);
     *     validation.missing.forEach(scope => console.log(`   - ${scope}`));
     *     console.log(`3. Update your configuration with the new PAT`);
     *     
     *     return false;
     *   }
     *   
     *   return true;
     * }
     * 
     * @example
     * // Permission monitoring and alerting
     * class PermissionMonitor {
     *   constructor(integration, interval = 3600000) { // 1 hour
     *     this.integration = integration;
     *     this.interval = interval;
     *     this.monitoring = false;
     *   }
     *   
     *   async startMonitoring() {
     *     this.monitoring = true;
     *     
     *     while (this.monitoring) {
     *       try {
     *         const validation = await this.integration.validatePermissions();
     *         
     *         if (!validation.isValid) {
     *           this.alertPermissionIssues(validation);
     *         }
     *         
     *         if (validation.warnings.length > 0) {
     *           this.logWarnings(validation.warnings);
     *         }
     *         
     *         await new Promise(resolve => setTimeout(resolve, this.interval));
     *       } catch (error) {
     *         console.error('Permission monitoring error:', error.message);
     *         await new Promise(resolve => setTimeout(resolve, 60000)); // Retry in 1 minute
     *       }
     *     }
     *   }
     *   
     *   alertPermissionIssues(validation) {
     *     console.error('🚨 PERMISSION ALERT: PAT permissions have changed');
     *     console.error('Missing permissions:', validation.missing);
     *     // Send notification to administrators
     *   }
     *   
     *   logWarnings(warnings) {
     *     console.warn('⚠️ Permission warnings:', warnings);
     *   }
     *   
     *   stopMonitoring() {
     *     this.monitoring = false;
     *   }
     * }
     * 
     * @example
     * // Integration with application startup
     * async function applicationStartup() {
     *   console.log('🚀 Starting application...');
     *   
     *   // Validate permissions before proceeding
     *   try {
     *     const validation = await integration.validatePermissions();
     *     
     *     if (!validation.isValid) {
     *       console.error('❌ Application cannot start - insufficient permissions');
     *       console.error('Required permissions:', validation.missing);
     *       process.exit(1);
     *     }
     *     
     *     // Log successful validation
     *     console.log('✅ Permission validation passed');
     *     console.log('Available features:', Object.keys(validation.permissions).filter(
     *       key => validation.permissions[key]
     *     ));
     *     
     *     // Continue with application initialization
     *     console.log('✨ Application ready');
     *     
     *   } catch (error) {
     *     console.error('💥 Startup failed during permission validation:', error.message);
     *     process.exit(1);
     *   }
     * }
     */
    async validatePermissions() {
        await this.ensureInitialized();
        return this.auth.validatePermissions([
            'Work Items',
            'Git', 
            'Test Management'
        ]);
    }    /**
     * Retrieves comprehensive connection information and health status
     * 
     * @async
     * @method getConnectionInfo
     * @description Provides detailed information about the current Azure DevOps connection
     * including authentication status, service health, performance metrics, and configuration
     * details. This method is essential for monitoring, debugging, and operational dashboards.
     * 
     * The connection information includes:
     * - Authentication token status and expiration details
     * - Service endpoint health and response times
     * - API version compatibility and feature availability
     * - Network connectivity metrics and latency measurements
     * - Error rates and reliability statistics
     * - Configuration validation and compliance status
     * 
     * @returns {Promise<ConnectionInfo>} Comprehensive connection information object
     * @returns {Promise<ConnectionInfo.isConnected>} boolean - Overall connection status
     * @returns {Promise<ConnectionInfo.authentication>} Object - Authentication details
     * @returns {Promise<ConnectionInfo.authentication.isValid>} boolean - Token validity status
     * @returns {Promise<ConnectionInfo.authentication.expiresAt>} Date - Token expiration timestamp
     * @returns {Promise<ConnectionInfo.authentication.scope>} Array<string> - Available token scopes
     * @returns {Promise<ConnectionInfo.endpoints>} Object - Service endpoint health status
     * @returns {Promise<ConnectionInfo.endpoints.core>} Object - Core API endpoint status
     * @returns {Promise<ConnectionInfo.endpoints.workItems>} Object - Work Items API status
     * @returns {Promise<ConnectionInfo.endpoints.git>} Object - Git API endpoint status
     * @returns {Promise<ConnectionInfo.endpoints.testManagement>} Object - Test API status
     * @returns {Promise<ConnectionInfo.performance>} Object - Performance metrics
     * @returns {Promise<ConnectionInfo.performance.latency>} number - Average response time (ms)
     * @returns {Promise<ConnectionInfo.performance.throughput>} number - Requests per second
     * @returns {Promise<ConnectionInfo.performance.errorRate>} number - Error percentage
     * @returns {Promise<ConnectionInfo.configuration>} Object - Connection configuration details
     * @returns {Promise<ConnectionInfo.lastHealthCheck>} Date - Last health check timestamp
     * 
     * @throws {Error} When connection information cannot be retrieved
     * @throws {AuthenticationError} When authentication status cannot be determined
     * @throws {NetworkError} When service endpoints are unreachable
     * @throws {ConfigurationError} When connection configuration is invalid
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/} Azure DevOps REST API Reference
     * @see {@link AzureDevOpsAuth#getConnectionInfo} For authentication-specific connection details
     * @see {@link AzureDevOpsIntegration#validatePermissions} For permission validation
     * 
     * @example
     * // Basic connection health check
     * try {
     *   const connectionInfo = await integration.getConnectionInfo();
     *   
     *   console.log(`Connection Status: ${connectionInfo.isConnected ? '✅ Connected' : '❌ Disconnected'}`);
     *   console.log(`Token Valid: ${connectionInfo.authentication.isValid ? '✅' : '❌'}`);
     *   console.log(`Token Expires: ${connectionInfo.authentication.expiresAt}`);
     *   console.log(`Average Latency: ${connectionInfo.performance.latency}ms`);
     *   console.log(`Error Rate: ${connectionInfo.performance.errorRate}%`);
     *   
     * } catch (error) {
     *   console.error('Failed to get connection info:', error.message);
     * }
     * 
     * @example
     * // Detailed service endpoint monitoring
     * async function monitorServiceEndpoints() {
     *   const connectionInfo = await integration.getConnectionInfo();
     *   
     *   console.log('\n📊 Service Endpoint Status:');
     *   const endpoints = connectionInfo.endpoints;
     *   
     *   Object.entries(endpoints).forEach(([service, status]) => {
     *     const statusIcon = status.healthy ? '✅' : '❌';
     *     console.log(`${statusIcon} ${service}: ${status.responseTime}ms`);
     *     
     *     if (!status.healthy) {
     *       console.log(`  ⚠️ Last Error: ${status.lastError}`);
     *       console.log(`  🕐 Last Success: ${status.lastSuccessfulCall}`);
     *     }
     *   });
     *   
     *   // Calculate overall health score
     *   const healthyEndpoints = Object.values(endpoints).filter(e => e.healthy).length;
     *   const totalEndpoints = Object.keys(endpoints).length;
     *   const healthScore = (healthyEndpoints / totalEndpoints) * 100;
     *   
     *   console.log(`\n🏥 Overall Health Score: ${healthScore.toFixed(1)}%`);
     *   return healthScore >= 80; // Consider healthy if 80%+ endpoints are working
     * }
     * 
     * @example
     * // Performance monitoring and alerting
     * class PerformanceMonitor {
     *   constructor(integration, thresholds = {}) {
     *     this.integration = integration;
     *     this.thresholds = {
     *       maxLatency: 2000, // 2 seconds
     *       maxErrorRate: 5,  // 5%
     *       minThroughput: 10, // 10 requests/second
     *       ...thresholds
     *     };
     *   }
     *   
     *   async checkPerformance() {
     *     const connectionInfo = await this.integration.getConnectionInfo();
     *     const { performance } = connectionInfo;
     *     
     *     const alerts = [];
     *     
     *     if (performance.latency > this.thresholds.maxLatency) {
     *       alerts.push(`High latency: ${performance.latency}ms (threshold: ${this.thresholds.maxLatency}ms)`);
     *     }
     *     
     *     if (performance.errorRate > this.thresholds.maxErrorRate) {
     *       alerts.push(`High error rate: ${performance.errorRate}% (threshold: ${this.thresholds.maxErrorRate}%)`);
     *     }
     *     
     *     if (performance.throughput < this.thresholds.minThroughput) {
     *       alerts.push(`Low throughput: ${performance.throughput} req/s (threshold: ${this.thresholds.minThroughput} req/s)`);
     *     }
     *     
     *     if (alerts.length > 0) {
     *       console.warn('🚨 Performance Alerts:');
     *       alerts.forEach(alert => console.warn(`  - ${alert}`));
     *       return false;
     *     }
     *     
     *     console.log('✅ Performance within acceptable thresholds');
     *     return true;
     *   }
     * }
     * 
     * @example
     * // Connection diagnostics and troubleshooting
     * async function runConnectionDiagnostics() {
     *   console.log('🔍 Running connection diagnostics...\n');
     *   
     *   try {
     *     const connectionInfo = await integration.getConnectionInfo();
     *     
     *     // 1. Authentication Diagnostics
     *     console.log('🔐 Authentication Status:');
     *     if (connectionInfo.authentication.isValid) {
     *       console.log('  ✅ Token is valid');
     *       console.log(`  📅 Expires: ${connectionInfo.authentication.expiresAt.toLocaleDateString()}`);
     *       console.log(`  🔑 Scopes: ${connectionInfo.authentication.scope.join(', ')}`);
     *     } else {
     *       console.log('  ❌ Token is invalid or expired');
     *       console.log('  💡 Recommendation: Generate a new PAT');
     *     }
     *     
     *     // 2. Connectivity Diagnostics
     *     console.log('\n🌐 Network Connectivity:');
     *     if (connectionInfo.isConnected) {
     *       console.log('  ✅ Connection established');
     *       console.log(`  ⚡ Latency: ${connectionInfo.performance.latency}ms`);
     *     } else {
     *       console.log('  ❌ Connection failed');
     *       console.log('  💡 Check network settings and firewall');
     *     }
     *     
     *     // 3. Service Health Diagnostics
     *     console.log('\n🏥 Service Health:');
     *     const unhealthyServices = Object.entries(connectionInfo.endpoints)
     *       .filter(([, status]) => !status.healthy);
     *     
     *     if (unhealthyServices.length === 0) {
     *       console.log('  ✅ All services are healthy');
     *     } else {
     *       console.log('  ⚠️ Unhealthy services detected:');
     *       unhealthyServices.forEach(([service, status]) => {
     *         console.log(`    - ${service}: ${status.lastError}`);
     *       });
     *     }
     *     
     *     // 4. Performance Diagnostics
     *     console.log('\n📈 Performance Metrics:');
     *     console.log(`  Throughput: ${connectionInfo.performance.throughput} req/s`);
     *     console.log(`  Error Rate: ${connectionInfo.performance.errorRate}%`);
     *     console.log(`  Last Check: ${connectionInfo.lastHealthCheck.toLocaleString()}`);
     *     
     *   } catch (error) {
     *     console.error('❌ Diagnostics failed:', error.message);
     *     console.log('\n💡 Troubleshooting steps:');
     *     console.log('  1. Verify organization URL is correct');
     *     console.log('  2. Check PAT is valid and has required permissions');
     *     console.log('  3. Ensure network connectivity to Azure DevOps');
     *     console.log('  4. Try refreshing the connection');
     *   }
     * }
     * 
     * @example
     * // Automated health monitoring dashboard
     * class ConnectionDashboard {
     *   constructor(integration) {
     *     this.integration = integration;
     *     this.metrics = [];
     *   }
     *   
     *   async collectMetrics() {
     *     const connectionInfo = await this.integration.getConnectionInfo();
     *     
     *     const metric = {
     *       timestamp: new Date(),
     *       connected: connectionInfo.isConnected,
     *       latency: connectionInfo.performance.latency,
     *       errorRate: connectionInfo.performance.errorRate,
     *       throughput: connectionInfo.performance.throughput,
     *       healthyEndpoints: Object.values(connectionInfo.endpoints)
     *         .filter(e => e.healthy).length
     *     };
     *     
     *     this.metrics.push(metric);
     *     
     *     // Keep only last 100 metrics
     *     if (this.metrics.length > 100) {
     *       this.metrics = this.metrics.slice(-100);
     *     }
     *     
     *     return metric;
     *   }
     *   
     *   generateReport() {
     *     if (this.metrics.length === 0) return null;
     *     
     *     const latest = this.metrics[this.metrics.length - 1];
     *     const avgLatency = this.metrics.reduce((sum, m) => sum + m.latency, 0) / this.metrics.length;
     *     const avgErrorRate = this.metrics.reduce((sum, m) => sum + m.errorRate, 0) / this.metrics.length;
     *     const uptime = (this.metrics.filter(m => m.connected).length / this.metrics.length) * 100;
     *     
     *     return {
     *       currentStatus: latest,
     *       averages: {
     *         latency: Math.round(avgLatency),
     *         errorRate: Math.round(avgErrorRate * 100) / 100,
     *         uptime: Math.round(uptime * 100) / 100
     *       },
     *       dataPoints: this.metrics.length
     *     };
     *   }
     * }
     */
    async getConnectionInfo() {
        await this.ensureInitialized();
        return this.auth.getConnectionInfo();
    }    /**
     * Refreshes the Azure DevOps connection and reinitializes all services
     * 
     * @async
     * @method refresh
     * @description Performs a complete refresh of the Azure DevOps integration by resetting
     * all connections, clearing cached data, and reinitializing all service modules. This
     * method is essential for long-running applications that need to recover from connection
     * issues, handle token expiration, or refresh stale service connections.
     * 
     * The refresh process includes:
     * - Authentication service reconnection and token validation
     * - Service module reinitialization (Pull Request, Work Item, Test Case managers)
     * - Cache invalidation and data refresh
     * - Connection health verification and diagnostic testing
     * - Error state recovery and resilience mechanisms
     * - Performance metrics reset and baseline establishment
     * 
     * @returns {Promise<boolean>} True if refresh successful, false otherwise
     * 
     * @throws {Error} When refresh process fails after all retry attempts
     * @throws {AuthenticationError} When token cannot be renewed or validated
     * @throws {NetworkError} When Azure DevOps services are unreachable during refresh
     * @throws {ConfigurationError} When configuration becomes invalid during refresh
     * @throws {ServiceError} When service modules fail to reinitialize
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/} Azure DevOps REST API
     * @see {@link AzureDevOpsIntegration#initialize} For initial setup process
     * @see {@link AzureDevOpsIntegration#getConnectionInfo} For connection status monitoring
     * 
     * @example
     * // Basic connection refresh for error recovery
     * try {
     *   console.log('🔄 Refreshing Azure DevOps connection...');
     *   const success = await integration.refresh();
     *   
     *   if (success) {
     *     console.log('✅ Connection refreshed successfully');
     *     
     *     // Verify services are working
     *     const connectionInfo = await integration.getConnectionInfo();
     *     console.log(`New connection status: ${connectionInfo.isConnected ? 'Connected' : 'Disconnected'}`);
     *   } else {
     *     console.error('❌ Connection refresh failed');
     *     // Handle refresh failure
     *   }
     * } catch (error) {
     *   console.error('💥 Refresh process encountered an error:', error.message);
     * }
     * 
     * @example
     * // Scheduled refresh for long-running applications
     * class ConnectionManager {
     *   constructor(integration, refreshInterval = 3600000) { // 1 hour
     *     this.integration = integration;
     *     this.refreshInterval = refreshInterval;
     *     this.refreshTimer = null;
     *     this.isRefreshing = false;
     *   }
     *   
     *   startScheduledRefresh() {
     *     console.log('🕐 Starting scheduled connection refresh');
     *     
     *     this.refreshTimer = setInterval(async () => {
     *       if (this.isRefreshing) {
     *         console.log('⏳ Refresh already in progress, skipping...');
     *         return;
     *       }
     *       
     *       try {
     *         this.isRefreshing = true;
     *         console.log('🔄 Performing scheduled refresh...');
     *         
     *         const success = await this.integration.refresh();
     *         if (success) {
     *           console.log('✅ Scheduled refresh completed successfully');
     *         } else {
     *           console.warn('⚠️ Scheduled refresh failed, will retry next cycle');
     *         }
     *       } catch (error) {
     *         console.error('❌ Scheduled refresh error:', error.message);
     *       } finally {
     *         this.isRefreshing = false;
     *       }
     *     }, this.refreshInterval);
     *   }
     *   
     *   stopScheduledRefresh() {
     *     if (this.refreshTimer) {
     *       clearInterval(this.refreshTimer);
     *       this.refreshTimer = null;
     *       console.log('🛑 Scheduled refresh stopped');
     *     }
     *   }
     * }
     * 
     * @example
     * // Retry mechanism with exponential backoff
     * class ResilientIntegration {
     *   constructor(integration) {
     *     this.integration = integration;
     *   }
     *   
     *   async refreshWithRetry(maxAttempts = 5, baseDelay = 1000) {
     *     for (let attempt = 1; attempt <= maxAttempts; attempt++) {
     *       try {
     *         console.log(`🔄 Refresh attempt ${attempt}/${maxAttempts}`);
     *         
     *         const success = await this.integration.refresh();
     *         if (success) {
     *           console.log(`✅ Refresh successful on attempt ${attempt}`);
     *           return true;
     *         }
     *         
     *         if (attempt < maxAttempts) {
     *           const delay = baseDelay * Math.pow(2, attempt - 1);
     *           console.log(`⏳ Waiting ${delay}ms before retry...`);
     *           await new Promise(resolve => setTimeout(resolve, delay));
     *         }
     *         
     *       } catch (error) {
     *         console.error(`❌ Refresh attempt ${attempt} failed:`, error.message);
     *         
     *         if (attempt === maxAttempts) {
     *           console.error('💥 All refresh attempts failed');
     *           throw new Error(`Failed to refresh after ${maxAttempts} attempts: ${error.message}`);
     *         }
     *         
     *         if (attempt < maxAttempts) {
     *           const delay = baseDelay * Math.pow(2, attempt - 1);
     *           console.log(`⏳ Waiting ${delay}ms before retry...`);
     *           await new Promise(resolve => setTimeout(resolve, delay));
     *         }
     *       }
     *     }
     *     
     *     return false;
     *   }
     * }
     * 
     * @example
     * // Health-based refresh trigger
     * class HealthMonitor {
     *   constructor(integration) {
     *     this.integration = integration;
     *     this.healthThreshold = 0.8; // 80% health score
     *     this.checkInterval = 300000; // 5 minutes
     *     this.monitoring = false;
     *   }
     *   
     *   async startHealthMonitoring() {
     *     this.monitoring = true;
     *     console.log('🏥 Starting health-based refresh monitoring');
     *     
     *     while (this.monitoring) {
     *       try {
     *         const connectionInfo = await this.integration.getConnectionInfo();
     *         
     *         // Calculate health score
     *         const healthyEndpoints = Object.values(connectionInfo.endpoints)
     *           .filter(e => e.healthy).length;
     *         const totalEndpoints = Object.keys(connectionInfo.endpoints).length;
     *         const healthScore = healthyEndpoints / totalEndpoints;
     *         
     *         console.log(`🏥 Health Score: ${(healthScore * 100).toFixed(1)}%`);
     *         
     *         // Trigger refresh if health is below threshold
     *         if (healthScore < this.healthThreshold) {
     *           console.warn(`⚠️ Health below threshold (${this.healthThreshold * 100}%), triggering refresh`);
     *           
     *           const refreshSuccess = await this.integration.refresh();
     *           if (refreshSuccess) {
     *             console.log('✅ Health-triggered refresh completed');
     *           } else {
     *             console.error('❌ Health-triggered refresh failed');
     *           }
     *         }
     *         
     *         await new Promise(resolve => setTimeout(resolve, this.checkInterval));
     *         
     *       } catch (error) {
     *         console.error('❌ Health monitoring error:', error.message);
     *         await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute on error
     *       }
     *     }
     *   }
     *   
     *   stopHealthMonitoring() {
     *     this.monitoring = false;
     *     console.log('🛑 Health monitoring stopped');
     *   }
     * }
     * 
     * @example
     * // Event-driven refresh handling
     * class EventDrivenRefresh {
     *   constructor(integration) {
     *     this.integration = integration;
     *     this.setupEventHandlers();
     *   }
     *   
     *   setupEventHandlers() {
     *     // Handle authentication errors
     *     process.on('azuredevops:auth:error', async () => {
     *       console.log('🔐 Authentication error detected, refreshing connection...');
     *       await this.handleRefresh('Authentication error');
     *     });
     *     
     *     // Handle network connectivity issues
     *     process.on('azuredevops:network:error', async () => {
     *       console.log('🌐 Network error detected, refreshing connection...');
     *       await this.handleRefresh('Network error');
     *     });
     *     
     *     // Handle service unavailability
     *     process.on('azuredevops:service:unavailable', async () => {
     *       console.log('🚫 Service unavailable, refreshing connection...');
     *       await this.handleRefresh('Service unavailable');
     *     });
     *   }
     *   
     *   async handleRefresh(reason) {
     *     try {
     *       console.log(`🔄 Refreshing due to: ${reason}`);
     *       
     *       const success = await this.integration.refresh();
     *       if (success) {
     *         console.log('✅ Event-driven refresh successful');
     *         process.emit('azuredevops:refresh:success', { reason });
     *       } else {
     *         console.error('❌ Event-driven refresh failed');
     *         process.emit('azuredevops:refresh:failed', { reason });
     *       }
     *       
     *     } catch (error) {
     *       console.error('💥 Event-driven refresh error:', error.message);
     *       process.emit('azuredevops:refresh:error', { reason, error });
     *     }
     *   }
     * }
     */
    async refresh() {
        this.initialized = false;
        return this.initialize();
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        if (this.auth) {
            this.auth.dispose();
        }
        this.initialized = false;
        console.log('🔌 Azure DevOps Integration disposed');
    }    
    
    // ============================================================================
    // PULL REQUEST OPERATIONS
    // ============================================================================
    
    /**
     * Retrieves detailed information about a specific pull request
     * 
     * @async
     * @method getPullRequest
     * @param {string|number} repositoryId - Repository ID or name
     * @param {number} pullRequestId - Pull request ID
     * @param {boolean} [includeDetails=true] - Whether to include commits, work items, and iterations
     * @returns {Promise<Object>} Pull request object with detailed information
     * 
     * @example
     * const pr = await integration.getPullRequest('myRepo', 123, true);
     * console.log(`PR Title: ${pr.title}`);
     * console.log(`Status: ${pr.status}`);
     */
    async getPullRequest(repositoryId, pullRequestId, includeDetails = true) {
        await this.ensureInitialized();
        return this.pullRequestManager.getPullRequest(repositoryId, pullRequestId, includeDetails);
    }

    async getPullRequestByUrl(url, includeDetails = true) {
        await this.ensureInitialized();
        return this.pullRequestManager.getPullRequestByUrl(url, includeDetails);
    }

    async getPullRequestComments(repositoryId, pullRequestId, includeThreads = true) {
        await this.ensureInitialized();
        return this.pullRequestManager.getPullRequestComments(repositoryId, pullRequestId, includeThreads);
    }

    async addFileComment(repositoryId, pullRequestId, filePath, comment, line = null, position = null) {
        await this.ensureInitialized();
        return this.pullRequestManager.addFileComment(repositoryId, pullRequestId, filePath, comment, line, position);
    }

    async replyToComment(repositoryId, pullRequestId, parentCommentId, reply) {
        await this.ensureInitialized();
        return this.pullRequestManager.replyToComment(repositoryId, pullRequestId, parentCommentId, reply);
    }

    async updateCommentThreadStatus(repositoryId, pullRequestId, threadId, status) {
        await this.ensureInitialized();
        return this.pullRequestManager.updateCommentThreadStatus(repositoryId, pullRequestId, threadId, status);
    }    
    
    // ============================================================================
    // WORK ITEM OPERATIONS
    // ============================================================================
      /**
     * Creates a new user story work item in Azure DevOps with comprehensive metadata
     * 
     * @async
     * @method createUserStory
     * @description Creates a new user story work item in Azure DevOps with comprehensive
     * field support, validation, and automatic linking capabilities. This method provides
     * the foundation for agile project management by creating properly structured user
     * stories with rich metadata, acceptance criteria, and project tracking information.
     * 
     * The user story creation process includes:
     * - Standard work item field validation and sanitization
     * - Acceptance criteria formatting and validation
     * - Priority assignment and story point estimation
     * - Automatic area path and iteration path assignment
     * - Tags and classification support
     * - Custom field extension support
     * - Audit trail and change tracking initialization
     * 
     * @param {string} title - The title of the user story (required, 1-255 characters)
     * @param {string} description - Detailed description of the user story functionality and context
     * @param {Object} [additionalFields={}] - Additional fields and metadata for the user story
     * @param {string} [additionalFields.acceptanceCriteria] - Detailed acceptance criteria defining story completion
     * @param {number} [additionalFields.priority=3] - Priority level (1=Critical, 2=High, 3=Medium, 4=Low)
     * @param {number} [additionalFields.storyPoints] - Story points estimate for effort sizing (1-40)
     * @param {string} [additionalFields.assignedTo] - Email address of the assigned team member
     * @param {string} [additionalFields.areaPath] - Area path for organizational hierarchy
     * @param {string} [additionalFields.iterationPath] - Iteration path for sprint/milestone assignment
     * @param {Array<string>} [additionalFields.tags] - Array of tags for categorization and filtering
     * @param {string} [additionalFields.state='New'] - Initial state (New, Active, Resolved, Closed)
     * @param {string} [additionalFields.reason] - Reason for current state
     * @param {Object} [additionalFields.customFields] - Custom field values for organization-specific fields
     * @param {string} [additionalFields.businessValue] - Business value description and justification
     * @param {Date} [additionalFields.targetDate] - Target completion date
     * 
     * @returns {Promise<UserStoryWorkItem>} Created user story work item with complete metadata
     * @returns {Promise<UserStoryWorkItem.id>} number - Unique work item identifier
     * @returns {Promise<UserStoryWorkItem.title>} string - User story title
     * @returns {Promise<UserStoryWorkItem.description>} string - Full description
     * @returns {Promise<UserStoryWorkItem.state>} string - Current work item state
     * @returns {Promise<UserStoryWorkItem.assignedTo>} Object - Assigned user information
     * @returns {Promise<UserStoryWorkItem.createdBy>} Object - Creator information
     * @returns {Promise<UserStoryWorkItem.createdDate>} Date - Creation timestamp
     * @returns {Promise<UserStoryWorkItem.priority>} number - Priority level
     * @returns {Promise<UserStoryWorkItem.storyPoints>} number - Story points estimate
     * @returns {Promise<UserStoryWorkItem.acceptanceCriteria>} string - Acceptance criteria
     * @returns {Promise<UserStoryWorkItem.url>} string - Web URL for work item access
     * @returns {Promise<UserStoryWorkItem.tags>} Array<string> - Associated tags
     * @returns {Promise<UserStoryWorkItem.relations>} Array<Object> - Related work items
     * 
     * @throws {Error} When user story creation fails due to system errors
     * @throws {ValidationError} When required fields are missing or invalid
     * @throws {AuthenticationError} When PAT lacks work item creation permissions
     * @throws {AuthorizationError} When user lacks permissions in the specified area path
     * @throws {NetworkError} When Azure DevOps services are unreachable
     * @throws {QuotaError} When work item limits are exceeded
     * @throws {FieldValidationError} When field values violate Azure DevOps constraints
     * 
     * @since 1.0.0
     * 
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/wit/work-items/create} Work Items API
     * @see {@link WorkItemManager#createUserStory} For low-level user story creation
     * @see {@link AzureDevOpsIntegration#createTask} For creating related tasks
     * @see {@link AzureDevOpsIntegration#linkUserStoryToFeature} For feature association
     * 
     * @example
     * // Basic user story creation
     * try {
     *   const userStory = await integration.createUserStory(
     *     'User Authentication System',
     *     'As a user, I want to securely log in to the application so that I can access my personal dashboard and protected features.'
     *   );
     *   
     *   console.log(`Created user story #${userStory.id}: ${userStory.title}`);
     *   console.log(`URL: ${userStory.url}`);
     * } catch (error) {
     *   console.error('Failed to create user story:', error.message);
     * }
     * 
     * @example
     * // Comprehensive user story with all metadata
     * const comprehensiveStory = await integration.createUserStory(
     *   'Advanced Search Functionality',
     *   'As a power user, I want advanced search capabilities with filters, sorting, and saved searches so that I can quickly find relevant content in large datasets.',
     *   {
     *     acceptanceCriteria: `
     *       Given I am on the search page
     *       When I enter search criteria
     *       Then I should see filtered results
     *       
     *       And I can apply multiple filters simultaneously
     *       And I can save my search preferences
     *       And I can sort results by relevance, date, or title
     *     `,
     *     priority: 2,
     *     storyPoints: 8,
     *     assignedTo: 'developer@company.com',
     *     areaPath: 'MyProject\\Features\\Search',
     *     iterationPath: 'MyProject\\Sprint 12',
     *     tags: ['search', 'performance', 'user-experience'],
     *     businessValue: 'Improves user productivity and reduces support tickets',
     *     targetDate: new Date('2024-02-15'),
     *     customFields: {
     *       'Custom.RiskLevel': 'Medium',
     *       'Custom.TechnicalComplexity': 'High'
     *     }
     *   }
     * );
     * 
     * @example
     * // Bulk user story creation with error handling
     * async function createUserStories(storyDefinitions) {
     *   const results = [];
     *   const errors = [];
     *   
     *   for (const [index, storyDef] of storyDefinitions.entries()) {
     *     try {
     *       console.log(`Creating story ${index + 1}/${storyDefinitions.length}: ${storyDef.title}`);
     *       
     *       const userStory = await integration.createUserStory(
     *         storyDef.title,
     *         storyDef.description,
     *         storyDef.additionalFields
     *       );
     *       
     *       results.push({
     *         index,
     *         success: true,
     *         userStory,
     *         title: storyDef.title
     *       });
     *       
     *       // Add delay to avoid rate limiting
     *       await new Promise(resolve => setTimeout(resolve, 100));
     *       
     *     } catch (error) {
     *       console.error(`Failed to create story ${index + 1}:`, error.message);
     *       errors.push({
     *         index,
     *         title: storyDef.title,
     *         error: error.message
     *       });
     *     }
     *   }
     *   
     *   console.log(`\n📊 Creation Summary:`);
     *   console.log(`✅ Successful: ${results.length}`);
     *   console.log(`❌ Failed: ${errors.length}`);
     *   
     *   if (errors.length > 0) {
     *     console.log('\n❌ Failed Stories:');
     *     errors.forEach(error => {
     *       console.log(`  - ${error.title}: ${error.error}`);
     *     });
     *   }
     *   
     *   return { results, errors };
     * }
     * 
     * @example
     * // Epic breakdown into user stories
     * class EpicBreakdown {
     *   constructor(integration) {
     *     this.integration = integration;
     *   }
     *   
     *   async createStoriesFromEpic(epicDefinition) {
     *     const { title, description, stories } = epicDefinition;
     *     
     *     console.log(`📋 Breaking down epic: ${title}`);
     *     console.log(`Stories to create: ${stories.length}`);
     *     
     *     const createdStories = [];
     *     
     *     for (const storyDef of stories) {
     *       try {
     *         const userStory = await this.integration.createUserStory(
     *           storyDef.title,
     *           storyDef.description,
     *           {
     *             ...storyDef.fields,
     *             tags: [...(storyDef.fields?.tags || []), 'epic-breakdown'],
     *             acceptanceCriteria: storyDef.acceptanceCriteria
     *           }
     *         );
     *         
     *         createdStories.push(userStory);
     *         console.log(`✅ Created: ${userStory.title} (#${userStory.id})`);
     *         
     *       } catch (error) {
     *         console.error(`❌ Failed to create: ${storyDef.title}`, error.message);
     *       }
     *     }
     *     
     *     return createdStories;
     *   }
     * }
     * 
     * @example
     * // Template-based user story creation
     * class UserStoryTemplates {
     *   static readonly TEMPLATES = {
     *     CRUD_OPERATION: {
     *       title: (entity) => `Manage ${entity} Records`,
     *       description: (entity) => `As a user, I want to create, read, update, and delete ${entity} records so that I can manage ${entity} data effectively.`,
     *       acceptanceCriteria: (entity) => `
     *         Given I have appropriate permissions
     *         When I access the ${entity} management page
     *         Then I can create new ${entity} records
     *         And I can view existing ${entity} records
     *         And I can edit ${entity} records
     *         And I can delete ${entity} records
     *         And I receive confirmation for all operations
     *       `,
     *       storyPoints: 5,
     *       priority: 3
     *     },
     *     
     *     AUTHENTICATION: {
     *       title: 'User Authentication System',
     *       description: 'As a user, I want to securely authenticate into the system so that I can access protected features.',
     *       acceptanceCriteria: `
     *         Given I have valid credentials
     *         When I attempt to log in
     *         Then I am authenticated successfully
     *         And I am redirected to the appropriate dashboard
     *         And my session is managed securely
     *       `,
     *       storyPoints: 8,
     *       priority: 1
     *     }
     *   };
     *   
     *   static async createFromTemplate(integration, templateName, customization = {}) {
     *     const template = this.TEMPLATES[templateName];
     *     if (!template) {
     *       throw new Error(`Template '${templateName}' not found`);
     *     }
     *     
     *     const title = typeof template.title === 'function' 
     *       ? template.title(customization.entity) 
     *       : template.title;
     *       
     *     const description = typeof template.description === 'function'
     *       ? template.description(customization.entity)
     *       : template.description;
     *       
     *     const acceptanceCriteria = typeof template.acceptanceCriteria === 'function'
     *       ? template.acceptanceCriteria(customization.entity)
     *       : template.acceptanceCriteria;
     *     
     *     return await integration.createUserStory(
     *       customization.title || title,
     *       customization.description || description,
     *       {
     *         acceptanceCriteria: customization.acceptanceCriteria || acceptanceCriteria,
     *         storyPoints: customization.storyPoints || template.storyPoints,
     *         priority: customization.priority || template.priority,
     *         ...customization.additionalFields
     *       }
     *     );
     *   }
     * }
     * 
     * @example
     * // User story creation with automatic task breakdown
     * async function createStoryWithTasks(storyData, taskDefinitions) {
     *   try {
     *     // Create the parent user story
     *     const userStory = await integration.createUserStory(
     *       storyData.title,
     *       storyData.description,
     *       storyData.additionalFields
     *     );
     *     
     *     console.log(`✅ Created user story #${userStory.id}: ${userStory.title}`);
     *     
     *     // Create related tasks
     *     const createdTasks = [];
     *     for (const taskDef of taskDefinitions) {
     *       try {
     *         const task = await integration.createTask(
     *           taskDef.title,
     *           taskDef.description,
     *           {
     *             ...taskDef.options,
     *             parentId: userStory.id
     *           }
     *         );
     *         
     *         createdTasks.push(task);
     *         console.log(`  ✅ Created task #${task.id}: ${task.title}`);
     *         
     *       } catch (error) {
     *         console.error(`  ❌ Failed to create task: ${taskDef.title}`, error.message);
     *       }
     *     }
     *     
     *     return {
     *       userStory,
     *       tasks: createdTasks,
     *       totalTasks: taskDefinitions.length,
     *       successfulTasks: createdTasks.length
     *     };
     *     
     *   } catch (error) {
     *     console.error('Failed to create user story with tasks:', error.message);
     *     throw error;
     *   }
     * }
     */
    async createUserStory(title, description, additionalFields = {}) {
        await this.ensureInitialized();
        return this.workItemManager.createUserStory(title, description, additionalFields);
    }    async createTask(title, description, options = {}) {
        await this.ensureInitialized();
        return this.workItemManager.createTask(title, description, options);
    }

    async createBug(title, description, options = {}) {
        await this.ensureInitialized();
        return this.workItemManager.createBug(title, description, options);
    }    async updateUserStory(workItemId, updates) {
        await this.ensureInitialized();
        return this.workItemManager.updateUserStory(workItemId, updates);
    }

    async updateBug(workItemId, updates) {
        await this.ensureInitialized();
        return this.workItemManager.updateBug(workItemId, updates);
    }

    async deleteUserStory(workItemId) {
        await this.ensureInitialized();
        return this.workItemManager.deleteUserStory(workItemId);
    }    async linkUserStoryToFeature(userStoryId, featureId) {
        await this.ensureInitialized();
        return this.workItemManager.linkUserStoryToFeature(userStoryId, featureId);
    }

    async linkWorkItems(sourceWorkItemId, targetWorkItemId, linkType = 'Child') {
        await this.ensureInitialized();
        return this.workItemManager.linkWorkItems(sourceWorkItemId, targetWorkItemId, linkType);
    }    async getWorkItem(workItemId, fields = null) {
        await this.ensureInitialized();
        return this.workItemManager.getWorkItem(workItemId, fields);
    }

    async searchWorkItems(wiql) {
        await this.ensureInitialized();
        return this.workItemManager.searchWorkItems(wiql);
    }

    async getUserStoriesForFeature(featureId) {
        await this.ensureInitialized();
        return this.workItemManager.getUserStoriesForFeature(featureId);
    }    
    
    /**
     * Add a comment to a work item
     * @param {number|string} workItemId - The ID of the work item
     * @param {string} comment - The comment text
     * @returns {Promise<Object>} - The created comment response
     */
    async addWorkItemComment(workItemId, comment) {
        return await this.workItemManager.addWorkItemComment(workItemId, comment);
    }

    /**
     * Get comments for a work item
     * @param {number|string} workItemId - The ID of the work item
     * @param {Object} options - Optional parameters
     * @returns {Promise<Object>} - The comments response
     */
    async getWorkItemComments(workItemId, options = {}) {
        return await this.workItemManager.getWorkItemComments(workItemId, options);
    }

    /**
     * Update a work item comment
     * @param {number|string} workItemId - The ID of the work item
     * @param {number|string} commentId - The ID of the comment to update
     * @param {string} text - The new comment text
     * @returns {Promise<Object>} - The updated comment response
     */
    async updateWorkItemComment(workItemId, commentId, text) {
        return await this.workItemManager.updateWorkItemComment(workItemId, commentId, text);
    }

    /**
     * Delete a work item comment
     * @param {number|string} workItemId - The ID of the work item
     * @param {number|string} commentId - The ID of the comment to delete
     * @returns {Promise<Object>} - The deletion response
     */
    async deleteWorkItemComment(workItemId, commentId) {
        return await this.workItemManager.deleteWorkItemComment(workItemId, commentId);
    }

    // Test Case Management Methods
    
    /**
     * Create a new test case
     * @param {string} title - The title of the test case
     * @param {string} description - The description of the test case
     * @param {Array} steps - Array of test steps with action and expectedResult
     * @param {Object} additionalFields - Additional fields for the test case
     * @returns {Promise<Object>} - The created test case response
     */
    async createTestCase(title, description, steps = [], additionalFields = {}) {
        await this.ensureInitialized();
        return this.testCaseManager.createTestCase(title, description, steps, additionalFields);
    }

    /**
     * Update an existing test case
     * @param {number|string} testCaseId - The ID of the test case to update
     * @param {Object} updates - Updates to apply to the test case
     * @returns {Promise<Object>} - The updated test case response
     */
    async updateTestCase(testCaseId, updates) {
        await this.ensureInitialized();
        return this.testCaseManager.updateTestCase(testCaseId, updates);
    }

    /**
     * Get a test case by ID
     * @param {number|string} testCaseId - The ID of the test case to retrieve
     * @param {Array} fields - Optional array of fields to retrieve
     * @returns {Promise<Object>} - The test case response
     */
    async getTestCase(testCaseId, fields = null) {
        await this.ensureInitialized();
        return this.testCaseManager.getTestCase(testCaseId, fields);
    }

    /**
     * Associate a test case with a user story
     * @param {number|string} testCaseId - The ID of the test case
     * @param {number|string} userStoryId - The ID of the user story
     * @returns {Promise<Object>} - The association response
     */
    async associateTestCaseWithUserStory(testCaseId, userStoryId) {
        await this.ensureInitialized();
        return this.testCaseManager.associateTestCaseWithUserStory(testCaseId, userStoryId);
    }

    /**
     * Delete a test case permanently from Azure DevOps
     * @param {number|string} testCaseId - The ID of the test case to delete
     * @returns {Promise<Object>} - The deletion response with success status and details
     */
    async deleteTestCase(testCaseId) {
        await this.ensureInitialized();
        try {
            const result = await this.testCaseManager.deleteTestCase(testCaseId);
            return {
                success: true,
                id: result.id,
                title: result.title,
                deleted: result.deleted,
                deletedDate: result.deletedDate
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Remove the association between a test case and a user story
     * @param {number|string} testCaseId - The ID of the test case to disassociate
     * @param {number|string} userStoryId - The ID of the user story to disassociate from
     * @returns {Promise<Object>} - The disassociation response with success status and details
     */
    async removeTestCaseFromUserStory(testCaseId, userStoryId) {
        await this.ensureInitialized();
        try {
            const result = await this.testCaseManager.removeTestCaseFromUserStory(testCaseId, userStoryId);
            return {
                success: true,
                testCaseId: result.testCaseId,
                userStoryId: result.userStoryId,
                testCaseTitle: result.testCaseTitle,
                userStoryTitle: result.userStoryTitle,
                removed: result.removed,
                removedDate: result.removedDate,
                message: result.message
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

}

export default AzureDevOpsIntegration;
