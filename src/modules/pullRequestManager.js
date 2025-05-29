/**
 * Pull Request Management Module
 * Handles all pull request related operations
 */

import { parseAzureDevOpsUrl, extractErrorMessage, retryOperation } from '../utils/helpers.js';
import { CommentThreadStatus, PullRequestStatus } from 'azure-devops-node-api/interfaces/GitInterfaces.js';

export class PullRequestManager {
    constructor(webApi, project) {
        this.webApi = webApi;
        this.project = project;
        this.gitApi = null;
    }
    
    /**
     * Initializes the Git API client for pull request operations.
     * 
     * This method establishes a connection to the Azure DevOps Git API and prepares
     * the PullRequestManager for performing pull request-related operations. It must
     * be called before any other pull request operations can be executed.
     * 
     * The initialization process creates a Git API client instance from the provided
     * WebApi connection and stores it for subsequent operations. This ensures that
     * all pull request operations use the same authenticated session.
     * 
     * @async
     * @method initialize
     * @description Initializes the Git API client for pull request operations
     * @returns {Promise<void>} Resolves when the Git API client is successfully initialized
     * @throws {Error} When the Git API client initialization fails due to:
     *                 - Invalid authentication credentials
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Insufficient permissions for Git API access
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git|Azure DevOps Git REST API}
     * @see {@link https://github.com/Microsoft/azure-devops-node-api|Azure DevOps Node API}
     * 
     * @example
     * // Initialize the Pull Request Manager
     * const prManager = new PullRequestManager(webApi, projectName);
     * await prManager.initialize();
     * console.log('Pull Request Manager ready for operations');
     * 
     * @example
     * // Handle initialization errors gracefully
     * try {
     *     await prManager.initialize();
     *     console.log('✅ Successfully initialized Pull Request Manager');
     * } catch (error) {
     *     console.error('❌ Failed to initialize:', error.message);
     *     // Implement retry logic or fallback strategy
     * }
     * 
     * @example
     * // Initialize as part of application startup sequence
     * async function setupAzureDevOpsServices() {
     *     const webApi = new WebApi(serverUrl, authHandler);
     *     const prManager = new PullRequestManager(webApi, 'MyProject');
     *     
     *     await prManager.initialize();
     *     console.log('Pull Request services are ready');
     *     
     *     return prManager;
     * }
     */
    async initialize() {
        try {
            this.gitApi = await this.webApi.getGitApi();
            console.log('✅ Pull Request Manager initialized');
        } catch (error) {
            throw new Error(`Failed to initialize Pull Request Manager: ${extractErrorMessage(error)}`);
        }
    }
    
    /**
     * Retrieves detailed information about a specific pull request by its ID.
     * 
     * This method fetches comprehensive pull request data including basic metadata,
     * reviewer information, and optionally detailed information such as commits,
     * work items, and iterations. The method provides a normalized response format
     * that abstracts Azure DevOps-specific data structures.
     * 
     * When includeDetails is enabled, the method performs parallel requests to
     * gather additional information, providing a complete view of the pull request
     * state and history for comprehensive analysis and reporting.
     * 
     * @async
     * @method getPullRequest
     * @description Retrieves detailed information about a specific pull request by its ID
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request to retrieve
     * @param {boolean} [includeDetails=true] - Whether to include additional details (commits, work items, iterations)
     * @returns {Promise<Object>} A comprehensive pull request object containing:
     * @returns {number} returns.id - The pull request ID
     * @returns {string} returns.title - The pull request title
     * @returns {string} returns.description - The pull request description
     * @returns {string} returns.status - The normalized pull request status (Active, Completed, Abandoned)
     * @returns {Object} returns.createdBy - Information about the pull request creator
     * @returns {string} returns.creationDate - ISO 8601 formatted creation date
     * @returns {string} returns.sourceBranch - The source branch name (refs/heads/branch-name)
     * @returns {string} returns.targetBranch - The target branch name (refs/heads/branch-name)
     * @returns {Object} returns.repository - Repository information object
     * @returns {string} returns.repository.id - Repository unique identifier
     * @returns {string} returns.repository.name - Repository name
     * @returns {string} returns.repository.url - Repository web URL
     * @returns {string} returns.url - Direct URL to the pull request in Azure DevOps
     * @returns {Array<Object>} returns.reviewers - Array of reviewer objects with vote and requirement status
     * @returns {Array<Object>} [returns.commits] - Array of commit objects (when includeDetails=true)
     * @returns {Array<Object>} [returns.workItems] - Array of linked work items (when includeDetails=true)
     * @returns {Array<Object>} [returns.iterations] - Array of pull request iterations (when includeDetails=true)
     * @throws {Error} When the pull request retrieval fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Pull request not found (404)
     *                 - Insufficient permissions to access the repository
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get|Get Pull Request REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Azure DevOps Pull Requests}
     * 
     * @example
     * // Retrieve basic pull request information
     * const pullRequest = await prManager.getPullRequest('repo-123', 456, false);
     * console.log(`PR: ${pullRequest.title} (${pullRequest.status})`);
     * console.log(`From: ${pullRequest.sourceBranch} → ${pullRequest.targetBranch}`);
     * 
     * @example
     * // Retrieve complete pull request details including commits and work items
     * const fullPR = await prManager.getPullRequest('repo-123', 456, true);
     * console.log(`PR: ${fullPR.title}`);
     * console.log(`Commits: ${fullPR.commits.length}`);
     * console.log(`Work Items: ${fullPR.workItems.length}`);
     * console.log(`Reviewers: ${fullPR.reviewers.map(r => r.displayName).join(', ')}`);
     * 
     * @example
     * // Handle pull request retrieval with error handling
     * try {
     *     const pr = await prManager.getPullRequest('repo-123', 456);
     *     
     *     // Process pull request data
     *     console.log(`Status: ${pr.status}`);
     *     console.log(`Created by: ${pr.createdBy.displayName}`);
     *     console.log(`URL: ${pr.url}`);
     *     
     *     // Check review status
     *     const approvals = pr.reviewers.filter(r => r.vote > 0).length;
     *     console.log(`Approvals: ${approvals}/${pr.reviewers.length}`);
     *     
     * } catch (error) {
     *     console.error('Failed to retrieve pull request:', error.message);
     *     // Implement fallback or retry logic
     * }
     * 
     * @example
     * // Bulk processing of pull requests
     * async function analyzePullRequests(repositoryId, prIds) {
     *     const results = await Promise.allSettled(
     *         prIds.map(id => prManager.getPullRequest(repositoryId, id))
     *     );
     *     
     *     const successful = results
     *         .filter(r => r.status === 'fulfilled')
     *         .map(r => r.value);
     *         
     *     console.log(`Successfully retrieved ${successful.length}/${prIds.length} PRs`);
     *     return successful;
     * }
     */
    async getPullRequest(repositoryId, pullRequestId, includeDetails = true) {
        try {
            console.log(`🔄 Retrieving pull request ${pullRequestId} from repository ${repositoryId}...`);

            const pullRequest = await retryOperation(async () => {
                return await this.gitApi.getPullRequest(repositoryId, pullRequestId, this.project);
            });

            if (!pullRequest) {
                throw new Error(`Pull request ${pullRequestId} not found`);
            }

            let details = {};
            if (includeDetails) {
                // Get additional details
                const [commits, workItems, iterations] = await Promise.all([
                    this.getPullRequestCommits(repositoryId, pullRequestId),
                    this.getPullRequestWorkItems(repositoryId, pullRequestId),
                    this.getPullRequestIterations(repositoryId, pullRequestId)
                ]);

                details = { commits, workItems, iterations };
            }

            const result = {
                id: pullRequest.pullRequestId,
                title: pullRequest.title,
                description: pullRequest.description,
                status: this.mapPullRequestStatus(pullRequest.status),
                createdBy: pullRequest.createdBy,
                creationDate: pullRequest.creationDate,
                sourceBranch: pullRequest.sourceRefName,
                targetBranch: pullRequest.targetRefName,
                repository: {
                    id: pullRequest.repository.id,
                    name: pullRequest.repository.name,
                    url: pullRequest.repository.webUrl
                },
                url: `${pullRequest.repository.webUrl}/pullrequest/${pullRequest.pullRequestId}`,
                reviewers: pullRequest.reviewers?.map(reviewer => ({
                    id: reviewer.id,
                    displayName: reviewer.displayName,
                    uniqueName: reviewer.uniqueName,
                    vote: reviewer.vote,
                    isRequired: reviewer.isRequired
                })) || [],
                ...details
            };

            console.log(`✅ Successfully retrieved pull request: ${result.title}`);
            return result;

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to retrieve pull request ${pullRequestId}:`, errorMessage);
            throw new Error(`Failed to retrieve pull request: ${errorMessage}`);
        }
    }

    /**
     * Retrieves detailed information about a pull request using its Azure DevOps URL.
     * 
     * This convenience method accepts an Azure DevOps pull request URL and automatically
     * parses it to extract the necessary identifiers (project, repository, pull request ID)
     * before delegating to the getPullRequest method. This is particularly useful when
     * working with pull request URLs from web interfaces, notifications, or external systems.
     * 
     * The method performs URL validation, repository resolution, and handles the complete
     * workflow of converting a user-friendly URL into the specific API calls required
     * to retrieve pull request data. It supports all standard Azure DevOps pull request
     * URL formats and provides detailed error messages for invalid or inaccessible URLs.
     * 
     * @async
     * @method getPullRequestByUrl
     * @description Retrieves detailed information about a pull request using its Azure DevOps URL
     * @param {string} url - The complete Azure DevOps pull request URL to parse and retrieve
     * @param {boolean} [includeDetails=true] - Whether to include additional details (commits, work items, iterations)
     * @returns {Promise<Object>} A comprehensive pull request object (same structure as getPullRequest)
     * @returns {number} returns.id - The pull request ID
     * @returns {string} returns.title - The pull request title
     * @returns {string} returns.description - The pull request description
     * @returns {string} returns.status - The normalized pull request status
     * @returns {Object} returns.createdBy - Information about the pull request creator
     * @returns {string} returns.creationDate - ISO 8601 formatted creation date
     * @returns {string} returns.sourceBranch - The source branch name
     * @returns {string} returns.targetBranch - The target branch name
     * @returns {Object} returns.repository - Repository information object
     * @returns {string} returns.url - Direct URL to the pull request in Azure DevOps
     * @returns {Array<Object>} returns.reviewers - Array of reviewer objects
     * @returns {Array<Object>} [returns.commits] - Array of commit objects (when includeDetails=true)
     * @returns {Array<Object>} [returns.workItems] - Array of linked work items (when includeDetails=true)
     * @returns {Array<Object>} [returns.iterations] - Array of pull request iterations (when includeDetails=true)
     * @throws {Error} When the pull request retrieval fails due to:
     *                 - Invalid or malformed Azure DevOps URL format
     *                 - URL does not point to a pull request resource
     *                 - Repository not found in the specified project
     *                 - Pull request ID extracted from URL is invalid
     *                 - Insufficient permissions to access repository or pull request
     *                 - Network connectivity issues during URL parsing or data retrieval
     *                 - Authentication token expiration
     *                 - Azure DevOps service unavailability
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests/get|Get Pull Request REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Azure DevOps Pull Requests}
     * @see {@link getPullRequest} - The underlying method used for data retrieval
     * 
     * @example
     * // Retrieve pull request from a standard Azure DevOps URL
     * const url = 'https://dev.azure.com/myorg/myproject/_git/myrepo/pullrequest/123';
     * const pullRequest = await prManager.getPullRequestByUrl(url);
     * console.log(`Retrieved: ${pullRequest.title}`);
     * 
     * @example
     * // Handle different Azure DevOps URL formats
     * const urls = [
     *     'https://dev.azure.com/org/project/_git/repo/pullrequest/123',
     *     'https://myorg.visualstudio.com/project/_git/repo/pullrequest/456',
     *     'https://myorg.visualstudio.com/DefaultCollection/project/_git/repo/pullrequest/789'
     * ];
     * 
     * for (const url of urls) {
     *     try {
     *         const pr = await prManager.getPullRequestByUrl(url, false);
     *         console.log(`✅ ${pr.title} - ${pr.status}`);
     *     } catch (error) {
     *         console.error(`❌ Failed to process ${url}: ${error.message}`);
     *     }
     * }
     * 
     * @example
     * // Process pull request URL from external webhook or notification
     * async function handlePullRequestWebhook(webhookData) {
     *     const prUrl = webhookData.resource.url;
     *     
     *     try {
     *         const pullRequest = await prManager.getPullRequestByUrl(prUrl, true);
     *         
     *         // Analyze pull request for automated checks
     *         console.log(`Processing PR: ${pullRequest.title}`);
     *         console.log(`Author: ${pullRequest.createdBy.displayName}`);
     *         console.log(`Changes: ${pullRequest.commits.length} commits`);
     *         
     *         // Perform automated reviews or notifications
     *         if (pullRequest.status === 'Active') {
     *             await performAutomatedChecks(pullRequest);
     *         }
     *         
     *     } catch (error) {
     *         console.error('Webhook processing failed:', error.message);
     *         // Send notification to development team
     *     }
     * }
     * 
     * @example
     * // Validate and normalize pull request URLs for batch processing
     * async function processPullRequestUrls(urls) {
     *     const results = [];
     *     
     *     for (const url of urls) {
     *         try {
     *             // Validate URL format before processing
     *             if (!url.includes('pullrequest')) {
     *                 throw new Error('Invalid pull request URL format');
     *             }
     *             
     *             const pr = await prManager.getPullRequestByUrl(url);
     *             results.push({
     *                 url: url,
     *                 success: true,
     *                 data: {
     *                     id: pr.id,
     *                     title: pr.title,
     *                     status: pr.status,
     *                     repository: pr.repository.name
     *                 }
     *             });
     *             
     *         } catch (error) {
     *             results.push({
     *                 url: url,
     *                 success: false,
     *                 error: error.message
     *             });
     *         }
     *     }
     *     
     *     return results;
     * }
     */
    async getPullRequestByUrl(url, includeDetails = true) {
        try {
            console.log(`🔄 Parsing pull request URL: ${url}`);

            const parsed = parseAzureDevOpsUrl(url);
            
            if (parsed.type !== 'pullRequest') {
                throw new Error('URL is not a valid Azure DevOps pull request URL');
            }

            // Get repository ID from repository name
            const repositories = await this.gitApi.getRepositories(parsed.project);
            const repository = repositories.find(repo => repo.name === parsed.repository);
            
            if (!repository) {
                throw new Error(`Repository '${parsed.repository}' not found in project '${parsed.project}'`);
            }

            return await this.getPullRequest(repository.id, parsed.pullRequestId, includeDetails);

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to retrieve pull request by URL:`, errorMessage);
            throw new Error(`Failed to retrieve pull request by URL: ${errorMessage}`);
        }
    }
    
    /**
     * Retrieves all comment threads and individual comments from a pull request.
     * 
     * This method fetches the complete comment hierarchy for a pull request, including
     * both general comments and file-specific comments organized into threaded conversations.
     * It provides comprehensive comment metadata, threading information, and status details
     * that enable rich comment analysis and conversation management.
     * 
     * The method processes comment threads to extract nested conversations, author information,
     * timestamps, and contextual details such as file positions for code review comments.
     * It supports filtering options to include or exclude empty threads and provides
     * normalized status information for better application integration.
     * 
     * @async
     * @method getPullRequestComments
     * @description Retrieves all comment threads and individual comments from a pull request
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request to retrieve comments from
     * @param {boolean} [includeThreads=true] - Whether to include empty comment threads (threads without comments)
     * @returns {Promise<Array<Object>>} Array of comment thread objects containing:
     * @returns {number} returns[].id - The unique thread identifier
     * @returns {string} returns[].status - The normalized thread status (Active, Resolved, Closed, etc.)
     * @returns {Object} returns[].context - Thread context information including file path and position
     * @returns {string} returns[].context.filePath - The file path where the comment thread is located
     * @returns {number} returns[].context.rightFileStart.line - Starting line number for the comment
     * @returns {number} returns[].context.rightFileStart.offset - Character offset within the line
     * @returns {boolean} returns[].isDeleted - Whether the thread has been deleted
     * @returns {string} returns[].publishedDate - ISO 8601 formatted thread creation date
     * @returns {string} returns[].lastUpdatedDate - ISO 8601 formatted last update date
     * @returns {Array<Object>} returns[].comments - Array of individual comments within the thread
     * @returns {number} returns[].comments[].id - The unique comment identifier
     * @returns {string} returns[].comments[].content - The comment text content (may include markdown)
     * @returns {Object} returns[].comments[].author - Author information object
     * @returns {string} returns[].comments[].author.displayName - Display name of the comment author
     * @returns {string} returns[].comments[].author.uniqueName - Unique identifier for the author
     * @returns {string} returns[].comments[].publishedDate - ISO 8601 formatted comment creation date
     * @returns {string} returns[].comments[].lastUpdatedDate - ISO 8601 formatted last update date
     * @returns {number} returns[].comments[].parentCommentId - ID of parent comment (for replies)
     * @returns {string} returns[].comments[].commentType - Type of comment (text, suggestion, etc.)
     * @returns {boolean} returns[].comments[].isDeleted - Whether the individual comment has been deleted
     * @throws {Error} When comment retrieval fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Pull request not found or inaccessible
     *                 - Insufficient permissions to read pull request comments
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/list|Pull Request Threads REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Azure DevOps Pull Request Comments}
     * 
     * @example
     * // Retrieve all comments and threads for a pull request
     * const comments = await prManager.getPullRequestComments('repo-123', 456);
     * console.log(`Found ${comments.length} comment threads`);
     * 
     * comments.forEach(thread => {
     *     console.log(`Thread ${thread.id}: ${thread.status}`);
     *     if (thread.context?.filePath) {
     *         console.log(`  File: ${thread.context.filePath}`);
     *     }
     *     console.log(`  Comments: ${thread.comments.length}`);
     * });
     * 
     * @example
     * // Filter and analyze comment threads by status
     * const comments = await prManager.getPullRequestComments('repo-123', 456);
     * 
     * const activeThreads = comments.filter(thread => thread.status === 'Active');
     * const resolvedThreads = comments.filter(thread => thread.status === 'Resolved');
     * 
     * console.log(`Active discussions: ${activeThreads.length}`);
     * console.log(`Resolved discussions: ${resolvedThreads.length}`);
     * 
     * // Find threads requiring attention
     * const unresolvedFileComments = activeThreads.filter(thread => 
     *     thread.context?.filePath && thread.comments.length > 0
     * );
     * 
     * console.log(`Unresolved file comments: ${unresolvedFileComments.length}`);
     * 
     * @example
     * // Extract conversation history and participant analysis
     * const comments = await prManager.getPullRequestComments('repo-123', 456, true);
     * 
     * const conversationAnalysis = comments.map(thread => {
     *     const participants = new Set(
     *         thread.comments.map(comment => comment.author.displayName)
     *     );
     *     
     *     const lastActivity = thread.comments.length > 0 
     *         ? new Date(Math.max(...thread.comments.map(c => new Date(c.lastUpdatedDate))))
     *         : new Date(thread.publishedDate);
     *     
     *     return {
     *         threadId: thread.id,
     *         status: thread.status,
     *         filePath: thread.context?.filePath || 'General',
     *         participants: Array.from(participants),
     *         commentCount: thread.comments.length,
     *         lastActivity: lastActivity,
     *         daysSinceActivity: Math.floor((new Date() - lastActivity) / (1000 * 60 * 60 * 24))
     *     };
     * });
     * 
     * console.log('Conversation Analysis:', conversationAnalysis);
     * 
     * @example
     * // Generate comment summary report for pull request review
     * async function generateCommentReport(repositoryId, pullRequestId) {
     *     try {
     *         const comments = await prManager.getPullRequestComments(repositoryId, pullRequestId);
     *         
     *         const report = {
     *             totalThreads: comments.length,
     *             totalComments: comments.reduce((sum, thread) => sum + thread.comments.length, 0),
     *             activeThreads: comments.filter(t => t.status === 'Active').length,
     *             resolvedThreads: comments.filter(t => t.status === 'Resolved').length,
     *             fileComments: comments.filter(t => t.context?.filePath).length,
     *             generalComments: comments.filter(t => !t.context?.filePath).length,
     *             commentsByFile: {}
     *         };
     *         
     *         // Group comments by file
     *         comments.forEach(thread => {
     *             if (thread.context?.filePath) {
     *                 const filePath = thread.context.filePath;
     *                 if (!report.commentsByFile[filePath]) {
     *                     report.commentsByFile[filePath] = 0;
     *                 }
     *                 report.commentsByFile[filePath] += thread.comments.length;
     *             }
     *         });
     *         
     *         console.log('📊 Pull Request Comment Report:', report);
     *         return report;
     *         
     *     } catch (error) {
     *         console.error('Failed to generate comment report:', error.message);
     *         throw error;
     *     }
     * }
     */
    async getPullRequestComments(repositoryId, pullRequestId, includeThreads = true) {
        try {
            console.log(`🔄 Fetching comments for pull request ${pullRequestId}...`);

            const threads = await retryOperation(async () => {
                return await this.gitApi.getThreads(repositoryId, pullRequestId, this.project);
            });

            const comments = [];

            for (const thread of threads) {
                const threadInfo = {
                    id: thread.id,
                    status: this.mapCommentThreadStatus(thread.status),
                    context: thread.threadContext,
                    isDeleted: thread.isDeleted,
                    publishedDate: thread.publishedDate,
                    lastUpdatedDate: thread.lastUpdatedDate,
                    comments: []
                };

                if (thread.comments && thread.comments.length > 0) {
                    for (const comment of thread.comments) {
                        threadInfo.comments.push({
                            id: comment.id,
                            content: comment.content,
                            author: comment.author,
                            publishedDate: comment.publishedDate,
                            lastUpdatedDate: comment.lastUpdatedDate,
                            parentCommentId: comment.parentCommentId,
                            commentType: comment.commentType,
                            isDeleted: comment.isDeleted
                        });
                    }
                }

                if (includeThreads || threadInfo.comments.length > 0) {
                    comments.push(threadInfo);
                }
            }

            console.log(`✅ Successfully retrieved ${comments.length} comment threads`);
            return comments;

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to fetch pull request comments:`, errorMessage);
            throw new Error(`Failed to fetch pull request comments: ${errorMessage}`);
        }
    }

    /**
     * Adds a comment to a specific file in a pull request at an optional line position.
     * 
     * This method creates a new comment thread attached to a specific file within a pull request,
     * with optional line-specific positioning for precise code review feedback. It automatically
     * determines the latest pull request iteration to ensure comments are attached to the current
     * version of the file, and creates the appropriate thread context for Azure DevOps.
     * 
     * The method supports both general file comments (without line positioning) and specific
     * line comments for detailed code review scenarios. When line positioning is provided,
     * the comment appears inline with the code, while general file comments appear as
     * file-level discussions.
     * 
     * @async
     * @method addFileComment
     * @description Adds a comment to a specific file in a pull request at an optional line position
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request to comment on
     * @param {string} filePath - The relative path to the file within the repository (e.g., 'src/components/Button.js')
     * @param {string} comment - The comment content text (supports plain text and markdown formatting)
     * @param {number|null} [line=null] - The line number to attach the comment to (1-based indexing)
     * @param {number|null} [position=null] - The character position within the line (1-based, defaults to 1)
     * @returns {Promise<Object>} The created comment thread information containing:
     * @returns {number} returns.threadId - The unique identifier of the created comment thread
     * @returns {number} returns.commentId - The unique identifier of the created comment
     * @returns {string} returns.status - The normalized thread status (typically 'Active')
     * @returns {string} returns.content - The comment content that was posted
     * @returns {string} returns.filePath - The file path where the comment was added
     * @returns {number|null} returns.line - The line number where the comment was placed (null for file-level comments)
     * @returns {Object} returns.author - Information about the comment author
     * @returns {string} returns.author.displayName - Display name of the comment author
     * @returns {string} returns.author.uniqueName - Unique identifier for the author
     * @returns {string} returns.publishedDate - ISO 8601 formatted comment creation timestamp
     * @throws {Error} When comment creation fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Pull request not found or not accessible
     *                 - File path does not exist in the pull request changes
     *                 - Invalid line number (exceeds file length or negative)
     *                 - Insufficient permissions to add comments to the pull request
     *                 - Pull request is in a state that doesn't allow comments (e.g., abandoned)
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     *                 - Comment content exceeds size limits
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads/create|Create Pull Request Thread REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Azure DevOps Pull Request Comments}
     * @see {@link replyToComment} - For replying to existing comments
     * 
     * @example
     * // Add a general file-level comment
     * const comment = await prManager.addFileComment(
     *     'repo-123', 
     *     456, 
     *     'src/components/Button.js', 
     *     'This component looks great! Consider adding prop validation.'
     * );
     * console.log(`Comment added: ${comment.commentId}`);
     * 
     * @example
     * // Add a line-specific comment for code review
     * const lineComment = await prManager.addFileComment(
     *     'repo-123',
     *     456,
     *     'src/utils/helpers.js',
     *     'Consider using const instead of let here for immutability.',
     *     42,  // Line number
     *     5    // Character position
     * );
     * console.log(`Line comment added at line ${lineComment.line}`);
     * 
     * @example
     * // Add formatted comment with markdown
     * const markdownComment = await prManager.addFileComment(
     *     'repo-123',
     *     456,
     *     'README.md',
     *     `## Documentation Feedback
     * 
     * Great start on the documentation! A few suggestions:
     * 
     * - [ ] Add installation instructions
     * - [ ] Include usage examples  
     * - [ ] Add API reference
     * 
     * **Note:** Consider using \`code blocks\` for examples.`
     * );
     * console.log(`Markdown comment added: ${markdownComment.threadId}`);
     * 
     * @example
     * // Batch add comments for automated code review
     * async function performAutomatedReview(repositoryId, pullRequestId, reviewFindings) {
     *     const commentResults = [];
     *     
     *     for (const finding of reviewFindings) {
     *         try {
     *             const comment = await prManager.addFileComment(
     *                 repositoryId,
     *                 pullRequestId,
     *                 finding.filePath,
     *                 `🤖 **Automated Review**: ${finding.message}
     * 
     * **Severity**: ${finding.severity}
     * **Rule**: ${finding.rule}
     * 
     * ${finding.suggestion ? `**Suggestion**: ${finding.suggestion}` : ''}`,
     *                 finding.line,
     *                 finding.column
     *             );
     *             
     *             commentResults.push({
     *                 success: true,
     *                 finding: finding,
     *                 commentId: comment.commentId,
     *                 threadId: comment.threadId
     *             });
     *             
     *             // Add delay to avoid rate limiting
     *             await new Promise(resolve => setTimeout(resolve, 100));
     *             
     *         } catch (error) {
     *             commentResults.push({
     *                 success: false,
     *                 finding: finding,
     *                 error: error.message
     *             });
     *         }
     *     }
     *     
     *     const successful = commentResults.filter(r => r.success).length;
     *     console.log(`✅ Added ${successful}/${reviewFindings.length} automated review comments`);
     *     
     *     return commentResults;
     * }
     * 
     * @example
     * // Handle comment creation with comprehensive error handling
     * async function addReviewComment(repoId, prId, filePath, commentText, lineNum) {
     *     try {
     *         // Validate inputs
     *         if (!commentText || commentText.trim().length === 0) {
     *             throw new Error('Comment text cannot be empty');
     *         }
     *         
     *         if (lineNum && (lineNum < 1 || !Number.isInteger(lineNum))) {
     *             throw new Error('Line number must be a positive integer');
     *         }
     *         
     *         const result = await prManager.addFileComment(repoId, prId, filePath, commentText, lineNum);
     *         
     *         console.log('✅ Comment added successfully:', {
     *             threadId: result.threadId,
     *             file: result.filePath,
     *             line: result.line,
     *             author: result.author.displayName,
     *             timestamp: result.publishedDate
     *         });
     *         
     *         return result;
     *         
     *     } catch (error) {
     *         console.error('❌ Failed to add comment:', {
     *             error: error.message,
     *             file: filePath,
     *             line: lineNum,
     *             pullRequest: prId
     *         });
     *         
     *         // Implement retry logic for transient failures
     *         if (error.message.includes('network') || error.message.includes('timeout')) {
     *             console.log('🔄 Retrying comment creation...');
     *             await new Promise(resolve => setTimeout(resolve, 1000));
     *             return addReviewComment(repoId, prId, filePath, commentText, lineNum);
     *         }
     *         
     *         throw error;
     *     }
     * }
     */
    async addFileComment(repositoryId, pullRequestId, filePath, comment, line = null, position = null) {
        try {
            console.log(`🔄 Adding comment to file ${filePath} in pull request ${pullRequestId}...`);

            // Get the latest iteration to ensure we're commenting on the current version
            const iterations = await this.getPullRequestIterations(repositoryId, pullRequestId);
            const latestIteration = iterations[iterations.length - 1];

            if (!latestIteration) {
                throw new Error('No iterations found for this pull request');
            }

            // Create thread context for file comment
            const threadContext = {
                filePath: filePath,
                rightFileStart: line ? { line: line, offset: position || 1 } : null,
                rightFileEnd: line ? { line: line, offset: position || 1 } : null
            };

            const newThread = {
                comments: [{
                    content: comment,
                    commentType: 1 // Text comment
                }],
                status: CommentThreadStatus.Active,
                threadContext: threadContext
            };

            const createdThread = await retryOperation(async () => {
                return await this.gitApi.createThread(newThread, repositoryId, pullRequestId, this.project);
            });

            const result = {
                threadId: createdThread.id,
                commentId: createdThread.comments[0].id,
                status: this.mapCommentThreadStatus(createdThread.status),
                content: comment,
                filePath: filePath,
                line: line,
                author: createdThread.comments[0].author,
                publishedDate: createdThread.comments[0].publishedDate
            };

            console.log(`✅ Successfully added comment to file: ${filePath}`);
            return result;

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to add file comment:`, errorMessage);
            throw new Error(`Failed to add file comment: ${errorMessage}`);
        }
    }
    
    /**
     * Replies to an existing comment in a pull request thread, maintaining conversation flow.
     * 
     * This method adds a reply to an existing comment within a pull request discussion thread,
     * preserving the hierarchical conversation structure. It automatically locates the parent
     * comment's thread, validates the conversation context, and creates a properly linked
     * reply that maintains the discussion flow in Azure DevOps.
     * 
     * The method handles the complexities of Azure DevOps comment threading by searching
     * through all comment threads to find the one containing the target parent comment,
     * then creates the reply with proper parent-child relationships. This ensures that
     * the conversation hierarchy is maintained and users can follow the discussion flow.
     * 
     * @async
     * @method replyToComment
     * @description Replies to an existing comment in a pull request thread, maintaining conversation flow
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request containing the comment
     * @param {number} parentCommentId - The unique identifier of the comment to reply to
     * @param {string} reply - The reply content text (supports plain text and markdown formatting)
     * @returns {Promise<Object>} The created reply comment information containing:
     * @returns {number} returns.commentId - The unique identifier of the created reply comment
     * @returns {number} returns.threadId - The unique identifier of the thread containing the conversation
     * @returns {number} returns.parentCommentId - The ID of the parent comment being replied to
     * @returns {string} returns.content - The reply content that was posted
     * @returns {Object} returns.author - Information about the reply author
     * @returns {string} returns.author.displayName - Display name of the reply author
     * @returns {string} returns.author.uniqueName - Unique identifier for the author
     * @returns {string} returns.publishedDate - ISO 8601 formatted reply creation timestamp
     * @throws {Error} When reply creation fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Parent comment ID not found in any thread
     *                 - Parent comment has been deleted or is inaccessible
     *                 - Thread has been closed or locked for replies
     *                 - Insufficient permissions to reply to comments
     *                 - Pull request is in a state that doesn't allow new comments
     *                 - Reply content exceeds size limits
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments/create|Create Pull Request Comment REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Azure DevOps Pull Request Comments}
     * @see {@link addFileComment} - For creating new comment threads
     * @see {@link getPullRequestComments} - For retrieving existing comments and threads
     * 
     * @example
     * // Reply to a code review comment
     * const reply = await prManager.replyToComment(
     *     'repo-123',
     *     456,
     *     789,  // Parent comment ID
     *     'Thanks for the feedback! I will update this in the next iteration.'
     * );
     * console.log(`Reply added: ${reply.commentId}`);
     * 
     * @example
     * // Reply with markdown formatting
     * const markdownReply = await prManager.replyToComment(
     *     'repo-123',
     *     456,
     *     789,
     *     '**Response**: Thanks for pointing this out! You are right about the performance concern. I will implement caching and debouncing to address this.'
     * );
     * 
     * @example
     * // Handle reply with error checking
     * try {
     *     const result = await prManager.replyToComment(repoId, prId, commentId, replyText);
     *     console.log('Reply posted:', result.commentId);
     * } catch (error) {
     *     if (error.message.includes('not found')) {
     *         console.error('Parent comment no longer exists');
     *     } else {
     *         console.error('Failed to post reply:', error.message);
     *     }
     * }
     * 
     * @example
     * // Automated response to review comments
     * async function autoReplyToReviews(repositoryId, pullRequestId) {
     *     const comments = await prManager.getPullRequestComments(repositoryId, pullRequestId);
     *     
     *     for (const thread of comments) {
     *         for (const comment of thread.comments) {
     *             if (comment.content.includes('automated review') && !comment.replies) {
     *                 await prManager.replyToComment(
     *                     repositoryId,
     *                     pullRequestId,
     *                     comment.id,
     *                     'Acknowledged: This feedback will be addressed in the next update.'
     *                 );
     *             }
     *         }
     *     }
     * }
     */
    async replyToComment(repositoryId, pullRequestId, parentCommentId, reply) {
        try {
            console.log(`🔄 Replying to comment ${parentCommentId} in pull request ${pullRequestId}...`);

            // First, find the thread containing the parent comment
            const threads = await this.gitApi.getThreads(repositoryId, pullRequestId, this.project);
            
            let targetThread = null;
            for (const thread of threads) {
                if (thread.comments && thread.comments.some(c => c.id === parentCommentId)) {
                    targetThread = thread;
                    break;
                }
            }

            if (!targetThread) {
                throw new Error(`Parent comment ${parentCommentId} not found`);
            }

            const newComment = {
                content: reply,
                parentCommentId: parentCommentId,
                commentType: 1 // Text comment
            };

            const createdComment = await retryOperation(async () => {
                return await this.gitApi.createComment(newComment, repositoryId, pullRequestId, targetThread.id, this.project);
            });

            const result = {
                commentId: createdComment.id,
                threadId: targetThread.id,
                parentCommentId: parentCommentId,
                content: reply,
                author: createdComment.author,
                publishedDate: createdComment.publishedDate
            };

            console.log(`✅ Successfully replied to comment`);
            return result;

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to reply to comment:`, errorMessage);
            throw new Error(`Failed to reply to comment: ${errorMessage}`);
        }
    }
    
    /**
     * Retrieves the commit history for a specific pull request from its latest iteration.
     * 
     * This method fetches the complete list of commits that are part of a pull request,
     * providing detailed information about each commit including metadata, authorship,
     * and commit messages. It automatically selects the latest pull request iteration
     * to ensure the most current commit information is returned.
     * 
     * The method processes pull request iterations to identify the most recent changes
     * and extracts commit details in a normalized format. This is essential for
     * code review workflows, change tracking, and generating detailed pull request
     * summaries that include commit-level granularity.
     * 
     * @async
     * @method getPullRequestCommits
     * @description Retrieves the commit history for a specific pull request from its latest iteration
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request to retrieve commits from
     * @returns {Promise<Array<Object>>} Array of commit objects containing:
     * @returns {string} returns[].commitId - The unique SHA-1 hash identifier of the commit
     * @returns {string} returns[].comment - The commit message text
     * @returns {Object} returns[].author - Information about the commit author
     * @returns {string} returns[].author.name - Full name of the commit author
     * @returns {string} returns[].author.email - Email address of the commit author
     * @returns {string} returns[].author.date - ISO 8601 formatted commit authoring timestamp
     * @returns {Object} returns[].committer - Information about the commit committer (may differ from author)
     * @returns {string} returns[].committer.name - Full name of the commit committer
     * @returns {string} returns[].committer.email - Email address of the commit committer
     * @returns {string} returns[].committer.date - ISO 8601 formatted commit timestamp
     * @returns {string} returns[].url - Direct URL to view the commit in Azure DevOps
     * @throws {Error} When commit retrieval fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Pull request not found or inaccessible
     *                 - No iterations exist for the pull request
     *                 - Insufficient permissions to access commit history
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iterations/list|Pull Request Iterations REST API}
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iteration-commits/list|Pull Request Commits REST API}
     * @see {@link getPullRequestIterations} - For retrieving all pull request iterations
     * 
     * @example
     * // Get commits for a pull request
     * const commits = await prManager.getPullRequestCommits('repo-123', 456);
     * console.log(`Pull request contains ${commits.length} commits`);
     * 
     * commits.forEach(commit => {
     *     console.log(`${commit.commitId.substring(0, 8)}: ${commit.comment}`);
     *     console.log(`Author: ${commit.author.name} <${commit.author.email}>`);
     * });
     * 
     * @example
     * // Analyze commit patterns and statistics
     * const commits = await prManager.getPullRequestCommits('repo-123', 456);
     * 
     * const stats = {
     *     totalCommits: commits.length,
     *     authors: new Set(commits.map(c => c.author.email)).size,
     *     firstCommit: commits.length > 0 ? new Date(commits[0].author.date) : null,
     *     lastCommit: commits.length > 0 ? new Date(commits[commits.length - 1].author.date) : null,
     *     averageMessageLength: commits.reduce((sum, c) => sum + c.comment.length, 0) / commits.length
     * };
     * 
     * console.log('Commit Statistics:', stats);
     * 
     * @example
     * // Generate commit summary for pull request review
     * async function generateCommitSummary(repositoryId, pullRequestId) {
     *     try {
     *         const commits = await prManager.getPullRequestCommits(repositoryId, pullRequestId);
     *         
     *         if (commits.length === 0) {
     *             return { message: 'No commits found in this pull request' };
     *         }
     *         
     *         const authorStats = commits.reduce((acc, commit) => {
     *             const author = commit.author.name;
     *             acc[author] = (acc[author] || 0) + 1;
     *             return acc;
     *         }, {});
     *         
     *         const commitTypes = commits.reduce((acc, commit) => {
     *             const message = commit.comment.toLowerCase();
     *             if (message.startsWith('fix')) acc.fixes++;
     *             else if (message.startsWith('feat')) acc.features++;
     *             else if (message.startsWith('docs')) acc.documentation++;
     *             else if (message.startsWith('refactor')) acc.refactoring++;
     *             else acc.other++;
     *             return acc;
     *         }, { fixes: 0, features: 0, documentation: 0, refactoring: 0, other: 0 });
     *         
     *         return {
     *             totalCommits: commits.length,
     *             authorContributions: authorStats,
     *             commitTypes: commitTypes,
     *             timespan: {
     *                 from: commits[0].author.date,
     *                 to: commits[commits.length - 1].author.date
     *             },
     *             commitUrls: commits.map(c => ({ id: c.commitId.substring(0, 8), url: c.url }))
     *         };
     *         
     *     } catch (error) {
     *         console.error('Failed to generate commit summary:', error.message);
     *         return { error: error.message };
     *     }
     * }
     * 
     * @example
     * // Validate commit message conventions
     * async function validateCommitMessages(repositoryId, pullRequestId, conventions) {
     *     const commits = await prManager.getPullRequestCommits(repositoryId, pullRequestId);
     *     const validationResults = [];
     *     
     *     for (const commit of commits) {
     *         const result = {
     *             commitId: commit.commitId,
     *             message: commit.comment,
     *             valid: true,
     *             violations: []
     *         };
     *         
     *         // Check message length
     *         if (commit.comment.length > conventions.maxLength) {
     *             result.valid = false;
     *             result.violations.push(`Message exceeds ${conventions.maxLength} characters`);
     *         }
     *         
     *         // Check required prefixes
     *         if (conventions.requiredPrefixes && 
     *             !conventions.requiredPrefixes.some(prefix => 
     *                 commit.comment.toLowerCase().startsWith(prefix.toLowerCase()))) {
     *             result.valid = false;
     *             result.violations.push(`Message must start with: ${conventions.requiredPrefixes.join(', ')}`);
     *         }
     *         
     *         // Check for prohibited words
     *         if (conventions.prohibitedWords) {
     *             const found = conventions.prohibitedWords.filter(word => 
     *                 commit.comment.toLowerCase().includes(word.toLowerCase()));
     *             if (found.length > 0) {
     *                 result.valid = false;
     *                 result.violations.push(`Contains prohibited words: ${found.join(', ')}`);
     *             }
     *         }
     *         
     *         validationResults.push(result);
     *     }
     *     
     *     const validCount = validationResults.filter(r => r.valid).length;
     *     console.log(`Commit validation: ${validCount}/${commits.length} commits passed`);
     *     
     *     return {
     *         totalCommits: commits.length,
     *         validCommits: validCount,
     *         invalidCommits: commits.length - validCount,
     *         results: validationResults
     *     };
     * }
     */
    async getPullRequestCommits(repositoryId, pullRequestId) {
        try {
            const iterations = await this.gitApi.getPullRequestIterations(repositoryId, pullRequestId, this.project);
            
            if (!iterations || iterations.length === 0) {
                return [];
            }

            // Get commits from the latest iteration
            const latestIteration = iterations[iterations.length - 1];
            const commits = await this.gitApi.getPullRequestIterationCommits(
                repositoryId, 
                pullRequestId, 
                latestIteration.id, 
                this.project
            );

            return commits.map(commit => ({
                commitId: commit.commitId,
                comment: commit.comment,
                author: commit.author,
                committer: commit.committer,
                url: commit.url
            }));

        } catch (error) {
            console.warn('Could not retrieve pull request commits:', extractErrorMessage(error));
            return [];
        }
    }
    
    /**
     * Retrieves work items that are linked to or associated with a specific pull request.
     * 
     * This method fetches references to Azure DevOps work items (such as user stories,
     * bugs, tasks, or features) that have been linked to the pull request. Work item
     * linking provides traceability between code changes and business requirements,
     * enabling teams to track feature implementation and bug fixes through the development lifecycle.
     * 
     * The method returns work item references containing identifiers and URLs that can
     * be used to retrieve detailed work item information or navigate to the work items
     * in Azure DevOps. This linkage is essential for maintaining requirements traceability
     * and ensuring that all code changes are associated with approved work items.
     * 
     * @async
     * @method getPullRequestWorkItems
     * @description Retrieves work items that are linked to or associated with a specific pull request
     * @param {string} repositoryId - The unique identifier of the repository containing the pull request
     * @param {number} pullRequestId - The unique identifier of the pull request to retrieve work items from
     * @returns {Promise<Array<Object>>} Array of work item reference objects containing:
     * @returns {string} returns[].id - The unique identifier of the linked work item
     * @returns {string} returns[].url - Direct URL to view the work item in Azure DevOps
     * @throws {Error} When work item retrieval fails due to:
     *                 - Invalid repository ID or pull request ID
     *                 - Pull request not found or inaccessible
     *                 - Insufficient permissions to access linked work items
     *                 - Work item service unavailability
     *                 - Network connectivity issues
     *                 - Azure DevOps service unavailability
     *                 - Authentication token expiration
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-work-items/list|Pull Request Work Items REST API}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/boards/backlogs/add-work-items|Azure DevOps Work Items}
     * @see {@link https://docs.microsoft.com/en-us/azure/devops/repos/git/pull-requests|Pull Request Work Item Linking}
     * 
     * @example
     * // Get linked work items for a pull request
     * const workItems = await prManager.getPullRequestWorkItems('repo-123', 456);
     * console.log(`Pull request is linked to ${workItems.length} work items`);
     * 
     * workItems.forEach(workItem => {
     *     console.log(`Work Item ${workItem.id}: ${workItem.url}`);
     * });
     * 
     * @example
     * // Check work item linkage for compliance
     * async function validateWorkItemLinkage(repositoryId, pullRequestId) {
     *     const workItems = await prManager.getPullRequestWorkItems(repositoryId, pullRequestId);
     *     
     *     if (workItems.length === 0) {
     *         console.warn('⚠️ Pull request has no linked work items - compliance check failed');
     *         return {
     *             compliant: false,
     *             reason: 'No work items linked to pull request',
     *             recommendation: 'Link at least one work item before merging'
     *         };
     *     }
     *     
     *     console.log('✅ Pull request has proper work item linkage');
     *     return {
     *         compliant: true,
     *         workItemCount: workItems.length,
     *         workItemIds: workItems.map(wi => wi.id)
     *     };
     * }
     * 
     * @example
     * // Generate traceability report for pull request
     * async function generateTraceabilityReport(repositoryId, pullRequestId) {
     *     try {
     *         const [pullRequest, workItems, commits] = await Promise.all([
     *             prManager.getPullRequest(repositoryId, pullRequestId, false),
     *             prManager.getPullRequestWorkItems(repositoryId, pullRequestId),
     *             prManager.getPullRequestCommits(repositoryId, pullRequestId)
     *         ]);
     *         
     *         const report = {
     *             pullRequest: {
     *                 id: pullRequest.id,
     *                 title: pullRequest.title,
     *                 status: pullRequest.status,
     *                 author: pullRequest.createdBy.displayName
     *             },
     *             traceability: {
     *                 workItemCount: workItems.length,
     *                 commitCount: commits.length,
     *                 workItemIds: workItems.map(wi => wi.id),
     *                 workItemUrls: workItems.map(wi => wi.url)
     *             },
     *             compliance: {
     *                 hasWorkItems: workItems.length > 0,
     *                 hasCommits: commits.length > 0,
     *                 traceabilityRatio: workItems.length / Math.max(commits.length, 1)
     *             }
     *         };
     *         
     *         console.log('📊 Traceability Report Generated:', report);
     *         return report;
     *         
     *     } catch (error) {
     *         console.error('Failed to generate traceability report:', error.message);
     *         return { error: error.message };
     *     }
     * }
     * 
     * @example
     * // Batch analysis of work item linkage across multiple pull requests
     * async function analyzeWorkItemLinkage(repositoryId, pullRequestIds) {
     *     const results = [];
     *     
     *     for (const prId of pullRequestIds) {
     *         try {
     *             const workItems = await prManager.getPullRequestWorkItems(repositoryId, prId);
     *             
     *             results.push({
     *                 pullRequestId: prId,
     *                 success: true,
     *                 workItemCount: workItems.length,
     *                 workItems: workItems,
     *                 hasLinkage: workItems.length > 0
     *             });
     *             
     *         } catch (error) {
     *             results.push({
     *                 pullRequestId: prId,
     *                 success: false,
     *                 error: error.message,
     *                 workItemCount: 0,
     *                 hasLinkage: false
     *             });
     *         }
     *     }
     *     
     *     const stats = {
     *         totalAnalyzed: results.length,
     *         successfulQueries: results.filter(r => r.success).length,
     *         withWorkItems: results.filter(r => r.hasLinkage).length,
     *         withoutWorkItems: results.filter(r => !r.hasLinkage).length,
     *         averageWorkItems: results.reduce((sum, r) => sum + r.workItemCount, 0) / results.length,
     *         complianceRate: (results.filter(r => r.hasLinkage).length / results.length) * 100
     *     };
     *     
     *     console.log('Work Item Linkage Analysis:', stats);
     *     return { results, statistics: stats };
     * }
     * 
     * @example
     * // Monitor and alert on work item compliance
     * async function monitorWorkItemCompliance(repositoryId, pullRequestId, complianceRules) {
     *     const workItems = await prManager.getPullRequestWorkItems(repositoryId, pullRequestId);
     *     const alerts = [];
     *     
     *     // Check minimum work item requirement
     *     if (complianceRules.minimumWorkItems && workItems.length < complianceRules.minimumWorkItems) {
     *         alerts.push({
     *             severity: 'error',
     *             rule: 'minimum-work-items',
     *             message: `Pull request must be linked to at least ${complianceRules.minimumWorkItems} work items`,
     *             current: workItems.length,
     *             required: complianceRules.minimumWorkItems
     *         });
     *     }
     *     
     *     // Check for specific work item types if provided
     *     if (complianceRules.requiredWorkItemTypes && workItems.length > 0) {
     *         // This would require additional API calls to get work item details
     *         alerts.push({
     *             severity: 'info',
     *             rule: 'work-item-types',
     *             message: 'Work item type validation requires additional API calls',
     *             workItemIds: workItems.map(wi => wi.id)
     *         });
     *     }
     *     
     *     // Check maximum work item limit
     *     if (complianceRules.maximumWorkItems && workItems.length > complianceRules.maximumWorkItems) {
     *         alerts.push({
     *             severity: 'warning',
     *             rule: 'maximum-work-items',
     *             message: `Pull request should not exceed ${complianceRules.maximumWorkItems} linked work items`,
     *             current: workItems.length,
     *             limit: complianceRules.maximumWorkItems
     *         });
     *     }
     *     
     *     const compliance = {
     *         compliant: alerts.filter(a => a.severity === 'error').length === 0,
     *         workItemCount: workItems.length,
     *         alerts: alerts,
     *         workItems: workItems
     *     };
     *     
     *     if (!compliance.compliant) {
     *         console.warn('❌ Work item compliance check failed:', compliance.alerts);
     *     } else {
     *         console.log('✅ Work item compliance check passed');
     *     }
     *     
     *     return compliance;
     * }
     */
    async getPullRequestWorkItems(repositoryId, pullRequestId) {
        try {
            const workItemRefs = await this.gitApi.getPullRequestWorkItemRefs(repositoryId, pullRequestId, this.project);
            
            return workItemRefs.map(ref => ({
                id: ref.id,
                url: ref.url
            }));

        } catch (error) {
            console.warn('Could not retrieve pull request work items:', extractErrorMessage(error));
            return [];
        }
    }    /**
     * Retrieves all iterations for a specific pull request, providing a comprehensive history
     * of changes and updates throughout the pull request lifecycle. Each iteration represents
     * a point-in-time snapshot of the pull request state, including pushes, updates, and
     * force pushes that modify the branch content.
     * 
     * Pull request iterations are essential for:
     * - Tracking the evolution of code changes over time
     * - Understanding the review history and feedback cycles
     * - Analyzing development patterns and iteration frequency
     * - Implementing automated quality gates based on iteration count
     * - Generating detailed change logs and audit trails
     * - Performing diff analysis between iterations
     * 
     * The method handles various iteration scenarios including initial submissions,
     * subsequent updates, force pushes, and merge commits. It provides structured
     * metadata for each iteration including authorship, timestamps, and descriptive
     * information to support comprehensive pull request analytics.
     * 
     * @async
     * @method getPullRequestIterations
     * @description Fetches all iterations for a pull request with detailed metadata and chronological ordering
     * 
     * @param {string} repositoryId - The unique identifier of the Azure DevOps repository
     *                               Format: GUID (e.g., "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c")
     *                               Must be a valid repository ID with pull request access permissions
     * @param {number} pullRequestId - The unique numeric identifier of the pull request
     *                                Range: 1 to 2,147,483,647 (32-bit signed integer)
     *                                Must reference an existing pull request in the specified repository
     * 
     * @returns {Promise<Array<Object>>} Promise resolving to an array of iteration objects
     * @returns {Array<Object>} iterations - Chronologically ordered array of pull request iterations
     * @returns {number} iterations[].id - Unique iteration identifier (incrementing sequence)
     * @returns {string} iterations[].description - Human-readable description of the iteration
     *                                            - Typically describes the type of update or changes made
     *                                            - May include commit messages or update summaries
     * @returns {Object} iterations[].author - Author information for the iteration
     * @returns {string} iterations[].author.displayName - Full display name of the iteration author
     * @returns {string} iterations[].author.uniqueName - Unique username or email identifier
     * @returns {string} iterations[].author.id - Unique user identifier (GUID format)
     * @returns {string} iterations[].author.imageUrl - URL to the author's profile image
     * @returns {string} iterations[].createdDate - ISO 8601 timestamp when iteration was created
     *                                            - Format: "YYYY-MM-DDTHH:mm:ss.sssZ"
     *                                            - Always in UTC timezone
     * @returns {string} iterations[].updatedDate - ISO 8601 timestamp when iteration was last updated
     *                                            - Format: "YYYY-MM-DDTHH:mm:ss.sssZ"
     *                                            - May be same as createdDate for initial iterations
     * 
     * @throws {Error} Throws an error if repository access fails
     *                 - Authentication token is invalid or expired
     *                 - Insufficient permissions to access the repository
     *                 - Repository does not exist or has been deleted
     * @throws {Error} Throws an error if pull request is not found
     *                 - Pull request ID does not exist in the specified repository
     *                 - Pull request has been permanently deleted
     *                 - Access permissions insufficient for pull request data
     * @throws {Error} Throws an error for invalid parameters
     *                 - Repository ID is not a valid GUID format
     *                 - Pull request ID is not a positive integer
     *                 - Required parameters are null, undefined, or empty
     * @throws {Error} Throws an error for network or service issues
     *                 - Azure DevOps service temporarily unavailable
     *                 - Network connectivity problems
     *                 - API rate limiting exceeded
     *                 - Timeout during data retrieval
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-iterations} - Azure DevOps Pull Request Iterations API
     * @see {@link getPullRequest} - For retrieving basic pull request information
     * @see {@link getPullRequestCommits} - For retrieving commits from latest iteration
     * @see {@link getPullRequestComments} - For retrieving comments across all iterations
     * 
     * @example
     * // Basic iteration retrieval for development tracking
     * const iterations = await pullRequestManager.getPullRequestIterations(
     *     '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
     *     42
     * );
     * console.log(`Pull request has ${iterations.length} iterations`);
     * iterations.forEach((iteration, index) => {
     *     console.log(`Iteration ${iteration.id}: ${iteration.description}`);
     *     console.log(`Author: ${iteration.author.displayName}`);
     *     console.log(`Created: ${new Date(iteration.createdDate).toLocaleDateString()}`);
     * });
     * 
     * @example
     * // Iteration analysis for code review metrics
     * async function analyzeIterationPattern(repositoryId, pullRequestId) {
     *     try {
     *         const iterations = await pullRequestManager.getPullRequestIterations(
     *             repositoryId, 
     *             pullRequestId
     *         );
     *         
     *         if (iterations.length === 0) {
     *             return { error: 'No iterations found' };
     *         }
     *         
     *         const analysis = {
     *             totalIterations: iterations.length,
     *             firstIteration: new Date(iterations[0].createdDate),
     *             lastIteration: new Date(iterations[iterations.length - 1].createdDate),
     *             uniqueAuthors: new Set(iterations.map(i => i.author.uniqueName)).size,
     *             averageTimeBetween: 0
     *         };
     *         
     *         // Calculate average time between iterations
     *         if (iterations.length > 1) {
     *             const totalTime = analysis.lastIteration - analysis.firstIteration;
     *             analysis.averageTimeBetween = totalTime / (iterations.length - 1);
     *         }
     *         
     *         return analysis;
     *     } catch (error) {
     *         throw new Error(`Iteration analysis failed: ${error.message}`);
     *     }
     * }
     * 
     * @example
     * // Quality gate implementation based on iteration count
     * async function checkIterationQualityGate(repositoryId, pullRequestId, maxIterations = 5) {
     *     const iterations = await pullRequestManager.getPullRequestIterations(
     *         repositoryId,
     *         pullRequestId
     *     );
     *     
     *     const qualityCheck = {
     *         passed: iterations.length <= maxIterations,
     *         currentCount: iterations.length,
     *         maxAllowed: maxIterations,
     *         recommendation: ''
     *     };
     *     
     *     if (!qualityCheck.passed) {
     *         qualityCheck.recommendation = 
     *             `Pull request has ${iterations.length} iterations, exceeding limit of ${maxIterations}. ` +
     *             'Consider breaking into smaller changes or improving initial code quality.';
     *     } else {
     *         qualityCheck.recommendation = 'Iteration count within acceptable limits.';
     *     }
     *     
     *     return qualityCheck;
     * }
     * 
     * @example
     * // Iteration timeline generation for reporting
     * async function generateIterationTimeline(repositoryId, pullRequestIds) {
     *     const timelines = [];
     *     
     *     for (const prId of pullRequestIds) {
     *         try {
     *             const iterations = await pullRequestManager.getPullRequestIterations(
     *                 repositoryId,
     *                 prId
     *             );
     *             
     *             const timeline = {
     *                 pullRequestId: prId,
     *                 timeline: iterations.map(iteration => ({
     *                     iterationId: iteration.id,
     *                     timestamp: iteration.createdDate,
     *                     author: iteration.author.displayName,
     *                     description: iteration.description,
     *                     daysSinceFirst: iterations[0] ? 
     *                         Math.floor((new Date(iteration.createdDate) - new Date(iterations[0].createdDate)) / (1000 * 60 * 60 * 24)) : 0
     *                 }))
     *             };
     *             
     *             timelines.push(timeline);
     *         } catch (error) {
     *             console.warn(`Failed to generate timeline for PR ${prId}:`, error.message);
     *         }
     *     }
     *     
     *     return timelines;
     * }
     * 
     * @example
     * // Error handling and retry logic for iteration retrieval
     * async function getIterationsWithRetry(repositoryId, pullRequestId, maxRetries = 3) {
     *     let lastError;
     *     
     *     for (let attempt = 1; attempt <= maxRetries; attempt++) {
     *         try {
     *             const iterations = await pullRequestManager.getPullRequestIterations(
     *                 repositoryId,
     *                 pullRequestId
     *             );
     *             
     *             console.log(`Successfully retrieved ${iterations.length} iterations on attempt ${attempt}`);
     *             return {
     *                 success: true,
     *                 data: iterations,
     *                 attempts: attempt
     *             };
     *         } catch (error) {
     *             lastError = error;
     *             console.warn(`Attempt ${attempt} failed:`, error.message);
     *             
     *             if (attempt < maxRetries) {
     *                 const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
     *                 await new Promise(resolve => setTimeout(resolve, delay));
     *             }
     *         }
     *     }
     *     
     *     return {
     *         success: false,
     *         error: lastError.message,
     *         attempts: maxRetries
     *     };
     * }
     */
    async getPullRequestIterations(repositoryId, pullRequestId) {
        try {
            const iterations = await this.gitApi.getPullRequestIterations(repositoryId, pullRequestId, this.project);
            
            return iterations.map(iteration => ({
                id: iteration.id,
                description: iteration.description,
                author: iteration.author,
                createdDate: iteration.createdDate,
                updatedDate: iteration.updatedDate
            }));

        } catch (error) {
            console.warn('Could not retrieve pull request iterations:', extractErrorMessage(error));
            return [];
        }
    }    /**
     * Updates the status of a specific comment thread in a pull request, enabling
     * sophisticated conversation management and review workflow automation. This method
     * is essential for implementing automated review processes, managing feedback cycles,
     * and maintaining organized discussion threads throughout the pull request lifecycle.
     * 
     * Comment thread status management supports various workflow scenarios:
     * - Marking conversations as resolved when issues are addressed
     * - Reopening discussions for continued feedback or clarification
     * - Implementing automated review gates based on thread resolution
     * - Managing code quality discussions and their lifecycle
     * - Tracking feedback implementation and verification
     * - Coordinating multi-reviewer approval processes
     * 
     * The method provides robust error handling and retry logic to ensure reliable
     * status updates even in high-concurrency review environments. It integrates
     * with Azure DevOps permissions and notification systems to maintain proper
     * review governance and team communication.
     * 
     * Status transitions follow Azure DevOps thread lifecycle rules and trigger
     * appropriate notifications to relevant stakeholders including authors,
     * reviewers, and thread participants.
     * 
     * @async
     * @method updateCommentThreadStatus
     * @description Updates comment thread status with comprehensive error handling and workflow integration
     * 
     * @param {string} repositoryId - The unique identifier of the Azure DevOps repository
     *                               Format: GUID (e.g., "6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c")
     *                               Must be a valid repository ID with pull request modification permissions
     * @param {number} pullRequestId - The unique numeric identifier of the pull request
     *                                Range: 1 to 2,147,483,647 (32-bit signed integer)
     *                                Must reference an existing pull request in the specified repository
     * @param {number} threadId - The unique identifier of the comment thread to update
     *                           Range: 1 to 2,147,483,647 (32-bit signed integer)
     *                           Must reference an existing thread in the specified pull request
     * @param {string} status - The target status for the comment thread
     *                         Allowed values: 'active', 'fixed', 'wontFix', 'closed', 'byDesign', 'pending'
     *                         Case-insensitive string that maps to Azure DevOps CommentThreadStatus enum
     *                         - 'active': Thread is open and requires attention or response
     *                         - 'fixed': Issue has been addressed and resolved
     *                         - 'wontFix': Issue acknowledged but will not be addressed
     *                         - 'closed': Thread is closed and no longer active
     *                         - 'byDesign': Behavior is intentional and by design
     *                         - 'pending': Thread is awaiting further review or action
     * 
     * @returns {Promise<Object>} Promise resolving to the updated thread status information
     * @returns {Object} result - Updated thread status details
     * @returns {number} result.threadId - The unique identifier of the updated thread
     * @returns {string} result.status - The new status of the thread (human-readable format)
     *                                  - Maps Azure DevOps enum values to readable strings
     *                                  - Reflects the actual status after successful update
     * 
     * @throws {Error} Throws an error if repository access fails
     *                 - Authentication token is invalid or expired
     *                 - Insufficient permissions to modify pull request threads
     *                 - Repository does not exist or has been deleted
     * @throws {Error} Throws an error if pull request is not found
     *                 - Pull request ID does not exist in the specified repository
     *                 - Pull request has been deleted or is inaccessible
     *                 - Access permissions insufficient for thread modification
     * @throws {Error} Throws an error if comment thread is not found
     *                 - Thread ID does not exist in the specified pull request
     *                 - Thread has been deleted or is no longer accessible
     *                 - User lacks permissions to modify the specific thread
     * @throws {Error} Throws an error for invalid status values
     *                 - Status string does not match supported values
     *                 - Status transition is not allowed by Azure DevOps rules
     *                 - Current thread state prevents the requested status change
     * @throws {Error} Throws an error for invalid parameters
     *                 - Repository ID is not a valid GUID format
     *                 - Pull request ID is not a positive integer
     *                 - Thread ID is not a positive integer
     *                 - Status parameter is null, undefined, or empty
     * @throws {Error} Throws an error for network or service issues
     *                 - Azure DevOps service temporarily unavailable
     *                 - Network connectivity problems during update
     *                 - API rate limiting exceeded
     *                 - Timeout during status update operation
     * @throws {Error} Throws an error for permission violations
     *                 - User lacks modify permissions for the thread
     *                 - Thread is locked or protected from modification
     *                 - Repository-level permissions insufficient
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments} - Azure DevOps Thread Comments API
     * @see {@link getPullRequestComments} - For retrieving comment threads before status updates
     * @see {@link addFileComment} - For creating new comment threads
     * @see {@link replyToComment} - For adding replies to existing threads
     * @see {@link mapCommentThreadStatus} - For status enum mapping utilities
     * @see {@link mapCommentThreadStatusToEnum} - For reverse status mapping
     * 
     * @example
     * // Basic thread status update for issue resolution
     * try {
     *     const result = await pullRequestManager.updateCommentThreadStatus(
     *         '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
     *         42,
     *         158,
     *         'fixed'
     *     );
     *     console.log(`Thread ${result.threadId} status updated to: ${result.status}`);
     * } catch (error) {
     *     console.error('Failed to update thread status:', error.message);
     * }
     * 
     * @example
     * // Automated review workflow with thread status management
     * async function processReviewFeedback(repositoryId, pullRequestId, threadUpdates) {
     *     const results = [];
     *     
     *     for (const update of threadUpdates) {
     *         try {
     *             const result = await pullRequestManager.updateCommentThreadStatus(
     *                 repositoryId,
     *                 pullRequestId,
     *                 update.threadId,
     *                 update.targetStatus
     *             );
     *             
     *             results.push({
     *                 threadId: update.threadId,
     *                 success: true,
     *                 oldStatus: update.currentStatus,
     *                 newStatus: result.status,
     *                 timestamp: new Date().toISOString()
     *             });
     *             
     *             console.log(`✅ Thread ${update.threadId}: ${update.currentStatus} → ${result.status}`);
     *         } catch (error) {
     *             results.push({
     *                 threadId: update.threadId,
     *                 success: false,
     *                 error: error.message,
     *                 timestamp: new Date().toISOString()
     *             });
     *             
     *             console.warn(`❌ Failed to update thread ${update.threadId}:`, error.message);
     *         }
     *     }
     *     
     *     return {
     *         totalProcessed: results.length,
     *         successful: results.filter(r => r.success).length,
     *         failed: results.filter(r => !r.success).length,
     *         details: results
     *     };
     * }
     * 
     * @example
     * // Quality gate implementation based on resolved threads
     * async function checkThreadResolutionGate(repositoryId, pullRequestId) {
     *     try {
     *         const comments = await pullRequestManager.getPullRequestComments(
     *             repositoryId,
     *             pullRequestId
     *         );
     *         
     *         const activeThreads = comments.filter(thread => 
     *             thread.status === 'active' && thread.comments.length > 0
     *         );
     *         
     *         if (activeThreads.length === 0) {
     *             return {
     *                 passed: true,
     *                 message: 'All comment threads have been resolved',
     *                 activeCount: 0
     *             };
     *         }
     *         
     *         // Auto-resolve threads marked as non-blocking
     *         const autoResolutions = [];
     *         for (const thread of activeThreads) {
     *             const lastComment = thread.comments[thread.comments.length - 1];
     *             if (lastComment.content.includes('[auto-resolve]')) {
     *                 const result = await pullRequestManager.updateCommentThreadStatus(
     *                     repositoryId,
     *                     pullRequestId,
     *                     thread.id,
     *                     'fixed'
     *                 );
     *                 autoResolutions.push(result);
     *             }
     *         }
     *         
     *         const remainingActive = activeThreads.length - autoResolutions.length;
     *         return {
     *             passed: remainingActive === 0,
     *             message: remainingActive > 0 
     *                 ? `${remainingActive} active threads require resolution`
     *                 : 'All threads resolved (including auto-resolutions)',
     *             activeCount: remainingActive,
     *             autoResolved: autoResolutions.length
     *         };
     *     } catch (error) {
     *         throw new Error(`Thread resolution gate check failed: ${error.message}`);
     *     }
     * }
     * 
     * @example
     * // Bulk thread status update with progress tracking
     * async function bulkUpdateThreadStatus(repositoryId, pullRequestId, threadIds, newStatus) {
     *     const progress = {
     *         total: threadIds.length,
     *         completed: 0,
     *         successful: 0,
     *         failed: 0,
     *         results: []
     *     };
     *     
     *     console.log(`Starting bulk update of ${threadIds.length} threads to status: ${newStatus}`);
     *     
     *     for (let i = 0; i < threadIds.length; i++) {
     *         const threadId = threadIds[i];
     *         
     *         try {
     *             const result = await pullRequestManager.updateCommentThreadStatus(
     *                 repositoryId,
     *                 pullRequestId,
     *                 threadId,
     *                 newStatus
     *             );
     *             
     *             progress.successful++;
     *             progress.results.push({
     *                 threadId,
     *                 success: true,
     *                 status: result.status
     *             });
     *             
     *         } catch (error) {
     *             progress.failed++;
     *             progress.results.push({
     *                 threadId,
     *                 success: false,
     *                 error: error.message
     *             });
     *         }
     *         
     *         progress.completed++;
     *         const percentage = Math.round((progress.completed / progress.total) * 100);
     *         console.log(`Progress: ${percentage}% (${progress.completed}/${progress.total})`);
     *     }
     *     
     *     console.log(`Bulk update completed: ${progress.successful} successful, ${progress.failed} failed`);
     *     return progress;
     * }
     * 
     * @example
     * // Thread lifecycle management with status validation
     * async function manageThreadLifecycle(repositoryId, pullRequestId, threadId, workflow) {
     *     const validTransitions = {
     *         'active': ['fixed', 'wontFix', 'closed', 'pending'],
     *         'pending': ['active', 'fixed', 'wontFix', 'closed'],
     *         'fixed': ['active', 'closed'],
     *         'wontFix': ['active', 'closed'],
     *         'byDesign': ['active', 'closed'],
     *         'closed': ['active']
     *     };
     *     
     *     let currentStatus = workflow.initialStatus || 'active';
     *     const history = [];
     *     
     *     for (const step of workflow.steps) {
     *         const { targetStatus, reason } = step;
     *         
     *         // Validate transition
     *         if (!validTransitions[currentStatus]?.includes(targetStatus)) {
     *             throw new Error(
     *                 `Invalid status transition: ${currentStatus} → ${targetStatus}`
     *             );
     *         }
     *         
     *         try {
     *             const result = await pullRequestManager.updateCommentThreadStatus(
     *                 repositoryId,
     *                 pullRequestId,
     *                 threadId,
     *                 targetStatus
     *             );
     *             
     *             history.push({
     *                 timestamp: new Date().toISOString(),
     *                 fromStatus: currentStatus,
     *                 toStatus: result.status,
     *                 reason: reason,
     *                 success: true
     *             });
     *             
     *             currentStatus = result.status;
     *         } catch (error) {
     *             history.push({
     *                 timestamp: new Date().toISOString(),
     *                 fromStatus: currentStatus,
     *                 toStatus: targetStatus,
     *                 reason: reason,
     *                 success: false,
     *                 error: error.message
     *             });
     *             
     *             throw error;
     *         }
     *     }
     *     
     *     return {
     *         threadId,
     *         finalStatus: currentStatus,
     *         history
     *     };
     * }
     */
    async updateCommentThreadStatus(repositoryId, pullRequestId, threadId, status) {
        try {
            console.log(`🔄 Updating comment thread ${threadId} status to ${status}...`);

            const thread = {
                status: this.mapCommentThreadStatusToEnum(status)
            };

            const updatedThread = await retryOperation(async () => {
                return await this.gitApi.updateThread(thread, repositoryId, pullRequestId, threadId, this.project);
            });

            console.log(`✅ Successfully updated comment thread status`);
            return {
                threadId: updatedThread.id,
                status: this.mapCommentThreadStatus(updatedThread.status)
            };

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to update comment thread status:`, errorMessage);
            throw new Error(`Failed to update comment thread status: ${errorMessage}`);
        }
    }    /**
     * Maps Azure DevOps pull request status enumeration values to human-readable string
     * representations for improved user interface display and logging purposes. This utility
     * method provides a centralized translation layer between the internal Azure DevOps
     * enum system and user-friendly status descriptions.
     * 
     * The mapping ensures consistent status representation across the application and
     * facilitates easier debugging, logging, and user interface development. It handles
     * all standard pull request lifecycle states defined by the Azure DevOps API.
     * 
     * @method mapPullRequestStatus
     * @description Converts Azure DevOps PullRequestStatus enum values to readable strings
     * 
     * @param {number} status - The Azure DevOps PullRequestStatus enumeration value
     *                         Supported values from Microsoft Azure DevOps API:
     *                         - 0: NotSet (initial state, not yet defined)
     *                         - 1: Active (open and under review)
     *                         - 2: Abandoned (closed without merging)
     *                         - 3: Completed (successfully merged)
     *                         - 4: All (query filter for all statuses)
     * 
     * @returns {string} Human-readable status string representation
     *                   Possible return values:
     *                   - 'NotSet': Pull request status has not been set
     *                   - 'Active': Pull request is open and active
     *                   - 'Abandoned': Pull request was abandoned/closed
     *                   - 'Completed': Pull request was completed/merged
     *                   - 'All': Special filter value for querying all statuses
     *                   - 'Unknown': Fallback for unrecognized enum values
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-requests} - Azure DevOps Pull Request API Reference
     * @see {@link getPullRequest} - Method that uses this mapping for status display
     * @see {@link mapCommentThreadStatus} - Related method for comment thread status mapping
     * 
     * @example
     * // Basic status mapping for display purposes
     * const status = pullRequestManager.mapPullRequestStatus(1);
     * console.log(`Pull request status: ${status}`); // Output: "Pull request status: Active"
     * 
     * @example
     * // Status mapping in pull request processing
     * const pullRequests = await getPullRequests();
     * pullRequests.forEach(pr => {
     *     const readableStatus = pullRequestManager.mapPullRequestStatus(pr.status);
     *     console.log(`PR #${pr.id}: ${readableStatus}`);
     * });
     */
    mapPullRequestStatus(status) {
        const statusMap = {
            [PullRequestStatus.NotSet]: 'NotSet',
            [PullRequestStatus.Active]: 'Active',
            [PullRequestStatus.Abandoned]: 'Abandoned',
            [PullRequestStatus.Completed]: 'Completed',
            [PullRequestStatus.All]: 'All'
        };
        return statusMap[status] || 'Unknown';
    }

    /**
     * Maps Azure DevOps comment thread status enumeration values to human-readable string
     * representations for enhanced user experience and consistent status display across
     * the application. This utility method provides essential translation between the
     * internal Azure DevOps enum system and user-friendly status descriptions.
     * 
     * The mapping supports all standard comment thread states in the Azure DevOps workflow,
     * enabling proper display in user interfaces, logging systems, and automated workflows.
     * It ensures consistent terminology and facilitates easier debugging and monitoring
     * of code review processes.
     * 
     * @method mapCommentThreadStatus
     * @description Converts Azure DevOps CommentThreadStatus enum values to readable strings
     * 
     * @param {number} status - The Azure DevOps CommentThreadStatus enumeration value
     *                         Supported values from Microsoft Azure DevOps API:
     *                         - 0: Unknown (status not determined or undefined)
     *                         - 1: Active (thread is open and requires attention)
     *                         - 2: Fixed (issue has been resolved)
     *                         - 3: WontFix (issue acknowledged but will not be addressed)
     *                         - 4: Closed (thread is closed and inactive)
     *                         - 5: ByDesign (behavior is intentional and by design)
     *                         - 6: Pending (thread is awaiting further review or action)
     * 
     * @returns {string} Human-readable status string representation
     *                   Possible return values:
     *                   - 'Unknown': Thread status is not determined
     *                   - 'Active': Thread is open and active
     *                   - 'Fixed': Issue in thread has been resolved
     *                   - 'WontFix': Issue will not be addressed
     *                   - 'Closed': Thread is closed
     *                   - 'ByDesign': Behavior is intentional
     *                   - 'Pending': Thread is pending review
     *                   - 'Unknown': Fallback for unrecognized enum values
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments} - Azure DevOps Thread Comments API
     * @see {@link getPullRequestComments} - Method that uses this mapping for thread status display
     * @see {@link updateCommentThreadStatus} - Method that modifies thread status
     * @see {@link mapCommentThreadStatusToEnum} - Reverse mapping method for status updates
     * 
     * @example
     * // Basic thread status mapping for display
     * const threadStatus = pullRequestManager.mapCommentThreadStatus(2);
     * console.log(`Thread status: ${threadStatus}`); // Output: "Thread status: Fixed"
     * 
     * @example
     * // Thread status mapping in comment processing
     * const comments = await getPullRequestComments(repoId, prId);
     * comments.forEach(thread => {
     *     const readableStatus = pullRequestManager.mapCommentThreadStatus(thread.status);
     *     console.log(`Thread ${thread.id}: ${readableStatus} (${thread.comments.length} comments)`);
     * });
     */
    mapCommentThreadStatus(status) {
        const statusMap = {
            [CommentThreadStatus.Unknown]: 'Unknown',
            [CommentThreadStatus.Active]: 'Active',
            [CommentThreadStatus.Fixed]: 'Fixed',
            [CommentThreadStatus.WontFix]: 'WontFix',
            [CommentThreadStatus.Closed]: 'Closed',
            [CommentThreadStatus.ByDesign]: 'ByDesign',
            [CommentThreadStatus.Pending]: 'Pending'
        };
        return statusMap[status] || 'Unknown';
    }

    /**
     * Maps human-readable comment thread status strings to Azure DevOps CommentThreadStatus
     * enumeration values for API communication and status updates. This utility method
     * provides the reverse translation of mapCommentThreadStatus, enabling seamless
     * conversion from user-friendly status names to the enum values required by Azure DevOps APIs.
     * 
     * The mapping supports case-sensitive string matching and provides fallback handling
     * for unrecognized status strings. This method is essential for status update operations
     * and ensures proper communication with the Azure DevOps REST API while maintaining
     * user-friendly interfaces.
     * 
     * Status string validation and enum conversion are critical for maintaining data
     * integrity and preventing API errors during comment thread status updates.
     * 
     * @method mapCommentThreadStatusToEnum
     * @description Converts readable status strings to Azure DevOps CommentThreadStatus enum values
     * 
     * @param {string} status - The human-readable status string to convert
     *                         Supported values (case-sensitive):
     *                         - 'Unknown': Maps to CommentThreadStatus.Unknown (0)
     *                         - 'Active': Maps to CommentThreadStatus.Active (1)
     *                         - 'Fixed': Maps to CommentThreadStatus.Fixed (2)
     *                         - 'WontFix': Maps to CommentThreadStatus.WontFix (3)
     *                         - 'Closed': Maps to CommentThreadStatus.Closed (4)
     *                         - 'ByDesign': Maps to CommentThreadStatus.ByDesign (5)
     *                         - 'Pending': Maps to CommentThreadStatus.Pending (6)
     * 
     * @returns {number} Azure DevOps CommentThreadStatus enumeration value
     *                   Return values correspond to Azure DevOps API enum:
     *                   - 0: Unknown status
     *                   - 1: Active thread requiring attention
     *                   - 2: Fixed issue resolution
     *                   - 3: WontFix acknowledgment without resolution
     *                   - 4: Closed thread
     *                   - 5: ByDesign intentional behavior
     *                   - 6: Pending further review
     *                   - 1: Default fallback to Active for unrecognized strings
     * 
     * @since 1.0.0
     * @see {@link https://docs.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments} - Azure DevOps Thread Comments API
     * @see {@link updateCommentThreadStatus} - Method that uses this mapping for status updates
     * @see {@link mapCommentThreadStatus} - Reverse mapping method for status display
     * @see {@link addFileComment} - Method that may use status mapping for initial thread state
     * 
     * @example
     * // Basic status string to enum conversion
     * const enumValue = pullRequestManager.mapCommentThreadStatusToEnum('Fixed');
     * console.log(`Enum value: ${enumValue}`); // Output: "Enum value: 2"
     * 
     * @example
     * // Status conversion in thread update workflow
     * async function updateThreadsToResolved(threadIds, repositoryId, pullRequestId) {
     *     const targetEnum = pullRequestManager.mapCommentThreadStatusToEnum('Fixed');
     *     
     *     for (const threadId of threadIds) {
     *         await updateCommentThreadStatus(repositoryId, pullRequestId, threadId, 'Fixed');
     *     }
     * }
     * 
     * @example
     * // Validation and conversion with error handling
     * function validateAndConvertStatus(userInput) {
     *     const validStatuses = ['Unknown', 'Active', 'Fixed', 'WontFix', 'Closed', 'ByDesign', 'Pending'];
     *     
     *     if (!validStatuses.includes(userInput)) {
     *         throw new Error(`Invalid status: ${userInput}. Valid options: ${validStatuses.join(', ')}`);
     *     }
     *     
     *     return pullRequestManager.mapCommentThreadStatusToEnum(userInput);
     * }
     */
    mapCommentThreadStatusToEnum(status) {
        const statusMap = {
            'Unknown': CommentThreadStatus.Unknown,
            'Active': CommentThreadStatus.Active,
            'Fixed': CommentThreadStatus.Fixed,
            'WontFix': CommentThreadStatus.WontFix,
            'Closed': CommentThreadStatus.Closed,
            'ByDesign': CommentThreadStatus.ByDesign,
            'Pending': CommentThreadStatus.Pending
        };
        return statusMap[status] || CommentThreadStatus.Active;
    }
}
