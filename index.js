/**
 * Azure DevOps MCP Integration Module
 * 
 * @file index.js - Main entry point for the Azure DevOps Model Context Protocol (MCP) integration
 * @description This module serves as the primary interface for interacting with Azure DevOps services
 * through the Model Context Protocol. It provides a simplified API for work item management,
 * pull request operations, and test case handling.
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires dotenv - For environment variable management
 * @requires ./src/modules/azureDevOpsIntegration - Core integration module
 * 
 * @example
 * // Import and use the integration
 * import { AzureDevOpsIntegration } from './index.js';
 * 
 * const integration = new AzureDevOpsIntegration({
 *   organizationUrl: 'https://dev.azure.com/your-org',
 *   personalAccessToken: 'your-pat-token',
 *   project: 'your-project'
 * });
 * 
 * await integration.initialize();
 * const workItem = await integration.createUserStory('Title', 'Description');
 */

import dotenv from 'dotenv';
import AzureDevOpsIntegration from './src/modules/azureDevOpsIntegration.js';
import { CodeReviewManager } from './src/modules/codeReviewManager.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Main demonstration function for Azure DevOps integration
 * 
 * @async
 * @function main
 * @description Demonstrates basic usage of the Azure DevOps integration by
 * initializing the connection and testing connectivity to Azure DevOps services.
 * This function serves as both a demonstration and a basic health check.
 * 
 * @throws {Error} When Azure DevOps connection fails or environment variables are missing
 * @returns {Promise<void>} Resolves when demonstration is complete
 * 
 * @example
 * // Run the demonstration
 * main().catch(console.error);
 */
async function main() {
    try {

        console.log('🚀 Azure DevOps MCP Integration Module');
        console.log('=====================================');
        
        // Initialize Azure DevOps integration with configuration from environment variables
        const azureDevOps = new AzureDevOpsIntegration({
            organizationUrl: process.env.AZURE_DEVOPS_ORG_URL,
            personalAccessToken: process.env.AZURE_DEVOPS_PAT,
            project: process.env.AZURE_DEVOPS_PROJECT
        });

        // Test connection to validate configuration and connectivity
        const isConnected = await azureDevOps.testConnection();
        
        if (isConnected) {
            console.log('✅ Successfully connected to Azure DevOps');
            
            // Test code review manager
            console.log('\n🔍 Initializing Code Review Manager...');
            const codeReviewManager = new CodeReviewManager(azureDevOps.webApi, process.env.AZURE_DEVOPS_PROJECT);
            await codeReviewManager.initialize();
            console.log('✅ Code Review Manager initialized successfully');
            
        } else {
            console.log('❌ Failed to connect to Azure DevOps');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the main function if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

// Export for use by other modules
export default AzureDevOpsIntegration;
export { CodeReviewManager };
