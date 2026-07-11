import bcrypt from 'bcryptjs';
import User from '../models/User';

export const seedAdmin = async (): Promise<void> => {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('[Seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed');
    return;
  }

  const exists = await User.findOne({ email });
  if (exists) return;

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    email,
    name: 'Admin',
    role: 'admin',
    password: hashed,
    isVerified: true,
  });

  console.log(`[Seed] Admin user created: ${email}`);
};
