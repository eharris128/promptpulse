import { Resend } from 'resend';
import dotenv from 'dotenv';
import log from './logger.js';

dotenv.config();

class EmailService {
  constructor() {
    this.resend = null;
    this.initialized = false;
    this.init();
  }

  init() {
    const apiKey = process.env.RESEND_API_KEY;
    
    if (!apiKey) {
      log.warn('RESEND_API_KEY not found in environment variables. Email functionality will be disabled.');
      return;
    }

    try {
      this.resend = new Resend(apiKey);
      this.initialized = true;
      log.info('Email service initialized successfully with Resend');
    } catch (error) {
      log.error('Failed to initialize email service:', error);
    }
  }

  isEnabled() {
    return this.initialized && this.resend !== null;
  }

  async sendEmail({ to, subject, html, from = 'PromptPulse <noreply@promptpulse.com>' }) {
    if (!this.isEnabled()) {
      throw new Error('Email service not initialized. Check RESEND_API_KEY environment variable.');
    }

    try {
      const result = await this.resend.emails.send({
        from,
        to,
        subject,
        html
      });

      log.info('Email sent successfully', { 
        to, 
        subject, 
        emailId: result.data?.id 
      });

      return {
        success: true,
        emailId: result.data?.id,
        error: null
      };
    } catch (error) {
      log.error('Failed to send email:', { 
        error: error.message, 
        to, 
        subject 
      });

      return {
        success: false,
        emailId: null,
        error: error.message
      };
    }
  }

  async sendUsageReport(userEmail, reportData, reportType = 'weekly') {
    const { subject, html } = this.generateReportEmail(reportData, reportType);
    
    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  async sendTestEmail(userEmail, username) {
    const subject = 'PromptPulse Email Test';
    const html = this.generateTestEmail(username);
    
    return await this.sendEmail({
      to: userEmail,
      subject,
      html
    });
  }

  generateReportEmail(reportData, reportType) {
    const { 
      username, 
      displayName,
      periodStart, 
      periodEnd, 
      totalTokens, 
      totalCost, 
      sessionCount,
      topProjects,
      costBreakdown,
      tokenBreakdown 
    } = reportData;

    const displayUserName = displayName || username;
    const formattedPeriod = this.formatPeriod(periodStart, periodEnd, reportType);
    
    const subject = `Your ${reportType} PromptPulse Usage Report - ${formattedPeriod}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
          .metric { background: #fff; border: 1px solid #e9ecef; padding: 15px; margin: 10px 0; border-radius: 5px; }
          .metric-value { font-size: 24px; font-weight: bold; color: #0066cc; }
          .metric-label { font-size: 14px; color: #666; }
          .section { margin: 30px 0; }
          .project-list { list-style: none; padding: 0; }
          .project-item { padding: 8px 0; border-bottom: 1px solid #eee; }
          .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
          .unsubscribe { margin-top: 20px; font-size: 11px; color: #999; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Your ${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Usage Report</h1>
          <p>Hi ${displayUserName}! Here's your Claude Code usage summary for ${formattedPeriod}</p>
        </div>

        <div class="section">
          <h2>📊 Usage Overview</h2>
          <div class="metric">
            <div class="metric-value">${totalTokens.toLocaleString()}</div>
            <div class="metric-label">Total Tokens Used</div>
          </div>
          <div class="metric">
            <div class="metric-value">$${totalCost.toFixed(2)}</div>
            <div class="metric-label">Total Cost</div>
          </div>
          <div class="metric">
            <div class="metric-value">${sessionCount}</div>
            <div class="metric-label">Coding Sessions</div>
          </div>
        </div>

        ${tokenBreakdown ? `
        <div class="section">
          <h2>🔤 Token Breakdown</h2>
          <div class="metric">
            <div class="metric-value">${tokenBreakdown.input.toLocaleString()}</div>
            <div class="metric-label">Input Tokens</div>
          </div>
          <div class="metric">
            <div class="metric-value">${tokenBreakdown.output.toLocaleString()}</div>
            <div class="metric-label">Output Tokens</div>
          </div>
          ${tokenBreakdown.cache_creation ? `
          <div class="metric">
            <div class="metric-value">${tokenBreakdown.cache_creation.toLocaleString()}</div>
            <div class="metric-label">Cache Creation Tokens</div>
          </div>
          ` : ''}
          ${tokenBreakdown.cache_read ? `
          <div class="metric">
            <div class="metric-value">${tokenBreakdown.cache_read.toLocaleString()}</div>
            <div class="metric-label">Cache Read Tokens</div>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${topProjects && topProjects.length > 0 ? `
        <div class="section">
          <h2>🚀 Top Projects</h2>
          <ul class="project-list">
            ${topProjects.map(project => `
              <li class="project-item">
                <strong>${project.name}</strong><br>
                <small>${project.tokens.toLocaleString()} tokens • $${project.cost.toFixed(2)} • ${project.sessions} sessions</small>
              </li>
            `).join('')}
          </ul>
        </div>
        ` : ''}

        <div class="footer">
          <p>Keep coding! 🚀</p>
          <p><strong>PromptPulse</strong> - Your Claude Code Usage Tracker</p>
          <div class="unsubscribe">
            <p>Don't want these emails? Update your preferences in the <a href="https://promptpulse.com/settings">PromptPulse dashboard</a></p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, html };
  }

  generateTestEmail(username) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>PromptPulse Email Test</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; text-align: center; }
          .content { background: #fff; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Email Test Successful!</h1>
        </div>
        
        <div class="content">
          <p>Hi ${username}!</p>
          
          <p>Great news! Your email settings are working correctly. You'll now receive your usage reports at the frequency you've selected.</p>
          
          <p>If you have any questions or need help, feel free to reach out through our support channels.</p>
          
          <p>Happy coding! 🚀</p>
        </div>

        <div class="footer">
          <p><strong>PromptPulse</strong> - Your Claude Code Usage Tracker</p>
        </div>
      </body>
      </html>
    `;
  }

  formatPeriod(startDate, endDate, reportType) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const options = { 
      month: 'short', 
      day: 'numeric',
      year: start.getFullYear() !== end.getFullYear() ? 'numeric' : undefined 
    };

    if (reportType === 'daily') {
      return start.toLocaleDateString('en-US', { 
        weekday: 'long',
        month: 'long', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } else if (reportType === 'weekly') {
      return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
    } else if (reportType === 'monthly') {
      return start.toLocaleDateString('en-US', { 
        month: 'long', 
        year: 'numeric' 
      });
    }
    
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;