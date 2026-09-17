const http = require('http');
const fs = require('fs');
const path = require('path');
const dns = require('dns').promises;
const os = require('os');
const { exec } = require('child_process');

const PORT = 3000;

// LÓGICA Y CLASES DE RED (Orientado a Objetos)

class NetworkUtils {
    static isValidIPv4(ip) {
        const regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        return regex.test(ip);
    }

    static ipToLong(ip) {
        return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
    }

    static longToIp(long) {
        return [
            (long >>> 24) & 255,
            (long >>> 16) & 255,
            (long >>> 8) & 255,
            long & 255
        ].join('.');
    }

    static generateIpRange(startIp, endIp) {
        const start = this.ipToLong(startIp);
        const end = this.ipToLong(endIp);

        if (start > end) {
            throw new Error("La IP de inicio no puede ser mayor que la IP final.");
        }

        if ((end - start) > 255) {
            throw new Error("El rango máximo permitido es de 256 direcciones IP para evitar sobrecarga.");
        }

        const list = [];
        for (let i = start; i <= end; i++) {
            list.push(this.longToIp(i));
        }
        return list;
    }
}

class NetworkScanner {
    static async pingHost(ip, timeoutMs) {
        return new Promise((resolve) => {
            const isWin = os.platform() === 'win32';
            const cmd = isWin
                ? `ping -n 1 -w ${timeoutMs} ${ip}`
                : `ping -c 1 -W ${Math.ceil(timeoutMs / 1000)} ${ip}`;

            const startTime = Date.now();

            exec(cmd, (error, stdout) => {
                const duration = Date.now() - startTime;

                if (error) {
                    resolve({ online: false, time: null });
                    return;
                }

                let time = duration;
                if (isWin) {
                    const match = stdout.match(/tiempo[=<]\s*(\d+)ms/i) || stdout.match(/time[=<]\s*(\d+)ms/i);
                    if (match) time = parseInt(match[1]);
                } else {
                    const match = stdout.match(/time=(\d+(?:\.\d+)?)\s*ms/i);
                    if (match) time = Math.round(parseFloat(match[1]));
                }

                resolve({ online: true, time });
            });
        });
    }

    static async getHostname(ip) {
        try {
            const hostnames = await dns.reverse(ip);
            return hostnames.length > 0 ? hostnames[0] : 'Desconocido';
        } catch {
            return 'No disponible';
        }
    }

    static async scanSingleIp(ip, timeoutMs) {
        const pingResult = await this.pingHost(ip, timeoutMs);
        let hostname = 'N/A';

        if (pingResult.online) {
            hostname = await this.getHostname(ip);
        }

        return {
            ip,
            online: pingResult.online,
            hostname,
            responseTime: pingResult.time
        };
    }
}

// SERVIDOR HTTP

const server = http.createServer(async (req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, (err, content) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error interno cargando la interfaz');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content);
        });
        return;
    }

    if (req.url.startsWith('/api/scan')) {
        const urlParams = new URL(req.url, `http://${req.headers.host}`).searchParams;
        const startIp = urlParams.get('start');
        const endIp = urlParams.get('end');
        const timeout = parseInt(urlParams.get('timeout') || '1000');

        if (!NetworkUtils.isValidIPv4(startIp) || !NetworkUtils.isValidIPv4(endIp)) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Direcciones IP inválidas. Verifique el formato IPv4.' }));
            return;
        }

        let ipList;
        try {
            ipList = NetworkUtils.generateIpRange(startIp, endIp);
        } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: err.message }));
            return;
        }

        // Configuración de Server-Sent Events (SSE) para progreso en tiempo real
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        const total = ipList.length;
        let completed = 0;

        for (const ip of ipList) {
            const result = await NetworkScanner.scanSingleIp(ip, timeout);
            completed++;

            const payload = {
                current: completed,
                total,
                percentage: Math.round((completed / total) * 100),
                data: result
            };

            res.write(`data: ${JSON.stringify(payload)}\n\n`);
        }

        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Recurso no encontrado');
});

server.listen(PORT, () => {
    console.log(` Servidor de Escáner de Red activo en:`);
    console.log(` http://localhost:${PORT}`);
});