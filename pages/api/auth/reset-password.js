import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({ message: "Email, OTP, and new password are required" });
  }

  // Find the most recent OTP for this email
  const otpRecord = await prisma.resetOTP.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  // Check if OTP matches
  if (otpRecord.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  // Check if OTP is expired
  if (new Date() > otpRecord.expiresAt) {
    return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  }

  // Hash the new password
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  // Update the user's password
  await prisma.user.update({
    where: { email },
    data: { password: hashedPassword },
  });

  // Delete the used OTP record
  await prisma.resetOTP.delete({ where: { id: otpRecord.id } });

  res.status(200).json({ message: "Password updated successfully!" });
}
