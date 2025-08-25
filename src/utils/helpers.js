/**
 * Azure DevOps Utility Functions
 * 
 * @file helpers.js - Collection of utility functions for Azure DevOps operations
 * @description This module provides a comprehensive set of utility functions used throughout
 * the Azure DevOps MCP integration. Includes URL parsing, field formatting, validation,
 * retry logic, and error handling utilities that ensure robust and reliable operations.
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @example
 * // Parse Azure DevOps URLs
 * import { parseAzureDevOpsUrl, retryOperation } from './helpers.js';
 * 
 * const urlInfo = parseAzureDevOpsUrl('https://dev.azure.com/org/project/_git/repo/pullrequest/123');
 * console.log(urlInfo.pullRequestId); // 123
 * 
 * // Use retry logic for API calls
 * const result = await retryOperation(async () => {
 *   return await apiCall();
 * }, 3, 1000);
 */

/**
 * Parses Azure DevOps URLs to extract organization, project, and resource information
 * 
 * @function parseAzureDevOpsUrl
 * @description Analyzes Azure DevOps URLs and extracts structured information including
 * organization name, project name, repository name, and resource IDs. Supports pull
 * request, work item, and repository URLs.
 * 
 * @param {string} url - The Azure DevOps URL to parse
 * @returns {Object} Parsed URL components
 * @returns {string} returns.type - Type of resource ('pullRequest', 'workItem', 'repository')
 * @returns {string} returns.organization - Organization name
 * @returns {string} returns.project - Project name
 * @returns {string} [returns.repository] - Repository name (for git-related URLs)
 * @returns {number} [returns.pullRequestId] - Pull request ID (for PR URLs)
 * @returns {number} [returns.workItemId] - Work item ID (for work item URLs)
 * 
 * @throws {Error} When URL format is not recognized or invalid
 * 
 * @example
 * // Parse pull request URL
 * const prInfo = parseAzureDevOpsUrl(
 *   'https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/123'
 * );
 * console.log(prInfo);
 * // {
 * //   type: 'pullRequest',
 * //   organization: 'myorg',
 * //   project: 'myproject',
 * //   repository: 'myrepo',
 * //   pullRequestId: 123
 * // }
 * 
 * // Parse work item URL
 * const wiInfo = parseAzureDevOpsUrl(
 *   'https://dev.azure.com/myorg/myproject/_workitems/edit/456'
 * );
 * console.log(wiInfo.workItemId); // 456
 */
export function parseAzureDevOpsUrl(url) {
    const patterns = {
        pullRequest: /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)\/pullrequest\/(\d+)/,
        workItem: /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_workitems\/edit\/(\d+)/,
        repository: /https:\/\/dev\.azure\.com\/([^\/]+)\/([^\/]+)\/_git\/([^\/]+)/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
        const match = url.match(pattern);
        if (match) {
            switch (type) {
                case 'pullRequest':
                    return {
                        type: 'pullRequest',
                        organization: match[1],
                        project: match[2],
                        repository: match[3],
                        pullRequestId: parseInt(match[4])
                    };
                case 'workItem':
                    return {
                        type: 'workItem',
                        organization: match[1],
                        project: match[2],
                        workItemId: parseInt(match[3])
                    };
                case 'repository':
                    return {
                        type: 'repository',
                        organization: match[1],
                        project: match[2],
                        repository: match[3]
                    };
            }
        }
    }

    throw new Error(`Unable to parse Azure DevOps URL: ${url}`);
}

/**
 * Formats work item fields for Azure DevOps API patch operations
 * 
 * @function formatWorkItemFields
 * @description Converts a simple key-value object into the JSON Patch format required
 * by the Azure DevOps Work Item API. Each field becomes an 'add' operation targeting
 * the appropriate field path.
 * 
 * @param {Object} fields - Object containing field names and values
 * @returns {Array<Object>} Array of JSON Patch operations
 * @returns {string} returns[].op - Operation type (always 'add')
 * @returns {string} returns[].path - Field path in format '/fields/FieldName'
 * @returns {*} returns[].value - Field value
 * 
 * @example
 * const fields = {
 *   'System.Title': 'My User Story',
 *   'System.Description': 'Story description',
 *   'Microsoft.VSTS.Common.Priority': 2
 * };
 * 
 * const patchDocument = formatWorkItemFields(fields);
 * console.log(patchDocument);
 * // [
 * //   { op: 'add', path: '/fields/System.Title', value: 'My User Story' },
 * //   { op: 'add', path: '/fields/System.Description', value: 'Story description' },
 * //   { op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: 2 }
 * // ]
 */
export function formatWorkItemFields(fields) {
    return Object.entries(fields).map(([key, value]) => ({
        op: 'add',
        path: `/fields/${key}`,
        value: value
    }));
}

/**
 * Validates work item type against supported Azure DevOps work item types
 * 
 * @function validateWorkItemType
 * @description Ensures the provided work item type is valid and supported by
 * the Azure DevOps integration. Throws an error for unsupported types.
 * 
 * @param {string} type - Work item type to validate
 * @throws {Error} When work item type is not supported
 * 
 * @example
 * validateWorkItemType('User Story'); // ✓ Valid
 * validateWorkItemType('Epic');       // ✓ Valid
 * validateWorkItemType('Invalid');    // ✗ Throws error
 */
export function validateWorkItemType(type) {
    const validTypes = ['User Story', 'Feature', 'Epic', 'Task', 'Bug', 'Test Case'];
    if (!validTypes.includes(type)) {
        throw new Error(`Invalid work item type: ${type}. Valid types: ${validTypes.join(', ')}`);
    }
}

/**
 * Generates unique identifiers for operations and tracking
 * 
 * @function generateOperationId
 * @description Creates a unique identifier combining timestamp and random string.
 * Useful for tracking operations, logging, and ensuring uniqueness across requests.
 * 
 * @returns {string} Unique operation identifier in format 'op_timestamp_randomstring'
 * 
 * @example
 * const opId = generateOperationId();
 * console.log(opId); // 'op_1640995200000_abc123def'
 */
export function generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Executes operations with retry logic and exponential backoff
 * 
 * @async
 * @function retryOperation
 * @description Provides robust retry mechanism for operations that may fail due to
 * network issues, rate limiting, or temporary service unavailability. Uses exponential
 * backoff strategy to avoid overwhelming the service.
 * 
 * @param {Function} operation - Async function to execute (should return a Promise)
 * @param {number} [maxRetries=3] - Maximum number of retry attempts
 * @param {number} [baseDelay=1000] - Base delay in milliseconds (doubled each retry)
 * @returns {Promise<*>} Result of the successful operation
 * 
 * @throws {Error} When operation fails after all retry attempts
 * 
 * @example
 * // Retry an API call that might fail
 * const result = await retryOperation(async () => {
 *   const response = await fetch('/api/data');
 *   if (!response.ok) throw new Error('API call failed');
 *   return response.json();
 * }, 3, 1000);
 * 
 * // Custom retry parameters
 * const data = await retryOperation(
 *   () => riskOperation(),
 *   5,    // 5 retry attempts
 *   2000  // Start with 2 second delay
 * );
 */
export async function retryOperation(operation, maxRetries = 3, baseDelay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            
            if (attempt === maxRetries) {
                break;
            }
            
            const delay = baseDelay * Math.pow(2, attempt - 1);
            // Retry logging suppressed for MCP mode
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    throw new Error(`Operation failed after ${maxRetries} attempts: ${lastError.message}`);
}

/**
 * Extracts meaningful error messages from Azure DevOps API responses
 * 
 * @function extractErrorMessage
 * @description Parses error objects from Azure DevOps API responses to extract
 * the most relevant error message. Handles various error response formats and
 * provides fallback for unknown error structures.
 * 
 * @param {Error|Object} error - Error object from Azure DevOps API or network call
 * @returns {string} Human-readable error message
 * 
 * @example
 * try {
 *   await azureDevOpsApiCall();
 * } catch (error) {
 *   const message = extractErrorMessage(error);
 *   console.error('Azure DevOps operation failed:', message);
 *   // Instead of: Error: Request failed with status code 400
 *   // Shows: The specified work item does not exist
 * }
 */
export function extractErrorMessage(error) {
    if (error.response && error.response.data) {
        if (error.response.data.message) {
            return error.response.data.message;
        }
        if (error.response.data.error && error.response.data.error.message) {
            return error.response.data.error.message;
        }
    }
    return error.message || 'Unknown error occurred';
}
