export interface EmailService {
  sendEmail(to: string, template: string, data: Record<string, unknown>, tenantId?: string | null): Promise<void>;
}

export const consoleEmailService: EmailService = {
  async sendEmail(to, template, data) {
    // eslint-disable-next-line no-console
    console.log(`[email:${template}] to=${to}`, data);
  },
};
