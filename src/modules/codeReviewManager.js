/**
 * Code Review Management Module
 * 
 * @file codeReviewManager.js - Handles code review comment analysis and fix suggestions
 * @description This module provides functionality to analyze code review comments in
 * Azure DevOps pull requests and generate actionable fix suggestions. It processes
 * comment threads, identifies common issues, and provides structured recommendations
 * for addressing reviewer feedback.
 * 
 * @version 1.0.0
 * @author Luu Tran
 * @since 2025-05-29
 * 
 * @requires ./pullRequestManager.js - Pull request operations
 * @requires ../utils/helpers.js - Utility functions
 * 
 * @example
 * // Analyze code review comments and get fix suggestions
 * const manager = new CodeReviewManager(webApi, project);
 * await manager.initialize();
 * 
 * const analysis = await manager.analyzeCodeReviewComments(
 *   'https://dev.azure.com/org/project/_git/repo/pullrequest/123'
 * );
 * 
 * console.log('Fix suggestions:', analysis.fixSuggestions);
 */

import { PullRequestManager } from './pullRequestManager.js';
import { parseAzureDevOpsUrl, extractErrorMessage, retryOperation } from '../utils/helpers.js';

/**
 * Code Review Manager Class
 * 
 * @class CodeReviewManager
 * @description Manages code review comment analysis and fix suggestion generation
 * for Azure DevOps pull requests. Provides comprehensive analysis of reviewer
 * feedback and generates actionable recommendations.
 */
export class CodeReviewManager {
    /**
     * Creates an instance of CodeReviewManager
     * 
     * @constructor
     * @param {Object} webApi - Azure DevOps Web API client instance
     * @param {string} project - Azure DevOps project name
     */
    constructor(webApi, project) {
        this.webApi = webApi;
        this.project = project;
        this.pullRequestManager = new PullRequestManager(webApi, project);
    }

    /**
     * Initialize the Code Review Manager
     * 
     * @async
     * @method initialize
     * @description Initializes the underlying pull request manager
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.pullRequestManager.initialize();
    }

    /**
     * Analyzes code review comments from a pull request URL and generates fix suggestions
     * 
     * @async
     * @method analyzeCodeReviewComments
     * @description Parses a pull request URL, retrieves comments, analyzes them for
     * actionable issues, and generates structured fix suggestions
     * 
     * @param {string} pullRequestUrl - The Azure DevOps pull request URL
     * @returns {Promise<Object>} Analysis results with fix suggestions
     * @throws {Error} When URL parsing or comment analysis fails
     */
    async analyzeCodeReviewComments(pullRequestUrl) {
        try {
            console.log(`🔍 Analyzing code review comments from: ${pullRequestUrl}`);

            // Parse the pull request URL
            const urlInfo = parseAzureDevOpsUrl(pullRequestUrl);
            
            if (urlInfo.type !== 'pullRequest') {
                throw new Error('URL is not a valid Azure DevOps pull request URL');
            }

            // Get pull request details
            const pullRequest = await this.pullRequestManager.getPullRequestByUrl(pullRequestUrl, true);
            
            if (!pullRequest) {
                throw new Error('Pull request not found or inaccessible');
            }
            
            if (!pullRequest.repository || !pullRequest.repository.id) {
                throw new Error('Pull request repository information is missing');
            }
            
            // Get comments
            const comments = await this.pullRequestManager.getPullRequestComments(
                pullRequest.repository.id,
                pullRequest.id
            );

            // Analyze comments for actionable issues
            const analysis = await this.analyzeCommentThreads(comments);

            // Generate fix suggestions
            const fixSuggestions = await this.generateFixSuggestions(analysis.actionableComments);

            const result = {
                pullRequest: {
                    id: pullRequest.id || 'Unknown',
                    title: pullRequest.title || 'Untitled',
                    url: pullRequest.url || pullRequestUrl,
                    repository: pullRequest.repository?.name || 'Unknown Repository',
                    status: pullRequest.status || 'Unknown'
                },
                analysis: {
                    totalThreads: comments.length,
                    activeThreads: analysis.activeThreads,
                    actionableComments: analysis.actionableComments.length,
                    commentsByFile: analysis.commentsByFile,
                    commonIssues: analysis.commonIssues
                },
                fixSuggestions: fixSuggestions,
                summary: this.generateSummary(analysis, fixSuggestions)
            };

            console.log(`✅ Analysis complete: ${result.analysis.actionableComments} actionable comments found`);
            return result;

        } catch (error) {
            const errorMessage = extractErrorMessage(error);
            console.error(`❌ Failed to analyze code review comments:`, errorMessage);
            throw new Error(`Failed to analyze code review comments: ${errorMessage}`);
        }
    }

    /**
     * Analyzes comment threads to identify actionable issues
     * 
     * @async
     * @method analyzeCommentThreads
     * @description Processes comment threads to identify active issues that need addressing
     * 
     * @param {Array<Object>} comments - Array of comment threads
     * @returns {Promise<Object>} Analysis results
     */
    async analyzeCommentThreads(comments) {
        const analysis = {
            activeThreads: 0,
            actionableComments: [],
            commentsByFile: {},
            commonIssues: {}
        };

        for (const thread of comments) {
            if (thread.status === 'Active' && thread.comments.length > 0) {
                analysis.activeThreads++;

                // Group by file
                const filePath = thread.context?.filePath || 'General';
                if (!analysis.commentsByFile[filePath]) {
                    analysis.commentsByFile[filePath] = [];
                }

                // Process each comment in the thread
                for (const comment of thread.comments) {
                    if (this.isActionableComment(comment)) {
                        const actionableComment = {
                            threadId: thread.id,
                            commentId: comment.id,
                            content: comment.content,
                            author: comment.author,
                            filePath: filePath,
                            line: thread.context?.rightFileStart?.line || null,
                            publishedDate: comment.publishedDate,
                            issueType: this.categorizeIssue(comment.content),
                            severity: this.assessSeverity(comment.content)
                        };

                        analysis.actionableComments.push(actionableComment);
                        analysis.commentsByFile[filePath].push(actionableComment);

                        // Track common issues
                        const issueType = actionableComment.issueType;
                        analysis.commonIssues[issueType] = (analysis.commonIssues[issueType] || 0) + 1;
                    }
                }
            }
        }

        return analysis;
    }

    /**
     * Determines if a comment is actionable (requires code changes)
     * 
     * @method isActionableComment
     * @description Analyzes comment content to determine if it requires action
     * 
     * @param {Object} comment - Comment object to analyze
     * @returns {boolean} True if comment is actionable
     */
    isActionableComment(comment) {
        const content = comment.content.toLowerCase();
        
        // Skip comments from bots or automated systems
        if (comment.author.displayName.toLowerCase().includes('bot') ||
            comment.author.displayName.toLowerCase().includes('automated')) {
            return false;
        }

        // Actionable keywords
        const actionableKeywords = [
            'should', 'must', 'need to', 'please', 'fix', 'change', 'update', 'remove',
            'add', 'consider', 'improve', 'refactor', 'optimize', 'better', 'issue',
            'problem', 'error', 'bug', 'incorrect', 'missing', 'wrong', 'typo',
            'vulnerability', 'security', 'performance', 'memory leak', 'deprecated'
        ];

        // Non-actionable keywords (informational/positive)
        const nonActionableKeywords = [
            'looks good', 'lgtm', 'approved', 'nice', 'great', 'perfect', 'thanks',
            'well done', 'good job', 'excellent', 'awesome', 'fantastic'
        ];

        // Check for non-actionable patterns first
        if (nonActionableKeywords.some(keyword => content.includes(keyword))) {
            return false;
        }

        // Check for actionable patterns
        return actionableKeywords.some(keyword => content.includes(keyword));
    }

    /**
     * Categorizes the type of issue based on comment content
     * 
     * @method categorizeIssue
     * @description Analyzes comment content to determine the category of issue
     * 
     * @param {string} content - Comment content to analyze
     * @returns {string} Issue category
     */
    categorizeIssue(content) {
        const lowerContent = content.toLowerCase();

        const categories = {
            'Code Quality': ['refactor', 'clean up', 'better way', 'improve', 'optimize', 'simplify'],
            'Bug': ['bug', 'error', 'issue', 'problem', 'incorrect', 'wrong', 'broken'],
            'Security': ['security', 'vulnerability', 'unsafe', 'risk', 'exploit', 'sanitize'],
            'Performance': ['performance', 'slow', 'optimization', 'memory', 'cpu', 'efficiency'],
            'Style': ['style', 'format', 'naming', 'convention', 'consistent', 'typo'],
            'Documentation': ['comment', 'documentation', 'doc', 'explain', 'describe', 'unclear'],
            'Testing': ['test', 'unit test', 'coverage', 'mock', 'assertion', 'verify'],
            'Architecture': ['design', 'architecture', 'pattern', 'structure', 'organization'],
            'Maintenance': ['deprecated', 'legacy', 'update', 'upgrade', 'maintain', 'replace']
        };

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(keyword => lowerContent.includes(keyword))) {
                return category;
            }
        }

        return 'General';
    }

    /**
     * Assesses the severity of an issue based on comment content
     * 
     * @method assessSeverity
     * @description Determines the severity level of an issue
     * 
     * @param {string} content - Comment content to analyze
     * @returns {string} Severity level (High, Medium, Low)
     */
    assessSeverity(content) {
        const lowerContent = content.toLowerCase();

        const highSeverityKeywords = [
            'critical', 'urgent', 'must fix', 'security', 'vulnerability', 'bug', 'error',
            'broken', 'fail', 'crash', 'memory leak', 'performance issue'
        ];

        const mediumSeverityKeywords = [
            'should', 'need to', 'important', 'issue', 'problem', 'incorrect', 'wrong',
            'improve', 'refactor', 'optimize'
        ];

        if (highSeverityKeywords.some(keyword => lowerContent.includes(keyword))) {
            return 'High';
        } else if (mediumSeverityKeywords.some(keyword => lowerContent.includes(keyword))) {
            return 'Medium';
        }

        return 'Low';
    }

    /**
     * Generates fix suggestions for actionable comments
     * 
     * @async
     * @method generateFixSuggestions
     * @description Creates structured fix suggestions for each actionable comment
     * 
     * @param {Array<Object>} actionableComments - Array of actionable comments
     * @returns {Promise<Array<Object>>} Array of fix suggestions
     */
    async generateFixSuggestions(actionableComments) {
        const fixSuggestions = [];

        for (const comment of actionableComments) {
            const suggestion = {
                commentId: comment.commentId,
                threadId: comment.threadId,
                filePath: comment.filePath,
                line: comment.line,
                issueType: comment.issueType,
                severity: comment.severity,
                originalComment: comment.content,
                author: comment.author.displayName,
                suggestion: await this.generateSpecificSuggestion(comment),
                actionItems: this.generateActionItems(comment),
                estimatedEffort: this.estimateEffort(comment),
                resources: this.getRelevantResources(comment.issueType)
            };

            fixSuggestions.push(suggestion);
        }

        return fixSuggestions;
    }

    /**
     * Generates a specific fix suggestion for a comment
     * 
     * @async
     * @method generateSpecificSuggestion
     * @description Creates a specific fix suggestion based on comment analysis
     * 
     * @param {Object} comment - Comment object to generate suggestion for
     * @returns {Promise<string>} Specific fix suggestion
     */
    async generateSpecificSuggestion(comment) {
        const issueType = comment.issueType;
        const content = comment.content.toLowerCase();

        // Generate suggestions based on issue type and content
        const suggestions = {
            'Code Quality': this.generateCodeQualitySuggestion(content),
            'Bug': this.generateBugFixSuggestion(content),
            'Security': this.generateSecuritySuggestion(content),
            'Performance': this.generatePerformanceSuggestion(content),
            'Style': this.generateStyleSuggestion(content),
            'Documentation': this.generateDocumentationSuggestion(content),
            'Testing': this.generateTestingSuggestion(content),
            'Architecture': this.generateArchitectureSuggestion(content),
            'Maintenance': this.generateMaintenanceSuggestion(content)
        };

        return suggestions[issueType] || this.generateGenericSuggestion(content);
    }

    /**
     * Generates code quality improvement suggestions
     * 
     * @method generateCodeQualitySuggestion
     * @param {string} content - Comment content
     * @returns {string} Code quality suggestion
     */
    generateCodeQualitySuggestion(content) {
        if (content.includes('refactor')) {
            return 'Consider refactoring this code to improve readability and maintainability. Break down complex functions, extract common logic, and use meaningful variable names.';
        }
        if (content.includes('simplify')) {
            return 'Simplify this code by removing unnecessary complexity, using built-in functions where applicable, and following the DRY principle.';
        }
        if (content.includes('optimize')) {
            return 'Optimize this code by improving algorithm efficiency, reducing redundant operations, and using more efficient data structures.';
        }
        return 'Review and improve the code quality by following coding best practices and standards.';
    }

    /**
     * Generates bug fix suggestions
     * 
     * @method generateBugFixSuggestion
     * @param {string} content - Comment content
     * @returns {string} Bug fix suggestion
     */
    generateBugFixSuggestion(content) {
        if (content.includes('null') || content.includes('undefined')) {
            return 'Add null/undefined checks and proper error handling to prevent runtime errors.';
        }
        if (content.includes('logic')) {
            return 'Review and fix the logical error in this code. Verify conditions, loops, and branching logic.';
        }
        if (content.includes('exception') || content.includes('error')) {
            return 'Add proper exception handling with try-catch blocks and meaningful error messages.';
        }
        return 'Identify and fix the bug by adding proper validation, error handling, and testing.';
    }

    /**
     * Generates security improvement suggestions
     * 
     * @method generateSecuritySuggestion
     * @param {string} content - Comment content
     * @returns {string} Security suggestion
     */
    generateSecuritySuggestion(content) {
        if (content.includes('injection')) {
            return 'Implement proper input validation and sanitization to prevent injection attacks. Use parameterized queries and validate all user inputs.';
        }
        if (content.includes('authentication')) {
            return 'Strengthen authentication mechanisms by implementing proper session management, password policies, and multi-factor authentication.';
        }
        if (content.includes('authorization')) {
            return 'Implement proper authorization checks to ensure users can only access resources they are permitted to use.';
        }
        return 'Review and improve security by implementing proper validation, sanitization, and access controls.';
    }

    /**
     * Generates performance improvement suggestions
     * 
     * @method generatePerformanceSuggestion
     * @param {string} content - Comment content
     * @returns {string} Performance suggestion
     */
    generatePerformanceSuggestion(content) {
        if (content.includes('loop') || content.includes('iteration')) {
            return 'Optimize loops by reducing iterations, using more efficient algorithms, or implementing caching mechanisms.';
        }
        if (content.includes('memory')) {
            return 'Optimize memory usage by avoiding memory leaks, using appropriate data structures, and implementing proper cleanup.';
        }
        if (content.includes('database') || content.includes('query')) {
            return 'Optimize database queries by adding indexes, reducing query complexity, and implementing query optimization techniques.';
        }
        return 'Improve performance by profiling the code, identifying bottlenecks, and implementing optimization strategies.';
    }

    /**
     * Generates style improvement suggestions
     * 
     * @method generateStyleSuggestion
     * @param {string} content - Comment content
     * @returns {string} Style suggestion
     */
    generateStyleSuggestion(content) {
        if (content.includes('naming')) {
            return 'Use meaningful and descriptive names for variables, functions, and classes that clearly indicate their purpose.';
        }
        if (content.includes('format')) {
            return 'Apply consistent code formatting using automated tools like Prettier or ESLint to maintain code consistency.';
        }
        if (content.includes('convention')) {
            return 'Follow established coding conventions and style guides for your programming language and team standards.';
        }
        return 'Improve code style by following consistent naming conventions, formatting rules, and coding standards.';
    }

    /**
     * Generates documentation improvement suggestions
     * 
     * @method generateDocumentationSuggestion
     * @param {string} content - Comment content
     * @returns {string} Documentation suggestion
     */
    generateDocumentationSuggestion(content) {
        if (content.includes('comment')) {
            return 'Add comprehensive comments explaining the purpose, parameters, and return values of functions and complex logic.';
        }
        if (content.includes('readme')) {
            return 'Update the README file with clear installation instructions, usage examples, and API documentation.';
        }
        return 'Improve documentation by adding clear explanations, examples, and maintaining up-to-date information.';
    }

    /**
     * Generates testing improvement suggestions
     * 
     * @method generateTestingSuggestion
     * @param {string} content - Comment content
     * @returns {string} Testing suggestion
     */
    generateTestingSuggestion(content) {
        if (content.includes('unit test')) {
            return 'Add comprehensive unit tests covering all functions, edge cases, and error scenarios.';
        }
        if (content.includes('coverage')) {
            return 'Increase test coverage by adding tests for untested code paths and edge cases.';
        }
        return 'Improve testing by adding comprehensive test cases, mocking dependencies, and ensuring proper test coverage.';
    }

    /**
     * Generates architecture improvement suggestions
     * 
     * @method generateArchitectureSuggestion
     * @param {string} content - Comment content
     * @returns {string} Architecture suggestion
     */
    generateArchitectureSuggestion(content) {
        if (content.includes('design pattern')) {
            return 'Consider implementing appropriate design patterns to improve code organization and maintainability.';
        }
        if (content.includes('separation')) {
            return 'Improve separation of concerns by organizing code into logical modules and following SOLID principles.';
        }
        return 'Review and improve the overall architecture by following established design principles and patterns.';
    }

    /**
     * Generates maintenance improvement suggestions
     * 
     * @method generateMaintenanceSuggestion
     * @param {string} content - Comment content
     * @returns {string} Maintenance suggestion
     */
    generateMaintenanceSuggestion(content) {
        if (content.includes('deprecated')) {
            return 'Replace deprecated functions or libraries with their modern alternatives to ensure future compatibility.';
        }
        if (content.includes('update')) {
            return 'Update dependencies to their latest stable versions and review for security vulnerabilities.';
        }
        return 'Improve maintainability by updating dependencies, removing deprecated code, and following current best practices.';
    }

    /**
     * Generates generic fix suggestions
     * 
     * @method generateGenericSuggestion
     * @param {string} content - Comment content
     * @returns {string} Generic suggestion
     */
    generateGenericSuggestion(content) {
        return 'Review the code and address the concerns raised in the comment. Consider the reviewer\'s feedback and implement appropriate changes.';
    }

    /**
     * Generates action items for a comment
     * 
     * @method generateActionItems
     * @param {Object} comment - Comment object
     * @returns {Array<string>} Array of action items
     */
    generateActionItems(comment) {
        const actions = [];
        const content = comment.content.toLowerCase();
        const issueType = comment.issueType;

        // Add general action items based on issue type
        if (issueType === 'Bug') {
            actions.push('Investigate and reproduce the issue');
            actions.push('Write unit tests to validate the fix');
            actions.push('Implement the fix with proper error handling');
        } else if (issueType === 'Security') {
            actions.push('Conduct security impact assessment');
            actions.push('Implement security improvements');
            actions.push('Add security tests and validation');
        } else if (issueType === 'Performance') {
            actions.push('Profile the code to identify bottlenecks');
            actions.push('Implement performance optimizations');
            actions.push('Add performance tests and benchmarks');
        } else {
            actions.push('Review and understand the feedback');
            actions.push('Implement the suggested changes');
            actions.push('Test the changes thoroughly');
        }

        // Add file-specific actions if needed
        if (comment.line) {
            actions.push(`Focus on line ${comment.line} in ${comment.filePath}`);
        }

        return actions;
    }

    /**
     * Estimates effort required to address a comment
     * 
     * @method estimateEffort
     * @param {Object} comment - Comment object
     * @returns {string} Effort estimate
     */
    estimateEffort(comment) {
        const severity = comment.severity;
        const issueType = comment.issueType;

        if (severity === 'High') {
            return 'High (4-8 hours)';
        } else if (severity === 'Medium') {
            if (issueType === 'Security' || issueType === 'Bug') {
                return 'Medium (2-4 hours)';
            } else {
                return 'Medium (1-3 hours)';
            }
        } else {
            return 'Low (0.5-1 hour)';
        }
    }

    /**
     * Gets relevant resources for an issue type
     * 
     * @method getRelevantResources
     * @param {string} issueType - Type of issue
     * @returns {Array<Object>} Array of relevant resources
     */
    getRelevantResources(issueType) {
        const resources = {
            'Code Quality': [
                { title: 'Clean Code Principles', url: 'https://clean-code-developer.com/' },
                { title: 'Code Review Best Practices', url: 'https://github.com/joho/awesome-code-review' }
            ],
            'Security': [
                { title: 'OWASP Top 10', url: 'https://owasp.org/www-project-top-ten/' },
                { title: 'Security Code Review', url: 'https://owasp.org/www-project-code-review-guide/' }
            ],
            'Performance': [
                { title: 'Performance Best Practices', url: 'https://web.dev/performance/' },
                { title: 'JavaScript Performance', url: 'https://developer.mozilla.org/en-US/docs/Web/Performance' }
            ],
            'Testing': [
                { title: 'Testing Best Practices', url: 'https://github.com/goldbergyoni/javascript-testing-best-practices' },
                { title: 'Unit Testing Guide', url: 'https://martinfowler.com/bliki/UnitTest.html' }
            ]
        };

        return resources[issueType] || [
            { title: 'General Development Best Practices', url: 'https://github.com/charlax/professional-programming' }
        ];
    }

    /**
     * Generates a summary of the analysis and fix suggestions
     * 
     * @method generateSummary
     * @param {Object} analysis - Analysis results
     * @param {Array<Object>} fixSuggestions - Fix suggestions
     * @returns {Object} Summary object
     */
    generateSummary(analysis, fixSuggestions) {
        const severityCount = fixSuggestions.reduce((acc, suggestion) => {
            acc[suggestion.severity] = (acc[suggestion.severity] || 0) + 1;
            return acc;
        }, {});

        const mostCommonIssue = Object.entries(analysis.commonIssues)
            .sort(([,a], [,b]) => b - a)[0];

        const totalEstimatedTime = fixSuggestions.reduce((total, suggestion) => {
            const effort = suggestion.estimatedEffort;
            if (effort.includes('High')) return total + 6; // Average of 4-8 hours
            if (effort.includes('Medium')) return total + 2.5; // Average of 1-4 hours
            return total + 0.75; // Average of 0.5-1 hour
        }, 0);

        return {
            overview: `Found ${analysis.actionableComments.length} actionable comments across ${Object.keys(analysis.commentsByFile).length} files`,
            severityBreakdown: severityCount,
            mostCommonIssue: mostCommonIssue ? mostCommonIssue[0] : 'None',
            estimatedTotalTime: `${Math.round(totalEstimatedTime * 10) / 10} hours`,
            priorityItems: fixSuggestions
                .filter(s => s.severity === 'High')
                .map(s => `${s.issueType} in ${s.filePath}${s.line ? ` (line ${s.line})` : ''}`),
            recommendations: this.generateRecommendations(analysis, fixSuggestions)
        };
    }

    /**
     * Generates overall recommendations based on analysis
     * 
     * @method generateRecommendations
     * @param {Object} analysis - Analysis results
     * @param {Array<Object>} fixSuggestions - Fix suggestions
     * @returns {Array<string>} Array of recommendations
     */
    generateRecommendations(analysis, fixSuggestions) {
        const recommendations = [];
        const highPriorityCount = fixSuggestions.filter(s => s.severity === 'High').length;
        const securityIssues = fixSuggestions.filter(s => s.issueType === 'Security').length;
        const bugIssues = fixSuggestions.filter(s => s.issueType === 'Bug').length;

        if (highPriorityCount > 0) {
            recommendations.push(`Address ${highPriorityCount} high-priority issues first`);
        }

        if (securityIssues > 0) {
            recommendations.push(`Security issues require immediate attention (${securityIssues} found)`);
        }

        if (bugIssues > 0) {
            recommendations.push(`Fix bugs before implementing new features (${bugIssues} found)`);
        }

        if (analysis.actionableComments.length > 10) {
            recommendations.push('Consider breaking down the PR into smaller, more manageable chunks');
        }

        recommendations.push('Run automated tests after each fix to ensure no regressions');
        recommendations.push('Consider pair programming for complex issues');

        return recommendations;
    }
} 