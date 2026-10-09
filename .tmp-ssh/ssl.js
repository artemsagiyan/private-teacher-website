const { Client } = require("ssh2");
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
        return 301 https://$host$request_uri;
    }
}

server {
    listen 195.161.62.2:443 ssl;
    server_name easyphys.ru www.easyphys.ru;

    ssl_certificate /etc/letsencrypt/live/easyphys.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/easyphys.ru/privkey.pem;

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}

server {
    listen 195.161.62.2:443 ssl;
    server_name ekaterina-math.ru www.ekaterina-math.ru;

    ssl_certificate /etc/letsencrypt/live/ekaterina-math.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ekaterina-math.ru/privkey.pem;

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 3600s;
    }
}

server {
    listen 195.161.62.2:443 ssl;
    server_name nadejda-repetitor.ru www.nadejda-repetitor.ru;

    ssl_certificate /etc/letsencrypt/live/nadejda-repetitor.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/nadejda-repetitor.ru/privkey.pem;

    client_max_body_size 32m;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
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
      c.exec("nginx -t && systemctl reload nginx && echo RELOADED", (err2, stream) => {
        stream.on("data", d => process.stdout.write(d));
        stream.stderr.on("data", d => process.stderr.write(d));
        stream.on("close", code => { console.log("exit", code); c.end(); process.exit(code||0); });
      });
    });
  });
}).on("error", e => { console.error(e.message); process.exit(1); })
.connect({ host: "96856eb0268d.vps.myjino.ru", port: 49429, username: "root", password: process.env.VPS_PASS, readyTimeout: 20000 });
