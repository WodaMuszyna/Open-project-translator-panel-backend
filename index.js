const express = require("express");
const fs = require("fs");
const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;

const app = express();

app.use(bodyParser.json()); 

const router = express.Router()

router.post("/register", register)

app.listen(port, ()=>{
    console.log(`Listening on port ${port}`)
})

function register(req, res, next) {
    let connection = mysql.createConnection({
        host: environment.mysqlHost,
        user: environment.mysqlUser,
        password: environment.mysqlPassword,
        database: environment.mysqlDatabase
    });

    let insertionValues = [null, req.body.username, req.body.password, new Date(), req.body.email, new Date(req.body.birthdate), 0, "Translator", "default-1.png", req.body.languages.join(",")]
    console.log(insertionValues)
    connection.query(`INSERT INTO users VALUES (?)`, [insertionValues], (res, err)=>{
        return
    })
}