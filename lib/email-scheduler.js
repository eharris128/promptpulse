import { getDbManager } from './db-manager.js';
import emailService from './email-service.js';
import reportGenerator from './report-generator.js';
import log from './logger.js';

class EmailScheduler {
  constructor() {
    this.isRunning = false;
  }

  /**
   * Process all pending email reports
   * This method should be called by a cron job or scheduled task
   */
  async processPendingEmails() {
    if (this.isRunning) {
      log.warn('Email scheduler is already running, skipping this execution');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      log.info('Starting email scheduler process');

      if (!emailService.isEnabled()) {
        log.warn('Email service is not enabled, skipping email scheduler');
        return;
      }

      const currentTime = new Date();
      const results = {
        processed: 0,
        sent: 0,
        failed: 0,
        skipped: 0
      };

      // Get all users with email reports enabled
      const usersToProcess = await this.getUsersForEmailReports(currentTime);
      log.info(`Found ${usersToProcess.length} users to process for email reports`);

      for (const user of usersToProcess) {
        try {
          await this.processUserEmailReports(user, currentTime, results);
          results.processed++;
        } catch (error) {
          log.error('Failed to process email for user:', { 
            error: error.message, 
            userId: user.user_id,
            email: user.email 
          });
          results.failed++;
        }
      }

      const duration = Date.now() - startTime;
      log.info('Email scheduler completed', { 
        duration: `${duration}ms`,
        results 
      });

      return results;

    } catch (error) {
      log.error('Email scheduler process failed:', { error: error.message });
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Get users who should receive email reports at this time
   */
  async getUsersForEmailReports(currentTime) {
    return await getDbManager().executeQuery(async (db) => {
      const currentHour = currentTime.getHours();
      const currentMinute = currentTime.getMinutes();
      const currentDate = currentTime.toISOString().split('T')[0]; // YYYY-MM-DD
      
      return await db.sql`
        SELECT 
          u.id as user_id,
          u.email,
          u.username,
          u.display_name,
          u.timezone as user_timezone,
          ep.report_frequency,
          ep.preferred_time,
          ep.timezone,
          ep.last_sent_daily,
          ep.last_sent_weekly,
          ep.last_sent_monthly
        FROM users u
        JOIN user_email_preferences ep ON u.id = ep.user_id
        WHERE u.email IS NOT NULL 
          AND u.is_deleted = 0
          AND ep.email_reports_enabled = 1
          AND (
            -- Check if it's time to send based on frequency and preferred time
            (ep.report_frequency = 'daily' AND (ep.last_sent_daily IS NULL OR ep.last_sent_daily < ${currentDate}))
            OR (ep.report_frequency = 'weekly' AND (ep.last_sent_weekly IS NULL OR ep.last_sent_weekly < ${this.getWeekAgo(currentTime)}))
            OR (ep.report_frequency = 'monthly' AND (ep.last_sent_monthly IS NULL OR ep.last_sent_monthly < ${this.getMonthAgo(currentTime)}))
          )
      `;
    }, { operation: 'get_users_for_email_reports' });
  }

  /**
   * Process email reports for a specific user
   */
  async processUserEmailReports(user, currentTime, results) {
    const { user_id, email, report_frequency, preferred_time, timezone } = user;

    // Check if it's the right time to send (within 30 minute window of preferred time)
    if (!this.isTimeToSend(currentTime, preferred_time, timezone)) {
      log.debug('Not time to send email for user', { 
        userId: user_id, 
        preferredTime: preferred_time,
        timezone,
        currentTime: currentTime.toISOString()
      });
      results.skipped++;
      return;
    }

    // Check if user has enough activity to warrant sending a report
    const hasActivity = await reportGenerator.shouldSendReport(user_id, report_frequency, currentTime);
    if (!hasActivity) {
      log.info('Skipping email for user with no activity', { userId: user_id, reportFrequency: report_frequency });
      results.skipped++;
      await this.updateLastSentDate(user_id, report_frequency, currentTime);
      return;
    }

    try {
      // Generate the report
      const reportData = await reportGenerator.generateUsageReport(user_id, report_frequency, currentTime);
      
      // Send the email
      const emailResult = await emailService.sendUsageReport(email, reportData, report_frequency);
      
      // Log the email send attempt
      await this.logEmailSend(user_id, report_frequency, email, emailResult);

      if (emailResult.success) {
        // Update last sent date
        await this.updateLastSentDate(user_id, report_frequency, currentTime);
        
        log.info('Email report sent successfully', { 
          userId: user_id, 
          email, 
          reportFrequency: report_frequency,
          emailId: emailResult.emailId
        });
        
        results.sent++;
      } else {
        log.error('Failed to send email report', { 
          userId: user_id, 
          email, 
          reportFrequency: report_frequency,
          error: emailResult.error
        });
        
        results.failed++;
      }

    } catch (error) {
      log.error('Error processing email report for user:', { 
        error: error.message, 
        userId: user_id, 
        email,
        reportFrequency: report_frequency
      });
      
      // Log the failed attempt
      await this.logEmailSend(user_id, report_frequency, email, { 
        success: false, 
        error: error.message,
        emailId: null 
      });
      
      results.failed++;
    }
  }

  /**
   * Check if it's the right time to send an email based on user preferences
   */
  isTimeToSend(currentTime, preferredTime, userTimezone) {
    try {
      // Convert current time to user's timezone
      const userTime = new Date(currentTime.toLocaleString("en-US", { timeZone: userTimezone || 'UTC' }));
      
      const [preferredHour, preferredMinute] = preferredTime.split(':').map(Number);
      const currentHour = userTime.getHours();
      const currentMinute = userTime.getMinutes();
      
      // Calculate preferred time in minutes since midnight
      const preferredMinutes = preferredHour * 60 + preferredMinute;
      const currentMinutes = currentHour * 60 + currentMinute;
      
      // Allow 30-minute window (15 minutes before and after preferred time)
      const timeDiff = Math.abs(currentMinutes - preferredMinutes);
      return timeDiff <= 15 || timeDiff >= (24 * 60 - 15); // Handle midnight wrap-around
      
    } catch (error) {
      log.warn('Error checking send time, defaulting to false:', { 
        error: error.message, 
        preferredTime, 
        userTimezone 
      });
      return false;
    }
  }

  /**
   * Update the last sent date for a user's report frequency
   */
  async updateLastSentDate(userId, reportFrequency, sentDate) {
    const dateString = sentDate.toISOString().split('T')[0]; // YYYY-MM-DD
    
    let columnToUpdate;
    switch (reportFrequency) {
      case 'daily':
        columnToUpdate = 'last_sent_daily';
        break;
      case 'weekly':
        columnToUpdate = 'last_sent_weekly';
        break;
      case 'monthly':
        columnToUpdate = 'last_sent_monthly';
        break;
      default:
        throw new Error(`Invalid report frequency: ${reportFrequency}`);
    }

    await getDbManager().executeQuery(async (db) => {
      return await db.sql`
        UPDATE user_email_preferences 
        SET ${columnToUpdate} = ${dateString}
        WHERE user_id = ${userId}
      `;
    }, { operation: 'update_last_sent_date' });
  }

  /**
   * Log email send attempt to database
   */
  async logEmailSend(userId, reportType, emailAddress, result) {
    try {
      await getDbManager().executeQuery(async (db) => {
        return await db.sql`
          INSERT INTO email_send_log (
            user_id, email_type, email_address, status, error_message, resend_email_id
          ) VALUES (
            ${userId}, 
            ${reportType}, 
            ${emailAddress}, 
            ${result.success ? 'sent' : 'failed'}, 
            ${result.error || null}, 
            ${result.emailId || null}
          )
        `;
      }, { operation: 'log_email_send_attempt' });
    } catch (error) {
      log.error('Failed to log email send attempt:', { 
        error: error.message, 
        userId, 
        reportType, 
        emailAddress 
      });
    }
  }

  /**
   * Helper method to get date one week ago
   */
  getWeekAgo(currentTime) {
    const weekAgo = new Date(currentTime);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return weekAgo.toISOString().split('T')[0];
  }

  /**
   * Helper method to get date one month ago
   */
  getMonthAgo(currentTime) {
    const monthAgo = new Date(currentTime);
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return monthAgo.toISOString().split('T')[0];
  }

  /**
   * Send a manual email report for a user (for testing or admin purposes)
   */
  async sendManualReport(userId, reportType = 'weekly') {
    try {
      // Get user info
      const user = await dbManager.executeQuery(async (db) => {
        return await db.sql`
          SELECT email, username FROM users WHERE id = ${userId} AND email IS NOT NULL
        `;
      }, { operation: 'get_user_for_manual_report' });

      if (!user[0]) {
        throw new Error('User not found or no email address');
      }

      // Generate and send report
      const reportData = await reportGenerator.generateUsageReport(userId, reportType);
      const result = await emailService.sendUsageReport(user[0].email, reportData, reportType);
      
      // Log the manual send
      await this.logEmailSend(userId, reportType, user[0].email, result);
      
      return result;
      
    } catch (error) {
      log.error('Failed to send manual report:', { error: error.message, userId, reportType });
      throw error;
    }
  }

  /**
   * Get email statistics for monitoring
   */
  async getEmailStats(days = 7) {
    return await dbManager.executeQuery(async (db) => {
      const since = new Date();
      since.setDate(since.getDate() - days);
      
      return await db.sql`
        SELECT 
          email_type,
          status,
          COUNT(*) as count,
          DATE(sent_at) as date
        FROM email_send_log 
        WHERE sent_at >= ${since.toISOString()}
        GROUP BY email_type, status, DATE(sent_at)
        ORDER BY date DESC, email_type, status
      `;
    }, { operation: 'get_email_statistics' });
  }
}

// Create singleton instance
const emailScheduler = new EmailScheduler();

export default emailScheduler;