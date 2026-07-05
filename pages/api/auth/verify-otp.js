import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const otpRecord = await prisma.resetOTP.findFirst({
    where: { email },
    orderBy: { createdAt: "desc" },
  });

  if (!otpRecord) {
    return res.status(400).json({ message: "Invalid or expired OTP" });
  }

  if (otpRecord.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  if (new Date() > otpRecord.expiresAt) {
    return res.status(400).json({ message: "OTP has expired. Please request a new one." });
  }

  // OTP is valid! Do not delete it yet, we will delete it in the final reset-password step.
  res.status(200).json({ message: "OTP verified successfully!" });
}
