import { PrismaClient } from "@prisma/client";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email is required" });

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return res.status(404).json({ message: "No account found with this email address." });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await prisma.resetOTP.create({
    data: {
      email,
      otp,
      expiresAt,
    }
  });

  // Setup Nodemailer transporter
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      await transporter.sendMail({
        from: `"Zenith Auth" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your Zenith Password Reset OTP",
        html: `<div style="font-family: sans-serif; padding: 20px;">
                 <h2>Password Reset</h2>
                 <p>Your one-time password (OTP) is: <strong>${otp}</strong></p>
                 <p>This code will expire in 10 minutes.</p>
               </div>`,
      });
      console.log(`Real email sent to ${email}`);
    } else {
      console.log(`[MOCK EMAIL - No EMAIL_USER in .env] OTP for ${email} is ${otp}`);
    }
  } catch (error) {
    console.error("Error sending email:", error);
    return res.status(500).json({ message: "Failed to send email. Check SMTP settings." });
  }

  res.status(200).json({ message: "If your email is in our system, an OTP has been sent." });
}
