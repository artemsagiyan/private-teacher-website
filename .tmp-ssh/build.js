const { Client } = require("ssh2");
const c = new Client();
const remote = `cd /root/tutor-platform && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ports.yml --env-file deploy/.env.prod up -d --build --no-deps frontend`;
c.on("ready", () => c.exec(remote, (e,s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", code => { console.log("exit", code); c.end(); process.exit(code||0); });
})).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
