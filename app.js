const express = require('express');
const bcrypt = require("bcrypt");
const db = require("./database");
//db.connect();

const app = express();
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

app.post("/login", (req,res) =>{
    let username = req.body.username;
    let password = req.body.password;
    db.query(
    `SELECT SALT,HASH,ID, ADMIN FROM USERS WHERE USERNAME = ${db.escape(username)};`,
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
            db.query(
            `INSERT INTO COOKIES VALUES(${db.escape(sessionID)},'${db.escape(result[0].ID)}');`
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

app.get("/register", (req,res)=>{
    res.render("register");
});

app.post("/register", (req,res) =>{
    let name = req.body.name;
    let username = req.body.username;
    let password = req.body.password;
    let passwordC = req.body.confirmPassword;
    var pass = hashPassword(password);
    db.query(
    "select * from USERS where USERNAME = " + db.escape(username) + ";",
    (err, result, field) => {
        if (err){
        throw err
        }
        else{
        if (result[0] === undefined) {
            if (name && (password === passwordC)) {
            db.query(
                `INSERT INTO USERS (USERNAME, NAME, SALT, HASH, ADMIN) VALUES(${db.escape(username)},${db.escape(name)},'${pass.salt}', '${pass.hash}', 0);`
            );
            res.render("Success");
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