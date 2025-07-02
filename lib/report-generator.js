import { getDbManager } from "./db-manager.js";
import log from "./logger.js";

class ReportGenerator {

  /**
   * Generate usage report data for a specific user and time period
   * @param {number} userId - User ID
   * @param {string} reportType - 'daily', 'weekly', or 'monthly'
   * @param {Date} endDate - End date for the report period (defaults to now)
   * @returns {Object} Report data object ready for email template
   */
  async generateUsageReport(userId, reportType, endDate = new Date()) {
    try {
      const { startDate, periodEnd } = this.calculateReportPeriod(reportType, endDate);

      log.info("Generating usage report", {
        userId,
        reportType,
        startDate: startDate.toISOString(),
        endDate: periodEnd.toISOString()
      });

      // Get user information
      const user = await this.getUserInfo(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Get usage data for the period
      const [
        aggregateData,
        sessionData,
        topProjects
      ] = await Promise.all([
        this.getAggregateUsage(userId, startDate, periodEnd),
        this.getSessionData(userId, startDate, periodEnd),
        this.getTopProjects(userId, startDate, periodEnd, 5)
      ]);

      // Calculate summary metrics
      const summary = this.calculateSummaryMetrics(aggregateData, sessionData);

      return {
        username: user.username,
        displayName: user.display_name,
        email: user.email,
        reportType,
        periodStart: startDate.toISOString(),
        periodEnd: periodEnd.toISOString(),
        ...summary,
        topProjects,
        sessionCount: sessionData.length
      };

    } catch (error) {
      log.error("Failed to generate usage report:", { error: error.message, userId, reportType });
      throw error;
    }
  }

  /**
   * Calculate start and end dates for the report period
   */
  calculateReportPeriod(reportType, endDate) {
    const periodEnd = new Date(endDate);
    const startDate = new Date(endDate);

    switch (reportType) {
      case "daily":
        startDate.setDate(startDate.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        break;

      case "weekly":
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        break;

      case "monthly":
        startDate.setMonth(startDate.getMonth() - 1);
        startDate.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);
        break;

      default:
        throw new Error(`Invalid report type: ${reportType}`);
    }

    return { startDate, periodEnd };
  }

  /**
   * Get user information
   */
  async getUserInfo(userId) {
    return await getDbManager().executeQuery(async (db) => {
      const result = await db.sql`
        SELECT id, username, display_name, email, timezone
        FROM users 
        WHERE id = ${userId} AND is_deleted = 0
        LIMIT 1
      `;
      return result[0] || null;
    }, { operation: "get_user_for_report" });
  }

  /**
   * Get aggregate usage data for the period
   */
  async getAggregateUsage(userId, startDate, endDate) {
    return await getDbManager().executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          machine_id,
          date,
          input_tokens,
          output_tokens,
          cache_creation_tokens,
          cache_read_tokens,
          total_tokens,
          total_cost,
          models_used,
          model_breakdowns
        FROM usage_data 
        WHERE user_id = ${userId} 
          AND date >= ${startDate.toISOString().split("T")[0]}
          AND date <= ${endDate.toISOString().split("T")[0]}
        ORDER BY date DESC
      `;
    }, { operation: "get_aggregate_usage_for_report" });
  }

  /**
   * Get session data for the period
   */
  async getSessionData(userId, startDate, endDate) {
    return await getDbManager().executeQuery(async (db) => {
      return await db.sql`
        SELECT 
          machine_id,
          session_id,
          project_path,
          start_time,
          end_time,
          duration_minutes,
          input_tokens,
          output_tokens,
          cache_creation_tokens,
          cache_read_tokens,
          total_tokens,
          total_cost,
          models_used
        FROM usage_sessions 
        WHERE user_id = ${userId} 
          AND start_time >= ${startDate.toISOString()}
          AND start_time <= ${endDate.toISOString()}
        ORDER BY start_time DESC
      `;
    }, { operation: "get_session_data_for_report" });
  }

  /**
   * Get top projects by usage for the period
   */
  async getTopProjects(userId, startDate, endDate, limit = 5) {
    const sessionData = await this.getSessionData(userId, startDate, endDate);

    // Group by project path and aggregate
    const projectMap = new Map();

    sessionData.forEach(session => {
      if (!session.project_path) return;

      const projectName = this.extractProjectName(session.project_path);
      const existing = projectMap.get(projectName) || {
        name: projectName,
        tokens: 0,
        cost: 0,
        sessions: 0
      };

      existing.tokens += session.total_tokens || 0;
      existing.cost += session.total_cost || 0;
      existing.sessions += 1;

      projectMap.set(projectName, existing);
    });

    // Convert to array and sort by tokens
    return Array.from(projectMap.values())
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, limit);
  }

  /**
   * Extract project name from full path
   */
  extractProjectName(projectPath) {
    if (!projectPath) return "Unknown Project";

    // Remove common prefixes and get the main project folder name
    const parts = projectPath.replace(/^\/+/, "").split("/");

    // Look for meaningful project indicators
    const meaningfulParts = parts.filter(part =>
      !part.startsWith(".") &&
      part !== "Users" &&
      part !== "home" &&
      part !== "projects" &&
      part.length > 1
    );

    return meaningfulParts[meaningfulParts.length - 1] || "Unknown Project";
  }

  /**
   * Calculate summary metrics from usage data
   */
  calculateSummaryMetrics(aggregateData, sessionData) {
    const totalTokens = aggregateData.reduce((sum, row) => sum + (row.total_tokens || 0), 0);
    const totalCost = aggregateData.reduce((sum, row) => sum + (row.total_cost || 0), 0);

    // Calculate token breakdown
    const tokenBreakdown = {
      input: aggregateData.reduce((sum, row) => sum + (row.input_tokens || 0), 0),
      output: aggregateData.reduce((sum, row) => sum + (row.output_tokens || 0), 0),
      cache_creation: aggregateData.reduce((sum, row) => sum + (row.cache_creation_tokens || 0), 0),
      cache_read: aggregateData.reduce((sum, row) => sum + (row.cache_read_tokens || 0), 0)
    };

    // Calculate cost breakdown by model (from model_breakdowns JSON)
    const costBreakdown = this.calculateCostBreakdown(aggregateData);

    // Calculate total session duration
    const totalDuration = sessionData.reduce((sum, session) => sum + (session.duration_minutes || 0), 0);

    return {
      totalTokens,
      totalCost,
      tokenBreakdown,
      costBreakdown,
      totalDurationMinutes: totalDuration,
      totalDurationHours: Math.round(totalDuration / 60 * 10) / 10, // Round to 1 decimal
      dailyAverage: aggregateData.length > 0 ? Math.round(totalTokens / aggregateData.length) : 0
    };
  }

  /**
   * Calculate cost breakdown by model from model_breakdowns JSON
   */
  calculateCostBreakdown(aggregateData) {
    const breakdown = {};

    aggregateData.forEach(row => {
      if (row.model_breakdowns) {
        try {
          const modelData = JSON.parse(row.model_breakdowns);
          Object.entries(modelData).forEach(([model, data]) => {
            if (!breakdown[model]) {
              breakdown[model] = { cost: 0, tokens: 0 };
            }
            breakdown[model].cost += data.cost || 0;
            breakdown[model].tokens += data.total_tokens || 0;
          });
        } catch (error) {
          log.warn("Failed to parse model_breakdowns JSON:", { error: error.message, data: row.model_breakdowns });
        }
      }
    });

    return breakdown;
  }

  /**
   * Check if user has enough activity to warrant sending a report
   * @param {number} userId
   * @param {string} reportType
   * @param {Date} endDate
   * @returns {boolean}
   */
  async shouldSendReport(userId, reportType, endDate = new Date()) {
    try {
      const { startDate, periodEnd } = this.calculateReportPeriod(reportType, endDate);

      const activity = await getDbManager().executeQuery(async (db) => {
        const result = await db.sql`
          SELECT COUNT(*) as session_count, COALESCE(SUM(total_tokens), 0) as total_tokens
          FROM usage_sessions 
          WHERE user_id = ${userId} 
            AND start_time >= ${startDate.toISOString()}
            AND start_time <= ${periodEnd.toISOString()}
        `;
        return result[0];
      }, { operation: "check_report_activity" });

      // Send report if user had at least 1 session or 100 tokens
      return (activity.session_count > 0) || (activity.total_tokens > 100);

    } catch (error) {
      log.error("Failed to check report activity:", { error: error.message, userId, reportType });
      return false;
    }
  }
}

// Create singleton instance
const reportGenerator = new ReportGenerator();

export default reportGenerator;
