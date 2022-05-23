const express = require("express");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;
const argon2 = require("argon2");

const app = express();

app.use(bodyParser.json());
app.use(cors());
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
    connection.query(`INSERT INTO users(id, username, surname, name, password, email, birthdate, blocked, rankId, languages) VALUES (?)`, [insertionValues], (err, response)=>{
        if (err) { res.status(500); res.end(); return; }
        res.status(200).json({
            message: "Success"
        })
    });
});

app.post("/login", (req, res) => {
    let typeOfLogin = "username";
    if (req.body.emailOrUsername.includes("@")) typeOfLogin = "email";
    connection.query(`SELECT * FROM users WHERE ${typeOfLogin}="${req.body.emailOrUsername}";`, async (err, response) => {
        if (err) { res.status(500); res.end(); return; }
        let message;
        if (response.length === 0) message = "Invalid credentials"
        else if (await argon2.verify(response[0].password, req.body.password)) message = "Success"
        else message = "Invalid credentials";
        res.status(200).json({
            message: message
        });
        res.end();
    })
})

app.get("*", (req, res) => {
    res.json({});
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
