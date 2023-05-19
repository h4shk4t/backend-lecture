const express = require('express');
require("dotenv").config();
const bcrypt = require("bcrypt");
const bodyParser = require('body-parser');
const crypto = require("crypto");
const db = require("./database");
db.connect();

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;

async function hashPassword(password) {
    const saltRounds = 10;
    const salt = await bcrypt.genSalt(saltRounds);
    const hash = await bcrypt.hash(password, salt);
    
    return {
      salt: salt,
      hash: hash
    };
}

app.listen(PORT, (error)=>{
    if(!error)
        console.log("Server is Successfully Running,and App is listening on port: "+ PORT)
    else 
        console.log("Error occurred, server can't start", error);
    }
);

//routes
app.get("/", (req, res)=> {
    //res.render("index");
    res.status(200);
    res.send("Index page");
});
  
app.get("/login", (req, res)=> {
    res.render("login");
});

app.get("/tasks",validateCookies, (req, res) => {
    // Assuming you have implemented user authentication and obtained the user ID from the session
    const userId = "1"; // Testing only!

    // Query the database to retrieve tasks for the logged-in user
    db.query(
        `SELECT * FROM tasks WHERE user_id = ${userId}`,
        (err, result) => {
        if (err) {
            throw err;
        } else {
            // Send the retrieved tasks as the response
            res.send(result);
        }
        }
    );
});

app.get("/register", (req,res)=>{
    res.render("register");
});

app.post("/login", (req,res) =>{
    let username = req.body.username;
    let password = req.body.password;
    db.query(
    `SELECT SALT,HASH,ID, ADMIN FROM users WHERE USERNAME = ${db.escape(username)};`,
    async (err,result,field) => {
    if (err){
        throw err
    }
    else{
        //check if result is a list or not
        let hash = await bcrypt.hash(password, result[0].SALT);
        //console.log(hash)
        if (hash === result[0].HASH){
            console.log(`${username} logged in!`);
            //console.log(result[0].ID);
            //let sessionID = crypto.createHash('sha256').update(`${result[0].ID}`).digest("base64");
            let sessionID = crypto.randomUUID();
            res.cookie("sessionID",sessionID,{
            maxAge: 12000000,
            httpOnly: true,
            //secure: true
            });
            //console.log(`INSERT INTO COOKIES VALUES('${result[0].ID}',${sessionID});`)
            // Add cookie support!
            db.query(
            `INSERT INTO cookies (userid,sessionid) VALUES('${db.escape(result[0].ID)}',${db.escape(sessionID)});`
            );
            if (result[0].ADMIN === 1){
            res.redirect("/dashboard")
            }
            else{
            res.redirect("/browse");
            }
            //sessionManager.setUser();
            //req.render(`dashboard`, {data:probably somecookie});
        }
        else if (hash !== result[1]){
            console.log(`Incorrect login attempt for ${username}`);
            res.render(`login`, {data: "Incorrect ID or Password"});
        }
        else{
            console.log("Some Unexpected Error Occured!");
        }
        }
    }
    )
});

app.post("/register", async (req,res) =>{
    console.log(req.body.password);
    let name = req.body.name;
    let username = req.body.username;
    let password = req.body.password;
    let passwordC = req.body.confirmPassword;
    var pass = await hashPassword(password);
    console.log(pass);
    db.query(
    "select * from users where USERNAME = " + db.escape(username) + ";",
    (err, result, field) => {
        if (err){
        throw err
        }
        else{
        if (result[0] === undefined) {
            if (name && (password === passwordC)) {
            db.query(
                `INSERT INTO users (USERNAME, NAME, SALT, HASH, ADMIN) VALUES(${db.escape(username)},${db.escape(name)},'${pass.salt}', '${pass.hash}', 0);`
            );
            res.send("Success");
            } else if (password !== passwordC) {
            res.send("Passwords didn't match");
            } else {
            res.send("Password must not be empty");
            }
        } else {
            res.send("Username is not unique");
        }
        }
    }
    );
});

app.post("/addtask",validateCookies, async (req, res) => {
    try {
      const { name, description, points } = req.body;
      //const userId = req.user.id;
      const userId = 1; // For testing only
      // Perform any necessary validation on the input fields
      if (!name || !description || !points) {
        return res.send("All fields must be provided");
      }
  
      // Insert the task into the database
      const query = `
        INSERT INTO tasks (name, description, points, user_id)
        VALUES (${db.escape(name)}, ${db.escape(description)}, ${db.escape(points)}, ${db.escape(userId)})
      `;
      await db.query(query);
      console.log("new task added")
      res.send("Task added successfully");
    } catch (error) {
      console.error(error);
      res.status(500).send("An error occurred");
    }
  });

  // My middleware
  function validateCookies(req,res,next) {
    req.adminAuth = 0;
    //console.log(req.headers.cookie.slice(10));
    const cookie = req.headers.cookie.slice(10);
    if (req.headers.cookie.includes("sessionID")){
      //console.log(req)
      //console.log(`SELECT USERID, SESSIONID FROM USERS WHERE SESSIONID=${db.escape(cookie)};`)
      //console.log(`${db.escape(cookie)}`);
      db.query(
        `SELECT cookies.userid, cookies.sessionid, users.admin FROM cookies, users WHERE sessionid=${db.escape(cookie)} AND users.id=cookies.userid;`,
        (err,result,field) =>{
          if (err){
            throw err;
          }
          else{
            //console.log(`${cookie}`);
            //console.log(result)
            //console.log(`${result[0].SESSIONID}`)
           0// console.log(result[0])
            if (result[0].ADMIN === 1){
              req.adminAuth = 1;
            }
            else{
              req.adminAuth = 0;
            }
            if (cookie===result[0].sessionid){
              req.userID = result[0].userid;
              next();
            }
            else{
                console.log("cookie: ",cookie);
                console.log("sessionID: ",result[0]);
                res.status(403).send({ 'msg': 'Not Authenticated'});
            }
          }
        }
      )
    }
    else {
      res.status(403).send({ 'msg': 'Not Authenticated'});
    }
  }
  
  function isAdmin (req,res,next) {
    if(req.adminAuth === 1){
      next();
    }
    else{
      res.status(403).send({ 'msg': 'Not Authenticated'});
    }
  }