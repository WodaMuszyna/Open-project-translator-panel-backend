const express = require("express");
// const fs = require("fs");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;

const app = express();

app.use(bodyParser.json());
app.use(cors());
let connection = new mysql.createConnection({
    host: environment.mysqlHost,
    user: environment.mysqlUser,
    password: environment.mysqlPassword,
    database: environment.mysqlDatabase
})

app.get("/userExists/:username", (req, res)=>{
    if (!req.params.username) return res.status(200).json({exists: false});
    connection.query(`SELECT id FROM users WHERE username="${req.params.username}"`, (err, response)=>{
        if (err) {
            res.status(500);
            res.end();
            return;
        }
        res.status(200);
        if (response.length==0) return res.json({exists: false});
        else res.json({exists: true});
    });
});

app.get("/emailTaken/:email",(req, res)=> {
    if (!req.params.email) return res.status(200).json({taken: false});
    connection.query(`SELECT id FROM users WHERE email="${req.params.email}"`, (err, response)=>{
        if (err) {
            res.status(500);
            res.end();
            return;
        }
        res.status(200);
        if (response.length==0) return res.json({taken: false});
        else res.json({taken: true});
    });
})

app.post("/register", (req, res) => {
    res.status(200).json({
        "message": "SUCCESS"
    });
})

app.get("*", (req, res)=>{
    res.json({});
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
