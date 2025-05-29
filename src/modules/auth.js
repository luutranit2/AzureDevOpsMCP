/**
 * Azure DevOps Authentication Module
 * 
 * @file auth.js - Handles authentication and API connection management for Azure DevOps
 * @description This module provides comprehensive authentication services for Azure DevOps,
 * including Personal Access Token (PAT) handling, connection management, and API client
 * initialization. It supports both modern dev.azure.com and legacy visualstudio.com URLs.
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires azure-devops-node-api - Official Azure DevOps Node.js API client
 * @requires ../utils/helpers - Utility functions for error handling and retries
 * 
 * @example
 * // Initialize authentication
 * const auth = new AzureDevOpsAuth(
 *   'https://dev.azure.com/myorg',
 *   'personal_access_token_here',
 *   { maxRetries: 3, timeout: 30000 }
 * );
 * 
 * await auth.initialize();
 * const webApi = auth.getWebApi();
 * const workItemApi = await webApi.getWorkItemTrackingApi();
 */

import { getPersonalAccessTokenHandler, getBearerHandler, WebApi } from 'azure-devops-node-api';
import { extractErrorMessage, retryOperation } from '../utils/helpers.js';

/**
 * Azure DevOps Authentication Class
 * 
 * @class AzureDevOpsAuth
 * @description Manages authentication and connection to Azure DevOps services.
 * Handles PAT token validation, connection setup, and provides access to the
 * Azure DevOps Web API client for downstream operations.
 */
export class AzureDevOpsAuth {
    /**
     * Creates an instance of AzureDevOpsAuth
     * 
     * @constructor
     * @param {string} organizationUrl - Azure DevOps organization URL
     * @param {string} personalAccessToken - Personal Access Token for authentication
     * @param {Object} [options={}] - Additional configuration options
     * @param {number} [options.maxRetries=3] - Maximum number of retry attempts
     * @param {number} [options.timeout=30000] - Request timeout in milliseconds
     * @param {boolean} [options.allowInsecureConnections=false] - Allow insecure HTTPS connections
     * 
     * @throws {Error} When organization URL is invalid or missing
     * 
     * @example
     * const auth = new AzureDevOpsAuth(
     *   'https://dev.azure.com/myorg',
     *   'pat_token_here',
     *   { maxRetries: 5, timeout: 60000 }
     * );
     */
    constructor(organizationUrl, personalAccessToken, options = {}) {
        this.organizationUrl = this.normalizeOrganizationUrl(organizationUrl);
        this.personalAccessToken = personalAccessToken;
        this.options = {
            maxRetries: options.maxRetries || 3,
            timeout: options.timeout || 30000,
            allowInsecureConnections: options.allowInsecureConnections || false,
            ...options
        };
        this.webApi = null;
        this.authHandler = null;
        this.connectionInfo = null;
    }    
    
    /**
     * Normalizes the organization URL to ensure correct format and compatibility
     * 
     * @private
     * @method normalizeOrganizationUrl
     * @description Converts organization URLs to the standard dev.azure.com format
     * and validates URL structure. Handles legacy visualstudio.com URLs by converting
     * them to the modern format.
     * 
     * @param {string} url - The organization URL to normalize
     * @returns {string} Normalized organization URL
     * 
     * @throws {Error} When URL is missing or has invalid format
     * 
     * @example
     * // Converts legacy format
     * normalizeOrganizationUrl('https://myorg.visualstudio.com')
     * // Returns: 'https://dev.azure.com/myorg'
     * 
     * // Validates modern format
     * normalizeOrganizationUrl('https://dev.azure.com/myorg/')
     * // Returns: 'https://dev.azure.com/myorg'
     */
    normalizeOrganizationUrl(url) {
        if (!url) {
            throw new Error('Organization URL is required');
        }

        // Remove trailing slash
        url = url.replace(/\/$/, '');

        // Ensure it's using https://dev.azure.com format
        if (url.includes('visualstudio.com')) {
            // Convert old format: https://organization.visualstudio.com
            const orgName = url.match(/https:\/\/([^.]+)\.visualstudio\.com/)?.[1];
            if (orgName) {
                url = `https://dev.azure.com/${orgName}`;
            }
        }

        // Validate URL format
        if (!url.match(/^https:\/\/dev\.azure\.com\/[^\/]+$/)) {
            throw new Error('Invalid organization URL. Expected format: https://dev.azure.com/organization');
        }

        return url;
    }    
    
    /**
     * Validate the Personal Access Token format
     */
    validatePersonalAccessToken(token) {
        if (!token) {
            throw new Error('Personal Access Token is required');
        }

        // Skip validation for Bearer tokens (they have different format)
        if (token.startsWith('Bearer ')) {
            const bearerToken = token.substring(7);
            if (bearerToken.length < 10) {
                throw new Error('Bearer token appears to be too short');
            }
            return true;
        }

        // PAT should be a base64-like string, typically 52 characters
        if (token.length < 20) {
            throw new Error('Personal Access Token appears to be too short');
        }

        // Check for common PAT format patterns
        if (!/^[A-Za-z0-9+/=]+$/.test(token)) {
            throw new Error('Personal Access Token contains invalid characters');
        }

        return true;
    }

    /**
     * Create authentication handler based on token type
     */
    createAuthHandler() {
        this.validatePersonalAccessToken(this.personalAccessToken);

        // Check if it's a Bearer token or PAT
        if (this.personalAccessToken.startsWith('Bearer ')) {
            const token = this.personalAccessToken.substring(7);
            return getBearerHandler(token);
        } else {
            return getPersonalAccessTokenHandler(this.personalAccessToken);
        }
    }

    /**
     * Initialize the Azure DevOps API connection
     */
    async initialize() {
        try {
            console.log(`🔄 Initializing connection to ${this.organizationUrl}...`);

            this.authHandler = this.createAuthHandler();
            
            // Create WebApi instance with timeout and retry options
            this.webApi = new WebApi(this.organizationUrl, this.authHandler, {
                allowRetries: true,
                maxRetries: this.options.maxRetries,
                timeout: this.options.timeout
            });

            // Test the connection to ensure it's working
            const connectionTest = await this.testConnection();
            if (!connectionTest) {
                throw new Error('Failed to establish connection to Azure DevOps');
            }

            console.log('✅ Successfully initialized Azure DevOps connection');
            return true;
        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error('❌ Authentication initialization failed:', errorMessage);
            throw new Error(`Authentication failed: ${errorMessage}`);
        }
    }

    /**
     * Get the initialized Web API client
     */
    getWebApi() {
        if (!this.webApi) {
            throw new Error('Azure DevOps API not initialized. Call initialize() first.');
        }
        return this.webApi;
    }

    /**
     * Get connection information
     */
    async getConnectionInfo() {
        if (this.connectionInfo) {
            return this.connectionInfo;
        }

        try {
            const coreApi = await this.webApi.getCoreApi();
            const connectionData = await coreApi.getConnectedServiceDetails();
            
            this.connectionInfo = {
                authenticatedUser: connectionData.authenticatedUser,
                authorizedUser: connectionData.authorizedUser,
                instanceId: connectionData.instanceId,
                deploymentId: connectionData.deploymentId,
                deploymentType: connectionData.deploymentType
            };

            return this.connectionInfo;
        } catch (error) {
            console.warn('Could not retrieve connection info:', extractErrorMessage(error));
            return null;
        }
    }

    /**
     * Test the connection to Azure DevOps with detailed validation
     */
    async testConnection() {
        try {
            if (!this.webApi) {
                await this.initialize();
            }

            console.log('🔄 Testing Azure DevOps connection...');

            // Test 1: Basic API access
            const coreApi = await this.webApi.getCoreApi();
            
            // Test 2: Get projects (this requires basic read permissions)
            const projects = await retryOperation(async () => {
                return await coreApi.getProjects();
            }, this.options.maxRetries);

            // Test 3: Get connection info
            await this.getConnectionInfo();

            console.log(`✅ Connection successful! Found ${projects.length} projects.`);
            
            if (projects.length > 0) {
                console.log(`📋 Available projects: ${projects.slice(0, 3).map(p => p.name).join(', ')}${projects.length > 3 ? '...' : ''}`);
            }

            return {
                success: true,
                projectCount: projects.length,
                projects: projects.map(p => ({ id: p.id, name: p.name, description: p.description }))
            };
        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error('❌ Connection test failed:', errorMessage);
            
            // Provide helpful error messages based on common issues
            if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
                throw new Error('Authentication failed. Please check your Personal Access Token.');
            } else if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
                throw new Error('Access denied. Please ensure your PAT has the required permissions.');
            } else if (errorMessage.includes('404') || errorMessage.includes('Not Found')) {
                throw new Error('Organization not found. Please check your organization URL.');
            } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
                throw new Error('Connection timeout. Please check your network connection.');
            }
            
            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Validate PAT permissions by testing specific API endpoints
     */
    async validatePermissions(requiredPermissions = []) {
        const permissions = {
            'Work Items': { api: 'getWorkItemTrackingApi', test: 'getWorkItemTypes' },
            'Git': { api: 'getGitApi', test: 'getRepositories' },
            'Test Management': { api: 'getTestApi', test: 'getTestPlans' },
            'Build': { api: 'getBuildApi', test: 'getBuilds' },
            'Release': { api: 'getReleaseApi', test: 'getReleases' }
        };

        const results = {};
        
        for (const permission of requiredPermissions) {
            if (!permissions[permission]) {
                results[permission] = { available: false, error: 'Unknown permission type' };
                continue;
            }

            try {
                const api = await this.webApi[permissions[permission].api]();
                // Test with a simple call that requires minimal permissions
                await api[permissions[permission].test](undefined, undefined, undefined, undefined, 1);
                results[permission] = { available: true };
            } catch (error) {
                const errorMessage = extractErrorMessage(error);
                results[permission] = { 
                    available: false, 
                    error: errorMessage.includes('403') ? 'Insufficient permissions' : errorMessage
                };
            }
        }

        return results;
    }

    /**
     * Refresh the connection (useful for long-running applications)
     */
    async refresh() {
        console.log('🔄 Refreshing Azure DevOps connection...');
        this.webApi = null;
        this.connectionInfo = null;
        return await this.initialize();
    }

    /**
     * Get organization information
     */
    async getOrganizationInfo() {
        try {
            const coreApi = await this.webApi.getCoreApi();
            const projects = await coreApi.getProjects();
            
            // Extract organization name from URL
            const orgName = this.organizationUrl.split('/').pop();
            
            return {
                name: orgName,
                url: this.organizationUrl,
                projectCount: projects.length,
                projects: projects.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    state: p.state,
                    visibility: p.visibility
                }))
            };
        } catch (error) {
            throw new Error(`Failed to get organization info: ${extractErrorMessage(error)}`);
        }
    }

    /**
     * Dispose of the connection
     */
    dispose() {
        this.webApi = null;
        this.authHandler = null;
        this.connectionInfo = null;
        console.log('🔌 Azure DevOps connection disposed');
    }
}
