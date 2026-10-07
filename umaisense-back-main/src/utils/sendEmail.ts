import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendOtpEmail = async (to: string, code: string): Promise<void> => {
  await transporter.sendMail({
    from: `"UmaiSense" <${process.env.SMTP_USER}>`,
    to,
    subject: 'Ваш код для входа в UmaiSense',
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; background: #F8F9FF; border-radius: 16px;">
        <h1 style="color: #6C63FF; font-size: 28px; margin: 0 0 8px;">UmaiSense</h1>
        <p style="color: #6B7280; font-size: 15px; margin: 0 0 32px;">Код подтверждения для входа</p>
        <div style="background: white; border-radius: 12px; padding: 24px; text-align: center; border: 1px solid #E5E7EB;">
          <p style="color: #6B7280; font-size: 13px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 1px;">Ваш код</p>
          <div style="font-size: 40px; font-weight: 700; letter-spacing: 12px; color: #1A1A2E;">${code}</div>
        </div>
        <p style="color: #9CA3AF; font-size: 13px; margin: 20px 0 0; text-align: center;">
          Код действителен 5 минут. Не передавайте его никому.
        </p>
      </div>
    `,
  });
};

/** Простое письмо-уведомление. Ошибки SMTP не пробрасываются — уведомление в приложении остаётся основным каналом. */
export const sendNotificationEmail = async (to: string, subject: string, html: string): Promise<void> => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return;
  try {
    // На Vercel функцию нельзя оставлять ждать SMTP дольше нескольких секунд
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('SMTP timeout')), 5000);
    });
    await Promise.race([sendPromise(to, subject, html), timeout]).finally(() => clearTimeout(timer));
  } catch (err) {
    console.error('[email] send failed:', err);
  }
};

const sendPromise = (to: string, subject: string, html: string) =>
    transporter.sendMail({
      from: `"UmaiSense" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html: `<div style="font-family: Inter, sans-serif; max-width: 520px; margin: 0 auto; padding: 28px 24px; background: #F9FAFB; border-radius: 16px; color: #1F2937; font-size: 14px; line-height: 1.6;">
        <h1 style="color: #E07628; font-size: 22px; margin: 0 0 16px;">UmaiSense</h1>${html}</div>`,
    });

/** Экранирование пользовательского текста перед вставкой в HTML письма */
export const escapeHtml = (v: string): string =>
  v.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
