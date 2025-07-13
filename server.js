const express = require("express");
const layouts = require("express-ejs-layouts");
const session = require("express-session");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const { getClient } = require("./telegramClient");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegStatic);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const pool = mysql.createPool({ host:"localhost", user:"root", password:"", database:"drakor" });

app.use(express.static("public"));
app.use(express.urlencoded({extended:true}));
app.use(layouts);
app.set("view engine","ejs");
app.set("layout","layouts/main");
app.use(session({secret:"drakor-secret",resave:false,saveUninitialized:false}));

function requireRole(role){
  return (req,res,next)=>{
    if(req.session.user?.role===role) return next();
    res.redirect("/login");
  };
}

// Register
app.get("/register", (req,res)=> res.render("register",{error:null}));
app.post("/register", async (req,res)=>{
  const {username,email,phone,password,tos} = req.body;
  if(!tos) return res.render("register",{error:"Setuju TOS diperlukan"});
  const hash = bcrypt.hashSync(password,10);
  await pool.query("INSERT INTO users (username,email,phone,password) VALUES(?,?,?,?,?)", [username,email,phone,hash]);
  res.redirect("/login");
});

// Login
app.get("/login",(req,res)=>res.render("login",{error:null}));
app.post("/login", async(req,res)=>{
  const {username,password} = req.body;
  const [u] = await pool.query("SELECT * FROM users WHERE username=?", [username]);
  if(!u.length || !bcrypt.compareSync(password,u[0].password)) return res.render("login",{error:"Invalid"});
  req.session.user = {id:u[0].id,username:u[0].username,role:u[0].role};
  res.redirect(u[0].role==="admin"?"/admin":"/");
});
app.get("/logout",(req,res)=>req.session.destroy(()=>res.redirect("/login")));

// Telegram login
app.get("/login-telegram", requireRole("admin"), (req,res)=>res.render("login-telegram",{error:null}));
app.post("/login-telegram", requireRole("admin"), async(req,res)=>{
  try{ await getClient({phone:req.body.phone,code:req.body.code}); res.redirect("/admin");
  }catch{ res.render("login-telegram",{error:"Gagal login"}); }
});

// Admin dashboard
app.get("/admin", requireRole("admin"), async(req,res)=>{
  const [scr] = await pool.query("SELECT * FROM scrape_history ORDER BY id DESC LIMIT 5");
  res.render("admin",{scrapes:scr});
});
app.post("/admin/scrape", requireRole("admin"), async(req,res)=>{
  const {channel,label} = req.body;
  await pool.query("INSERT INTO scrape_history (channel_name,label) VALUES(?,?)",[channel,label]);
  io.emit("startScrape",{channel,label});
  res.redirect("/admin");
});

// Scrape/download via socket.io
io.on("connection", socket =>{
  socket.on("startScrape", async data => {
    const {channel,label}=data;
    const [ins] = await pool.query("INSERT INTO scrape_history(channel_name,label,status) VALUES(?,?,?)",[channel,label,"in_progress"]);
    const id = ins.insertId;
    const client = await getClient();
    const entity = await client.getEntity(channel);
    const msgs = await client.getMessages(entity,{limit:5});
    let idx=0;
    for(const m of msgs){
      if(m.media && m.document){
        idx++;
        socket.emit("progress",`Downloading ${idx}/${msgs.length}`);
        const fn = `${Date.now()}_${m.id}.mp4`;
        const fp = path.join(__dirname,"public/videos",fn);
        await client.downloadMedia(m.media,{file:fp});
        socket.emit("progress",`Converting to HLS`);
        const hd = path.join(__dirname,"public/hls",fn.replace(".mp4",""));
        fs.mkdirSync(hd,{recursive:true});
        await new Promise(r=>ffmpeg(fp).output(path.join(hd,"index.m3u8")).addOption("-hls_time","10").addOption("-hls_list_size","0").on("end",r).run());
        await pool.query("INSERT INTO videos(title,episode,filename) VALUES(?,?,?)",[label,"00",fn]);
      }
    }
    await client.disconnect();
    await pool.query("UPDATE scrape_history SET status='done' WHERE id=?", [id]);
    socket.emit("done","Selesai!");
  });
});

// User streaming
app.get("/", requireRole("user"), async(req,res)=>{
  const [vids] = await pool.query("SELECT * FROM videos ORDER BY id DESC");
  res.render("index",{videos:vids,user:req.session.user});
});
app.get("/play/:id", requireRole("user"), async(req,res)=>{
  const [v] = await pool.query("SELECT * FROM videos WHERE id=?", [req.params.id]);
  if(!v.length) return res.sendStatus(404);
  res.render("play",{video:v[0],user:req.session.user});
});

server.listen(3000, ()=>console.log("Server running"));
