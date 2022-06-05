const express = require("express");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const fs = require("fs")

const app = express();

app.use(bodyParser.json());
app.use(cors());

const PRIVATE_KEY = fs.readFileSync('./private.key');

function authenticateToken(req, res) {
    const token = req.headers['authorization'];
    if (token == null) return res.sendStatus(401); //we are guaranteed that we have token (front end ngOnInit, translation-panel.component.ts)
    jwt.verify(token, PRIVATE_KEY, { algorithms: 'RS256' }, (err, user) => {
        if (err) return res.status(200).json({ valid: false });
        res.status(200).json({ valid: true });
    });
}
let mysqlConnect = () => {
    return new mysql.createConnection({
        host: environment.mysqlHost,
        user: environment.mysqlUser,
        password: environment.mysqlPassword,
        database: environment.mysqlDatabase
    });
};

app.post("/userExists", (req, res) => {
    if (!req.body.username) return res.status(200).json({ exists: false });
    mysqlConnect().query(`SELECT id FROM users WHERE username="${req.body.username}";`, (err, response) => {
        if (err) { res.sendStatus(500).end(); return; }
        res.status(200);
        if (response.length == 0) return res.json({ exists: false });
        else res.json({ exists: true });
    });
});

app.post("/emailTaken", (req, res) => {
    if (!req.body.email) return res.status(200).json({ taken: false });
    mysqlConnect().query(`SELECT id FROM users WHERE email="${req.body.email}";`, (err, response) => {
        if (err) { res.sendStatus(500).end(); return; }
        res.status(200);
        if (response.length == 0) return res.json({ taken: false });
        else res.json({ taken: true });
    });
})

app.get("/supportedLanguages", (req, res) => {
    mysqlConnect().query("SELECT id FROM languages;", (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; }
        let languages = new Array();
        for (let i = 0; i < response.length; i++) {
            languages.push(response[i].id);
        }
        res.status(200).json({ languages: languages }).end();
    })
})

app.post("/register", async (req, res) => {
    let pass = await argon2.hash(req.body.password);
    let insertionValues = [null, req.body.username, req.body.surname, req.body.name, pass, req.body.email, req.body.birthdate.split("T")[0], 0, 1, req.body.languages.join(",")]
    connection.query(`INSERT INTO users(id, username, surname, name, password, email, birthdate, blocked, rankId, languages) VALUES (?)`, [insertionValues], (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200).json({
            message: "Success"
        });
    });
});

app.post("/login", (req, res) => {
    let typeOfLogin = "username";
    if (req.body.emailOrUsername.includes("@")) typeOfLogin = "email";
    mysqlConnect().query(`SELECT * FROM users WHERE BINARY ${typeOfLogin}="${req.body.emailOrUsername}";`, async (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200);
        if (response.length === 0 || !await argon2.verify(response[0].password, req.body.password)) {
            res.json({ message: "Invalid credentials" }).end();
            return;
        }
        const jwtBearerToken = jwt.sign({
            username: response[0].username,
            languages: response[0].languages.split(","),
            rankId: response[0].rankId,
            blocked: response[0].blocked,
            birthdate: response[0].birthdate
        }, PRIVATE_KEY, {
            algorithm: "RS256",
            expiresIn: 2592000 //30 days
        });

        res.json({
            message: "Success",
            jwtToken: jwtBearerToken,
            expiresIn: 2592000 //30 days
        }).end();
    })
})

app.route("/authenticate").get(authenticateToken);

app.get("*", (req, res) => {
    res.sendStatus(404);
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
