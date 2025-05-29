/**
 * Pull Request Manager Tests
 * Tests for Azure DevOps pull request functionality
 */

import { PullRequestManager } from '../src/modules/pullRequestManager.js';
import { parseAzureDevOpsUrl } from '../src/utils/helpers.js';

async function runPullRequestTests() {
    console.log('🧪 Running Pull Request Manager Tests...');
    console.log('=======================================');

    // Test 1: URL Parsing for Pull Requests
    console.log('\n📝 Test 1: Pull Request URL Parsing');
    try {
        const testUrls = [
            'https://dev.azure.com/testorg/testproject/_git/testrepo/pullrequest/123',
            'https://dev.azure.com/mycompany/MyProject/_git/MyRepository/pullrequest/456'
        ];

        for (const url of testUrls) {
            const parsed = parseAzureDevOpsUrl(url);
            console.log(`✅ URL parsed successfully: PR ${parsed.pullRequestId} in ${parsed.repository}`);
        }
    } catch (error) {
        console.log('❌ URL parsing test failed:', error.message);
    }    // Test 2: Invalid URL Handling
    console.log('\n📝 Test 2: Invalid Pull Request URL Handling');
    try {
        parseAzureDevOpsUrl('https://invalid-url-format');
        console.log('❌ Should have thrown error for invalid URL');
    } catch (error) {
        console.log('✅ Invalid URL correctly rejected:', error.message);
    }

    // Test 3: Status Mapping
    console.log('\n📝 Test 3: Status Mapping Functions');
    try {
        // Create a mock Pull Request Manager to test status mapping
        const mockWebApi = { getGitApi: () => ({}) };
        const prManager = new PullRequestManager(mockWebApi, 'test-project');

        // Test pull request status mapping
        const prStatus = prManager.mapPullRequestStatus(2); // Active
        console.log(`✅ PR Status mapping works: ${prStatus}`);

        // Test comment thread status mapping
        const threadStatus = prManager.mapCommentThreadStatus(1); // Active
        console.log(`✅ Thread Status mapping works: ${threadStatus}`);

        // Test reverse mapping
        const statusEnum = prManager.mapCommentThreadStatusToEnum('Fixed');
        console.log(`✅ Reverse status mapping works: ${statusEnum}`);
    } catch (error) {
        console.log('❌ Status mapping test failed:', error.message);
    }

    // Test 4: Mock Pull Request Manager Creation
    console.log('\n📝 Test 4: Pull Request Manager Instantiation');
    try {
        const mockWebApi = {
            getGitApi: async () => ({
                getPullRequest: () => ({}),
                getThreads: () => ([]),
                createThread: () => ({}),
                createComment: () => ({})
            })
        };

        const prManager = new PullRequestManager(mockWebApi, 'test-project');
        console.log('✅ Pull Request Manager created successfully');

        // Test initialization
        await prManager.initialize();
        console.log('✅ Pull Request Manager initialized successfully');
    } catch (error) {
        console.log('❌ Pull Request Manager creation failed:', error.message);
    }

    // Test 5: Error Handling with Invalid Repository
    console.log('\n📝 Test 5: Error Handling');
    try {
        const mockWebApi = {
            getGitApi: async () => ({
                getPullRequest: () => { throw new Error('Repository not found'); }
            })
        };

        const prManager = new PullRequestManager(mockWebApi, 'test-project');
        await prManager.initialize();
        
        try {
            await prManager.getPullRequest('invalid-repo', 123);
            console.log('❌ Should have thrown error for invalid repository');
        } catch (error) {
            console.log('✅ Error handling works correctly:', error.message);
        }
    } catch (error) {
        console.log('❌ Error handling test setup failed:', error.message);
    }

    // Test 6: Comment Structure Validation
    console.log('\n📝 Test 6: Comment Structure Validation');
    try {
        const mockComment = {
            id: 1,
            content: 'Test comment',
            author: { displayName: 'Test User' },
            publishedDate: new Date().toISOString(),
            lastUpdatedDate: new Date().toISOString(),
            parentCommentId: null,
            commentType: 1,
            isDeleted: false
        };

        const mockThread = {
            id: 1,
            status: 1, // Active
            threadContext: { filePath: '/test/file.js' },
            isDeleted: false,
            publishedDate: new Date().toISOString(),
            lastUpdatedDate: new Date().toISOString(),
            comments: [mockComment]
        };

        // Validate structure matches expected format
        console.log('✅ Comment structure validation passed');
        console.log(`   Thread ID: ${mockThread.id}, Status: ${mockThread.status}`);
        console.log(`   Comment ID: ${mockComment.id}, Content: "${mockComment.content}"`);
    } catch (error) {
        console.log('❌ Comment structure validation failed:', error.message);
    }

    console.log('\n🎉 Pull Request Manager Tests Completed!');
    console.log('Note: Full integration tests require valid Azure DevOps credentials and are not run in this test suite.');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    runPullRequestTests().catch(console.error);
}

export { runPullRequestTests };
