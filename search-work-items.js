#!/usr/bin/env node
/**
 * Script to search for work items in Azure DevOps project
 * This will help us find bug work items to test repro steps functionality
 */

import AzureDevOpsIntegration from './src/modules/azureDevOpsIntegration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function searchWorkItems() {
    console.log('🔍 Searching for work items in Azure DevOps...');
    
    try {
        // Initialize Azure DevOps integration
        const integration = new AzureDevOpsIntegration({
            organizationUrl: process.env.AZURE_DEVOPS_ORG_URL,
            personalAccessToken: process.env.AZURE_DEVOPS_PAT,
            project: process.env.AZURE_DEVOPS_PROJECT
        });

        console.log('🔧 Initializing Azure DevOps connection...');
        const initialized = await integration.initialize();
        
        if (!initialized) {
            throw new Error('Failed to initialize Azure DevOps connection');
        }

        console.log('✅ Azure DevOps connection established');

        // Search for bugs in the project
        console.log('\n🐛 Searching for Bug work items...');
        const bugQuery = `
            SELECT 
                [System.Id],
                [System.Title],
                [System.State],
                [System.CreatedDate],
                [System.WorkItemType]
            FROM workitems 
            WHERE [System.TeamProject] = '${process.env.AZURE_DEVOPS_PROJECT}'
            AND [System.WorkItemType] = 'Bug'
            ORDER BY [System.Id] DESC
        `;

        const bugResults = await integration.searchWorkItems(bugQuery);
        
        if (bugResults.success) {
            console.log(`✅ Found ${bugResults.workItems.length} bug(s):`);
            
            bugResults.workItems.forEach((item, index) => {
                console.log(`\n   ${index + 1}. Bug ID: ${item.id}`);
                console.log(`      Title: ${item.fields['System.Title']}`);
                console.log(`      State: ${item.fields['System.State']}`);
                console.log(`      Created: ${new Date(item.fields['System.CreatedDate']).toLocaleDateString()}`);
            });

            if (bugResults.workItems.length > 0) {
                const firstBugId = bugResults.workItems[0].id;
                console.log(`\n💡 You can test with the first bug: node test-bug-repro.js ${firstBugId}`);
            }
        } else {
            console.log('❌ Failed to search for bugs:', bugResults.error);
        }

        // Also search for any work items (bugs, user stories, etc.)
        console.log('\n📋 Searching for all work items (recent 10)...');
        const allQuery = `
            SELECT 
                [System.Id],
                [System.Title],
                [System.State],
                [System.WorkItemType]
            FROM workitems 
            WHERE [System.TeamProject] = '${process.env.AZURE_DEVOPS_PROJECT}'
            ORDER BY [System.Id] DESC
        `;

        const allResults = await integration.searchWorkItems(allQuery);
        
        if (allResults.success) {
            console.log(`✅ Found ${allResults.workItems.length} total work item(s):`);
            
            // Show first 10 results
            allResults.workItems.slice(0, 10).forEach((item, index) => {
                console.log(`\n   ${index + 1}. ID: ${item.id} | Type: ${item.fields['System.WorkItemType']}`);
                console.log(`      Title: ${item.fields['System.Title']}`);
                console.log(`      State: ${item.fields['System.State']}`);
            });

            if (allResults.workItems.length > 0) {
                const firstWorkItemId = allResults.workItems[0].id;
                console.log(`\n💡 Test with any work item: node test-bug-repro.js ${firstWorkItemId}`);
            }
        } else {
            console.log('❌ Failed to search for work items:', allResults.error);
        }

    } catch (error) {
        console.error('❌ Search failed:', error.message);
        console.error('💡 Make sure your Azure DevOps credentials are configured in .env file');
    }
}

// Run the search
searchWorkItems().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});
