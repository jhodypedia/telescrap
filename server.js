const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");
const { getClient } = require("./telegramClient");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const http = require("http");
const { Server } = require("socket.io");

ffmpeg.setFfmpegPath(ffmpegStatic);
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const pool = mysql.createPool({
  host: "localhost", user: "root", password: "", database: "drakor"
});

app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static(path.join(__dirname, "public")));
app.use(session({ secret: "drakor-secret", resave: false, saveUninitialized: false }));

function requireAdmin(req, res, next) {
  if (req.session.admin) return next();
  res.redirect("/login-telegram");
}

// User-side streaming
app.get("/", async (req, res) => {
  const [videos] = await pool.query("SELECT * FROM videos ORDER BY id DESC");
  res.render("index", { videos });
});
app.get("/secure/:id", (req, res) => res.redirect(`/play/${req.params.id}`));
app.get("/play/:id", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM videos WHERE id=?", [req.params.id]);
  if (!rows.length) return res.status(404).send("Not found");
  res.render("play", { video: rows[0] });
});

// Admin login Telegram
app.get("/login-telegram", (req, res) => res.render("login-telegram", { error: null }));
app.post("/login-telegram", async (req, res) => {
  const { phone, code } = req.body;
  try {
    await getClient({ phone, code });
    req.session.admin = true;
    res.redirect("/admin");
  } catch (e) {
    res.render("login-telegram", { error: "Login Telegram gagal" });
  }
});
app.get("/logout", (req, res) => { req.session.destroy(); res.redirect("/"); });

// Admin dashboard & Socket.IO
app.get("/admin", requireAdmin, async (req, res) => {
  const [scrapes] = await pool.query("SELECT * FROM scrape_history ORDER BY id DESC LIMIT 5");
  res.render("admin", { scrapes });
});
app.post("/admin/scrape", requireAdmin, async (req, res) => {
  const { channel, label } = req.body;
  await pool.query("INSERT INTO scrape_history(channel_name,label,status) VALUES(?,?,?)",
    [channel, label, "pending"]);
  io.emit("startScrape", { channel, label });
  res.redirect("/admin");
});

// Socket.IO handlers
io.on("connection", socket => {
  socket.on("startScrape", async data => {
    const { channel, label } = data;
    const [insert] = await pool.query("INSERT INTO scrape_history(channel_name,label,status) VALUES(?,?,?)",
      [channel, label, "in_progress"]);
    const scrapeId = insert.insertId;

    const client = await getClient();
    const entity = await client.getEntity(channel);
    const messages = await client.getMessages(entity, { limit: 5 });

    let idx = 0;
    for (const msg of messages) {
      if (msg.media && msg.document) {
        idx++;
        socket.emit("progress", `Downloading ${idx}/${messages.length}...`);
        const fileName = `${Date.now()}_${msg.id}.mp4`;
        const filePath = path.join(__dirname, "public/videos", fileName);
        await client.downloadMedia(msg.media, { file: filePath });

        socket.emit("progress", "Converting to HLS...");
        const hlsDir = path.join(__dirname, "public/hls", fileName.replace(".mp4", ""));
        fs.mkdirSync(hlsDir, { recursive: true });
        await new Promise(resolve => {
          ffmpeg(filePath)
            .output(path.join(hlsDir, "index.m3u8"))
            .addOption("-hls_time", "10").addOption("-hls_list_size", "0")
            .on("end", resolve).run();
        });

        await pool.query(
          "INSERT INTO videos(title,episode,filename) VALUES(?,?,?)",
          [label, "00", fileName]
        );
      }
    }
    await client.disconnect();
    await pool.query("UPDATE scrape_history SET status='done' WHERE id=?", [scrapeId]);
    socket.emit("done", "Scrape & download selesai!");
  });
});

server.listen(3000, () => console.log("▶️ http://localhost:3000"));
