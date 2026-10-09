const { Client } = require("ssh2");
const fs = require("fs");
const c = new Client();
function exec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      stream.on("data", d => process.stdout.write(d));
      stream.stderr.on("data", d => process.stderr.write(d));
      stream.on("close", code => resolve(code || 0));
    });
  });
}
c.on("ready", () => {
  c.sftp((err, sftp) => {
    if (err) { console.error(err); process.exit(1); }
    sftp.fastPut("D:/job/website/.tmp-ssh/frontend-theme.tgz", "/tmp/frontend-theme.tgz", async (e) => {
      if (e) { console.error(e); process.exit(1); }
      console.log("uploaded", fs.statSync("D:/job/website/.tmp-ssh/frontend-theme.tgz").size);
      const code = await exec(c, "tar -xzf /tmp/frontend-theme.tgz -C /root/tutor-platform && cd /root/tutor-platform && docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml -f deploy/docker-compose.ports.yml --env-file deploy/.env.prod up -d --build --no-deps frontend");
      c.end();
      process.exit(code);
    });
  });
}).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
