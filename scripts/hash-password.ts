import { hashPassword } from "../src/auth/password";

const plain = process.argv[2];
if (!plain) {
  console.error("Usage: npx tsx scripts/hash-password.ts 'your-password'");
  process.exit(1);
}

hashPassword(plain).then((h) => {
  console.log(h);
});
