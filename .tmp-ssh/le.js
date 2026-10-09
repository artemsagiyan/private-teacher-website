const { Client } = require("ssh2");
const c = new Client();
const remote = `certbot certonly --webroot -w /var/www/letsencrypt -d easyphys.ru -d www.easyphys.ru --cert-name easyphys.ru --non-interactive --agree-tos --register-unsafely-without-email; echo EXIT:$?; openssl x509 -in /etc/letsencrypt/live/easyphys.ru/fullchain.pem -noout -dates -ext subjectAltName 2>/dev/null || echo NOCERT`;
c.on("ready", () => c.exec(remote, (e,s) => {
  s.on("data", d => process.stdout.write(d));
  s.stderr.on("data", d => process.stderr.write(d));
  s.on("close", code => { console.log("close", code); c.end(); });
})).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
