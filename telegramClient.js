const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const fs = require("fs");
const path = require("path");

const apiId = YOUR_API_ID;
const apiHash = "YOUR_API_HASH";
const SESSION_PATH = path.join(__dirname, "tg-session.txt");

async function getClient({ phone, code } = {}) {
  const sessionString = fs.existsSync(SESSION_PATH)
    ? fs.readFileSync(SESSION_PATH, "utf8")
    : "";
  const client = new TelegramClient(new StringSession(sessionString), apiId, apiHash, {
    connectionRetries: 5,
  });
  await client.start({
    phoneNumber: phone ? () => phone : undefined,
    phoneCode: code ? () => code : undefined,
  });
  const newSession = client.session.save();
  fs.writeFileSync(SESSION_PATH, newSession, "utf8");
  return client;
}

module.exports = { getClient };
