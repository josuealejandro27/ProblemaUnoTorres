// config/mailer.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 587),
  secure: process.env.MAIL_SECURE === 'true', // true para 465
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS
  }
});

async function enviarCorreo(to, subject, text, html) {
  const info = await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
    html
  });
  return info;
}

module.exports = { transporter, enviarCorreo };
