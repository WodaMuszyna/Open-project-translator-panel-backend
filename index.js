const express = require("express");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;
const argon2 = require("argon2");
const jwt  = require("jsonwebtoken");
const fs = require("fs")

const app = express();

app.use(bodyParser.json());
app.use(cors());

const RSA_PRIVATE_KEY = fs.readFileSync('./private.key');

let connection = new mysql.createConnection({
    host: environment.mysqlHost,
    user: environment.mysqlUser,
    password: environment.mysqlPassword,
    database: environment.mysqlDatabase
})

app.get("/userExists/:username", (req, res) => {
    if (!req.params.username) return res.status(200).json({ exists: false });
    connection.query(`SELECT id FROM users WHERE username="${req.params.username}";`, (err, response) => {
        if (err) { res.status(500); res.end(); return; }
        res.status(200);
        if (response.length == 0) return res.json({ exists: false });
        else res.json({ exists: true });
    });
});

app.get("/emailTaken/:email", (req, res) => {
    if (!req.params.email) return res.status(200).json({ taken: false });
    connection.query(`SELECT id FROM users WHERE email="${req.params.email}";`, (err, response) => {
        if (err) { res.status(500); res.end(); return; }
        res.status(200);
        if (response.length == 0) return res.json({ taken: false });
        else res.json({ taken: true });
    });
})

app.get("/supportedLanguages", (req, res) => {
    connection.query("SELECT id FROM languages;", (err, response) => {
        if (err) { res.status(500); res.end(); return; }
        let languages = new Array();
        for (let i = 0; i < response.length; i++) {
            languages.push(response[i].id);
        }
        res.status(200).json({ languages: languages}).end();
    })
})

app.post("/register", async (req, res) => {
    let pass = await argon2.hash(req.body.password);
    let insertionValues = [
        null,
        req.body.username,
        req.body.surname,
        req.body.name,
        pass,
        req.body.email,
        req.body.birthdate.split("T")[0],
        0,
        1,
        req.body.languages.join(",")
    ]
    connection.query(`INSERT INTO users(id, username, surname, name, password, email, birthdate, blocked, rankId, languages) VALUES (?)`, [insertionValues], (err, response) => {
        if (err) { res.status(500); res.end(); return; };
        res.status(200).json({
            message: "Success"
        });
    });
});

app.post("/login", (req, res) => {
    let typeOfLogin = "username";
    if (req.body.emailOrUsername.includes("@")) typeOfLogin = "email";
    connection.query(`SELECT * FROM users WHERE ${typeOfLogin}="${req.body.emailOrUsername}";`, async (err, response) => {
        if (err) { res.status(500); res.end(); return; };
        let message;
        if (response.length === 0 || !await argon2.verify(response[0].password, req.body.password)) {
            res.json({message: "Invalid credentials"});
            return;
        }
        const jwtBearerToken = jwt.sign({}, RSA_PRIVATE_KEY, {
            algorithm: 'RS256',
            expiresIn: 2592000,
            subject: response[0].username
        });
        res.status(200).json({
            message: "Success",
            username: response[0].username,
            jwtToken: jwtBearerToken,
            expiresIn: 2592000
        });
        res.end();
    })
})

app.post("/authenticate", (req, res)=>{
    jwt.verify(req.body.jwtToken, RSA_PRIVATE_KEY, {algorithms:'RS256'}, (err, decoded)=>{
        if (err) return res.json({valid:false, err: err})
        return res.json({valid: true});
    })
})

app.get("*", (req, res) => {
    res.json({});
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
