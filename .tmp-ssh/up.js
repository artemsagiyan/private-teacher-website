const { Client } = require("ssh2");
const fs = require("fs");
const c = new Client();
c.on("ready", () => {
  c.sftp((err, sftp) => {
    if (err) { console.error(err); process.exit(1); }
    const src = "D:/job/website/.tmp-ssh/frontend-theme.tgz";
    sftp.fastPut(src, "/tmp/frontend-theme.tgz", (e) => {
      if (e) { console.error(e); process.exit(1); }
      console.log("uploaded", fs.statSync(src).size);
      c.exec("tar -xzf /tmp/frontend-theme.tgz -C /root/tutor-platform && echo EXTRACTED", (err2, stream) => {
        stream.on("data", d => process.stdout.write(d));
        stream.stderr.on("data", d => process.stderr.write(d));
        stream.on("close", code => { c.end(); process.exit(code || 0); });
      });
    });
  });
}).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
