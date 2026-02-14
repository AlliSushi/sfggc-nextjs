const fs = require("node:fs");

function getSocketPath() {
  if (process.env.MYSQL_UNIX_SOCKET && fs.existsSync(process.env.MYSQL_UNIX_SOCKET)) {
    return process.env.MYSQL_UNIX_SOCKET;
  }

  const candidates = [
    "/tmp/mysql.sock",
    "/opt/homebrew/var/mysql/mysql.sock",
    "/usr/local/var/mysql/mysql.sock",
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

module.exports = {
  getSocketPath,
};
