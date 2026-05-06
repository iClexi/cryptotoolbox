const baseUrl = process.env.APP_URL || "http://localhost:3000";
const username = `points_test_${Date.now()}`;

try {
  const login = await fetch(`${baseUrl}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      email: `${username}@example.com`,
      avatarSeed: username,
      pin: "123456",
      firstName: "Test",
      lastName: "Points",
      birthDate: "1999-01-01",
      gender: "prefiero_no_decir",
      termsAccepted: true,
    }),
  });

  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  const loginData = await login.json();
  console.log("Login response:", login.status, loginData);

  if (!login.ok || !cookie) throw new Error("Could not create test session");

  const points = await fetch(`${baseUrl}/api/users/points`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: JSON.stringify({ userId: loginData.user.id, pointsToAdd: 10 }),
  });

  console.log("Points response:", points.status, await points.json());
} catch (error) {
  console.error("Error:", error);
  process.exitCode = 1;
}
