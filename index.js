const express = require("express");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const mongoose = require("mongoose")
const Log = require("./log.js");

const app = express();

app.use(bodyParser.json());
app.use(cors());

const PRIVATE_KEY = fs.readFileSync('./private.key');

let mysqlConnect = (multipleQueries = false) => {
    return new mysql.createConnection({
        host: environment.mysqlHost,
        user: environment.mysqlUser,
        password: environment.mysqlPassword,
        database: environment.mysqlDatabase,
        multipleStatements: multipleQueries
    });
};

let doMongoose = (fc) => {
    mongoose.connect(environment.mongoUrl, {}).catch(err => { throw err });
    fc();
}


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

app.post("/languageInformation", (req, res) => {
    if (!req.body.language) return res.sendStatus(404);
    mysqlConnect(true).query(`
        SELECT COUNT(stringKey) as allStrings FROM strings;
        SELECT COUNT(DISTINCT stringKey) as translatedStrings FROM translations WHERE languageId="${req.body.language}";
        SELECT COUNT(DISTINCT stringKey) as approvedStrings FROM translations WHERE languageId="${req.body.language}" AND approved=1;
        SELECT COUNT(DISTINCT userId) as contributors FROM translations WHERE languageId="${req.body.language}";
    `, (err, response) => {
        //random crash??
        if (err) { res.sendStatus(500); res.end(); return; }
        res.status(200).json({
            availableStrings: response[0][0].allStrings,
            translatedStrings: response[1][0].translatedStrings,
            approved: response[2][0].approvedStrings,
            numberOfContributors: response[3][0].contributors
        }).end();
    })
});

app.post("/getLanguageExtended", (req, res) => {
    //we are guaranteed to have valid language in db
    mysqlConnect().query(`SELECT * FROM languages where id="${req.body.language}";`, (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; }
        res.status(200).json(response[0]).end();
    });
});

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
    mysqlConnect().query(`INSERT INTO users(id, username, surname, name, password, email, birthdate, blocked, rankId, languages) VALUES (?)`, [insertionValues], (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200).json({
            message: "Success"
        });

        let fc = () => {
            new Log({
                _id: new mongoose.Types.ObjectId(),
                user: response.insertId,
                action: "register",
                actionAppliesTo: response.insertId
            }).save();
        }
        doMongoose(fc);
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

        let fc = () => {
            new Log({
                _id: new mongoose.Types.ObjectId(),
                user: response[0].id,
                action: "login",
                actionAppliesTo: response[0].id
            }).save();
        }
        doMongoose(fc);
    })
})

app.post("/refreshUserInformation", (req, res) => {
    // if (!req.body.jwtToken) return res.status(200).json({});
    let decodedJwtToken = jwt.decode(req.body.jwtToken, { algorithm: "RS256" });
    let timeDifference = parseInt((new Date(Number(req.body.expiresAt)) - new Date()) / 1000);
    mysqlConnect().query(`SELECT username, languages, rankId, blocked, birthdate FROM users WHERE username="${decodedJwtToken.username}";`, (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        const jwtBearerToken = jwt.sign({
            username: response[0].username,
            languages: response[0].languages.split(","),
            rankId: response[0].rankId,
            blocked: response[0].blocked,
            birthdate: response[0].birthdate
        }, PRIVATE_KEY, {
            algorithm: "RS256",
            expiresIn: timeDifference
        });
        res.status(200).json({
            jwtToken: jwtBearerToken
        });
    });
});

app.post("/getFullUserInformation", (req, res) => {
    if (!req.body.username) return;
    mysqlConnect().query(`SELECT id, username, surname, name, creationDate, email, birthdate, blocked, rankId, languages FROM users WHERE username="${req.body.username}";`, (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200).json({
            id: response[0].id,
            username: response[0].username,
            surname: response[0].surname,
            name: response[0].name,
            creationDate: new Date(response[0].creationDate),
            email: response[0].email,
            birthdate: new Date(response[0].birthdate),
            blocked: response[0].blocked,
            rankId: response[0].rankId,
            languages: response[0].languages.split(",")
        }).end();
    })
})


app.route("/authenticate").get((req, res) => {
    const token = req.headers['authorization'];
    if (token == null) return res.sendStatus(401); //we are guaranteed that we have token (front end ngOnInit, translation-panel.component.ts)
    jwt.verify(token, PRIVATE_KEY, { algorithms: 'RS256' }, (err, user) => {
        if (err) return res.status(200).json({ valid: false });
        res.status(200).json({ valid: true });
    });
});

app.post("/getUsers", (req, res) => {
    let whereStatement = "";
    if (req.body.language) whereStatement = `WHERE languages like "%${req.body.language}%"`;
    mysqlConnect().query(`SELECT id, username, rankId, languages FROM users ${whereStatement} ORDER BY rankId DESC;`, (err, response) => {
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200).send(response).end();
    })
})


//strings service

app.route("/getStrings").post((req, res) => {
    if (!req.body.language) { res.sendStatus(200); res.end(); return; }
    let language = req.body.language;
    mysqlConnect(true).query(`  SELECT * FROM strings; 
                                SELECT DISTINCT stringKey FROM translations WHERE languageId="${language}" AND approved=true; 
                                SELECT DISTINCT stringKey FROM translations WHERE languageId="${language}" AND approved=false; `
                                , (err, response)=>{
        let allStrings = response[0].map((o)=>o.stringKey);
        let approvedStrings = response[1].map((o)=>o.stringKey);
        let translatedStrings = response[2].map((o)=>o.stringKey);
        let formattedResponse = new Array();
        for (let i = 0 ; i < allStrings.length;i++) {
            if (approvedStrings.includes(allStrings[i])) {
                formattedResponse.push({
                    stringKey: allStrings[i],
                    stringContent: response[0].find(o=>o.stringKey===allStrings[i]).stringContent,
                    additionalContext: response[0].find(o=>o.stringKey===allStrings[i]).additionalContext || null,
                    status: "approved"
                });
                continue;
            }
            if (translatedStrings.includes(allStrings[i])) {
                formattedResponse.push({
                    stringKey: allStrings[i],
                    stringContent: response[0].find(o=>o.stringKey===allStrings[i]).stringContent,
                    additionalContext: response[0].find(o=>o.stringKey===allStrings[i]).additionalContext || null,
                    status: "translated"
                });
                continue;
            }
            formattedResponse.push({
                stringKey: allStrings[i],
                stringContent: response[0].find(o=>o.stringKey===allStrings[i]).stringContent,
                additionalContext: response[0].find(o=>o.stringKey===allStrings[i]).additionalContext || null,
                status: "pending"
            });
        }
        if (err) { res.sendStatus(500); res.end(); return; };
        res.status(200).json(formattedResponse).end();
        return;
    })
})


app.get("*", (req, res) => {
    res.sendStatus(404);
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
