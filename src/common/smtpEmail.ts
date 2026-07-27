import nodemailer from 'nodemailer';
import { EmailService } from './email';
import { env } from '../config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
});

export const smtpEmailService: EmailService = {
  async sendEmail(to, template, data) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to,
      subject: `ToolzyPro: ${template}`,
      text: JSON.stringify(data),
    });
  },
};
