const express = require("express");
// const fs = require("fs");
// const mysql = require("mysql");
const bodyParser = require('body-parser')
const cors = require("cors");
const environment = require("../environment.json");
const port = environment.backEndPort || 7200;

const app = express();

app.use(bodyParser.json());
app.use(cors());

app.post("/register", (req, res) => {
    console.log(req.body)
    res.status(200).json({
        "message": "SUCCESS"
    });
})

app.listen(port, () => {
    console.log(`Listening on port ${port}`)
})
