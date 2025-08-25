#!/usr/bin/env node
/**
 * Bug Analysis Script
 * 
 * This script searches for bugs in the Azure DevOps project and analyzes them
 * to find reproduction steps and other relevant information.
 */

import AzureDevOpsIntegration from './src/modules/azureDevOpsIntegration.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function findAndAnalyzeBugs() {
    console.log('🔍 Searching for bugs in Azure DevOps project...');
    console.log('=====================================\n');
    
    try {
        // Initialize Azure DevOps integration
        const integration = new AzureDevOpsIntegration({
            organizationUrl: process.env.AZURE_DEVOPS_ORG_URL,
            personalAccessToken: process.env.AZURE_DEVOPS_PAT,
            project: process.env.AZURE_DEVOPS_PROJECT
        });

        console.log('🔧 Connecting to Azure DevOps...');
        await integration.initialize();
        console.log('✅ Connected successfully!\n');

        // Try to find bugs by checking common work item IDs
        console.log('🐛 Searching for Bug work items...');
        const testIds = [];
        
        // Generate a range of IDs to test
        for (let i = 1; i <= 200; i += 5) {
            testIds.push(i);
        }

        const foundBugs = [];
        const foundWorkItems = [];

        for (const id of testIds) {
            try {
                const result = await integration.getWorkItem(id);
                if (result.success) {
                    const workItem = {
                        id: id,
                        title: result.workItem.fields['System.Title'],
                        type: result.workItem.fields['System.WorkItemType'],
                        state: result.workItem.fields['System.State'],
                        description: result.workItem.fields['System.Description'] || '',
                        createdDate: result.workItem.fields['System.CreatedDate']
                    };
                    
                    foundWorkItems.push(workItem);
                    
                    if (workItem.type === 'Bug') {
                        foundBugs.push(workItem);
                    }
                }
            } catch (error) {
                // Skip unavailable work items
                continue;
            }
        }

        console.log(`✅ Found ${foundWorkItems.length} total work items`);
        console.log(`🐛 Found ${foundBugs.length} Bug work items\n`);

        if (foundBugs.length > 0) {
            console.log('📋 Bug Work Items Found:');
            foundBugs.forEach((bug, index) => {
                console.log(`\n   ${index + 1}. Bug ID: ${bug.id}`);
                console.log(`      Title: ${bug.title}`);
                console.log(`      State: ${bug.state}`);
                console.log(`      Created: ${new Date(bug.createdDate).toLocaleDateString()}`);
                
                if (bug.description) {
                    const cleanDesc = bug.description.replace(/<[^>]*>/g, '').trim();
                    console.log(`      Description: ${cleanDesc.substring(0, 100)}${cleanDesc.length > 100 ? '...' : ''}`);
                }
            });

            // Analyze the first bug in detail
            const firstBug = foundBugs[0];
            console.log(`\n🔍 Detailed Analysis of Bug ${firstBug.id}:`);
            console.log('=====================================');
            await analyzeBugInDetail(integration, firstBug.id);
        } else {
            console.log('❌ No Bug work items found in the scanned range');
            console.log('\n📋 Other work items found:');
            foundWorkItems.slice(0, 10).forEach((item, index) => {
                console.log(`\n   ${index + 1}. ID: ${item.id} - ${item.type}`);
                console.log(`      Title: ${item.title}`);
                console.log(`      State: ${item.state}`);
            });
            
            if (foundWorkItems.length > 0) {
                console.log(`\n💡 You can analyze any work item with:`);
                console.log(`   node test-bug-repro.js ${foundWorkItems[0].id}`);
            }
        }

    } catch (error) {
        console.error('❌ Analysis failed:', error.message);
    }
}

async function analyzeBugInDetail(integration, bugId) {
    try {
        console.log(`\n📄 Retrieving detailed information for Bug ${bugId}...`);
        
        // Get full work item details
        const workItem = await integration.getWorkItem(bugId);
        
        if (!workItem.success) {
            console.log('❌ Failed to retrieve work item details');
            return;
        }

        const fields = workItem.workItem.fields;
        
        console.log('\n📊 Bug Details:');
        console.log(`   Title: ${fields['System.Title']}`);
        console.log(`   State: ${fields['System.State']}`);
        console.log(`   Priority: ${fields['Microsoft.VSTS.Common.Priority'] || 'Not set'}`);
        console.log(`   Severity: ${fields['Microsoft.VSTS.Common.Severity'] || 'Not set'}`);
        console.log(`   Assigned To: ${fields['System.AssignedTo']?.displayName || 'Unassigned'}`);
        console.log(`   Created: ${new Date(fields['System.CreatedDate']).toLocaleString()}`);
        console.log(`   Changed: ${new Date(fields['System.ChangedDate']).toLocaleString()}`);

        // Check for reproduction steps and related information
        console.log('\n🔍 Reproduction Information:');
        const reproFields = [
            { field: 'Microsoft.VSTS.TCM.ReproSteps', name: 'Reproduction Steps' },
            { field: 'System.Description', name: 'Description' },
            { field: 'Microsoft.VSTS.Common.AcceptanceCriteria', name: 'Acceptance Criteria' },
            { field: 'Microsoft.VSTS.TCM.SystemInfo', name: 'System Info' },
            { field: 'Microsoft.VSTS.Common.FoundIn', name: 'Found In Build' }
        ];
        
        let foundReproInfo = false;
        reproFields.forEach(fieldInfo => {
            const value = fields[fieldInfo.field];
            if (value) {
                console.log(`\n   📝 ${fieldInfo.name}:`);
                const cleanValue = value.toString().replace(/<[^>]*>/g, '').trim();
                console.log(`      ${cleanValue}`);
                foundReproInfo = true;
            }
        });

        if (!foundReproInfo) {
            console.log('   ℹ️  No reproduction information found in standard fields');
        }

        // Analyze comments
        console.log('\n💬 Comments Analysis:');
        const comments = await integration.getWorkItemComments(bugId);
        
        if (comments.success && comments.count > 0) {
            console.log(`   Found ${comments.count} comment(s):`);
            
            comments.comments.comments.forEach((comment, index) => {
                console.log(`\n   💬 Comment ${index + 1}:`);
                console.log(`      By: ${comment.createdBy.displayName}`);
                console.log(`      Date: ${new Date(comment.createdDate).toLocaleString()}`);
                console.log(`      Text: ${comment.text}`);
                
                // Check for reproduction keywords
                const reproKeywords = ['repro', 'reproduce', 'steps', 'how to', 'recreation', 'replicate', 'bug', 'issue', 'problem'];
                const commentLower = comment.text.toLowerCase();
                const foundKeywords = reproKeywords.filter(keyword => commentLower.includes(keyword));
                
                if (foundKeywords.length > 0) {
                    console.log(`      🔍 Contains keywords: ${foundKeywords.join(', ')}`);
                }
            });
        } else {
            console.log('   ℹ️  No comments found');
        }

        // Check for related work items
        if (workItem.workItem.relations && workItem.workItem.relations.length > 0) {
            console.log('\n🔗 Related Work Items:');
            workItem.workItem.relations.forEach((relation, index) => {
                console.log(`   ${index + 1}. ${relation.rel}: ${relation.url}`);
            });
        }

        console.log('\n✅ Bug analysis complete!');

    } catch (error) {
        console.error('❌ Failed to analyze bug:', error.message);
    }
}

// Run the analysis
findAndAnalyzeBugs().catch(error => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
});
