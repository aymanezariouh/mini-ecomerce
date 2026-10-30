import bcrypt from "bcrypt";
import User from "../modules/User.js";

export function readSeedUser(prefix, role, defaultName) {
  const email = process.env[`${prefix}_EMAIL`]?.trim().toLowerCase();
  const password = process.env[`${prefix}_PASSWORD`];
  const name = process.env[`${prefix}_NAME`]?.trim() || defaultName;

  if (!email || !password || password.length < 8) {
    throw new Error(`Set ${prefix}_EMAIL and ${prefix}_PASSWORD (at least 8 characters)`);
  }

  return { name, email, password, role };
}

export async function ensureSeedUsers(users) {
  if (new Set(users.map((user) => user.email)).size !== users.length) {
    throw new Error("Seed users must have different email addresses");
  }

  await User.init();
  // Check every role before writing, so an existing customer is never promoted.
  for (const user of users) {
    const existing = await User.findOne({ email: user.email });
    if (existing && existing.role !== user.role) {
      throw new Error(`An account already exists with a different role for ${user.email}`);
    }
  }

  for (const { password, ...user } of users) {
    const passwordHash = await bcrypt.hash(password, 10);
    await User.updateOne(
      { email: user.email },
      { $setOnInsert: { ...user, passwordHash } },
      { upsert: true, runValidators: true },
    );
  }
}
