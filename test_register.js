const baseUrl = process.env.APP_URL || "http://localhost:3000";
const username = `register_test_${Date.now()}`;

try {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      avatarSeed: username,
      pin: "1234",
    }),
  });

  console.log("Register response:", res.status, await res.json());
} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
}
