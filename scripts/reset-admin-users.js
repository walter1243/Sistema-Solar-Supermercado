const { createClient } = require("@vercel/postgres");

async function main() {
  const client = createClient();
  await client.connect();

  const admins = [
    { id: 1, username: "admin", name: "Administrador Solar", password: "123456" },
    { id: 2, username: "admin2", name: "Administrador Solar 2", password: "123456" },
    { id: 3, username: "admin3", name: "Administrador Solar 3", password: "123456" },
  ];

  for (const admin of admins) {
    await client.query(
      `INSERT INTO admin_users (id, username, name, profile_image, password)
       VALUES ($1, $2, $3, '', $4)
       ON CONFLICT (id) DO UPDATE
       SET username = EXCLUDED.username,
           name = EXCLUDED.name,
           profile_image = EXCLUDED.profile_image,
           password = EXCLUDED.password`,
      [admin.id, admin.username, admin.name, admin.password],
    );
  }

  const result = await client.query("SELECT id, username, name FROM admin_users ORDER BY id LIMIT 3");
  console.log(JSON.stringify(result.rows));
  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});