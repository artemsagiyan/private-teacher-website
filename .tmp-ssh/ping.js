const { Client } = require("ssh2");
const c = new Client();
const remote = `curl -sI -m 15 -H "Host: easyphys.ru" http://127.0.0.1:8080/ | head -12; echo ---; curl -skI -m 15 https://easyphys.ru/ | head -15`;
c.on("ready", () => c.exec(remote, (e,s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", () => c.end());
})).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
