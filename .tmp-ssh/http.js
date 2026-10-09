const { Client } = require("ssh2");
const fs = require("fs");
const conf = `
server {
    listen 195.161.62.2:80;
    server_name easyphys.ru www.easyphys.ru ekaterina-math.ru www.ekaterina-math.ru nadejda-repetitor.ru www.nadejda-repetitor.ru tvoi-mat-plan.ru www.tvoi-mat-plan.ru;

    client_max_body_size 32m;

    location ^~ /.well-known/acme-challenge/ {
        default_type text/plain;
        alias /var/www/letsencrypt/.well-known/acme-challenge/;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}
`;
const c = new Client();
c.on("ready", () => {
  c.sftp((err, sftp) => {
    if (err) { console.error(err); process.exit(1); }
    sftp.writeFile("/etc/nginx/sites-available/dedicated-ip.conf", Buffer.from(conf), (e) => {
      if (e) { console.error(e); process.exit(1); }
      const cmd = `ln -sfn /etc/nginx/sites-available/dedicated-ip.conf /etc/nginx/sites-enabled/dedicated-ip.conf && nginx -t && systemctl reload nginx && curl -sI -m 8 -H "Host: easyphys.ru" http://195.161.62.2/ | head -12`;
      c.exec(cmd, (err2, stream) => {
        stream.on("data", d => process.stdout.write(d));
        stream.stderr.on("data", d => process.stderr.write(d));
        stream.on("close", code => { console.log("exit", code); c.end(); process.exit(code||0); });
      });
    });
  });
}).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
