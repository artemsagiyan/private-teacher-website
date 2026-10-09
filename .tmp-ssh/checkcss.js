const { Client } = require("ssh2");
const c = new Client();
const remote = `
docker ps --filter name=tutor_frontend --format '{{.Status}}'
docker exec tutor_frontend sh -c "grep -R -l 6750A4 /app/.next/static 2>/dev/null | head; echo ---; grep -R -o 3E1F20 /app/.next/static/css 2>/dev/null | head"
`;
c.on("ready", () => c.exec(remote, (e,s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", () => c.end());
})).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
