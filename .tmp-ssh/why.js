const { Client } = require("ssh2");
const c = new Client();
const remote = `
echo '=== listeners 80/443 ==='
ss -lntup | grep -E ':80 |:443 |:8080|:3000|:3012' || true
echo '=== curl local ==='
curl -sI -m 8 http://127.0.0.1:8080/ | head -8
curl -sI -m 8 http://10.100.30.121:80/ | head -8
curl -sv -m 8 --interface 195.161.62.2 http://195.161.62.2/ -o /dev/null 2>&1 | head -25
echo '=== certs ==='
ls /etc/letsencrypt/live 2>/dev/null
`;
c.on("ready", () => c.exec(remote, (e,s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", () => c.end());
})).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
